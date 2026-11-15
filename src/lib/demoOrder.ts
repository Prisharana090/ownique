// 🎬 Demo Order & Ownership Transfer: server logic. Everything here reads/writes ONLY the demo_orders
// collection and generated demo files. No real listing, account, payment, Solana transaction, sale total
// (Tiger Data events) or rating is touched.
import "server-only";
import { createHash, randomUUID } from "crypto";
import sharp from "sharp";
import { DemoOrder } from "@/models/DemoOrder";
import { AGREEMENT_VERSION, buildPurchaseTerms, termsToText, type TermsSection } from "@/lib/purchaseTerms";
import { solToUsd } from "@/lib/price";
import { watermark } from "@/lib/designImage";
import type { SessionAccount } from "@/lib/auth";

export const DEMO_DISCLAIMER = "Demonstration only. No real payment or legal copyright transfer occurs.";

const SAMPLES = [
  { title: "Moonlit Iris (Demo)", category: "tote", priceSol: 0.4 },
  { title: "Peony Daydream (Demo)", category: "cup", priceSol: 0.3 },
  { title: "Wisteria Lace (Demo)", category: "shirt", priceSol: 0.5 },
];
const BUYERS = [
  { name: "Avery Lin", username: "avery_demo", email: "avery.lin@example.test", location: "Princeton, NJ (fictional)" },
  { name: "Jordan Patel", username: "jordan_demo", email: "jordan.patel@example.test", location: "Brooklyn, NY (fictional)" },
];

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const short = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

export type DemoLean = {
  _id: unknown; orderId: string; designerAccountId: string; designerUsername: string; designerName: string;
  archived: boolean; archivedAt: Date | null; status: "order_received" | "completed";
  design: { demoDesignId: string; title: string; category: string; priceSol: number; priceUsd: number; seed: number; status: "listed" | "sold"; ownerLabel: string | null; creatorCredit: string };
  buyer: { name: string; username: string; email: string; location: string; fictional: boolean };
  agreement: { version: string; termsHash: string; sections: TermsSection[] };
  designerAcceptance: { version: string; termsHash: string; acceptedAt: Date; by: string } | null;
  buyerAcceptance: { version: string; termsHash: string; acceptedAt: Date; by: string; simulated: boolean } | null;
  payment: { status: "pending" | "confirmed_simulated"; reference: string | null; confirmedAt: Date | null };
  transfer: { completedAt: Date | null; recipient: string | null; transferId: string | null };
  transferCount: number; purchaseAttemptsBlocked: number;
  timeline: { type: string; label: string; at: Date }[];
  createdAt: Date;
};

/** Agreement snapshot for a demo order: the real purchase terms, filled with demo data, plus a demo notice. */
function demoAgreement(designId: string, s: (typeof SAMPLES)[number], me: SessionAccount) {
  const sections = buildPurchaseTerms({
    designId, title: s.title, category: s.category, priceSol: s.priceSol, priceUsd: solToUsd(s.priceSol),
    designerAccount: `@${me.username} (demo session)`, designerUsername: me.displayName, governingLaw: null, isDemo: true,
  });
  sections.push({
    heading: "Demo Mode Notice",
    body: [
      DEMO_DISCLAIMER,
      "The buyer in this order is fictional. Buyer acceptance and payment are simulated by the designer for demonstration. No money is charged and no blockchain transaction is sent.",
    ],
  });
  return { version: AGREEMENT_VERSION, sections, termsHash: sha256(termsToText(sections)) };
}

async function createOrder(me: SessionAccount, previous = 0) {
  const s = SAMPLES[previous % SAMPLES.length];
  const b = BUYERS[previous % BUYERS.length];
  const demoDesignId = `DEMO-DESIGN-${short()}`;
  const now = new Date();
  return DemoOrder.create({
    orderId: `DEMO-ORDER-${short()}`,
    designerAccountId: me._id,
    designerUsername: me.username,
    designerName: me.displayName,
    design: {
      demoDesignId, title: s.title, category: s.category, priceSol: s.priceSol, priceUsd: solToUsd(s.priceSol),
      seed: Math.floor(Math.random() * 1e6), status: "listed", ownerLabel: null,
      creatorCredit: `${me.displayName} (@${me.username})`,
    },
    buyer: { ...b, fictional: true },
    agreement: demoAgreement(demoDesignId, s, me),
    timeline: [{ type: "order_received", label: `Order received from ${b.name} (fictional demo buyer)`, at: now }],
  });
}

/** The designer's active demo order, created if missing. Concurrent first loads can't create two. */
export async function activeOrder(me: SessionAccount): Promise<DemoLean> {
  const found = await DemoOrder.findOne({ designerAccountId: me._id, archived: false }).lean<DemoLean>();
  if (found) return found;
  const previous = await DemoOrder.countDocuments({ designerAccountId: me._id });
  try {
    await createOrder(me, previous);
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // another request created it first
  }
  return (await DemoOrder.findOne({ designerAccountId: me._id, archived: false }).lean<DemoLean>())!;
}

export const archivedCount = (me: SessionAccount) => DemoOrder.countDocuments({ designerAccountId: me._id, archived: true });

type Result = { ok: true; order: DemoLean; message: string; already?: boolean } | { ok: false; status: number; error: string; missing?: string[] };

/** Every action is scoped to THIS designer's active order and uses an atomic, conditional update. */
export async function demoAction(me: SessionAccount, orderId: string, action: string, body: { version?: string; termsHash?: string }): Promise<Result> {
  const order = await DemoOrder.findOne({ orderId, designerAccountId: me._id }).lean<DemoLean>();
  if (!order) return { ok: false, status: 404, error: "Demo order not found in your demo session." };
  if (order.archived) return { ok: false, status: 409, error: "This demo order was archived by Reset Demo. Reload to see your current demo." };
  const scope = { orderId, designerAccountId: me._id, archived: false };
  const sameTerms = body.version === order.agreement.version && body.termsHash === order.agreement.termsHash;
  const now = () => new Date();
  const update = async (filter: Record<string, unknown>, set: Record<string, unknown>, label: string, type: string, extra: Record<string, unknown> = {}) => {
    const at = now();
    return DemoOrder.findOneAndUpdate({ ...scope, ...filter }, { $set: set, $push: { timeline: { type, label, at } }, ...extra }, { returnDocument: "after" }).lean<DemoLean>();
  };
  const fresh = async () => (await DemoOrder.findOne(scope).lean<DemoLean>())!;

  switch (action) {
    case "designer_accept": {
      if (!sameTerms) return { ok: false, status: 409, error: "The agreement you read doesn't match this order's agreement. Reload and read it again." };
      if (order.designerAcceptance) return { ok: true, order, message: "You already accepted this agreement.", already: true };
      const at = now();
      const saved = await update(
        { designerAcceptance: null },
        { designerAcceptance: { version: order.agreement.version, termsHash: order.agreement.termsHash, acceptedAt: at, by: `${me.displayName} (@${me.username})`, simulated: false } },
        `Designer ${me.displayName} accepted agreement ${order.agreement.version}`, "designer_accepted"
      );
      return { ok: true, order: saved ?? (await fresh()), message: "Your acceptance is recorded.", already: !saved };
    }
    case "buyer_accept": {
      if (!sameTerms) return { ok: false, status: 409, error: "Agreement version mismatch. Reload and try again." };
      if (order.buyerAcceptance) return { ok: true, order, message: "The demo buyer already accepted.", already: true };
      const at = now();
      const saved = await update(
        { buyerAcceptance: null },
        { buyerAcceptance: { version: order.agreement.version, termsHash: order.agreement.termsHash, acceptedAt: at, by: `${order.buyer.name} (fictional)`, simulated: true } },
        `SIMULATED: ${order.buyer.name} accepted agreement ${order.agreement.version}`, "buyer_accepted_simulated"
      );
      return { ok: true, order: saved ?? (await fresh()), message: "Simulated buyer acceptance recorded.", already: !saved };
    }
    case "confirm_payment": {
      if (!order.buyerAcceptance) return { ok: false, status: 409, error: "The buyer must accept the agreement before payment.", missing: ["buyer acceptance"] };
      if (order.payment.status === "confirmed_simulated") return { ok: true, order, message: "Demo payment already confirmed.", already: true };
      const reference = `DEMO-PAY-${short()}`;
      const saved = await update(
        { "payment.status": "pending", buyerAcceptance: { $ne: null } },
        { payment: { status: "confirmed_simulated", reference, confirmedAt: now() } },
        `SIMULATED: payment of ${order.design.priceSol} SOL (≈ $${order.design.priceUsd}) confirmed · ${reference} · no money moved`, "payment_simulated"
      );
      return { ok: true, order: saved ?? (await fresh()), message: "Simulated payment confirmed. No money was charged.", already: !saved };
    }
    case "approve": {
      // All prerequisites are part of the atomic filter: only one request can ever complete the transfer.
      const v = order.agreement.version, h = order.agreement.termsHash;
      const transferId = `DEMO-TRANSFER-${short()}`;
      const at = now();
      const saved = await DemoOrder.findOneAndUpdate(
        {
          ...scope, status: "order_received", transferCount: 0, "design.status": "listed",
          "designerAcceptance.version": v, "designerAcceptance.termsHash": h,
          "buyerAcceptance.version": v, "buyerAcceptance.termsHash": h,
          "payment.status": "confirmed_simulated",
        },
        {
          $set: {
            status: "completed",
            "design.status": "sold",
            "design.ownerLabel": `${order.buyer.name} (fictional demo buyer)`,
            transfer: { completedAt: at, recipient: `${order.buyer.name} (@${order.buyer.username}, fictional)`, transferId },
          },
          $inc: { transferCount: 1 },
          $push: { timeline: { type: "transfer_completed", label: `Demo ownership transferred to ${order.buyer.name} · ${transferId} · creator credit kept`, at } },
        },
        { returnDocument: "after" }
      ).lean<DemoLean>();
      if (saved) return { ok: true, order: saved, message: "Demo ownership transfer completed." };
      const now2 = await fresh();
      if (now2.status === "completed") return { ok: true, order: now2, message: "Demo ownership transfer completed.", already: true };
      const missing = [
        !(now2.designerAcceptance?.version === v && now2.designerAcceptance?.termsHash === h) && "designer acceptance",
        !(now2.buyerAcceptance?.version === v && now2.buyerAcceptance?.termsHash === h) && "buyer acceptance",
        now2.payment.status !== "confirmed_simulated" && "payment confirmation",
      ].filter(Boolean) as string[];
      return { ok: false, status: 409, error: `Can't approve yet. Still missing: ${missing.join(", ")}.`, missing };
    }
    case "purchase_attempt": {
      // Simulates another shopper trying to buy the demo design. Never changes ownership.
      if (order.design.status === "sold") {
        const saved = await update({ "design.status": "sold" }, {}, "Blocked a second purchase attempt: design already sold", "purchase_blocked", { $inc: { purchaseAttemptsBlocked: 1 } });
        return { ok: false, status: 409, error: "This design has already been sold to its one owner. It can't be purchased again.", missing: saved ? [] : undefined };
      }
      return { ok: true, order, message: "The demo design is still available (this check doesn't buy it)." };
    }
    default:
      return { ok: false, status: 400, error: "Unknown demo action." };
  }
}

/** Reset Demo: archives ONLY this designer's active demo order (kept for audit) and creates a fresh one. */
export async function resetDemo(me: SessionAccount) {
  const at = new Date();
  await DemoOrder.updateMany(
    { designerAccountId: me._id, archived: false },
    { $set: { archived: true, archivedAt: at }, $push: { timeline: { type: "archived", label: "Archived by Reset Demo", at } } }
  );
  return activeOrder(me);
}

/** What the browser gets (no internal ids). */
export function publicOrder(o: DemoLean) {
  const { _id: _ignore, designerAccountId: _acc, ...rest } = o;
  void _ignore; void _acc;
  return {
    ...rest,
    canApprove:
      o.status === "order_received" &&
      o.designerAcceptance?.version === o.agreement.version && o.designerAcceptance?.termsHash === o.agreement.termsHash &&
      o.buyerAcceptance?.version === o.agreement.version && o.buyerAcceptance?.termsHash === o.agreement.termsHash &&
      o.payment.status === "confirmed_simulated",
  };
}

// ---------- Demo files (generated, never a real design) ----------

const g = globalThis as unknown as { _demoArt?: Map<string, Buffer> };
const artCache = (g._demoArt ??= new Map<string, Buffer>());

/** The demo "original": a generated floral artwork, labeled as demo. */
export async function demoOriginal(seed: number, title: string) {
  const key = `o:${seed}`;
  const hit = artCache.get(key);
  if (hit) return hit;
  const rnd = (n: number) => { const x = Math.sin(seed * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  const palette = ["#b79ad9", "#e7b3c6", "#8e6bbf", "#f3d9e4", "#6b3f7a"];
  let petals = "";
  for (let f = 0; f < 5; f++) {
    const cx = 160 + rnd(f) * 680, cy = 160 + rnd(f + 10) * 600, r = 60 + rnd(f + 20) * 70, col = palette[f % palette.length];
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2 + rnd(f + 30);
      petals += `<ellipse cx="${(cx + Math.cos(a) * r * 0.7).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.7).toFixed(1)}" rx="${(r * 0.55).toFixed(1)}" ry="${(r * 0.28).toFixed(1)}" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${(cx + Math.cos(a) * r * 0.7).toFixed(1)} ${(cy + Math.sin(a) * r * 0.7).toFixed(1)})" fill="${col}" fill-opacity="0.85"/>`;
    }
    petals += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.22).toFixed(1)}" fill="#f6e7b8"/>`;
  }
  const safeTitle = title.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
    <rect width="1000" height="1000" fill="#faf5ee"/>${petals}
    <rect x="0" y="900" width="1000" height="100" fill="#4a2b5e" fill-opacity="0.9"/>
    <text x="500" y="962" font-family="Georgia, serif" font-size="36" fill="#faf5ee" text-anchor="middle">${safeTitle} · DEMO FILE · not a real design</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  artCache.set(key, png);
  if (artCache.size > 40) artCache.delete(artCache.keys().next().value!);
  return png;
}

export async function demoPreview(seed: number, title: string) {
  const key = `p:${seed}`;
  const hit = artCache.get(key);
  if (hit) return hit;
  const jpg = await watermark(await demoOriginal(seed, title));
  artCache.set(key, jpg);
  return jpg;
}
