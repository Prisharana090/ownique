import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { checkPassword, cookieOptions, SESSION_COOKIE, sessionValue, throttled } from "@/lib/auth";

export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  if (throttled(`login:${email}`, 8)) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  await connectDb();
  const a = await Account.findOne({ email }).select("+passwordHash username role").lean<{ _id: unknown; passwordHash: string; username: string; role: string }>();
  if (!a || !(await checkPassword(String(b.password ?? ""), a.passwordHash)))
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  const res = NextResponse.json({ ok: true, username: a.username, role: a.role });
  res.cookies.set(SESSION_COOKIE, sessionValue(String(a._id)), cookieOptions);
  return res;
}
