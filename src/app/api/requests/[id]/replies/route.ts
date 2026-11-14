import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import sharp from "sharp";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { ObjectRequest, RequestReply } from "@/models/ObjectRequest";
import { getOwnershipGate } from "@/lib/agreements";
import { verifyWalletMessage } from "@/lib/walletAuth";
import { replyPrefix } from "@/lib/objectRequests";

/** GET → public reply cards, each with the design's LIVE price and availability. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ replies: [] });
  await connectDb();
  const replies = await RequestReply.find({ requestId: id }).sort({ createdAt: -1 }).lean<{ _id: unknown; designId: unknown }[]>();
  const designs = await Design.find({ _id: { $in: replies.map((r) => r.designId) } }).select("title price status designerWallet").lean<{ _id: unknown; title: string; price: number; status: string }[]>();
  const byId = Object.fromEntries(designs.map((d) => [String(d._id), d]));
  return NextResponse.json({
    replies: replies.map((r) => {
      const d = byId[String(r.designId)];
      return { ...r, design: d ? { title: d.title, price: d.price, available: d.status === "listed" } : { title: "Removed design", price: null, available: false } };
    }),
  });
}

/** POST multipart: designId, designerWallet, message, signature, explanation, kind (manual|ai), mockup image. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const form = await req.formData();
  const designId = String(form.get("designId") ?? "");
  const wallet = String(form.get("designerWallet") ?? "");
  const explanation = String(form.get("explanation") ?? "").trim();
  const kind = String(form.get("kind") ?? "");
  const mockup = form.get("mockup");
  if (!isValidObjectId(designId)) return NextResponse.json({ error: "Pick one of your designs." }, { status: 400 });
  if (!verifyWalletMessage({ wallet, message: String(form.get("message") ?? ""), signature: String(form.get("signature") ?? ""), prefix: replyPrefix(id, designId) }))
    return NextResponse.json({ error: "Please sign with your wallet to send the suggestion." }, { status: 401 });
  if (explanation.length < 10 || explanation.length > 500) return NextResponse.json({ error: "Explain in 10–500 characters why it suits the object." }, { status: 400 });
  if (kind !== "manual" && kind !== "ai") return NextResponse.json({ error: "Missing mockup type." }, { status: 400 });
  if (!(mockup instanceof File) || mockup.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Please create a mockup first." }, { status: 400 });

  await connectDb();
  const [request, design] = await Promise.all([
    ObjectRequest.findById(id).select("status buyerWallet").lean<{ status: string; buyerWallet: string }>(),
    Design.findById(designId).select("designerWallet status").lean<{ designerWallet: string; status: string }>(),
  ]);
  if (!request || request.status !== "open") return NextResponse.json({ error: "This request is no longer open." }, { status: 409 });
  if (!design || design.designerWallet !== wallet) return NextResponse.json({ error: "You can only suggest your own designs." }, { status: 403 });
  if (design.status !== "listed") return NextResponse.json({ error: "That design is no longer available." }, { status: 409 });
  if (request.buyerWallet === wallet) return NextResponse.json({ error: "You can't reply to your own request." }, { status: 400 });
  const gate = await getOwnershipGate(designId);
  if (gate.blockReason) return NextResponse.json({ error: gate.blockReason }, { status: 403 });

  let jpeg: Buffer;
  try {
    jpeg = await sharp(Buffer.from(await mockup.arrayBuffer())).resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "The mockup couldn't be read." }, { status: 400 });
  }
  try {
    const r = await RequestReply.create({ requestId: id, designId, designerWallet: wallet, explanation, mockup: jpeg, mockupKind: kind });
    return NextResponse.json({ id: String(r._id) });
  } catch {
    return NextResponse.json({ error: "You already suggested this design for this request." }, { status: 409 });
  }
}
