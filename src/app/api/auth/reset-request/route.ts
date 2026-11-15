import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { throttled } from "@/lib/auth";
import { hasEmail, resetEmail, sendEmail, siteUrl } from "@/lib/email";

const SAME = { ok: true, message: "If that email has an account, we've sent a reset link. It's valid for one hour." };

/**
 * POST { email } → emails a one-hour, single-use reset link. The response is identical whether or not
 * the email is registered (no account discovery). Rate-limited per email and per IP.
 */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const email = String((await req.json().catch(() => ({}))).email ?? "").trim().toLowerCase().slice(0, 200);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (throttled(`reset-ip:${ip}`, 10, 3600_000) || throttled(`reset:${email}`, 3, 3600_000)) return NextResponse.json(SAME);

  await connectDb();
  const a = await Account.findOne({ email }).select("_id email");
  if (!a) return NextResponse.json(SAME);

  const base = siteUrl();
  if (!base) {
    console.error("[Ownique] Password reset not sent: NEXT_PUBLIC_SITE_URL is not set.");
    return NextResponse.json(SAME);
  }
  const token = randomBytes(32).toString("base64url"); // only its hash is stored
  await Account.updateOne({ _id: a._id }, { resetTokenHash: createHash("sha256").update(token).digest("hex"), resetExpires: new Date(Date.now() + 3600_000) });
  const link = `${base}/reset?token=${token}`;

  if (hasEmail()) {
    const m = resetEmail(link);
    const sent = await sendEmail(a.email, m.subject, m.html, m.text);
    if (!sent.ok) console.error("[Ownique] Password reset email failed:", sent.error); // never logs the link
  } else if (process.env.NODE_ENV === "development") {
    // Local development without an email service only: print the link so the flow can be tested.
    console.info(`[Ownique] (dev only, email not configured) Password reset link: ${link}`);
    // Also keep it in a gitignored local file so the flow can be tested without reading the terminal.
    await import("fs/promises").then((fs) => fs.appendFile(".dev-reset-links.txt", `${new Date().toISOString()} ${a.email} ${link}\n`)).catch(() => {});
  } else {
    console.error("[Ownique] Password reset not sent: email service not configured.");
  }
  return NextResponse.json(SAME);
}
