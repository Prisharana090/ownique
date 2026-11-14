// Server helpers for the Designer Ownership Transfer Declaration.
import "server-only";
import { User } from "@/models/User";
import { Design } from "@/models/Design";
import { DesignerAgreement } from "@/models/DesignerAgreement";
import {
  CONFIRMATION_REQUIRED, DECLARATION_TEXT, DECLARATION_VERSION, REACCEPT_REQUIRED, RIGHTS_REVIEW_REQUIRED,
  cleanLegalName, declarationPrefix, isValidLegalName,
} from "@/lib/declaration";
import { verifyWalletMessage } from "@/lib/walletAuth";

export type DeclarationInput = {
  designerWallet: string;
  legalName: string;
  reviewedDeclaration: boolean;
  acceptedDeclaration: boolean;
  authorityConfirmed: boolean;
  thirdPartyContent: boolean;
  thirdPartyDetails: string;
  message: string;
  signature: string;
};

export function readDeclaration(form: FormData | Record<string, unknown>, designerWallet: string): DeclarationInput {
  const get = (k: string) => (form instanceof FormData ? form.get(k) : form[k]);
  return {
    designerWallet,
    legalName: cleanLegalName(String(get("legalName") ?? "")),
    reviewedDeclaration: String(get("reviewedDeclaration")) === "true",
    acceptedDeclaration: String(get("acceptedDeclaration")) === "true",
    authorityConfirmed: String(get("authorityConfirmed")) === "true",
    thirdPartyContent: String(get("thirdPartyContent")) === "true",
    thirdPartyDetails: String(get("thirdPartyDetails") ?? "").trim().slice(0, 1000),
    message: String(get("message") ?? ""),
    signature: String(get("signature") ?? ""),
  };
}

/** Returns an error message, or null if the declaration is complete and correctly signed. */
export function checkDeclaration(d: DeclarationInput): string | null {
  if (!isValidLegalName(d.legalName)) return "Please enter your full legal name (first and last name).";
  if (!d.reviewedDeclaration) return "Please confirm you have reviewed the ownership declaration.";
  if (!d.acceptedDeclaration) return "Please accept the ownership declaration.";
  if (!d.authorityConfirmed) return "Please confirm you have the authority to transfer these rights.";
  if (d.thirdPartyContent && d.thirdPartyDetails.length < 5)
    return "Please describe the third-party content (for example: a stock photo, a font, someone else's artwork).";
  const ok = verifyWalletMessage({
    wallet: d.designerWallet, message: d.message, signature: d.signature, prefix: declarationPrefix(d.legalName),
  });
  return ok ? null : "Please sign the ownership declaration with your wallet.";
}

/** Saves the acceptance (designer user id, legal name, design id, version, timestamp, status). */
// Older databases had one-agreement-per-design; amendments need one per version, so sync the indexes once.
let indexesSynced: Promise<unknown> | null = null;

export async function recordDeclaration(designId: string, d: DeclarationInput) {
  indexesSynced ??= (async () => {
    const idx = await DesignerAgreement.collection.indexes();
    if (idx.some((i) => i.name === "designId_1" && i.unique)) await DesignerAgreement.collection.dropIndex("designId_1");
    await DesignerAgreement.createIndexes();
  })().catch((e) => { indexesSynced = null; throw e; });
  await indexesSynced;
  const user = await User.findOneAndUpdate(
    { walletAddress: d.designerWallet },
    { $setOnInsert: { walletAddress: d.designerWallet } },
    { upsert: true, new: true }
  );
  const rightsReview = d.thirdPartyContent ? "pending" : "not_needed";
  const agreement = await DesignerAgreement.create({
    designId,
    designerUserId: user._id,
    designerWallet: d.designerWallet,
    legalName: d.legalName,
    agreementVersion: DECLARATION_VERSION,
    declarationText: DECLARATION_TEXT,
    acceptedAt: new Date(),
    status: "accepted",
    reviewedDeclaration: true,
    authorityConfirmed: true,
    signedMessage: d.message,
    signature: d.signature,
    thirdPartyContent: d.thirdPartyContent,
    thirdPartyDetails: d.thirdPartyDetails,
    rightsReview,
    history: [{ at: new Date(), event: `Designer accepted agreement version ${DECLARATION_VERSION}` }],
  });
  await Design.updateOne({ _id: designId }, { ownershipConfirmed: true, rightsReview });
  return agreement;
}

export type OwnershipGate = {
  accepted: boolean;
  acceptedAt: Date | null;
  agreementVersion: string | null;
  rightsReview: "not_needed" | "pending" | "cleared" | "rejected";
  blockReason: string | null; // why it can't be purchased right now (null = OK to buy)
  needsReaccept: boolean; // accepted an older version; the agreement was amended
  designerAgreementId: string | null;
};

/** The single source of truth for "can this design be bought?" */
export async function getOwnershipGate(designId: string): Promise<OwnershipGate> {
  // Only an acceptance of the CURRENT agreement version counts (amendments require fresh acceptance).
  const a = await DesignerAgreement.findOne({ designId, status: "accepted", agreementVersion: DECLARATION_VERSION })
    .select("_id acceptedAt agreementVersion rightsReview")
    .lean<{ _id: unknown; acceptedAt: Date; agreementVersion: string; rightsReview: OwnershipGate["rightsReview"] }>();
  if (!a) {
    const old = await DesignerAgreement.exists({ designId, status: "accepted" });
    return {
      accepted: false, acceptedAt: null, agreementVersion: null, rightsReview: "not_needed",
      blockReason: old ? REACCEPT_REQUIRED : CONFIRMATION_REQUIRED, needsReaccept: Boolean(old), designerAgreementId: null,
    };
  }
  const blocked = a.rightsReview === "pending" || a.rightsReview === "rejected";
  return {
    accepted: true,
    acceptedAt: a.acceptedAt,
    agreementVersion: a.agreementVersion,
    rightsReview: a.rightsReview,
    blockReason: blocked ? RIGHTS_REVIEW_REQUIRED : null,
    needsReaccept: false,
    designerAgreementId: String(a._id),
  };
}
