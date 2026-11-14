import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { ObjectRequest } from "@/models/ObjectRequest";

/** GET → public request details (no photo bytes, no shortlist). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  await connectDb();
  const r = await ObjectRequest.findById(id).lean();
  if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json({ request: r });
}
