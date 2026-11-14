// Server logic for the Exclusive Design Purchase Agreement: terms, acceptance, payment linking, access tokens.
import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { User } from "@/models/User";
import { Design } from "@/models/Design";
import { DesignerAgreement } from "@/models/DesignerAgreement";
import { PurchaseAgreement } from "@/models/PurchaseAgreement";
import { getOwnershipGate } from "@/lib/agreements";
import { cleanLegalName, isValidLegalName } from "@/lib/declaration";
import { verifyWalletMessage } from "@/lib/walletAuth";
import { hasNessie, solToUsd } from "@/lib/nessie";
import { RPC_URL } from "@/lib/solana";
import { AGREEMENT_VERSION, buildPurchaseTerms, purchaseAcceptancePrefix, termsToText } from "@/lib/purchaseTerms";

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
/** Prototype payments (Solana devnet/testnet, Nessie sandbox) are always demo: never legally effective. */
export const isDemoMode = () => /devnet|testnet|localhost/.test(RPC_URL) || process.env.OWNIQUE_LIVE_PAYMENTS !== "true";
const governingLaw = () => process.env.OWNIQUE_GOVERNING_LAW?.trim() || null;

type DesignLean = { _id: unknown; title: string; category: string; price: number; designerWallet: string; status: string };

/** The current design-specific terms, generated on the server from saved data. */
export async function currentTerms(designId: string) {
  const d = await Design.findById(designId).select("title category price designerWallet status").lean<DesignLean>();
  if (!d) return null;
  const u = await User.findOne({ walletAddress: d.designerWallet }).select("username").lean<{ username?: string }>();
  const sections = buildPurchaseTerms({
    designId: String(d._id), title: d.title, category: d.category, priceSol: d.price,
    priceUsd: hasNessie() ? solToUsd(d.price) : null,
    designerAccount: d.designerWallet, designerUsername: u?.username ?? null,
    governingLaw: governingLaw(), isDemo: isDemoMode(),
  });
  const text = termsToText(sections);
  return { design: d, sections, text, hash: sha256(text), version: AGREEMENT_VERSION, isDemo: isDemoMode(), governingLaw: governingLaw() };
}

type Fail = { error: string; status: number };

/** Buyer accepts the agreement (legal name + checkbox + wallet signature). Idempotent for repeated requests. */
export async function acceptPurchaseAgreement(designId: string, body: Record<string, unknown>): Promise<Fail | { agreement: Record<string, unknown> }> {
  const buyerWallet = String(body.buyerWallet ?? "");
  const legalName = cleanLegalName(String(body.legalName ?? ""));
  const message = String(body.message ?? "");
  const signature = String(body.signature ?? "");
  if (body.accepted !== true) return { error: "Please tick “I have read and agree to the Exclusive Design Purchase Agreement.”", status: 400 };
  if (!isValidLegalName(legalName)) return { error: "Please enter your full legal name (first and last name).", status: 400 };

  const terms = await currentTerms(designId);
  if (!terms || terms.design.status === "hidden") return { error: "Design not found.", status: 404 };
  if (terms.design.status !== "listed") return { error: "Sorry, this design already has an owner.", status: 409 };
  if (terms.design.designerWallet === buyerWallet) return { error: "You can't buy your own design.", status: 400 };
  if (body.version !== terms.version || body.termsHash !== terms.hash)
    return { error: "The agreement was updated while you were reading. Please review the new version and accept again.", status: 409 };

  const gate = await getOwnershipGate(designId);
  if (gate.blockReason || !gate.designerAgreementId) return { error: gate.blockReason ?? "Designer ownership confirmation required.", status: 403 };

  if (!verifyWalletMessage({ wallet: buyerWallet, message, signature, prefix: purchaseAcceptancePrefix(terms.version, terms.hash, designId, legalName) }))
    return { error: "Please sign the agreement acceptance with your wallet.", status: 401 };

  // Same buyer, same design, same terms, still unpaid → reuse (handles double clicks / retries).
  const existing = await PurchaseAgreement.findOne({
    designId, "buyer.account": buyerWallet, status: "awaiting_payment", termsHash: terms.hash,
  }).lean();
  if (existing) return { agreement: existing as Record<string, unknown> };

  const designerAgreement = await DesignerAgreement.findById(gate.designerAgreementId)
    .select("designerUserId designerWallet legalName agreementVersion acceptedAt")
    .lean<{ _id: unknown; designerUserId: unknown; designerWallet: string; legalName: string; agreementVersion: string; acceptedAt: Date }>();
  if (!designerAgreement || designerAgreement.agreementVersion !== terms.version)
    return { error: "The designer hasn't accepted this agreement version yet.", status: 403 };

  const [buyerUser, designerUser] = await Promise.all([
    User.findOneAndUpdate({ walletAddress: buyerWallet }, { $setOnInsert: { walletAddress: buyerWallet } }, { upsert: true, new: true }),
    User.findById(String(designerAgreement.designerUserId)).select("username").lean<{ username?: string }>(),
  ]);
  const now = new Date(); // server time only
  const doc = await PurchaseAgreement.create({
    agreementId: `OWN-AGR-${randomUUID()}`,
    designId,
    designTitle: terms.design.title,
    priceSol: terms.design.price,
    designerAgreementId: String(designerAgreement._id),
    designer: {
      userId: String(designerAgreement.designerUserId), account: designerAgreement.designerWallet, username: designerUser?.username ?? null,
      legalName: designerAgreement.legalName, acceptanceStatus: "accepted",
      acceptedVersion: designerAgreement.agreementVersion, acceptedAt: designerAgreement.acceptedAt,
    },
    buyer: {
      userId: buyerUser._id, account: buyerWallet, username: buyerUser.username ?? null, legalName,
      acceptanceStatus: "accepted", acceptedVersion: terms.version, acceptedAt: now,
    },
    agreementVersion: terms.version,
    termsSnapshot: terms.text,
    termsSections: terms.sections,
    termsHash: terms.hash,
    governingLaw: terms.governingLaw,
    isDemo: terms.isDemo,
    buyerSignedMessage: message,
    buyerSignature: signature,
    history: [{ at: now, event: `Buyer accepted agreement version ${terms.version}` }],
  });
  return { agreement: (doc as unknown as { toObject: () => Record<string, unknown> }).toObject() };
}

type AgreementLean = {
  agreementId: string; designId: unknown; buyer: { account: string; acceptedAt: Date }; status: string;
  agreementVersion: string; termsHash: string; designerAgreementId: unknown;
};

/** Checks the buyer's accepted agreement is valid for paying right now (before any money moves). */
export async function agreementForPayment(designId: string, buyerWallet: string, agreementId: unknown, maxAgeMs?: number): Promise<Fail | { agreement: AgreementLean }> {
  if (typeof agreementId !== "string" || !agreementId)
    return { error: "Please read and accept the Exclusive Design Purchase Agreement first.", status: 400 };
  const a = await PurchaseAgreement.findOne({ agreementId }).lean<AgreementLean>();
  if (!a || String(a.designId) !== designId || a.buyer.account !== buyerWallet)
    return { error: "Please read and accept the Exclusive Design Purchase Agreement first.", status: 403 };
  if (a.status === "paid") return { error: "This agreement has already been paid for.", status: 409 };
  if (a.status !== "awaiting_payment") return { error: "This agreement is no longer valid. Please accept the current version.", status: 409 };
  if (maxAgeMs && Date.now() - new Date(a.buyer.acceptedAt).getTime() > maxAgeMs)
    return { error: "Your acceptance expired. Please accept the agreement again.", status: 409 };

  const terms = await currentTerms(designId);
  const gate = await getOwnershipGate(designId);
  if (!terms || a.agreementVersion !== terms.version || a.termsHash !== terms.hash || gate.designerAgreementId !== String(a.designerAgreementId)) {
    await PurchaseAgreement.updateOne(
      { agreementId, status: "awaiting_payment" },
      { $set: { status: "superseded", transferStatus: "superseded" }, $push: { history: { at: new Date(), event: "Superseded: terms or designer acceptance changed before payment" } } }
    );
    return { error: "The agreement was updated. Please review the new version and accept again.", status: 409 };
  }
  return { agreement: a };
}

/** Links a VERIFIED payment to the agreement (once). Demo payments are never marked legally effective. */
export async function recordAgreementPayment(agreementId: string, p: { method: "sol" | "bank"; amountSol: number; amountUsd: number | null; reference: string }) {
  const now = new Date();
  const a = await PurchaseAgreement.findOne({ agreementId }).select("isDemo").lean<{ isDemo: boolean }>();
  return PurchaseAgreement.findOneAndUpdate(
    { agreementId, status: "awaiting_payment" },
    {
      $set: {
        status: "paid",
        transactionId: `OWN-TXN-${randomUUID()}`,
        transferStatus: a?.isDemo ? "demo_not_legally_effective" : "payment_confirmed_pending_execution",
        payment: { method: p.method, amountSol: p.amountSol, amountUsd: p.amountUsd, status: "verified", reference: p.reference, verifiedAt: now },
        paidAt: now,
      },
      $push: { history: { at: now, event: `Payment verified (${p.method}, ref ${p.reference})` } },
    },
    { new: true }
  );
}

// ---- Access tokens for "My Agreements" (wallet signs once, then a short-lived HMAC token) ----
const secret = () => process.env.AGREEMENT_SESSION_SECRET || sha256(`ownique-agreements:${process.env.MONGODB_URI ?? ""}`);
export const VIEW_PREFIX = "Ownique: show my agreements";

export function issueToken(wallet: string, message: string, signature: string) {
  if (!verifyWalletMessage({ wallet, message, signature, prefix: VIEW_PREFIX })) return null;
  const payload = `${wallet}.${Date.now() + 30 * 60 * 1000}`;
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}

export function walletFromToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const [wallet, exp, mac] = token.split(".");
  if (!wallet || !exp || !mac || Number(exp) < Date.now()) return null;
  const good = createHmac("sha256", secret()).update(`${wallet}.${exp}`).digest("hex");
  return mac.length === good.length && timingSafeEqual(Buffer.from(mac), Buffer.from(good)) ? wallet : null;
}
