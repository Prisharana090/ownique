import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { hashPassword, validPassword } from "@/lib/auth";

/** POST { token, password } → sets a new password if the reset link is valid (one use, one hour). */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  if (!validPassword(String(b.password ?? ""))) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  await connectDb();
  const tokenHash = createHash("sha256").update(String(b.token ?? "")).digest("hex");
  const a = await Account.findOne({ resetTokenHash: tokenHash, resetExpires: { $gt: new Date() } }).select("_id");
  if (!a) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  await Account.updateOne({ _id: a._id }, { passwordHash: await hashPassword(String(b.password)), resetTokenHash: null, resetExpires: null });
  return NextResponse.json({ ok: true });
}
