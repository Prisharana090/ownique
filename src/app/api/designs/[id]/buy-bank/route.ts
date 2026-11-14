import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { hasVault, transferDesignToken } from "@/lib/solana";
import { bankTransfer, ensureBankAccount, getBalance, hasNessie, solToUsd } from "@/lib/nessie";
import { logEvent } from "@/lib/events";
import { getOwnershipGate } from "@/lib/agreements";
import { agreementForPayment, recordAgreementPayment } from "@/lib/purchaseAgreements";

/** GET → is bank checkout available, and what does this design cost in dollars? */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasNessie() || !hasDb() || !isValidObjectId(id)) return NextResponse.json({ available: false });
  await connectDb();
  const d = await Design.findById(id).select("price").lean<{ price: number }>();
  return NextResponse.json({ available: Boolean(d), priceUsd: d ? solToUsd(d.price) : null });
}

/**
 * POST /api/designs/:id/buy-bank { buyerWallet, agreementId }
 * "Pay with bank" through Capital One Nessie:
 * 1. The buyer's wallet-signed agreement acceptance (made in the last 30 minutes) proves they own the receiving wallet.
 * 2. Money moves from the buyer's practice bank account to the designer's.
 * 3. The design is marked sold (only once) and the ownership token moves to the buyer on Solana.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasNessie()) return NextResponse.json({ error: "Bank checkout isn't set up yet (add NESSIE_API_KEY)." }, { status: 503 });
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  const { buyerWallet, agreementId } = await req.json();
  if (!buyerWallet) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });

  await connectDb();
  const design = await Design.findById(id);
  if (!design || design.status === "hidden") return NextResponse.json({ error: "Design not found." }, { status: 404 });
  if (design.status === "sold") return NextResponse.json({ error: "Sorry, this design already has an owner." }, { status: 409 });
  if (design.designerWallet === buyerWallet) return NextResponse.json({ error: "You can't buy your own design." }, { status: 400 });

  // 📜 Not for sale until the designer has accepted the Ownership Transfer Declaration
  const gate = await getOwnershipGate(id);
  if (gate.blockReason) return NextResponse.json({ error: gate.blockReason }, { status: 403 });

  // 📜 Accepted agreement (current version, signed by this wallet in the last 30 minutes) is required.
  const acc = await agreementForPayment(id, buyerWallet, agreementId, 30 * 60 * 1000);
  if ("error" in acc) return NextResponse.json({ error: acc.error }, { status: acc.status });

  // Reserve the design first so two buyers can't pay at the same moment.
  const reserved = await Design.findOneAndUpdate(
    { _id: id, status: "listed" },
    { status: "sold", ownerWallet: buyerWallet, paymentMethod: "bank", soldAt: new Date() },
    { new: true }
  );
  if (!reserved) return NextResponse.json({ error: "Sorry, someone else just bought it." }, { status: 409 });

  const amountUsd = solToUsd(design.price);
  let transferId: string;
  let buyerBalance: number | null = null;
  try {
    const [fromAccountId, toAccountId] = await Promise.all([
      ensureBankAccount(buyerWallet),
      ensureBankAccount(design.designerWallet),
    ]);
    const balance = await getBalance(fromAccountId);
    if (balance !== null && balance < amountUsd) throw new Error(`Not enough money in your test bank account ($${balance}).`);
    transferId = await bankTransfer({
      fromAccountId,
      toAccountId,
      amountUsd,
      description: `Ownique: "${design.title}"`,
    });
    buyerBalance = balance === null ? null : Math.round((balance - amountUsd) * 100) / 100;
  } catch (err) {
    // Payment failed: put the design back on sale.
    await Design.updateOne({ _id: id }, { status: "listed", ownerWallet: null, paymentMethod: null, soldAt: null });
    console.error("Nessie payment failed:", err);
    return NextResponse.json({ error: `Bank payment failed: ${(err as Error).message}` }, { status: 402 });
  }

  await Design.updateOne({ _id: id }, { nessieTransferId: transferId, priceUsd: amountUsd });
  const paid = await recordAgreementPayment(acc.agreement.agreementId, { method: "bank", amountSol: design.price, amountUsd, reference: transferId });
  logEvent("purchase", { designId: id, wallet: buyerWallet, amountSol: design.price });

  let transferSignature: string | null = null;
  if (hasVault() && reserved.mintAddress) {
    try {
      transferSignature = await transferDesignToken(reserved.mintAddress, buyerWallet);
      await Design.updateOne({ _id: id }, { tokenTransferSignature: transferSignature });
    } catch (err) {
      console.error("Token transfer failed after bank payment:", err);
    }
  }

  return NextResponse.json({ ok: true, amountUsd, transferId, buyerBalance, transferSignature, agreementId: paid?.agreementId, transactionId: paid?.transactionId });
}
