import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { throttled } from "@/lib/auth";

/**
 * POST { email } → creates a one-hour reset link. The response is the same whether or not the email exists.
 * No email service is configured yet, so in development the link is printed in the server terminal only.
 */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const email = String((await req.json().catch(() => ({}))).email ?? "").trim().toLowerCase();
  if (throttled(`reset:${email}`, 3, 60 * 60 * 1000)) return NextResponse.json({ ok: true });
  await connectDb();
  const a = await Account.findOne({ email }).select("_id");
  if (a) {
    const token = randomBytes(32).toString("base64url");
    await Account.updateOne({ _id: a._id }, { resetTokenHash: createHash("sha256").update(token).digest("hex"), resetExpires: new Date(Date.now() + 3600_000) });
    const link = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset?token=${token}`;
    if (process.env.NODE_ENV === "development") console.info(`[Ownique] Password reset link for ${email}: ${link}`);
    // TODO: send `link` by email once an email provider is configured.
  }
  return NextResponse.json({ ok: true });
}
