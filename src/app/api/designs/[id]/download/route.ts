import { isValidObjectId } from "mongoose";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { connectDb, hasDb } from "@/lib/db";
import { loadOriginal } from "@/lib/designImage";

/**
 * POST /api/designs/:id/download { wallet, message, signature }
 * The owner proves they control their wallet by signing a short message (free, no transaction).
 * Only the current owner gets the full-quality original file.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return Response.json({ error: "Design not found." }, { status: 404 });
  const { wallet, message, signature } = await req.json();
  if (!wallet || !message || !signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  // The message must be for this design and recent (stops someone re-using an old signature).
  const match = /^Ownique: download design (\w+) at (\d+)$/.exec(String(message));
  if (!match || match[1] !== id || Math.abs(Date.now() - Number(match[2])) > 5 * 60 * 1000)
    return Response.json({ error: "Signature expired. Please try again." }, { status: 400 });

  let valid = false;
  try {
    valid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      new PublicKey(wallet).toBytes()
    );
  } catch {
    valid = false;
  }
  if (!valid) return Response.json({ error: "Wallet signature didn't check out." }, { status: 401 });

  await connectDb();
  const d = await loadOriginal(id);
  if (!d) return Response.json({ error: "Design not found." }, { status: 404 });
  if (d.status !== "sold" || d.ownerWallet !== wallet)
    return Response.json({ error: "Only the owner can download the full file." }, { status: 403 });

  const ext = d.imageType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const name = d.title.replace(/[^\w\- ]/g, "").trim().replace(/\s+/g, "-") || "design";
  return new Response(new Uint8Array(d.bytes), {
    headers: { "Content-Type": d.imageType, "Content-Disposition": `attachment; filename="${name}.${ext}"` },
  });
}
