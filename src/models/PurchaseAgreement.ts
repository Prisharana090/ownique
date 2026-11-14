import { Schema, deleteModel, model, models } from "mongoose";
import { protectRecords } from "@/lib/immutable";

// The Exclusive Design Purchase Agreement for one purchase. The terms snapshot, hash, version and both
// parties' acceptances are frozen once created; only status/payment fields may change, and every change is logged.
const Party = {
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  account: { type: String, required: true }, // Ownique account = wallet address
  username: { type: String, default: null },
  legalName: { type: String, required: true },
  acceptanceStatus: { type: String, enum: ["accepted"], required: true },
  acceptedVersion: { type: String, required: true },
  acceptedAt: { type: Date, required: true }, // server-generated, never from the browser
};

const PurchaseAgreementSchema = new Schema(
  {
    agreementId: { type: String, required: true, unique: true },
    transactionId: { type: String, default: undefined, unique: true, sparse: true },
    designId: { type: Schema.Types.ObjectId, ref: "Design", required: true, index: true },
    designTitle: { type: String, required: true },
    priceSol: { type: Number, required: true },
    designerAgreementId: { type: Schema.Types.ObjectId, ref: "DesignerAgreement", required: true },
    designer: Party,
    buyer: Party,
    agreementVersion: { type: String, required: true },
    termsSnapshot: { type: String, required: true }, // exact text both parties accepted
    termsSections: { type: Schema.Types.Mixed, required: true },
    termsHash: { type: String, required: true }, // SHA-256 of termsSnapshot
    governingLaw: { type: String, default: null }, // null = flagged for legal review
    isDemo: { type: Boolean, required: true },
    buyerSignedMessage: { type: String, required: true },
    buyerSignature: { type: String, required: true },
    status: { type: String, enum: ["awaiting_payment", "paid", "superseded"], default: "awaiting_payment", index: true },
    transferStatus: {
      type: String,
      enum: ["awaiting_payment", "demo_not_legally_effective", "payment_confirmed_pending_execution", "superseded"],
      default: "awaiting_payment",
    },
    payment: {
      method: { type: String, enum: ["sol", "bank", null], default: null },
      amountSol: { type: Number, default: null },
      amountUsd: { type: Number, default: null },
      status: { type: String, enum: ["none", "verified"], default: "none" },
      reference: { type: String, default: null }, // Solana signature or Nessie transfer id
      verifiedAt: { type: Date, default: null },
    },
    paidAt: { type: Date, default: null },
    history: { type: [{ at: Date, event: String }], default: [] }, // append-only audit trail
  },
  { timestamps: true }
);
PurchaseAgreementSchema.index({ "payment.reference": 1 }, { unique: true, partialFilterExpression: { "payment.reference": { $type: "string" } } });
PurchaseAgreementSchema.index({ "buyer.account": 1 });
PurchaseAgreementSchema.index({ "designer.account": 1 });

protectRecords(PurchaseAgreementSchema, ["status", "transferStatus", "transactionId", "payment", "paidAt", "history"], "Purchase agreement");

// Re-register on hot reload so schema changes (indexes, protection hooks) always apply.
if (models.PurchaseAgreement) deleteModel("PurchaseAgreement");
export const PurchaseAgreement = model("PurchaseAgreement", PurchaseAgreementSchema);

// Generated PDFs are stored once per agreement + terms hash and never replaced.
const AgreementDocumentSchema = new Schema(
  {
    agreementId: { type: String, required: true },
    termsHash: { type: String, required: true },
    agreementVersion: { type: String, required: true },
    pdf: { type: Buffer, required: true, select: false },
    sha256: { type: String, required: true },
  },
  { timestamps: true }
);
AgreementDocumentSchema.index({ agreementId: 1, termsHash: 1 }, { unique: true });
protectRecords(AgreementDocumentSchema, [], "Agreement document");
if (models.AgreementDocument) deleteModel("AgreementDocument");
export const AgreementDocument = model("AgreementDocument", AgreementDocumentSchema);
