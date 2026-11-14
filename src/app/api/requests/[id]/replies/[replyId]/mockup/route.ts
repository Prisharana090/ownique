import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { RequestReply } from "@/models/ObjectRequest";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const { id, replyId } = await params;
  if (!hasDb() || !isValidObjectId(id) || !isValidObjectId(replyId)) return new Response("Not found", { status: 404 });
  await connectDb();
  const r = await RequestReply.findOne({ _id: replyId, requestId: id }).select("+mockup").lean<{ mockup: unknown }>();
  if (!r) return new Response("Not found", { status: 404 });
  const raw = r.mockup as Buffer | { buffer: Uint8Array };
  return new Response(new Uint8Array(Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
  });
}
