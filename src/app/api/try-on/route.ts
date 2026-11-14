import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { hasGemini, renderTryOn, suggestPlacement } from "@/lib/gemini";
import { logEvent } from "@/lib/events";

export const maxDuration = 60;

// POST /api/try-on (multipart: product image + designId) → realistic preview made by Gemini
export async function POST(req: Request) {
  if (!hasGemini()) return NextResponse.json({ error: "Add GEMINI_API_KEY to .env.local to use the AI preview." }, { status: 503 });
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });

  const form = await req.formData();
  const product = form.get("product");
  const designId = String(form.get("designId") ?? "");
  if (!(product instanceof File) || !product.type.startsWith("image/"))
    return NextResponse.json({ error: "Please upload a photo of your product." }, { status: 400 });
  if (product.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Photo must be under 5MB." }, { status: 400 });
  if (!isValidObjectId(designId)) return NextResponse.json({ error: "Pick a design first." }, { status: 400 });

  await connectDb();
  const d = await Design.findById(designId).select("+imageData imageType").lean<{ imageData: unknown; imageType: string }>();
  if (!d) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  const raw = d.imageData as Buffer | { buffer: Uint8Array };
  const designBytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);

  const productImg = { data: Buffer.from(await product.arrayBuffer()), mimeType: product.type };
  const designImg = { data: designBytes, mimeType: d.imageType };

  // 1) Best: a photorealistic render (needs a billing-enabled Gemini project).
  try {
    const out = await renderTryOn(productImg, designImg);
    logEvent("try_on", { designId });
    return NextResponse.json({ image: `data:${out.mimeType};base64,${out.data}` });
  } catch (err) {
    console.warn("Gemini image render unavailable, using smart placement:", (err as Error).message.slice(0, 120));
  }

  // 2) Free tier: Gemini looks at both images and places the design for you.
  try {
    const placement = await suggestPlacement(productImg, designImg);
    logEvent("try_on", { designId });
    return NextResponse.json({ placement });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gemini is busy right now. Try again in a moment." }, { status: 502 });
  }
}
