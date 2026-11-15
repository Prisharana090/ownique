import { connectDb, hasDb } from "@/lib/db";
import { getSessionAccount } from "@/lib/auth";
import { DemoOrder } from "@/models/DemoOrder";
import { demoOriginal, demoPreview, type DemoLean } from "@/lib/demoOrder";
import { buildAgreementPdf } from "@/lib/agreementPdf";

// GET /api/demo/:orderId/preview|original|agreement
// Demo files only (generated artwork), and only for the designer who owns this demo session.
// The "original" and the executed agreement unlock only after the demo transfer is completed.
// Real designs' download protections are untouched: this route can't read any real design.
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string; file: string }> }) {
  const { orderId, file } = await params;
  if (!hasDb()) return new Response("Not found", { status: 404 });
  const me = await getSessionAccount();
  if (!me) return new Response("Please log in.", { status: 401 });
  await connectDb();
  const o = await DemoOrder.findOne({ orderId, designerAccountId: me._id }).lean<DemoLean>();
  if (!o) return new Response("Not found", { status: 404 }); // other people's demo sessions look like they don't exist

  const noStore = { "Cache-Control": "private, no-store" };
  if (file === "preview") {
    return new Response(new Uint8Array(await demoPreview(o.design.seed, o.design.title)), { headers: { "Content-Type": "image/jpeg", ...noStore } });
  }
  if (o.status !== "completed" || o.transferCount !== 1)
    return new Response("Available to the demo buyer only after the demo ownership transfer is completed.", { status: 403 });

  if (file === "original") {
    return new Response(new Uint8Array(await demoOriginal(o.design.seed, o.design.title)), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${o.design.demoDesignId}-DEMO-original.png"`, ...noStore },
    });
  }
  if (file === "agreement") {
    const party = (name: string, username: string, account: string, at: Date | null | undefined) => ({
      legalName: name, username, account, userId: account, acceptedAt: at ?? new Date(0), acceptedVersion: o.agreement.version,
    });
    const pdf = await buildAgreementPdf({
      agreementId: o.orderId, transactionId: o.transfer.transferId ?? "-", date: o.transfer.completedAt ?? new Date(),
      version: o.agreement.version, governingLaw: null, isDemo: true,
      transferStatus: "demo_not_legally_effective", status: "paid",
      designer: party(`${o.designerName} (demo session)`, o.designerUsername, `demo:@${o.designerUsername}`, o.designerAcceptance?.acceptedAt),
      buyer: party(`${o.buyer.name} (FICTIONAL demo buyer)`, o.buyer.username, `demo:@${o.buyer.username}`, o.buyerAcceptance?.acceptedAt),
      design: { title: o.design.title, id: o.design.demoDesignId, priceSol: o.design.priceSol, creator: o.design.creatorCredit },
      sections: o.agreement.sections, termsHash: o.agreement.termsHash,
      thirdParty: { disclosed: false, details: "", review: "not_needed" },
      payment: { method: "demo", amountSol: o.design.priceSol, amountUsd: o.design.priceUsd, status: "SIMULATED - no money moved", reference: o.payment.reference, verifiedAt: o.payment.confirmedAt },
      preview: await demoPreview(o.design.seed, o.design.title),
    });
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${o.orderId}-DEMO-agreement.pdf"`, ...noStore },
    });
  }
  return new Response("Not found", { status: 404 });
}
