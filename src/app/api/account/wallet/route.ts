import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { getSessionAccount } from "@/lib/auth";
import { verifyWalletMessage } from "@/lib/walletAuth";
import { WALLET_LINK_PREFIX } from "@/lib/accountShared";

/** POST { wallet, message, signature } — links a Solana wallet (needed to buy or sell). Each wallet links to one account. */
export async function POST(req: Request) {
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const wallet = String(b.wallet ?? "");
  if (!verifyWalletMessage({ wallet, message: String(b.message ?? ""), signature: String(b.signature ?? ""), prefix: `${WALLET_LINK_PREFIX} @${me.username}` }))
    return NextResponse.json({ error: "Please sign with the wallet you want to link." }, { status: 401 });
  await connectDb();
  const other = await Account.findOne({ walletAddress: wallet, _id: { $ne: me._id } }).select("_id").lean();
  if (other) return NextResponse.json({ error: "That wallet is already linked to another Ownique account." }, { status: 409 });
  await Account.updateOne({ _id: me._id }, { walletAddress: wallet });
  return NextResponse.json({ ok: true, walletAddress: wallet });
}
