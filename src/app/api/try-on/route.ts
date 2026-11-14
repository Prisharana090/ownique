import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import sharp from "sharp";
import { connectDb, hasDb } from "@/lib/db";
import { hasGemini, renderTryOn } from "@/lib/gemini";
import { loadOriginal, watermark } from "@/lib/designImage";
import { logEvent } from "@/lib/events";

export const maxDuration = 60;

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const num = (v: FormDataEntryValue | null, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** GET → is AI generation configured? (lets the page explain it before anyone uploads) */
export async function GET() {
  return NextResponse.json({ ai: hasGemini() });
}

/**
 * POST /api/try-on (multipart: product photo, designId, x, y, size, rotation)
 * Sends the product photo, the WATERMARKED preview artwork (never the private original) and a placement guide
 * to Gemini's image model. Only a real Gemini image is returned as a result: no fake/overlay fallback.
 */
export async function POST(req: Request) {
  if (!hasGemini()) return NextResponse.json({ error: "AI try-on isn't set up on this server (missing Gemini key). Your manual preview still works.", code: "not_configured" }, { status: 503 });
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });

  const form = await req.formData();
  const product = form.get("product");
  const designId = String(form.get("designId") ?? "");
  if (!(product instanceof File) || !TYPES.includes(product.type))
    return NextResponse.json({ error: "Please upload a JPG, PNG or WebP photo of your product." }, { status: 400 });
  if (product.size > MAX_BYTES) return NextResponse.json({ error: "Photo must be under 5MB." }, { status: 400 });
  if (!isValidObjectId(designId)) return NextResponse.json({ error: "Pick a design first." }, { status: 400 });
  const x = num(form.get("x"), 0, 100, 50), y = num(form.get("y"), 0, 100, 50);
  const size = num(form.get("size"), 5, 100, 35), rotation = num(form.get("rotation"), -180, 180, 0);

  // Decode for real (rejects files that only pretend to be images) and normalise orientation/size.
  let photo: Buffer, w: number, h: number;
  try {
    const { data, info } = await sharp(Buffer.from(await product.arrayBuffer()))
      .rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    photo = data; w = info.width; h = info.height;
  } catch {
    return NextResponse.json({ error: "That file couldn't be read as an image. Try another photo." }, { status: 400 });
  }

  await connectDb();
  const d = await loadOriginal(designId);
  if (!d || d.status === "hidden") return NextResponse.json({ error: "Design not found." }, { status: 404 });
  const artwork = await watermark(d.bytes); // authorized preview only; watermark preserved

  // Placement guide: the user's manual layout, drawn on the photo, so Gemini knows exactly where it goes.
  const artW = Math.max(16, Math.round((size / 100) * w));
  const placed = await sharp(artwork).resize({ width: artW }).rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
  const left = Math.round((x / 100) * w - placed.info.width / 2), top = Math.round((y / 100) * h - placed.info.height / 2);
  const crop = { left: Math.max(0, -left), top: Math.max(0, -top) };
  const visW = Math.min(placed.info.width - crop.left, w - Math.max(0, left)), visH = Math.min(placed.info.height - crop.top, h - Math.max(0, top));
  let guide = photo;
  if (visW > 0 && visH > 0) {
    const piece = await sharp(placed.data).extract({ left: crop.left, top: crop.top, width: visW, height: visH }).toBuffer();
    guide = await sharp(photo).composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]).jpeg({ quality: 85 }).toBuffer();
  }

  try {
    const out = await renderTryOn(
      { data: photo, mimeType: "image/jpeg" },
      { data: artwork, mimeType: "image/jpeg" },
      { data: guide, mimeType: "image/jpeg" },
      { x, y, size, rotation }
    );
    logEvent("try_on", { designId });
    return NextResponse.json({ image: `data:${out.mimeType};base64,${out.data}` });
  } catch (err) {
    const status = (err as { status?: number }).status;
    console.warn("Gemini try-on failed:", (err as Error).message.slice(0, 200));
    if (status === 429 || status === 403)
      return NextResponse.json({ error: "Gemini's image model isn't available on this API key right now (quota or billing). Your manual preview still works.", code: "unavailable" }, { status: 503 });
    return NextResponse.json({ error: "Gemini couldn't make the preview this time. Please try again.", code: "failed" }, { status: 502 });
  }
}
