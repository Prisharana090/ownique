// "Ask Ownique": an AI helper (Gemini free tier, or Grok if XAI_API_KEY is set) that answers questions about the marketplace
// and checks uploaded images for look-alikes of famous brand logos and characters.
import "server-only";
import { runOwniqueAgent } from "@/lib/ownique-agent";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { usd } from "@/lib/price";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are "Ask Ownique", the friendly helper of Ownique, a design marketplace where every design
is sold exactly once: the buyer gets full ownership, the designer is credited forever, and sold designs can
never be listed again. Ownership is recorded on Solana (devnet). Prices are shown in US dollars and paid in SOL on devnet.

Your two jobs:
1. Answer questions about how Ownique works (selling, buying, Try It On, ownership, reports, policy).
2. Help designers stay original. When the user shares an image, check whether it looks like a famous
   brand logo, trademark, mascot, cartoon/movie/game character, sports team logo, or a well-known artwork.
   Start that answer with one line: "Verdict: ✅ Looks original", "Verdict: ⚠️ Similar to <name>" or
   "Verdict: 🚫 Matches <name>". Then explain in 1-3 short sentences what looks similar and how to make it
   more original (change shapes, colors, lettering, layout). Never help someone copy or disguise a protected logo.

Rules: keep replies short, warm and simple (no legal jargon). You are not a lawyer and this is not a legal
trademark search, so for anything serious suggest checking official sources (e.g. the USPTO trademark search).
If asked about something unrelated to Ownique or design, politely steer back.`;

export async function askOwnique(messages: ChatMessage[], imageDataUrl?: string | null) {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    if (!process.env.GEMINI_API_KEY)
      return "I'm not switched on yet: add GEMINI_API_KEY (free) or XAI_API_KEY to .env.local and I'll be ready to help! 💜";
    // Free path: the LangChain Deep Agent (with Ownique tools) running on Gemini's free tier,
    // falling back to a direct Gemini call if the agent fails (e.g. Google is briefly busy).
    try {
      return await runOwniqueAgent(messages, imageDataUrl);
    } catch (err) {
      console.error("Deep Agent (Gemini) failed, falling back to plain Gemini:", (err as Error).message);
      return askGemini(messages, imageDataUrl);
    }
  }

  // 🦜 Main path: the LangChain Deep Agent (with Ownique tools). Falls back to a plain Grok call if it fails.
  try {
    return await runOwniqueAgent(messages, imageDataUrl);
  } catch (err) {
    console.error("Deep Agent failed, falling back to plain Grok:", (err as Error).message);
  }

  const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  // Attach the image to the latest user message so Grok can look at it.
  if (imageDataUrl && history.length && history[history.length - 1].role === "user") {
    const last = history.pop()!;
    history.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        { type: "text", text: last.content || "Is this design original, or does it look like a famous brand logo?" },
      ],
    } as never);
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-4.7",
      messages: [{ role: "system", content: SYSTEM }, ...history],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Ask Ownique (Grok) error:", res.status, body.slice(0, 300));
    if (res.status === 401 || res.status === 403)
      return "I can't reach Grok right now: the API key or credits need attention. Please try again later!";
    return "Sorry, I had trouble thinking just now. Please try again in a moment.";
  }
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "Sorry, I didn't catch that. Could you ask again?");
}

// ---------- Gemini (free tier) ----------

/** Current listings, so Gemini can answer "what's for sale under $70?" without tool calls. */
async function shopSnapshot() {
  if (!hasDb()) return "The shop database isn't connected.";
  try {
    await connectDb();
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const docs = await Design.find({ status: { $in: ["listed", "sold"] } }).sort({ createdAt: -1 }).limit(40)
      .select("title category price status description").lean<{ _id: unknown; title: string; category: string; price: number; status: string; description?: string }[]>();
    if (!docs.length) return "No designs are listed yet.";
    return docs.map((d) => `- "${d.title}" (${d.category}) · ${d.status === "sold" ? "SOLD, already owned" : usd(d.price)} · ${site}/design/${String(d._id)}${d.description ? ` · ${d.description.slice(0, 120)}` : ""}`).join("\n");
  } catch {
    return "The shop list couldn't be loaded right now.";
  }
}

async function askGemini(messages: ChatMessage[], imageDataUrl?: string | null) {
  const contents = messages.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content.slice(0, 2000) }] as Record<string, unknown>[],
  }));
  const last = contents[contents.length - 1];
  const img = imageDataUrl?.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (img && last?.role === "user") {
    last.parts.unshift({ inline_data: { mime_type: img[1], data: img[2] } });
    if (!messages[messages.length - 1].content.trim()) last.parts.push({ text: "Is this design original, or does it look like a famous brand logo?" });
  }
  const system = `${SYSTEM}\n\nWhen recommending designs, only use this live shop list. Designs marked SOLD can't be bought. Write plain text with no markdown (no asterisks, no [text](url) links). List each design on its own line as: • Title · $price · link (paste the link as-is).\n${await shopSnapshot()}`;

  const models = ([process.env.GEMINI_CHAT_MODEL, "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-flash-latest"].filter(Boolean)) as string[]; // busy (503) models get a second try at the end
  const errors: string[] = [];
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 700, temperature: 0.6 } }),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        errors.push(`${model} ${res.status}: ${detail}`);
        console.error("Ask Ownique (Gemini) error:", model, res.status, detail);
        if (res.status === 404) continue; // model name not available for this key, try the next one
        if (res.status === 429) return "I'm getting a lot of questions right now. Please try again in a minute! 💜";
        if (res.status === 503) await new Promise((r) => setTimeout(r, 800)); // Google busy: brief pause
        continue; // try the next model
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
      if (text) return text;
    } catch (err) {
      errors.push(`${model}: ${(err as Error).message}`);
      console.error("Ask Ownique (Gemini) failed:", model, (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
  // In local development only, show why (never includes the key) so setup problems are easy to fix.
  if (process.env.NODE_ENV === "development") return `Sorry, I can't reach Gemini right now. (dev details: ${errors.join(" | ").slice(0, 600)})`;
  return "Sorry, I can't reach my brain right now. Please try again in a moment.";
}
