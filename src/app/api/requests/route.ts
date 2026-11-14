import { NextResponse } from "next/server";
import sharp from "sharp";
import { connectDb, hasDb } from "@/lib/db";
import { ObjectRequest, RequestReply } from "@/models/ObjectRequest";
import { verifyWalletMessage } from "@/lib/walletAuth";
import { MATERIALS, POST_PREFIX } from "@/lib/objectRequests";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** GET → open requests with reply counts (newest first). */
export async function GET() {
  if (!hasDb()) return NextResponse.json({ requests: [] });
  await connectDb();
  const list = await ObjectRequest.find({ status: "open" }).sort({ createdAt: -1 }).limit(60).lean<{ _id: unknown }[]>();
  const counts = await RequestReply.aggregate([{ $match: { requestId: { $in: list.map((r) => r._id) } } }, { $group: { _id: "$requestId", n: { $sum: 1 } } }]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return NextResponse.json({ requests: list.map((r) => ({ ...r, replies: byId[String(r._id)] ?? 0 })) });
}

/** POST multipart: photo, material, style, budget, wallet, message, signature → new "Open to ideas" request. */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const form = await req.formData();
  const wallet = String(form.get("wallet") ?? "");
  if (!verifyWalletMessage({ wallet, message: String(form.get("message") ?? ""), signature: String(form.get("signature") ?? ""), prefix: POST_PREFIX }))
    return NextResponse.json({ error: "Please sign with your wallet to post." }, { status: 401 });
  const photo = form.get("photo");
  const material = String(form.get("material") ?? "");
  const style = String(form.get("style") ?? "").trim().slice(0, 200);
  const budgetRaw = String(form.get("budget") ?? "").trim();
  const budget = budgetRaw ? Number(budgetRaw) : null;
  if (!(photo instanceof File) || !TYPES.includes(photo.type) || photo.size > 8 * 1024 * 1024)
    return NextResponse.json({ error: "Please add a JPG, PNG or WebP photo under 8MB." }, { status: 400 });
  if (!MATERIALS.includes(material as (typeof MATERIALS)[number])) return NextResponse.json({ error: "Please choose a material." }, { status: 400 });
  if (budget !== null && !(budget > 0 && budget < 1e6)) return NextResponse.json({ error: "Budget must be a positive number of SOL." }, { status: 400 });
  let jpeg: Buffer;
  try {
    // Re-encode: removes hidden metadata such as GPS location.
    jpeg = await sharp(Buffer.from(await photo.arrayBuffer())).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "That photo couldn't be read." }, { status: 400 });
  }
  await connectDb();
  const r = await ObjectRequest.create({ buyerWallet: wallet, photo: jpeg, material, style, budgetSol: budget });
  return NextResponse.json({ id: String(r._id) });
}
