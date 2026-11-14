// Server helpers for the Designer Ownership Transfer Declaration.
import "server-only";
import { User } from "@/models/User";
import { Design } from "@/models/Design";
import { DesignerAgreement } from "@/models/DesignerAgreement";
import {
  CONFIRMATION_REQUIRED, DECLARATION_TEXT, DECLARATION_VERSION, RIGHTS_REVIEW_REQUIRED,
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
export async function recordDeclaration(designId: string, d: DeclarationInput) {
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
};

/** The single source of truth for "can this design be bought?" */
export async function getOwnershipGate(designId: string): Promise<OwnershipGate> {
  const a = await DesignerAgreement.findOne({ designId, status: "accepted" })
    .select("acceptedAt agreementVersion rightsReview")
    .lean<{ acceptedAt: Date; agreementVersion: string; rightsReview: OwnershipGate["rightsReview"] }>();
  if (!a) return { accepted: false, acceptedAt: null, agreementVersion: null, rightsReview: "not_needed", blockReason: CONFIRMATION_REQUIRED };
  const blocked = a.rightsReview === "pending" || a.rightsReview === "rejected";
  return {
    accepted: true,
    acceptedAt: a.acceptedAt,
    agreementVersion: a.agreementVersion,
    rightsReview: a.rightsReview,
    blockReason: blocked ? RIGHTS_REVIEW_REQUIRED : null,
  };
}
