import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { AgreementDocument, PurchaseAgreement } from "@/models/PurchaseAgreement";
import { DesignerAgreement } from "@/models/DesignerAgreement";
import { sha256, walletFromToken } from "@/lib/purchaseAgreements";
import { buildAgreementPdf, type PdfParty } from "@/lib/agreementPdf";
import { loadOriginal, watermark } from "@/lib/designImage";

type Party = { userId: unknown; account: string; username: string | null; legalName: string; acceptedAt: Date; acceptedVersion: string };

/**
 * POST /api/agreements/:agreementId/pdf { token }
 * Only the buyer or the designer of a PAID agreement can download it. The PDF is built once from the
 * accepted snapshot, stored, and the same stored file is returned every time after that.
 */
export async function POST(req: Request, { params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = await params;
  if (!hasDb()) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const wallet = walletFromToken((await req.json().catch(() => ({}))).token);
  if (!wallet) return NextResponse.json({ error: "Please sign in with your wallet again." }, { status: 401 });

  await connectDb();
  const a = await PurchaseAgreement.findOne({ agreementId }).lean<Record<string, unknown> & {
    agreementId: string; transactionId?: string; designId: unknown; designTitle: string; priceSol: number; agreementVersion: string;
    governingLaw: string | null; isDemo: boolean; status: string; transferStatus: string; termsHash: string; termsSections: { heading: string; body: string[] }[];
    designer: Party; buyer: Party; designerAgreementId: unknown; paidAt: Date;
    payment: { method: string | null; amountSol: number | null; amountUsd: number | null; status: string; reference: string | null; verifiedAt: Date | null };
  }>();
  if (!a || (a.buyer.account !== wallet && a.designer.account !== wallet))
    return NextResponse.json({ error: "Agreement not found." }, { status: 404 }); // don't reveal other people's agreements
  if (a.status !== "paid" || !a.transactionId || a.payment.status !== "verified")
    return NextResponse.json({ error: "The PDF is available after the payment is verified." }, { status: 409 });

  let doc = await AgreementDocument.findOne({ agreementId, termsHash: a.termsHash }).select("+pdf").lean<{ pdf: unknown; sha256: string }>();
  if (!doc) {
    const decl = await DesignerAgreement.findById(a.designerAgreementId)
      .select("thirdPartyContent thirdPartyDetails rightsReview").lean<{ thirdPartyContent: boolean; thirdPartyDetails: string; rightsReview: string }>();
    let preview: Buffer | null = null;
    try { const o = await loadOriginal(String(a.designId)); if (o) preview = await watermark(o.bytes); } catch { /* optional */ }
    const party = (p: Party): PdfParty => ({ ...p, userId: String(p.userId) });
    const pdf = await buildAgreementPdf({
      agreementId: a.agreementId, transactionId: a.transactionId, date: a.paidAt, version: a.agreementVersion,
      governingLaw: a.governingLaw, isDemo: a.isDemo, transferStatus: a.transferStatus, status: a.status,
      designer: party(a.designer), buyer: party(a.buyer),
      design: { title: a.designTitle, id: String(a.designId), priceSol: a.priceSol,
        creator: `${a.designer.username ?? a.designer.account} (Ownique account ${a.designer.account})` },
      sections: a.termsSections, termsHash: a.termsHash,
      thirdParty: { disclosed: Boolean(decl?.thirdPartyContent), details: decl?.thirdPartyDetails ?? "", review: decl?.rightsReview ?? "not_needed" },
      payment: a.payment, preview,
    });
    try {
      await AgreementDocument.create({ agreementId, termsHash: a.termsHash, agreementVersion: a.agreementVersion, pdf, sha256: sha256(pdf) });
    } catch { /* another request stored it first: use that one */ }
    doc = await AgreementDocument.findOne({ agreementId, termsHash: a.termsHash }).select("+pdf").lean<{ pdf: unknown; sha256: string }>();
  }
  const raw = doc!.pdf as Buffer | { buffer: Uint8Array };
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${a.isDemo ? "TEST-" : ""}Ownique-Purchase-Agreement-${agreementId}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-SHA256": doc!.sha256,
    },
  });
}
