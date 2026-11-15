import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { Review } from "@/models/Account";
import { getSessionAccount } from "@/lib/auth";
import { eligibleDesigns, saveReview, summary } from "@/lib/reviews";

/** GET ?designer=<wallet> → public summary + reviews, and (for a signed-in buyer) purchases they can review. */
export async function GET(req: Request) {
  const designer = new URL(req.url).searchParams.get("designer") ?? "";
  if (!hasDb() || !designer) return NextResponse.json({ summary: { average: null, count: 0, dist: [] }, reviews: [], eligible: [] });
  await connectDb();
  const me = await getSessionAccount();
  const [sum, reviews, eligible] = await Promise.all([
    summary(designer),
    Review.find({ designerWallet: designer, isDemo: false }).sort({ createdAt: -1 }).limit(50)
      .select("designId buyerUsername buyerAccountId rating text createdAt updatedAt").lean<{ buyerAccountId: unknown }[]>(),
    eligibleDesigns(me, designer),
  ]);
  return NextResponse.json({
    summary: sum,
    reviews: reviews.map((r) => ({ ...r, buyerAccountId: undefined, mine: Boolean(me && String(r.buyerAccountId) === me._id) })),
    eligible,
  });
}

/** POST { designId, rating, text } → create, or edit your own review. Eligibility is checked on the server. */
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  await connectDb();
  const b = await req.json().catch(() => ({}));
  const err = await saveReview(await getSessionAccount(), String(b.designId ?? ""), Number(b.rating), String(b.text ?? ""));
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });
  return NextResponse.json({ ok: true });
}
