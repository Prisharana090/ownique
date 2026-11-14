import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { loadOriginal, watermark } from "@/lib/designImage";

// GET /api/designs/:id/image → watermarked preview (the full file is only for the owner, via /download)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDb();
  const d = await loadOriginal(id);
  if (!d || d.status === "hidden") return new Response("Not found", { status: 404 });
  try {
    const preview = await watermark(d.bytes);
    return new Response(new Uint8Array(preview), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Could not make preview", { status: 500 });
  }
}
