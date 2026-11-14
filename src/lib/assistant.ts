// "Ask Ownique": a Grok-powered helper that answers questions about the marketplace
// and checks uploaded images for look-alikes of famous brand logos and characters.
import "server-only";
import { runOwniqueAgent } from "@/lib/ownique-agent";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are "Ask Ownique", the friendly helper of Ownique, a design marketplace where every design
is sold exactly once: the buyer gets full ownership, the designer is credited forever, and sold designs can
never be listed again. Ownership is recorded on Solana (devnet). Prices are in SOL.

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
  if (!key)
    return "I'm not switched on yet: add XAI_API_KEY to .env.local and I'll be ready to help! 💜";

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
