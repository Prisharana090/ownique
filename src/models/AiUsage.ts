import { Schema, model, models } from "mongoose";
// One row per UTC day: how many AI-Enhanced Previews were requested (keeps us inside the free allowance).
const AiUsageSchema = new Schema({ day: { type: String, required: true, unique: true }, count: { type: Number, default: 0 } });
export const AiUsage = models.AiUsage || model("AiUsage", AiUsageSchema);
