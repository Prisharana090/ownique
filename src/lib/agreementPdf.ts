// Builds the "EXCLUSIVE DESIGN PURCHASE & COPYRIGHT OWNERSHIP TRANSFER AGREEMENT" PDF from SAVED data only
// (the accepted snapshot, never the current terms).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { AGREEMENT_TITLE, DEMO_ACCEPTANCE_LABEL, GOVERNING_LAW_MISSING, LEGAL_REVIEW_NOTICE } from "./purchaseTerms";
import { solText, usd } from "@/lib/price";

export type PdfParty = { legalName: string; username: string | null; account: string; userId: string; acceptedAt: Date; acceptedVersion: string };
export type PdfInput = {
  agreementId: string; transactionId: string; date: Date; version: string; governingLaw: string | null;
  isDemo: boolean; transferStatus: string; status: string;
  designer: PdfParty; buyer: PdfParty;
  design: { title: string; id: string; priceSol: number; creator: string };
  sections: { heading: string; body: string[] }[];
  termsHash: string;
  thirdParty: { disclosed: boolean; details: string; review: string };
  payment: { method: string | null; amountSol: number | null; amountUsd: number | null; status: string; reference: string | null; verifiedAt: Date | null };
  preview: Buffer | null; // JPEG
};

const PLUM = rgb(0.4, 0.18, 0.32), GOLD = rgb(0.75, 0.58, 0.27), INK = rgb(0.16, 0.14, 0.13), MUTED = rgb(0.45, 0.42, 0.4);
// Standard PDF fonts only cover Latin-1: replace anything else so names never break the file.
const safe = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[—–]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
const when = (d: Date | null) => (d ? `${new Date(d).toISOString().replace("T", " ").slice(0, 19)} UTC` : "-");
const TRANSFER: Record<string, string> = {
  demo_not_legally_effective: "TEST PURCHASE - not legally effective",
  payment_confirmed_pending_execution: "Payment confirmed - transfer pending execution conditions",
  awaiting_payment: "Awaiting payment", superseded: "Superseded",
};

export async function buildAgreementPdf(a: PdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${AGREEMENT_TITLE} ${a.agreementId}`);
  pdf.setAuthor("Ownique");
  pdf.setSubject(a.isDemo ? "TEST PURCHASE - demo agreement record" : "Agreement record");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const W = 612, H = 792, M = 56, TOP = H - 78, BOTTOM = 70;
  let page!: PDFPage;
  let y = 0;
  const newPage = () => { page = pdf.addPage([W, H]); y = TOP; };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(); };
  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const tryLine = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) <= width) line = tryLine;
        else {
          if (line) out.push(line);
          line = word;
          while (font.widthOfTextAtSize(line, size) > width) { // very long tokens (hashes, wallets)
            let i = line.length; while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > width) i--;
            out.push(line.slice(0, i)); line = line.slice(i);
          }
        }
      }
      out.push(line);
    }
    return out;
  };
  const text = (t: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) => {
    const font = o.font ?? reg, size = o.size ?? 10, x = o.x ?? M, width = o.width ?? W - M - x;
    for (const line of wrap(t, font, size, width)) {
      ensure(size + 4);
      page.drawText(line, { x, y: y - size, size, font, color: o.color ?? INK });
      y -= size + 4;
    }
    y -= o.gap ?? 4;
  };
  const heading = (t: string) => {
    ensure(40); y -= 6;
    page.drawText(safe(t), { x: M, y: y - 12, size: 12, font: bold, color: PLUM });
    y -= 18;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: GOLD });
    y -= 8;
  };
  const row = (label: string, value: string) => {
    const lines = wrap(value || "-", reg, 9.5, W - M - 190);
    ensure(lines.length * 13.5 + 2);
    page.drawText(safe(label), { x: M, y: y - 9.5, size: 9, font: bold, color: MUTED });
    for (const l of lines) { page.drawText(l, { x: 190, y: y - 9.5, size: 9.5, font: reg, color: INK }); y -= 13.5; }
    y -= 2;
  };

  newPage();
  // Title block
  page.drawText("Own", { x: M, y: y - 22, size: 24, font: serif, color: PLUM });
  page.drawText("ique", { x: M + serif.widthOfTextAtSize("Own", 24), y: y - 22, size: 24, font: serif, color: GOLD });
  y -= 40;
  text(AGREEMENT_TITLE, { font: bold, size: 15, color: PLUM, gap: 6 });
  if (a.isDemo) {
    ensure(46);
    page.drawRectangle({ x: M, y: y - 40, width: W - 2 * M, height: 40, color: rgb(1, 0.96, 0.86), borderColor: rgb(0.85, 0.65, 0.2), borderWidth: 1 });
    page.drawText(safe(`TEST PURCHASE - ${DEMO_ACCEPTANCE_LABEL}`), { x: M + 10, y: y - 16, size: 9.5, font: bold, color: rgb(0.5, 0.33, 0.05) });
    page.drawText("Prototype record: no real money moved and this transfer is NOT legally effective.", { x: M + 10, y: y - 30, size: 9, font: reg, color: rgb(0.5, 0.33, 0.05) });
    y -= 52;
  }

  heading("Agreement Details");
  row("Agreement ID", a.agreementId);
  row("Transaction ID", a.transactionId);
  row("Date", when(a.date));
  row("Agreement version", a.version);
  row("Governing law", a.governingLaw ?? GOVERNING_LAW_MISSING);
  row("Terms integrity hash", `SHA-256 ${a.termsHash}`);

  for (const [role, p] of [["Seller (Designer)", a.designer], ["Buyer", a.buyer]] as const) {
    heading(role);
    row("Legal name", p.legalName);
    row("Business name", "Not provided");
    row("Ownique username", p.username ?? "Not set");
    row("Ownique account", p.account);
    row("User ID", p.userId);
    row("Acceptance", `Accepted version ${p.acceptedVersion} at ${when(p.acceptedAt)} (server time)`);
  }

  heading("Design");
  if (a.preview) {
    try {
      const img = await pdf.embedJpg(a.preview);
      const s = Math.min(150 / img.width, 150 / img.height);
      ensure(img.height * s + 10);
      page.drawImage(img, { x: M, y: y - img.height * s, width: img.width * s, height: img.height * s });
      page.drawText("Watermarked preview", { x: M + img.width * s + 12, y: y - 12, size: 8.5, font: reg, color: MUTED });
      y -= img.height * s + 10;
    } catch { /* preview optional */ }
  }
  row("Title", a.design.title);
  row("Design ID", a.design.id);
  row("Price", `US${usd(a.design.priceSol)} (paid as ${solText(a.design.priceSol)})`);
  row("Original creator", a.design.creator);
  row("Third-party content", a.thirdParty.disclosed ? `Disclosed: ${a.thirdParty.details} (rights review: ${a.thirdParty.review})` : "None disclosed by the Designer");

  heading("Payment and Transfer Status");
  row("Transaction status", a.status === "paid" ? "Paid (payment verified)" : a.status);
  row("Payment method", a.payment.method === "sol" ? "Solana (SOL)" : a.payment.method === "bank" ? "Bank (Capital One Nessie)" : "-");
  row("Amount", [a.payment.amountSol != null ? `${a.payment.amountSol} SOL` : "", a.payment.amountUsd != null ? `US$${a.payment.amountUsd}` : ""].filter(Boolean).join(" / ") || "-");
  row("Payment status", `${a.payment.status}${a.payment.verifiedAt ? ` at ${when(a.payment.verifiedAt)}` : ""}`);
  row("Payment reference", a.payment.reference ?? "-");
  row("Transfer status", TRANSFER[a.transferStatus] ?? a.transferStatus);

  heading("Accepted Terms");
  for (const s of a.sections) {
    text(s.heading, { font: bold, size: 10.5, gap: 2 });
    for (const b of s.body) text(b, { size: 9.5, gap: 5 });
  }

  heading("Important Notice");
  text(LEGAL_REVIEW_NOTICE, { size: 9, color: MUTED });

  // Header + footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText("Ownique", { x: M, y: H - 36, size: 10, font: serif, color: PLUM });
    const id = safe(`Agreement ${a.agreementId}`);
    p.drawText(id, { x: W - M - reg.widthOfTextAtSize(id, 8), y: H - 35, size: 8, font: reg, color: MUTED });
    p.drawLine({ start: { x: M, y: H - 44 }, end: { x: W - M, y: H - 44 }, thickness: 0.5, color: GOLD });
    p.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.5, color: GOLD });
    const foot = safe(`${a.isDemo ? "TEST PURCHASE - " : ""}${a.agreementId}`);
    p.drawText(foot, { x: M, y: 36, size: 8, font: reg, color: MUTED });
    const pn = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pn, { x: W - M - reg.widthOfTextAtSize(pn, 8), y: 36, size: 8, font: reg, color: MUTED });
  });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
