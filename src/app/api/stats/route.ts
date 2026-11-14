import { NextResponse } from "next/server";
import { getStats, hasTiger } from "@/lib/events";

export const dynamic = "force-dynamic";

// GET /api/stats → live numbers for the dashboard, from Tiger Data
export async function GET() {
  if (!hasTiger()) return NextResponse.json({ configured: false });
  try {
    return NextResponse.json({ configured: true, ...(await getStats()) });
  } catch (err) {
    console.error("Tiger Data error:", err);
    const detail = process.env.NODE_ENV === "development" ? ` (${(err as Error).message})` : "";
    return NextResponse.json({ configured: true, error: `Couldn't reach Tiger Data.${detail}` }, { status: 502 });
  }
}
