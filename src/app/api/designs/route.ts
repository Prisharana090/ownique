import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { connectDb, hasDb } from "@/lib/db";
import { Design, CATEGORIES } from "@/models/Design";
import { describeWithGrok } from "@/lib/grok";
import { hasVault, mintDesignToken } from "@/lib/solana";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

// GET /api/designs → all visible designs (without image bytes)
export async function GET() {
  if (!hasDb()) return NextResponse.json({ designs: [] });
  await connectDb();
  const designs = await Design.find({ status: { $ne: "hidden" } }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ designs });
}

// POST /api/designs (multipart form) → uploads a new design
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "Add MONGODB_URI to .env.local first." }, { status: 503 });

  const form = await req.formData();
  const file = form.get("image");
  const title = String(form.get("title") ?? "").trim();
  const price = Number(form.get("price"));
  const category = String(form.get("category") ?? "other");
  const designerWallet = String(form.get("designerWallet") ?? "");
  const agreed = form.get("agreed") === "true";

  if (!(file instanceof File)) return NextResponse.json({ error: "Please choose an image." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 2MB." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Please add a title." }, { status: 400 });
  if (!(price > 0)) return NextResponse.json({ error: "Price must be more than 0 SOL." }, { status: 400 });
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number]))
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  if (!designerWallet) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });
  if (!agreed) return NextResponse.json({ error: "Please agree to all the confirmations." }, { status: 400 });

  await connectDb();
  const bytes = Buffer.from(await file.arrayBuffer());

  // 🚫 Starter copy check: blocks exact duplicates.
  // TODO (Prompt 9): upgrade to perceptual hash + Gemini so edited copies are caught too.
  const imageHash = createHash("sha256").update(bytes).digest("hex");
  const existing = await Design.findOne({ imageHash }).lean();
  if (existing)
    return NextResponse.json(
      { error: "🚫 This design looks like one that's already owned. Sold designs can't be listed again." },
      { status: 409 }
    );

  const grok = await describeWithGrok(title, category);

  const design = await Design.create({
    title,
    price,
    category,
    imageData: bytes,
    imageType: file.type,
    imageHash,
    designerWallet,
    description: grok.description,
    tags: grok.tags,
    describedByGrok: grok.byGrok,
    agreedAt: new Date(),
  });

  // ⛓️ Mint the 1-of-1 ownership token on Solana (held by the vault until someone buys it).
  // If Solana isn't set up yet, the design still lists so you can keep building.
  if (hasVault()) {
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      design.mintAddress = await mintDesignToken({
        name: title,
        uri: `${site}/api/designs/${design._id}/metadata`,
        designerWallet,
      });
      await design.save();
    } catch (err) {
      console.error("Minting failed (design still listed):", err);
    }
  }

  return NextResponse.json({ ok: true, id: String(design._id), mintAddress: design.mintAddress });
}
