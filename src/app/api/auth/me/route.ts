import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { getSessionAccount } from "@/lib/auth";
/** The signed-in account's own details (email only goes to its owner). */
export async function GET() {
  if (!hasDb()) return NextResponse.json({ account: null });
  const a = await getSessionAccount();
  return NextResponse.json({ account: a ? { username: a.username, displayName: a.displayName, role: a.role, email: a.email, bio: a.bio, hasAvatar: a.hasAvatar, walletAddress: a.walletAddress ?? null } : null });
}
