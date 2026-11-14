import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { logEvent } from "@/lib/events";

// Try It On mockups are rendered in the browser; no photo is ever sent here.
// POST /api/try-on { designId } → only counts the try-on for the live dashboard.
export async function POST(req: Request) {
  const { designId } = await req.json().catch(() => ({}));
  if (!isValidObjectId(designId)) return NextResponse.json({ error: "Pick a design first." }, { status: 400 });
  logEvent("try_on", { designId: String(designId) });
  return NextResponse.json({ ok: true });
}
