import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { checkDeclaration, getOwnershipGate, readDeclaration, recordDeclaration } from "@/lib/agreements";

/**
 * POST /api/designs/:id/agreement
 * Lets the original designer accept the Ownership Transfer Declaration for a design that was listed
 * without one (for example, before this feature existed). Only the designer's own wallet can do this.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  const body = await req.json();
  const designerWallet = String(body.designerWallet ?? "");

  await connectDb();
  const design = await Design.findById(id).select("designerWallet status");
  if (!design || design.status === "hidden") return NextResponse.json({ error: "Design not found." }, { status: 404 });
  if (design.designerWallet !== designerWallet)
    return NextResponse.json({ error: "Only the original designer can confirm ownership for this design." }, { status: 403 });
  if (design.status !== "listed") return NextResponse.json({ error: "This design is no longer for sale." }, { status: 409 });
  if ((await getOwnershipGate(id)).accepted)
    return NextResponse.json({ error: "Ownership has already been confirmed for this design." }, { status: 409 });

  const declaration = readDeclaration(body, designerWallet);
  const err = checkDeclaration(declaration);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  await recordDeclaration(id, declaration);
  return NextResponse.json({ ok: true, gate: await getOwnershipGate(id) });
}
