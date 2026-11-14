import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    walletAddress: { type: String, required: true, unique: true },
    username: { type: String },
    email: { type: String },
    verified: { type: Boolean, default: false },
    // Capital One Nessie practice bank account (for "Pay with bank")
    nessieCustomerId: { type: String, default: null },
    nessieAccountId: { type: String, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = models.User || model("User", UserSchema);
