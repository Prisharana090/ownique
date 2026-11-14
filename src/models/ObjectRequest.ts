import { Schema, model, models } from "mongoose";

// "Design My Object": a buyer posts a photo of their object; designers reply with their listed designs + a mockup.
const ObjectRequestSchema = new Schema(
  {
    buyerWallet: { type: String, required: true, index: true },
    photo: { type: Buffer, required: true, select: false }, // re-encoded JPEG (metadata stripped)
    material: { type: String, required: true },
    style: { type: String, default: "" },
    budgetSol: { type: Number, default: null },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    shortlist: { type: [Schema.Types.ObjectId], default: [], select: false }, // private to the buyer
  },
  { timestamps: true }
);
export const ObjectRequest = models.ObjectRequest || model("ObjectRequest", ObjectRequestSchema);

const RequestReplySchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: "ObjectRequest", required: true, index: true },
    designId: { type: Schema.Types.ObjectId, ref: "Design", required: true },
    designerWallet: { type: String, required: true },
    explanation: { type: String, required: true },
    mockup: { type: Buffer, required: true, select: false }, // made with Try It On from the watermarked preview
    mockupKind: { type: String, enum: ["manual", "ai"], required: true },
  },
  { timestamps: true }
);
RequestReplySchema.index({ requestId: 1, designId: 1 }, { unique: true });
export const RequestReply = models.RequestReply || model("RequestReply", RequestReplySchema);
