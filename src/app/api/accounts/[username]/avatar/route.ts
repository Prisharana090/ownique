import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!hasDb()) return new Response("Not found", { status: 404 });
  await connectDb();
  const a = await Account.findOne({ username: username.toLowerCase() }).select("+avatar hasAvatar").lean<{ avatar: unknown; hasAvatar: boolean }>();
  if (!a?.hasAvatar || !a.avatar) return new Response("Not found", { status: 404 });
  const raw = a.avatar as Buffer | { buffer: Uint8Array };
  return new Response(new Uint8Array(Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer)), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60" },
  });
}
