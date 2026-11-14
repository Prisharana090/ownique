import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { User } from "@/models/User";

// POST /api/users  { walletAddress } → creates the user if new (wallet = identity).
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ ok: false, error: "No database configured" }, { status: 503 });
  const { walletAddress } = await req.json();
  if (!walletAddress || typeof walletAddress !== "string")
    return NextResponse.json({ ok: false, error: "walletAddress required" }, { status: 400 });
  await connectDb();
  const user = await User.findOneAndUpdate(
    { walletAddress },
    { $setOnInsert: { walletAddress } },
    { upsert: true, new: true }
  );
  return NextResponse.json({ ok: true, user });
}
