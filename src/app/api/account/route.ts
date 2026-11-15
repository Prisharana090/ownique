import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { getSessionAccount } from "@/lib/auth";

/** PATCH { displayName?, bio? } — only the signed-in owner edits their own profile. Role and username never change. */
export async function PATCH(req: Request) {
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const update: Record<string, string> = {};
  if (b.displayName !== undefined) {
    const n = String(b.displayName).trim().slice(0, 60);
    if (n.length < 2) return NextResponse.json({ error: "Display name is too short." }, { status: 400 });
    update.displayName = n;
  }
  if (b.bio !== undefined) update.bio = String(b.bio).trim().slice(0, 300);
  await connectDb();
  await Account.updateOne({ _id: me._id }, update);
  return NextResponse.json({ ok: true });
}
