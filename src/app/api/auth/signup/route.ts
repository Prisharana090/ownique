import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { USERNAME_RE, cookieOptions, hashPassword, SESSION_COOKIE, sessionValue, throttled, validEmail, validPassword } from "@/lib/auth";

/** POST { email, password, displayName, username, role: "buyer"|"designer", acceptTerms } */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const username = String(b.username ?? "").trim().toLowerCase();
  const displayName = String(b.displayName ?? "").trim().slice(0, 60);
  const password = String(b.password ?? "");
  if (throttled(`signup:${req.headers.get("x-forwarded-for") ?? "local"}`, 10)) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  // Exactly one role; there is no "both" option and it can never change later.
  if (b.role !== "buyer" && b.role !== "designer") return NextResponse.json({ error: "Choose exactly one role: Buyer or Designer." }, { status: 400 });
  if (!validEmail(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!validPassword(password)) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (displayName.length < 2) return NextResponse.json({ error: "Please enter your display name." }, { status: 400 });
  if (!USERNAME_RE.test(username)) return NextResponse.json({ error: "Username: 3–20 lowercase letters, numbers or underscores." }, { status: 400 });
  if (b.acceptTerms !== true) return NextResponse.json({ error: "Please agree to the Terms and Privacy Policy." }, { status: 400 });

  await connectDb();
  if (await Account.exists({ email })) return NextResponse.json({ error: "An account with this email already exists. Try logging in." }, { status: 409 });
  if (await Account.exists({ username })) return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  try {
    const a = await Account.create({ email, username, displayName, role: b.role, passwordHash: await hashPassword(password), termsAcceptedAt: new Date() });
    const res = NextResponse.json({ ok: true, username: a.username, role: a.role });
    res.cookies.set(SESSION_COOKIE, sessionValue(String(a._id)), cookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "That email or username is already in use." }, { status: 409 });
  }
}
