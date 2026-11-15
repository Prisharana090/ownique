import { isValidObjectId } from "mongoose";
import { Design } from "@/models/Design";
import { connectDb, hasDb } from "@/lib/db";
import { loadOriginal, watermark } from "@/lib/designImage";

const g = globalThis as unknown as { _previews?: Map<string, Buffer> };
const previewCache = (g._previews ??= new Map<string, Buffer>());

// GET /api/designs/:id/image → watermarked preview (the full file is only for the owner, via /download)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDb();
  // Watermarking is CPU-heavy: keep recent previews in memory, keyed by the artwork's hash.
  const meta = await Design.findById(id).select("imageHash status").lean<{ imageHash: string; status: string }>();
  if (!meta || meta.status === "hidden") return new Response("Not found", { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  const cacheHeader = versioned ? "public, max-age=86400, immutable" : "public, max-age=60, stale-while-revalidate=300";
  const key = `${id}:${meta.imageHash}`;
  const etag0 = `"${meta.imageHash.slice(0, 16)}"`;
  if (req.headers.get("if-none-match") === etag0) return new Response(null, { status: 304, headers: { ETag: etag0 } });
  const hit = previewCache.get(key);
  if (hit) return new Response(new Uint8Array(hit), { headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheHeader, ETag: etag0 } });
  // Previews are stored at upload; older designs get one made (and saved) on first view.
  const stored = await Design.findById(id).select("+previewData").lean<{ previewData?: unknown }>();
  const raw = stored?.previewData as Buffer | { buffer: Uint8Array } | null | undefined;
  if (raw) {
    const preview = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);
    previewCache.set(key, preview);
    return new Response(new Uint8Array(preview), { headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheHeader, ETag: etag0 } });
  }
  const d = await loadOriginal(id);
  if (!d || d.status === "hidden") return new Response("Not found", { status: 404 });

  try {
    const preview = await watermark(d.bytes);
    previewCache.set(key, preview);
    Design.updateOne({ _id: id }, { previewData: preview }).catch(() => {});
    if (previewCache.size > 60) previewCache.delete(previewCache.keys().next().value!);
    return new Response(new Uint8Array(preview), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheHeader, ETag: etag0 },
    });
  } catch {
    return new Response("Could not make preview", { status: 500 });
  }
}
