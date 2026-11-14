import { Schema, deleteModel, model, models } from "mongoose";
import { protectRecords } from "@/lib/immutable";

// One record per design AND agreement version (amendments add a new record; old ones are kept): the designer's acceptance of the Ownership Transfer Declaration.
const DesignerAgreementSchema = new Schema(
  {
    designId: { type: Schema.Types.ObjectId, ref: "Design", required: true, index: true },
    designerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    designerWallet: { type: String, required: true }, // original creator attribution (unchanged)
    legalName: { type: String, required: true }, // private: never shown publicly
    agreementVersion: { type: String, required: true },
    declarationText: { type: String, required: true }, // snapshot of what was accepted
    acceptedAt: { type: Date, required: true },
    status: { type: String, enum: ["accepted", "revoked"], default: "accepted" },
    reviewedDeclaration: { type: Boolean, required: true },
    authorityConfirmed: { type: Boolean, required: true },
    // Evidence: the wallet signature over the declaration sentence (legal name + version + time)
    signedMessage: { type: String, required: true },
    signature: { type: String, required: true },
    // Third-party content needs a separate rights review before the design can be sold
    thirdPartyContent: { type: Boolean, default: false },
    thirdPartyDetails: { type: String, default: "" },
    rightsReview: { type: String, enum: ["not_needed", "pending", "cleared", "rejected"], default: "not_needed" },
    history: { type: [{ at: Date, event: String }], default: [] }, // audit trail (append-only)
  },
  { timestamps: true }
);

DesignerAgreementSchema.index({ designId: 1, agreementVersion: 1 }, { unique: true });
protectRecords(DesignerAgreementSchema, ["status", "rightsReview", "history"], "Designer agreement");

// Re-register on hot reload so schema changes (indexes, protection hooks) always apply.
if (models.DesignerAgreement) deleteModel("DesignerAgreement");
export const DesignerAgreement = model("DesignerAgreement", DesignerAgreementSchema);
