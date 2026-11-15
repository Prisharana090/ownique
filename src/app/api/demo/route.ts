import { NextResponse } from "next/server";
import { connectDb, hasDb } from "@/lib/db";
import { getSessionAccount, throttled } from "@/lib/auth";
import { activeOrder, archivedCount, demoAction, publicOrder, resetDemo, DEMO_DISCLAIMER } from "@/lib/demoOrder";

// 🎬 Demo Order & Ownership Transfer. Designer accounts only; each designer has their own isolated demo.

async function designer() {
  const me = await getSessionAccount();
  if (!me) return { error: NextResponse.json({ error: "Please log in with a Designer account to use Demo Mode." }, { status: 401 }) };
  if (me.role !== "designer") return { error: NextResponse.json({ error: "Demo Mode is for Designer accounts." }, { status: 403 }) };
  return { me };
}

// GET /api/demo → your current demo order (created on first visit)
export async function GET() {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const { me, error } = await designer();
  if (error) return error;
  await connectDb();
  const order = await activeOrder(me);
  return NextResponse.json({ disclaimer: DEMO_DISCLAIMER, order: publicOrder(order), archived: await archivedCount(me) });
}

// POST /api/demo { action, orderId, version?, termsHash? }
// actions: designer_accept · buyer_accept (simulated) · confirm_payment (simulated) · approve · purchase_attempt · reset
export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const { me, error } = await designer();
  if (error) return error;
  if (throttled(`demo:${me._id}`, 120, 10 * 60 * 1000)) return NextResponse.json({ error: "Too many demo actions. Please wait a minute." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  await connectDb();

  if (action === "reset") {
    if (throttled(`demo-reset:${me._id}`, 20, 10 * 60 * 1000)) return NextResponse.json({ error: "Too many resets. Please wait a few minutes." }, { status: 429 });
    const order = await resetDemo(me);
    return NextResponse.json({ ok: true, message: "Fresh demo order created. The previous one is archived for the audit trail.", order: publicOrder(order), archived: await archivedCount(me) });
  }

  const r = await demoAction(me, String(b.orderId ?? ""), action, { version: b.version, termsHash: b.termsHash });
  if (!r.ok) return NextResponse.json({ error: r.error, missing: r.missing }, { status: r.status });
  return NextResponse.json({ ok: true, message: r.message, already: Boolean(r.already), order: publicOrder(r.order) });
}
