import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { hasVault, transferDesignToken, verifyPayment } from "@/lib/solana";
import { logEvent } from "@/lib/events";

/**
 * POST /api/designs/:id/buy  { buyerWallet, signature, agreed }
 * 1. Verifies on Solana that the buyer really paid the designer the full price.
 * 2. Marks the design as sold (only once — a second buyer is rejected).
 * 3. Moves the ownership token from the vault to the buyer.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  const { buyerWallet, signature, agreed } = await req.json();
  if (!agreed) return NextResponse.json({ error: "Please agree to all the confirmations." }, { status: 400 });
  if (!buyerWallet || !signature) return NextResponse.json({ error: "Missing wallet or payment." }, { status: 400 });

  await connectDb();
  const design = await Design.findById(id);
  if (!design || design.status === "hidden") return NextResponse.json({ error: "Design not found." }, { status: 404 });
  if (design.status === "sold") return NextResponse.json({ error: "Sorry, this design already has an owner." }, { status: 409 });
  if (design.designerWallet === buyerWallet)
    return NextResponse.json({ error: "You can't buy your own design." }, { status: 400 });

  // Each payment can only be used once.
  if (await Design.exists({ txSignature: signature }))
    return NextResponse.json({ error: "This payment was already used." }, { status: 409 });

  const check = await verifyPayment({
    signature,
    buyerWallet,
    designerWallet: design.designerWallet,
    priceSol: design.price,
  });
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 402 });

  // Atomic: only succeeds if it's still listed (stops two buyers at the same moment).
  const sold = await Design.findOneAndUpdate(
    { _id: id, status: "listed" },
    { status: "sold", ownerWallet: buyerWallet, txSignature: signature, soldAt: new Date() },
    { new: true }
  );
  if (!sold) return NextResponse.json({ error: "Sorry, someone else just bought it." }, { status: 409 });

  logEvent("purchase", { designId: id, wallet: buyerWallet, amountSol: sold.price });

  // Hand over the ownership token.
  let transferSignature: string | null = null;
  if (hasVault() && sold.mintAddress) {
    try {
      transferSignature = await transferDesignToken(sold.mintAddress, buyerWallet);
    } catch (err) {
      console.error("Token transfer failed — retry from the admin page:", err);
    }
  }

  return NextResponse.json({ ok: true, transferSignature, mintAddress: sold.mintAddress });
}
