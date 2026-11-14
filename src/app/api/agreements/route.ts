import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { PurchaseAgreement } from "@/models/PurchaseAgreement";
import { DesignerAgreement } from "@/models/DesignerAgreement";
import { Design } from "@/models/Design";
import { issueToken, walletFromToken } from "@/lib/purchaseAgreements";

/**
 * POST /api/agreements  { wallet, message, signature } (first time) or { token }
 * Returns ONLY the agreements where this wallet is the buyer or the designer.
 */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const body = await req.json();
  let token: string | null = typeof body.token === "string" ? body.token : null;
  let wallet = walletFromToken(token);
  if (!wallet && body.wallet) {
    token = issueToken(String(body.wallet), String(body.message ?? ""), String(body.signature ?? ""));
    wallet = token ? String(body.wallet) : null;
  }
  if (!wallet) return NextResponse.json({ error: "Please sign in with your wallet to see your agreements." }, { status: 401 });

  await connectDb();
  const fields = "agreementId transactionId designId designTitle priceSol agreementVersion termsHash isDemo governingLaw status transferStatus payment paidAt designer buyer createdAt";
  const [asBuyer, asDesigner, declarations] = await Promise.all([
    PurchaseAgreement.find({ "buyer.account": wallet }).select(fields).sort({ createdAt: -1 }).lean(),
    PurchaseAgreement.find({ "designer.account": wallet, status: "paid" }).select(fields).sort({ createdAt: -1 }).lean(),
    DesignerAgreement.find({ designerWallet: wallet })
      .select("designId agreementVersion acceptedAt status rightsReview legalName").sort({ acceptedAt: -1 }).lean(),
  ]);
  const ids = [...new Set(declarations.map((d) => String((d as { designId: unknown }).designId)))];
  const titles = Object.fromEntries(
    (await Design.find({ _id: { $in: ids } }).select("title status").lean<{ _id: unknown; title: string; status: string }[]>())
      .map((d) => [String(d._id), { title: d.title, status: d.status }])
  );
  const strip = (a: Record<string, unknown>) => {
    // Each party already knows the other from the executed agreement; internal user ids stay server-side.
    const p = (x: { userId?: unknown } & Record<string, unknown>) => ({ ...x, userId: undefined });
    const designer = p(a.designer as never) as Record<string, unknown>;
    if (a.status !== "paid") designer.legalName = undefined; // shared with the buyer only once the purchase is paid
    return { ...a, designer, buyer: p(a.buyer as never) };
  };
  return NextResponse.json({
    token,
    wallet,
    purchases: asBuyer.map((a) => strip(a as Record<string, unknown>)),
    sales: asDesigner.map((a) => strip(a as Record<string, unknown>)),
    declarations: declarations.map((d) => {
      const x = d as { designId: unknown; agreementVersion: string; acceptedAt: Date; status: string; rightsReview: string; legalName: string };
      return { ...x, designId: String(x.designId), design: titles[String(x.designId)] ?? null };
    }),
  });
}
