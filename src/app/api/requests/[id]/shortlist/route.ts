import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { ObjectRequest } from "@/models/ObjectRequest";
import { issueSession, sessionWallet } from "@/lib/session";
import { SHORTLIST_SCOPE } from "@/lib/objectRequests";

/**
 * POST { token } or { wallet, message, signature } [, replyId, on]
 * Private shortlist: only the buyer who posted the request can read or change it. Shortlisting reserves nothing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const body = await req.json();
  let token: string | null = typeof body.token === "string" ? body.token : null;
  let wallet = sessionWallet(SHORTLIST_SCOPE, token);
  if (!wallet && body.wallet) {
    token = issueSession(SHORTLIST_SCOPE, String(body.wallet), String(body.message ?? ""), String(body.signature ?? ""));
    wallet = token ? String(body.wallet) : null;
  }
  if (!wallet) return NextResponse.json({ error: "Please sign in with your wallet." }, { status: 401 });

  await connectDb();
  const r = await ObjectRequest.findById(id).select("+shortlist buyerWallet").lean<{ buyerWallet: string; shortlist: unknown[] }>();
  if (!r || r.buyerWallet !== wallet) return NextResponse.json({ error: "Only the person who posted this request has a shortlist here." }, { status: 403 });
  if (isValidObjectId(body.replyId)) {
    await ObjectRequest.updateOne({ _id: id }, body.on ? { $addToSet: { shortlist: body.replyId } } : { $pull: { shortlist: body.replyId } });
  }
  const fresh = await ObjectRequest.findById(id).select("+shortlist").lean<{ shortlist: unknown[] }>();
  return NextResponse.json({ token, shortlist: (fresh?.shortlist ?? []).map(String) });
}
