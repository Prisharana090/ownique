import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { Review } from "@/models/Account";
import { getSessionAccount, throttled } from "@/lib/auth";

/** POST { reason } — flags a review for moderation. Requires an account; reviews are never deleted by designers. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionAccount();
  if (!me) return NextResponse.json({ error: "Please log in to report feedback." }, { status: 401 });
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (throttled(`report:${me._id}`, 10, 3600_000)) return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
  const reason = String((await req.json().catch(() => ({}))).reason ?? "").trim().slice(0, 300) || "Inappropriate";
  await connectDb();
  const r = await Review.updateOne({ _id: id }, { $push: { reports: { reason, at: new Date(), reporter: me.username } } });
  if (!r.matchedCount) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
