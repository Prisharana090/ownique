// 🦜 Ask Ownique as a LangChain Deep Agent (powered by Grok).
// The agent can plan, call Ownique's own tools (search the shop, look up a design,
// read its Solana ownership record, read our terms, read live stats), and look at
// an attached image to check for brand / character look-alikes.
import "server-only";
import { createDeepAgent } from "deepagents";
import { ChatXAI } from "@langchain/xai";
import { tool } from "langchain";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { getStats, hasTiger } from "@/lib/events";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type DesignLean = {
  _id: unknown; title: string; price: number; category: string; status: string;
  designerWallet: string; ownerWallet?: string | null; description?: string; tags?: string[];
  mintAddress?: string | null; txSignature?: string | null; soldAt?: Date | null; createdAt?: Date;
};

// ---------- Tools the agent can use ----------

const searchDesigns = tool(
  async ({ query, category, maxPrice, includeSold }) => {
    if (!hasDb()) return "The shop database isn't connected yet.";
    await connectDb();
    const filter: Record<string, unknown> = { status: includeSold ? { $ne: "hidden" } : "listed" };
    if (category) filter.category = category;
    if (maxPrice) filter.price = { $lte: maxPrice };
    if (query) {
      const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { description: rx }, { tags: rx }];
    }
    const docs = await Design.find(filter).sort({ createdAt: -1 }).limit(8).lean<DesignLean[]>();
    if (!docs.length) return "No designs matched.";
    return docs
      .map((d) => `- "${d.title}" (${d.category}) · ${d.status === "sold" ? "SOLD" : `${d.price} SOL`} · ${SITE()}/design/${String(d._id)}`)
      .join("\n");
  },
  {
    name: "search_designs",
    description: "Search the Ownique shop for designs by keyword, category, and max price.",
    schema: z.object({
      query: z.string().optional().describe("Keywords, e.g. 'waves' or 'minimalist'"),
      category: z.enum(["cup", "glasses", "shirt", "phone case", "tote", "other"]).optional(),
      maxPrice: z.number().optional().describe("Maximum price in SOL"),
      includeSold: z.boolean().optional().describe("Also include designs that already have an owner"),
    }),
  }
);

const getDesign = tool(
  async ({ id }) => {
    if (!hasDb() || !isValidObjectId(id)) return "Design not found.";
    await connectDb();
    const d = await Design.findById(id).lean<DesignLean>();
    if (!d || d.status === "hidden") return "Design not found.";
    return JSON.stringify({
      title: d.title, category: d.category, priceSol: d.price, status: d.status,
      designer: d.designerWallet, owner: d.ownerWallet ?? null, description: d.description, tags: d.tags,
      listedAt: d.createdAt, soldAt: d.soldAt ?? null, link: `${SITE()}/design/${id}`,
    });
  },
  {
    name: "get_design",
    description: "Get full details of one design by its id (the last part of a /design/<id> link).",
    schema: z.object({ id: z.string() }),
  }
);

const ownershipRecord = tool(
  async ({ id }) => {
    if (!hasDb() || !isValidObjectId(id)) return "Design not found.";
    await connectDb();
    const d = await Design.findById(id).lean<DesignLean>();
    if (!d) return "Design not found.";
    return JSON.stringify({
      creator: d.designerWallet,
      createdAt: d.createdAt,
      currentOwner: d.ownerWallet ?? "not sold yet (token held in the Ownique vault)",
      ownershipToken: d.mintAddress ? `https://explorer.solana.com/address/${d.mintAddress}?cluster=devnet` : "not minted",
      purchasePayment: d.txSignature ? `https://explorer.solana.com/tx/${d.txSignature}?cluster=devnet` : null,
    });
  },
  {
    name: "get_ownership_record",
    description: "Get the proof of creation and ownership for a design: creator wallet, date, current owner, and Solana links.",
    schema: z.object({ id: z.string() }),
  }
);

const TERMS: Record<string, string> = {
  ownership:
    "Each design sells exactly once. The buyer gets full ownership; the designer is credited forever but keeps no commercial ownership and can never sell or reuse it again; showing it in a portfolio needs the buyer's separate permission. Buyers get exclusive copyright ownership (subject to the purchase agreement) and the rights to use commercially, reproduce, modify, manufacture and sell products with it. Ownership is recorded on Solana.",
  payment:
    "The ownership token waits in a secure Ownique vault. The buyer pays the designer directly in SOL; Ownique verifies the payment on Solana and only then moves the token to the buyer. Each payment can be used once.",
  copyright:
    "Only upload work you created or have written permission to sell. No copying, tracing or lightly editing others' art. No fan art of characters from movies, shows, games or cartoons. A buyer receives the rights the designer had.",
  trademarks:
    "No brand logos, names, mascots or sports team logos, or anything confusingly similar. Changing colors or a few letters of a famous logo is still not allowed. Ask Ownique is a first check, not a legal trademark search.",
  reporting:
    "Tap Report on a design. Listed designs are hidden immediately while reviewed; valid reports lead to removal, and repeat offenders lose their account.",
  privacy:
    "Ownique stores your wallet address, uploaded designs, agreement times, activity events for the dashboard, and reports. It never stores wallet secrets. Try It On photos and chat messages are not saved. Anything on Solana is public.",
};

const lookupTerms = tool(async ({ topic }) => TERMS[topic], {
  name: "lookup_terms",
  description: "Read Ownique's official terms on a topic before answering policy questions.",
  schema: z.object({ topic: z.enum(["ownership", "payment", "copyright", "trademarks", "reporting", "privacy"]) }),
});

const platformStats = tool(
  async () => {
    if (!hasTiger()) return "Live stats aren't connected.";
    const s = await getStats();
    return JSON.stringify(s.totals);
  },
  {
    name: "get_platform_stats",
    description: "Get live Ownique totals (views, try-ons, sales, SOL earned, blocked copies) from Tiger Data.",
    schema: z.object({}),
  }
);

// ---------- The agent ----------

const SYSTEM = `You are "Ask Ownique", the friendly assistant of Ownique, a design marketplace where every
design sells exactly once: the buyer gets full ownership and the designer is credited forever.

Use your tools instead of guessing:
- Shopping questions → search_designs / get_design (always include the design links you found).
- "Who made this / who owns this / is it real?" → get_ownership_record.
- Policy, copyright, trademark, privacy or payment questions → lookup_terms first.
- Activity questions → get_platform_stats.

When the user attaches an image, check whether it looks like a famous brand logo, trademark, mascot,
cartoon/movie/game character, sports team logo, or a well-known artwork. Start that answer with exactly one line:
"Verdict: ✅ Looks original", "Verdict: ⚠️ Similar to <name>" or "Verdict: 🚫 Matches <name>",
then 1-3 short sentences on what looks similar and how to make it more original. Never help copy or disguise a protected logo.

Style: short, warm, simple words, no legal jargon. You are not a lawyer and this is not a legal trademark search.
For simple questions, answer directly without planning or writing files.`;

let agentCache: ReturnType<typeof createDeepAgent> | null = null;
function getAgent() {
  agentCache ??= createDeepAgent({
    model: new ChatXAI({
      model: process.env.GROK_MODEL || "grok-4.7",
      apiKey: process.env.XAI_API_KEY,
      temperature: 0.3,
    }),
    tools: [searchDesigns, getDesign, ownershipRecord, lookupTerms, platformStats],
    systemPrompt: SYSTEM,
  });
  return agentCache;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) => (typeof c === "string" ? c : (c as { type?: string; text?: string }).type === "text" ? (c as { text: string }).text : ""))
      .join("");
  return "";
}

export async function runOwniqueAgent(messages: ChatMessage[], imageDataUrl?: string | null) {
  const history: { role: string; content: unknown }[] = messages
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (imageDataUrl && history.length && history[history.length - 1].role === "user") {
    const last = history.pop()!;
    history.push({
      role: "user",
      content: [
        { type: "text", text: (last.content as string) || "Is this design original, or does it look like a famous brand logo?" },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    });
  }
  const result = await getAgent().invoke({ messages: history } as never, { recursionLimit: 25 });
  const out = (result as { messages: { content: unknown; getType?: () => string }[] }).messages;
  for (let i = out.length - 1; i >= 0; i--) {
    const t = textOf(out[i].content).trim();
    if (t && (!out[i].getType || out[i].getType!() === "ai")) return t;
  }
  return "Sorry, I didn't catch that. Could you ask again?";
}
