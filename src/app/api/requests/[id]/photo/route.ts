import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { ObjectRequest } from "@/models/ObjectRequest";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDb();
  const r = await ObjectRequest.findById(id).select("+photo").lean<{ photo: unknown }>();
  if (!r) return new Response("Not found", { status: 404 });
  const raw = r.photo as Buffer | { buffer: Uint8Array };
  return new Response(new Uint8Array(Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
  });
}
