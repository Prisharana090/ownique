import { Schema, model, models } from "mongoose";

export const CATEGORIES = ["cup", "glasses", "shirt", "phone case", "tote", "other"] as const;

const DesignSchema = new Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true }, // in SOL
    category: { type: String, enum: CATEGORIES, default: "other" },
    // Image is stored in MongoDB for hackathon simplicity (max ~2MB).
    imageData: { type: Buffer, required: true, select: false },
    imageType: { type: String, required: true },
    imageHash: { type: String, required: true, index: true }, // SHA-256 for duplicate blocking
    designerWallet: { type: String, required: true, index: true },
    ownerWallet: { type: String, default: null },
    status: { type: String, enum: ["listed", "sold", "hidden"], default: "listed" },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    describedByGrok: { type: Boolean, default: false },
    mintAddress: { type: String, default: null }, // TODO: Solana NFT (Prompt 7)
    txSignature: { type: String, default: null }, // TODO: purchase tx (Prompt 8)
    soldAt: { type: Date, default: null },
    agreedAt: { type: Date, required: true }, // when the designer ticked all checkboxes
  },
  { timestamps: true }
);

export const Design = models.Design || model("Design", DesignSchema);
