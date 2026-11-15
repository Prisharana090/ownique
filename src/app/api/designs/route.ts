import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { connectDb, hasDb } from "@/lib/db";
import { Design, CATEGORIES } from "@/models/Design";
import { describeWithGrok } from "@/lib/grok";
import { hasVault, mintDesignToken } from "@/lib/solana";
import { dHash, hammingDistance } from "@/lib/imageHash";
import { hasGemini, isSameDesign } from "@/lib/gemini";
import { logEvent } from "@/lib/events";
import { checkDeclaration, readDeclaration, recordDeclaration } from "@/lib/agreements";
import { getSessionAccount } from "@/lib/auth";
import { CURRENCIES, LIMITS, MATERIALS, STYLES, type Currency } from "@/lib/designOptions";
import { usdToSol } from "@/lib/price";
import { watermark } from "@/lib/designImage";
import sharp from "sharp";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const BLOCK_MESSAGE = "🚫 This design looks like one that's already owned. Sold designs can't be listed again.";
const LOOKS_IDENTICAL = 6; // bits different out of 64 → definitely a copy
const MAYBE_COPY = 14; // in between → ask Gemini to decide

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

  // 🔐 Designer accounts only: checked before anything else.
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in with a Designer account to list designs." }, { status: 401 });
  if (me.role !== "designer") return NextResponse.json({ error: "Only Designer accounts can list designs." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 400 });
  const file = form.get("image");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const currency = String(form.get("currency") ?? "USD") as Currency;
  const listPrice = Number(form.get("price")); // in the chosen currency
  const category = String(form.get("category") ?? "other");
  const style = String(form.get("style") ?? "other");
  const material = String(form.get("material") ?? "any");
  const isDemo = form.get("isDemo") === "true";
  const designerWallet = String(form.get("designerWallet") ?? "");
  const agreed = form.get("agreed") === "true";
  const declaration = readDeclaration(form, designerWallet);

  if (!(file instanceof File)) return NextResponse.json({ error: "Please choose an image." }, { status: 400 });
  if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Artwork must be a PNG, JPG or WebP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 2MB." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Please add a title." }, { status: 400 });
  if (title.length > LIMITS.title) return NextResponse.json({ error: `Title must be ${LIMITS.title} characters or fewer.` }, { status: 400 });
  if (description.length > LIMITS.description) return NextResponse.json({ error: `Description must be ${LIMITS.description} characters or fewer.` }, { status: 400 });
  if (!CURRENCIES.includes(currency)) return NextResponse.json({ error: "Choose USD or SOL." }, { status: 400 });
  const maxPrice = currency === "SOL" ? LIMITS.maxPriceSol : LIMITS.maxPriceUsd;
  if (!(listPrice > 0) || listPrice > maxPrice) return NextResponse.json({ error: `Price must be more than 0 and at most ${currency === "SOL" ? `${maxPrice} SOL` : `$${maxPrice.toLocaleString()}`}.` }, { status: 400 });
  const price = currency === "SOL" ? Math.round(listPrice * 1e6) / 1e6 : usdToSol(listPrice); // stored in SOL
  if (!(price > 0)) return NextResponse.json({ error: "That price is too small." }, { status: 400 });
  if (!(STYLES as readonly string[]).includes(style)) return NextResponse.json({ error: "Unknown style." }, { status: 400 });
  if (!(MATERIALS as readonly string[]).includes(material)) return NextResponse.json({ error: "Unknown material." }, { status: 400 });
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number]))
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  if (!designerWallet) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });
  // 🔐 The listing must use the wallet linked to this Designer account.
  if (me.walletAddress !== designerWallet)
    return NextResponse.json({ error: "Link this wallet to your Designer account (on your profile) before listing." }, { status: 403 });
  if (!agreed) return NextResponse.json({ error: "Please agree to all the confirmations." }, { status: 400 });
  // ✍️ Designer Ownership Transfer Declaration: legal name + review + accept + authority, signed with the wallet
  // (so nobody can list designs in someone else's name, and the acceptance is tied to this exact wording).
  const declarationError = checkDeclaration(declaration);
  if (declarationError) return NextResponse.json({ error: declarationError }, { status: 400 });

  await connectDb();
  const bytes = Buffer.from(await file.arrayBuffer());

  // Make sure it really is a readable image (not just a renamed file) and big enough to print.
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) throw new Error("no size");
    if (meta.width < 200 || meta.height < 200) return NextResponse.json({ error: "Artwork must be at least 200×200 pixels." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "We couldn't read that image. Try a PNG or JPG." }, { status: 400 });
  }

  // 🚫 Copy detector, step 1: exact same file.
  const imageHash = createHash("sha256").update(bytes).digest("hex");
  if (await Design.exists({ imageHash })) {
    logEvent("blocked_upload", { wallet: designerWallet });
    return NextResponse.json({ error: BLOCK_MESSAGE }, { status: 409 });
  }

  // 🚫 Step 2: looks the same (resized, recompressed, slightly edited).
  let hash: string | null = null;
  try {
    hash = await dHash(bytes);
  } catch {
    return NextResponse.json({ error: "We couldn't read that image. Try a PNG or JPG." }, { status: 400 });
  }
  const others = await Design.find({ dHash: { $ne: null } }).select("dHash").lean<{ _id: unknown; dHash: string }[]>();
  let closest: { id: unknown; distance: number } | null = null;
  for (const o of others) {
    const distance = hammingDistance(hash, o.dHash);
    if (!closest || distance < closest.distance) closest = { id: o._id, distance };
  }
  if (closest && closest.distance <= LOOKS_IDENTICAL) {
    logEvent("blocked_upload", { wallet: designerWallet });
    return NextResponse.json({ error: BLOCK_MESSAGE }, { status: 409 });
  }

  // 🤖 Step 3: borderline? Gemini compares the two images and decides.
  if (closest && closest.distance <= MAYBE_COPY && hasGemini()) {
    try {
      const other = await Design.findById(closest.id).select("+imageData imageType").lean<{ imageData: unknown; imageType: string }>();
      if (other) {
        const raw = other.imageData as Buffer | { buffer: Uint8Array };
        const otherBytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);
        const verdict = await isSameDesign({ data: bytes, mimeType: file.type }, { data: otherBytes, mimeType: other.imageType });
        if (verdict.same) {
          logEvent("blocked_upload", { wallet: designerWallet });
          return NextResponse.json({ error: `${BLOCK_MESSAGE} (Gemini: ${verdict.reason})` }, { status: 409 });
        }
      }
    } catch (err) {
      console.error("Gemini copy check failed, allowing upload:", err);
    }
  }

  // Designer's own description wins; Grok only fills in when it's empty (and xAI is configured).
  const grok = description ? { description, tags: [] as string[], byGrok: false } : await describeWithGrok(title, category);
  const tags = [...new Set([...grok.tags, style, category].filter((t) => t && t !== "other"))].slice(0, 8);

  // Watermarked public preview, made once now; the original file stays private.
  let previewData: Buffer;
  try {
    previewData = await watermark(bytes);
  } catch {
    return NextResponse.json({ error: "We couldn't make a preview of that image. Try a PNG or JPG." }, { status: 400 });
  }

  const design = await Design.create({
    title,
    price,
    category: category as (typeof CATEGORIES)[number],
    currency,
    style,
    material,
    isDemo,
    previewData,
    imageData: bytes,
    imageType: file.type,
    imageHash,
    dHash: hash,
    designerWallet,
    description: grok.description,
    tags,
    describedByGrok: grok.byGrok,
    agreedAt: new Date(),
  });

  // 📜 Save the declaration (designer user id, legal name, design id, version, timestamp, status)
  try {
    await recordDeclaration(String(design._id), declaration);
  } catch (err) {
    await Design.deleteOne({ _id: design._id });
    console.error("Saving the declaration failed:", err);
    return NextResponse.json({ error: "We couldn't save your ownership declaration. Please try again." }, { status: 500 });
  }

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

  logEvent("upload", { designId: String(design._id), wallet: designerWallet });
  return NextResponse.json({ ok: true, id: String(design._id), mintAddress: design.mintAddress });
}
