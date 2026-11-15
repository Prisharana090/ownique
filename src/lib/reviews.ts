// Designer ratings: eligibility from REAL verified purchases, averages from saved non-demo reviews only.
import "server-only";
import { Design } from "@/models/Design";
import { Review } from "@/models/Account";
import { PurchaseAgreement } from "@/models/PurchaseAgreement";
import type { SessionAccount } from "@/lib/auth";

type DesignLean = { _id: unknown; title: string; designerWallet: string; ownerWallet: string | null; status: string; txSignature?: string | null; nessieTransferId?: string | null };

/** Proof that this design was actually paid for (Solana payment, bank transfer, or a paid purchase agreement). */
async function purchaseRef(d: DesignLean): Promise<string | null> {
  if (d.txSignature) return d.txSignature;
  if (d.nessieTransferId) return d.nessieTransferId;
  const a = await PurchaseAgreement.findOne({ designId: String(d._id), status: "paid", "buyer.account": d.ownerWallet }).select("payment.reference").lean<{ payment?: { reference?: string } }>();
  return a?.payment?.reference ?? null;
}

/** Designs this buyer bought from the given designer (completed purchases only). */
export async function eligibleDesigns(me: SessionAccount | null, designerWallet: string) {
  if (!me || me.role !== "buyer" || !me.walletAddress || me.walletAddress === designerWallet) return [];
  const bought = await Design.find({ designerWallet, ownerWallet: me.walletAddress, status: "sold" })
    .select("title designerWallet ownerWallet status txSignature nessieTransferId").lean<DesignLean[]>();
  const out: { designId: string; title: string; ref: string }[] = [];
  for (const d of bought) {
    const ref = await purchaseRef(d);
    if (ref) out.push({ designId: String(d._id), title: d.title, ref });
  }
  return out;
}

export async function summary(designerWallet: string) {
  const rows = await Review.aggregate([
    { $match: { designerWallet, isDemo: false } },
    { $group: { _id: "$rating", n: { $sum: 1 } } },
  ]);
  const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: rows.find((r) => r._id === star)?.n ?? 0 }));
  const count = dist.reduce((s, d) => s + d.count, 0);
  const average = count ? Math.round((dist.reduce((s, d) => s + d.star * d.count, 0) / count) * 10) / 10 : null;
  return { average, count, dist };
}

/** Create or (for its own author) edit the review for one purchased design. Returns an error message or null. */
export async function saveReview(me: SessionAccount | null, designId: string, rating: number, text: string): Promise<{ error: string; status: number } | null> {
  if (!me) return { error: "Please log in to leave feedback.", status: 401 };
  if (me.role !== "buyer") return { error: "Only buyers can review designers.", status: 403 };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a rating from 1 to 5 stars.", status: 400 };
  const d = await Design.findById(designId).select("title designerWallet ownerWallet status txSignature nessieTransferId").lean<DesignLean>();
  if (!d) return { error: "Design not found.", status: 404 };
  if (!me.walletAddress || d.status !== "sold" || d.ownerWallet !== me.walletAddress)
    return { error: "You can only review a designer after completing a purchase from them (with the wallet linked to your account).", status: 403 };
  if (d.designerWallet === me.walletAddress) return { error: "You can't review yourself.", status: 403 };
  const ref = await purchaseRef(d);
  if (!ref) return { error: "We couldn't find a verified payment for this purchase.", status: 403 };

  const existing = await Review.findOne({ designId }).select("buyerAccountId").lean<{ buyerAccountId: unknown }>();
  if (existing) {
    if (String(existing.buyerAccountId) !== me._id) return { error: "This purchase already has a review.", status: 409 };
    await Review.updateOne({ designId }, { rating, text: text.trim().slice(0, 1000) }); // the author edits their own review
    return null;
  }
  try {
    await Review.create({ designId, designerWallet: d.designerWallet, buyerAccountId: me._id, buyerUsername: me.username, purchaseRef: ref, rating, text: text.trim().slice(0, 1000) });
  } catch {
    return { error: "This purchase already has a review.", status: 409 };
  }
  return null;
}
