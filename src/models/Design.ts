import { Schema, deleteModel, model, models } from "mongoose";

export { PRODUCT_CATEGORIES as CATEGORIES } from "@/lib/designOptions";
import { PRODUCT_CATEGORIES as CATEGORIES } from "@/lib/designOptions";

const DesignSchema = new Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true }, // in SOL
    category: { type: String, enum: CATEGORIES, default: "other" }, // product the design is made for
    currency: { type: String, enum: ["USD", "SOL"], default: "USD" }, // how the designer listed the price (stored price is SOL)
    style: { type: String, default: "other" },
    material: { type: String, default: "any" },
    isDemo: { type: Boolean, default: false }, // test/demo listing, labeled on cards
    // Watermarked public preview, made once at upload (the original above stays private).
    previewData: { type: Buffer, select: false, default: null },
    // Image is stored in MongoDB for hackathon simplicity (max ~2MB).
    imageData: { type: Buffer, required: true, select: false },
    imageType: { type: String, required: true },
    imageHash: { type: String, required: true, index: true }, // SHA-256: exact copies
    dHash: { type: String, default: null }, // perceptual hash: look-alike copies
    designerWallet: { type: String, required: true, index: true },
    ownerWallet: { type: String, default: null },
    status: { type: String, enum: ["listed", "sold", "hidden"], default: "listed" },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    describedByGrok: { type: Boolean, default: false },
    mintAddress: { type: String, default: null }, // Solana ownership token address
    txSignature: { type: String, default: null }, // Solana payment signature (crypto checkout)
    paymentMethod: { type: String, enum: ["sol", "bank", null], default: null },
    nessieTransferId: { type: String, default: null }, // Capital One Nessie transfer (bank checkout)
    priceUsd: { type: Number, default: null },
    tokenTransferSignature: { type: String, default: null },
    soldAt: { type: Date, default: null },
    // Designer Ownership Transfer Declaration (details live in DesignerAgreement)
    ownershipConfirmed: { type: Boolean, default: false },
    rightsReview: { type: String, enum: ["not_needed", "pending", "cleared", "rejected"], default: "not_needed" },
    agreedAt: { type: Date, required: true }, // when the designer ticked all checkboxes
  },
  { timestamps: true }
);

if (models.Design) deleteModel("Design"); // re-register on hot reload so new fields apply
export const Design = model("Design", DesignSchema) as unknown as (typeof models)[string]; // loosely typed, as before
