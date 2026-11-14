import { Schema, model, models } from "mongoose";

const ReportSchema = new Schema(
  {
    designId: { type: Schema.Types.ObjectId, ref: "Design", required: true },
    reporterWallet: { type: String, default: null },
    reason: { type: String, required: true },
    status: { type: String, enum: ["open", "restored", "removed"], default: "open" },
  },
  { timestamps: true }
);

export const Report = models.Report || model("Report", ReportSchema);
