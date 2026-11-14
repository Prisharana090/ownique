import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { Report } from "@/models/Report";
import { logEvent } from "@/lib/events";

// POST /api/designs/:id/report { reason, reporterWallet } → hides the design while it's reviewed
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  const { reason, reporterWallet } = await req.json();
  if (!reason || String(reason).trim().length < 5)
    return NextResponse.json({ error: "Please tell us what's wrong (a few words)." }, { status: 400 });

  await connectDb();
  const design = await Design.findById(id);
  if (!design) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  await Report.create({ designId: id, reporterWallet: reporterWallet ?? null, reason: String(reason).slice(0, 500) });
  // Only listed designs are hidden; a sold design stays with its owner while we review.
  if (design.status === "listed") {
    design.status = "hidden";
    await design.save();
  }
  logEvent("report", { designId: id, wallet: reporterWallet });
  return NextResponse.json({ ok: true });
}
