import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { isValidObjectId } from "mongoose";

// GET /api/designs/:id/image → the design's image
// TODO (Prompt 3 upgrade): serve a watermarked preview here, full image only to the owner.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDb();
  const d = await Design.findById(id).select("+imageData imageType").lean<{ imageData: unknown; imageType: string }>();
  if (!d) return new Response("Not found", { status: 404 });
  // .lean() returns raw BSON Binary instead of a Buffer, so convert safely.
  const raw = d.imageData as Buffer | { buffer: Uint8Array };
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": d.imageType, "Cache-Control": "public, max-age=3600" },
  });
}
