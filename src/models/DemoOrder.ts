// 🎬 Demo Mode: an isolated sample order a designer can walk through for judges.
// Lives in its own collection (demo_orders) and never touches real designs, accounts, payments, sales or ratings.
// One ACTIVE demo per designer account; "Reset Demo" archives it (kept for audit) and starts a fresh one.
import { Schema, deleteModel, model, models } from "mongoose";
import { protectRecords } from "@/lib/immutable";

const Acceptance = new Schema(
  { version: String, termsHash: String, acceptedAt: Date, by: String, simulated: Boolean },
  { _id: false }
);

const DemoOrderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true }, // DEMO-ORDER-xxxx
    designerAccountId: { type: String, required: true, index: true }, // whose isolated demo session this is
    designerUsername: { type: String, required: true },
    designerName: { type: String, required: true },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    status: { type: String, enum: ["order_received", "completed"], default: "order_received" },

    // Sample design (demo only: not in the shop, not a real listing)
    design: {
      demoDesignId: { type: String, required: true },
      title: { type: String, required: true },
      category: { type: String, required: true },
      priceSol: { type: Number, required: true },
      priceUsd: { type: Number, required: true },
      seed: { type: Number, required: true }, // picks the generated demo artwork
      status: { type: String, enum: ["listed", "sold"], default: "listed" },
      ownerLabel: { type: String, default: null }, // demo buyer after transfer
      creatorCredit: { type: String, required: true }, // original creator, kept forever
    },

    // Fictional buyer
    buyer: {
      name: { type: String, required: true },
      username: { type: String, required: true },
      email: { type: String, required: true },
      location: { type: String, required: true },
      fictional: { type: Boolean, default: true },
    },

    // Agreement snapshot taken when the order was created (never changed afterwards)
    agreement: {
      version: { type: String, required: true },
      termsHash: { type: String, required: true },
      sections: { type: [{ heading: String, body: [String] }], required: true },
    },

    designerAcceptance: { type: Acceptance, default: null },
    buyerAcceptance: { type: Acceptance, default: null },
    payment: {
      status: { type: String, enum: ["pending", "confirmed_simulated"], default: "pending" },
      reference: { type: String, default: null },
      confirmedAt: { type: Date, default: null },
    },
    transfer: {
      completedAt: { type: Date, default: null },
      recipient: { type: String, default: null },
      transferId: { type: String, default: null },
    },
    transferCount: { type: Number, default: 0 }, // must never exceed 1 (proves no duplicate transfers)
    purchaseAttemptsBlocked: { type: Number, default: 0 },
    timeline: { type: [{ type: { type: String }, label: String, at: Date, _id: false }], default: [] },
  },
  { timestamps: true, collection: "demo_orders" }
);

// Only one active (non-archived) demo per designer, even if two tabs load at once.
DemoOrderSchema.index({ designerAccountId: 1 }, { unique: true, partialFilterExpression: { archived: false }, name: "one_active_demo_per_designer" });

// Audit-safe: never deleted; the agreement snapshot, buyer and identity fields can't change after creation.
protectRecords(
  DemoOrderSchema,
  ["archived", "archivedAt", "status", "design", "designerAcceptance", "buyerAcceptance", "payment", "transfer", "transferCount", "purchaseAttemptsBlocked", "timeline"],
  "Demo order"
);

if (models.DemoOrder) deleteModel("DemoOrder");
export const DemoOrder = model("DemoOrder", DemoOrderSchema) as unknown as (typeof models)[string];
