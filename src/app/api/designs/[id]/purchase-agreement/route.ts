import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { acceptPurchaseAgreement, currentTerms } from "@/lib/purchaseAgreements";
import { getSessionAccount } from "@/lib/auth";
import { BUYER_ACCEPT_LABEL, DEMO_ACCEPTANCE_LABEL, LEGAL_REVIEW_NOTICE } from "@/lib/purchaseTerms";

/** GET → the full design-specific agreement (version + integrity hash) to show before checkout. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  await connectDb();
  const t = await currentTerms(id);
  if (!t || t.design.status === "hidden") return NextResponse.json({ error: "Design not found." }, { status: 404 });
  return NextResponse.json({
    version: t.version, termsHash: t.hash, sections: t.sections, isDemo: t.isDemo, governingLaw: t.governingLaw,
    acceptLabel: BUYER_ACCEPT_LABEL, demoLabel: DEMO_ACCEPTANCE_LABEL, legalNotice: LEGAL_REVIEW_NOTICE,
  });
}

/** POST { buyerWallet, legalName, accepted, version, termsHash, message, signature } → { agreementId } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  await connectDb();
  const body = await req.json();
  // 🔐 Only Buyer accounts can buy, with the wallet linked to their account (checkout requires this agreement).
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in with a Buyer account to buy." }, { status: 401 });
  if (me.role !== "buyer") return NextResponse.json({ error: "Only Buyer accounts can purchase designs." }, { status: 403 });
  if (me.walletAddress !== body.buyerWallet)
    return NextResponse.json({ error: "Link this wallet to your Buyer account (on your profile) before buying." }, { status: 403 });
  const r = await acceptPurchaseAgreement(id, body);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const a = r.agreement as { agreementId: string; agreementVersion: string; buyer: { acceptedAt: Date } };
  return NextResponse.json({ agreementId: a.agreementId, version: a.agreementVersion, acceptedAt: a.buyer.acceptedAt });
}
