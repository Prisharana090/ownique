import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { getSessionAccount } from "@/lib/auth";
import { CATEGORIES } from "@/models/Design";
import { CURRENCIES, LIMITS, MATERIALS, STYLES, type Currency } from "@/lib/designOptions";
import { solToUsd, usdToSol } from "@/lib/price";

const PUBLIC_FIELDS = "title description price currency category style material status designerWallet isDemo imageHash createdAt";

type Lean = { _id: unknown; title: string; description: string; price: number; currency?: string; category: string; style?: string; material?: string; status: string; designerWallet: string; isDemo?: boolean };

// GET /api/designs/:id → public listing details (never the original file)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await connectDb();
  const d = await Design.findById(id).select(PUBLIC_FIELDS).lean<Lean>();
  if (!d || d.status === "hidden") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const currency = d.currency === "SOL" ? "SOL" : "USD";
  return NextResponse.json({ design: { ...d, _id: String(d._id), currency, listPrice: currency === "SOL" ? d.price : solToUsd(d.price) } });
}

/**
 * PATCH /api/designs/:id → the listing's own designer edits an UNSOLD listing.
 * Prices already recorded in purchase agreements are untouched: those records are immutable, and a buyer
 * whose accepted terms no longer match the current price must re-accept before paying.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (me.role !== "designer") return NextResponse.json({ error: "Only Designer accounts can edit listings." }, { status: 403 });
  await connectDb();
  const d = await Design.findById(id).select("designerWallet status").lean<{ designerWallet: string; status: string }>();
  if (!d || d.status === "hidden") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!me.walletAddress || me.walletAddress !== d.designerWallet) return NextResponse.json({ error: "You can only edit your own listings." }, { status: 403 });
  if (d.status !== "listed") return NextResponse.json({ error: "Sold designs can't be edited." }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (b.title !== undefined) {
    const t = String(b.title).trim();
    if (!t || t.length > LIMITS.title) return NextResponse.json({ error: `Title must be 1–${LIMITS.title} characters.` }, { status: 400 });
    update.title = t;
  }
  if (b.description !== undefined) {
    const t = String(b.description).trim();
    if (t.length > LIMITS.description) return NextResponse.json({ error: `Description must be ${LIMITS.description} characters or fewer.` }, { status: 400 });
    update.description = t;
  }
  if (b.category !== undefined) {
    if (!(CATEGORIES as readonly string[]).includes(b.category)) return NextResponse.json({ error: "Unknown product category." }, { status: 400 });
    update.category = b.category;
  }
  if (b.style !== undefined) {
    if (!(STYLES as readonly string[]).includes(b.style)) return NextResponse.json({ error: "Unknown style." }, { status: 400 });
    update.style = b.style;
  }
  if (b.material !== undefined) {
    if (!(MATERIALS as readonly string[]).includes(b.material)) return NextResponse.json({ error: "Unknown material." }, { status: 400 });
    update.material = b.material;
  }
  if (b.price !== undefined || b.currency !== undefined) {
    const currency = String(b.currency ?? "USD") as Currency;
    const listPrice = Number(b.price);
    if (!CURRENCIES.includes(currency)) return NextResponse.json({ error: "Choose USD or SOL." }, { status: 400 });
    const max = currency === "SOL" ? LIMITS.maxPriceSol : LIMITS.maxPriceUsd;
    if (!(listPrice > 0) || listPrice > max) return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
    const price = currency === "SOL" ? Math.round(listPrice * 1e6) / 1e6 : usdToSol(listPrice);
    if (!(price > 0)) return NextResponse.json({ error: "That price is too small." }, { status: 400 });
    update.price = price;
    update.currency = currency;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  // Only update while still unsold (guards against a sale landing at the same moment).
  const saved = await Design.findOneAndUpdate({ _id: id, status: "listed", designerWallet: me.walletAddress }, update, { new: true }).select(PUBLIC_FIELDS).lean<Lean>();
  if (!saved) return NextResponse.json({ error: "This design was just sold, so it can't be edited." }, { status: 409 });
  return NextResponse.json({ ok: true, design: { ...saved, _id: String(saved._id) } });
}
