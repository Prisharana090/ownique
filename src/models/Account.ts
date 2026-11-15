import { Schema, model, models } from "mongoose";

// Email + password accounts. The role (buyer or designer) is chosen once at sign-up and can never change.
const AccountSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["buyer", "designer"], required: true, immutable: true },
    bio: { type: String, default: "" },
    avatar: { type: Buffer, default: null, select: false },
    hasAvatar: { type: Boolean, default: false },
    walletAddress: { type: String, default: undefined, unique: true, sparse: true }, // linked Solana wallet (for buying/selling)
    resetTokenHash: { type: String, default: null, select: false },
    resetExpires: { type: Date, default: null, select: false },
    termsAcceptedAt: { type: Date, required: true },
  },
  { timestamps: true }
);
export const Account = models.Account || model("Account", AccountSchema);

// Reviews of designers. One per completed purchase (each design sells once, so one per design).
const ReviewSchema = new Schema(
  {
    designId: { type: Schema.Types.ObjectId, ref: "Design", required: true, unique: true },
    designerWallet: { type: String, required: true, index: true },
    buyerAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    buyerUsername: { type: String, required: true },
    purchaseRef: { type: String, required: true }, // payment signature / transfer id of the verified purchase
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "" },
    isDemo: { type: Boolean, default: false }, // demo/test reviews never count toward ratings
    reports: { type: [{ reason: String, at: Date, reporter: String }], default: [], select: false },
  },
  { timestamps: true }
);
export const Review = models.Review || model("Review", ReviewSchema);
