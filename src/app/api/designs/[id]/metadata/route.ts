import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";

// GET /api/designs/:id/metadata → the NFT metadata JSON that wallets and explorers read.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectDb();
  const d = await Design.findById(id).lean<{ title: string; description: string; category: string; designerWallet: string }>();
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return NextResponse.json({
    name: d.title,
    description: d.description,
    image: `${site}/api/designs/${id}/image`,
    external_url: `${site}/design/${id}`,
    attributes: [
      { trait_type: "designer", value: d.designerWallet },
      { trait_type: "made for", value: d.category },
      { trait_type: "rule", value: "one design, one owner" },
    ],
  });
}
