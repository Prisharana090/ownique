import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { hashPassword, throttled, validPassword } from "@/lib/auth";

/** POST { token, password } → sets a new password if the reset link is valid (one use, one hour). */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (throttled(`reset-use:${ip}`, 15, 3600_000)) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  if (!validPassword(String(b.password ?? ""))) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  await connectDb();
  const tokenHash = createHash("sha256").update(String(b.token ?? "")).digest("hex");
  // Atomic single use: the token is cleared in the same update that changes the password.
  const done = await Account.findOneAndUpdate(
    { resetTokenHash: tokenHash, resetExpires: { $gt: new Date() } },
    { passwordHash: await hashPassword(String(b.password)), resetTokenHash: null, resetExpires: null },
    { projection: { _id: 1 } }
  );
  if (!done) return NextResponse.json({ error: "This reset link is invalid, expired or already used." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
