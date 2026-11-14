import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import sharp from "sharp";
import { connectDb, hasDb } from "@/lib/db";
import { loadOriginal, watermark } from "@/lib/designImage";
import { AiUsage } from "@/models/AiUsage";
import { AiError, editWithFlux, hasCloudflareAi } from "@/lib/cloudflareAi";
import { logEvent } from "@/lib/events";

export const maxDuration = 90;

// Conservative caps, well inside Cloudflare's free 10,000 neurons/day (one request ≈ 4 output + 3 input tiles).
const DAILY_CAP = Number(process.env.AI_PREVIEW_DAILY_CAP || 20);
const PER_CLIENT_DAILY = 5;
const COOLDOWN_MS = 30_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const clients = new Map<string, { day: string; count: number; last: number; busy: boolean }>();
const today = () => new Date().toISOString().slice(0, 10);

const PROMPT =
  "Image 0 is the product photo. Image 1 is the customized artwork. Image 2 shows the placement of the artwork on the " +
  "selected print area. Apply this artwork as a print on the selected product surface. Follow the fabric's folds, " +
  "perspective, lighting, and shadows. Preserve the artwork's identity and colors. Do not add a rectangular background " +
  "or alter anything outside the selected print area. Treat the artwork as a flat printed graphic only: never turn its " +
  "contents into real objects (floral artwork stays printed on a vase and must not become real flowers). " +
  "Keep the same framing, camera angle and composition as image 0.";

async function toRef(buf: Buffer) {
  return sharp(buf).rotate().resize(512, 512, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
}

/** GET → is the AI preview set up, and how many are left today (whole site)? */
export async function GET() {
  if (!hasCloudflareAi() || !hasDb()) return NextResponse.json({ available: false, remaining: 0 });
  await connectDb();
  const u = await AiUsage.findOne({ day: today() }).lean<{ count: number }>();
  return NextResponse.json({ available: true, remaining: Math.max(0, DAILY_CAP - (u?.count ?? 0)) });
}

/** POST multipart: product (photo), guide (the browser-made mockup), designId → AI-generated image. */
export async function POST(req: Request) {
  if (!hasCloudflareAi()) return NextResponse.json({ error: "AI-Enhanced Preview isn't set up on this server yet.", code: "config" }, { status: 503 });
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });

  // Per-visitor limits: one at a time, 30s apart, 5 per day.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const c = clients.get(ip);
  const now = Date.now(), day = today();
  const state = c && c.day === day ? c : { day, count: 0, last: 0, busy: false };
  if (state.busy) return NextResponse.json({ error: "Your AI preview is already being made." }, { status: 429 });
  if (now - state.last < COOLDOWN_MS) return NextResponse.json({ error: "Please wait 30 seconds between AI previews." }, { status: 429 });
  if (state.count >= PER_CLIENT_DAILY) return NextResponse.json({ error: "You've used today's AI previews. Your manual mockup still works.", code: "exhausted" }, { status: 429 });

  const form = await req.formData();
  const product = form.get("product"), guide = form.get("guide");
  const designId = String(form.get("designId") ?? "");
  if (!(product instanceof File) || !TYPES.includes(product.type) || product.size > MAX_BYTES)
    return NextResponse.json({ error: "Please use a JPG, PNG or WebP photo under 10MB." }, { status: 400 });
  if (!(guide instanceof File) || guide.size > 3 * 1024 * 1024) return NextResponse.json({ error: "Please place the design first." }, { status: 400 });
  if (!isValidObjectId(designId)) return NextResponse.json({ error: "Pick a design first." }, { status: 400 });

  const maskFile = form.get("mask");
  if (!(maskFile instanceof File) || maskFile.type !== "image/png" || maskFile.size > 2 * 1024 * 1024)
    return NextResponse.json({ error: "Please place the design first." }, { status: 400 });

  let refs: Buffer[], w: number, h: number, base: Buffer, alpha: Buffer;
  try {
    const photo = Buffer.from(await product.arrayBuffer());
    const meta = await sharp(photo).rotate().metadata();
    const pw = meta.autoOrient?.width ?? meta.width ?? 1024, ph = meta.autoOrient?.height ?? meta.height ?? 1024;
    const s = 1024 / Math.max(pw, ph); // output ≤1024 on the long side, multiples of 16
    w = Math.max(256, Math.round((pw * s) / 16) * 16); h = Math.max(256, Math.round((ph * s) / 16) * 16);
    await connectDb();
    const d = await loadOriginal(designId);
    if (!d || d.status === "hidden") return NextResponse.json({ error: "Design not found." }, { status: 404 });
    // Authorized watermarked preview only. If the visitor recolored it in Try It On, use their customized copy
    // (made in the browser from the watermarked preview) and stamp the watermark again on the server.
    const custom = form.get("artwork");
    const useCustom = custom instanceof File && custom.size > 0 && custom.size <= 3 * 1024 * 1024 && TYPES.includes(custom.type);
    const art = await watermark(useCustom ? Buffer.from(await custom.arrayBuffer()) : d.bytes);
    refs = await Promise.all([toRef(photo), toRef(art), toRef(Buffer.from(await guide.arrayBuffer()))]);
    // Original photo at output size, and the print-area mask as a softly feathered alpha channel.
    base = await sharp(photo).rotate().resize(w, h, { fit: "fill" }).removeAlpha().toBuffer();
    alpha = await sharp(Buffer.from(await maskFile.arrayBuffer())).resize(w, h, { fit: "fill" }).greyscale().blur(2).extractChannel(0).raw().toBuffer();
  } catch {
    return NextResponse.json({ error: "That photo couldn't be read. Try another image." }, { status: 400 });
  }

  // Site-wide daily cap (counted before calling, so failures still count and nothing retries automatically).
  const usage = await AiUsage.findOneAndUpdate({ day }, { $inc: { count: 1 } }, { upsert: true, new: true }).lean<{ count: number }>();
  if ((usage?.count ?? 0) > DAILY_CAP)
    return NextResponse.json({ error: "Today's AI previews are used up. They reset at midnight UTC. Your manual mockup still works.", code: "exhausted" }, { status: 429 });

  state.busy = true; state.last = now; state.count += 1;
  clients.set(ip, state);
  try {
    const image = await editWithFlux({ prompt: PROMPT, images: refs, width: w, height: h });
    // Boundaries are enforced here, not by the prompt: the AI pixels are only kept inside the print area;
    // everything outside it is the untouched original photo.
    const rgb = await sharp(Buffer.from(image, "base64")).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();
    const edited = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
      .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
    const out = await sharp(base).composite([{ input: edited }]).removeAlpha().jpeg({ quality: 90 }).toBuffer();
    logEvent("try_on", { designId });
    return NextResponse.json({ image: `data:image/jpeg;base64,${out.toString("base64")}` });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("The AI preview couldn't be created.", "failed");
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "exhausted" ? 429 : err.code === "config" ? 503 : 502 });
  } finally {
    state.busy = false;
  }
}
