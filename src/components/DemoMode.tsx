"use client";
// 🎬 Demo Mode (designer dashboard): a sample order the designer approves to show judges the ownership hand-over.
// Every rule is enforced by /api/demo on the server; this component only shows state and sends actions.
import { useCallback, useEffect, useRef, useState } from "react";

type Acceptance = { version: string; termsHash: string; acceptedAt: string; by: string; simulated?: boolean } | null;
type Order = {
  orderId: string; designerUsername: string; designerName: string; status: "order_received" | "completed"; archived: boolean;
  design: { demoDesignId: string; title: string; category: string; priceSol: number; priceUsd: number; status: "listed" | "sold"; ownerLabel: string | null; creatorCredit: string };
  buyer: { name: string; username: string; email: string; location: string };
  agreement: { version: string; termsHash: string; sections: { heading: string; body: string[] }[] };
  designerAcceptance: Acceptance; buyerAcceptance: Acceptance;
  payment: { status: "pending" | "confirmed_simulated"; reference: string | null; confirmedAt: string | null };
  transfer: { completedAt: string | null; recipient: string | null; transferId: string | null };
  transferCount: number; purchaseAttemptsBlocked: number;
  timeline: { type: string; label: string; at: string }[];
  createdAt: string; canApprove: boolean;
};

const DISCLAIMER = "Demonstration only. No real payment or legal copyright transfer occurs.";
const when = (s: string | null | undefined) => (s ? new Date(s).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" }) : "");
const btn = "rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${btn} bg-violet-700 text-white hover:bg-violet-800`;
const outline = `${btn} border border-violet-300 bg-white text-violet-800 hover:border-violet-500`;
const sim = `${btn} border border-dashed border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100`;

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className={`rounded-2xl border p-4 ${done ? "border-emerald-200 bg-emerald-50/60" : "border-[#ece3d9] bg-white"}`}>
      <p className="flex items-center gap-2 font-semibold text-violet-900">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-emerald-600 text-white" : "bg-violet-100 text-violet-800"}`}>{done ? "✓" : n}</span>
        {title}
      </p>
      <div className="mt-2 space-y-2 text-sm text-stone-700">{children}</div>
    </li>
  );
}

export default function DemoMode() {
  const [order, setOrder] = useState<Order | null>(null);
  const [archived, setArchived] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [buyerTab, setBuyerTab] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch("/api/demo", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't load Demo Mode.");
      setOrder(d.order);
      setArchived(d.archived);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load Demo Mode.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(action: string) {
    if (!order || busy) return;
    setBusy(action);
    setNote(null);
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderId: order.orderId, version: order.agreement.version, termsHash: order.agreement.termsHash }),
      });
      const d = await r.json();
      if (d.order) setOrder(d.order);
      if (typeof d.archived === "number") setArchived(d.archived);
      if (action === "reset") { setReadToEnd(false); setConfirmReset(false); setBuyerTab(false); box.current?.scrollTo({ top: 0 }); }
      if (!r.ok) setNote({ ok: false, text: d.error || "That didn't work. Please try again." });
      else setNote({ ok: true, text: d.message });
      if (!r.ok && r.status === 409 && /archived/i.test(d.error ?? "")) load();
    } catch {
      setNote({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  function onScroll() {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setReadToEnd(true);
  }

  if (loadError)
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-semibold">Demo Mode couldn&apos;t load.</p>
        <p className="text-sm">{loadError}</p>
        <button onClick={load} className={`${outline} mt-3`}>Try again</button>
      </section>
    );
  if (!order) return <section className="h-40 animate-pulse rounded-3xl border border-[#ece3d9] bg-white/70" aria-label="Loading Demo Mode" />;

  const o = order;
  const done = o.status === "completed";
  const dAcc = Boolean(o.designerAcceptance), bAcc = Boolean(o.buyerAcceptance), paid = o.payment.status === "confirmed_simulated";
  const price = `${o.design.priceSol} SOL (≈ $${o.design.priceUsd})`;
  const missing = [!dAcc && "your acceptance", !bAcc && "buyer acceptance", !paid && "payment confirmation"].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="demo-mode" className="space-y-5 rounded-3xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-white to-violet-50/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Demo Mode</p>
          <h2 id="demo-mode" className="font-serif text-3xl font-semibold text-violet-900">Order &amp; Ownership Transfer</h2>
          <p className="text-sm text-stone-600">A sample order with a fictional buyer, so you can show judges how a design is handed over.</p>
        </div>
        <div className="flex items-center gap-2">
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} disabled={Boolean(busy)} className={outline}>↺ Reset Demo</button>
          ) : (
            <>
              <span className="text-xs text-stone-600">Start a fresh demo? This one is archived.</span>
              <button onClick={() => act("reset")} disabled={Boolean(busy)} className={primary}>{busy === "reset" ? "Resetting…" : "Yes, reset"}</button>
              <button onClick={() => setConfirmReset(false)} disabled={Boolean(busy)} className={outline}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <p role="note" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">⚠️ {DISCLAIMER}</p>

      {note && <p role="status" aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${note.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{note.text}</p>}

      {done && (
        <div className="rounded-2xl bg-violet-900 px-5 py-4 text-violet-50">
          <p className="font-serif text-2xl">🎉 Demo ownership transfer completed.</p>
          <p className="text-sm text-violet-200">{o.transfer.recipient} now owns &ldquo;{o.design.title}&rdquo; (demo). {o.design.creatorCredit} stays credited as the original creator. Ref {o.transfer.transferId}.</p>
        </div>
      )}

      {/* Order received */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3 rounded-2xl border border-[#ece3d9] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-violet-900">📦 Order received</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${done ? "bg-violet-900 text-white" : "bg-emerald-50 text-emerald-700"}`}>{done ? "Completed" : "Awaiting approval"}</span>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-blush">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/demo/${o.orderId}/preview`} alt={`Watermarked preview of ${o.design.title}`} className="w-full" />
            <span className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${o.design.status === "sold" ? "bg-violet-900 text-white" : "bg-white/95 text-emerald-700"}`}>{o.design.status === "sold" ? "👑 Sold" : "Available"}</span>
            <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Demo data</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-stone-500">Design</dt><dd className="font-medium text-stone-900">{o.design.title}</dd>
            <dt className="text-stone-500">Price</dt><dd className="font-medium text-stone-900">{price}</dd>
            <dt className="text-stone-500">Creator</dt><dd className="text-stone-900">{o.design.creatorCredit}</dd>
            <dt className="text-stone-500">Buyer</dt><dd className="text-stone-900">{o.buyer.name} <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">fictional</span></dd>
            <dt className="text-stone-500">Contact</dt><dd className="text-stone-900">@{o.buyer.username} · {o.buyer.email}</dd>
            <dt className="text-stone-500">Location</dt><dd className="text-stone-900">{o.buyer.location}</dd>
            <dt className="text-stone-500">Order</dt><dd className="font-mono text-xs text-stone-700">{o.orderId}</dd>
            <dt className="text-stone-500">Agreement</dt><dd className="font-mono text-xs text-stone-700">v{o.agreement.version} · #{o.agreement.termsHash.slice(0, 12)}</dd>
          </dl>
          <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
            <p className="font-semibold text-stone-800">Another shopper tries to buy it</p>
            <button onClick={() => act("purchase_attempt")} disabled={Boolean(busy)} className={`${sim} mt-2`}>
              {busy === "purchase_attempt" ? "Checking…" : "Simulate another purchase attempt"}
            </button>
            {o.purchaseAttemptsBlocked > 0 && <p className="mt-1">Blocked attempts: {o.purchaseAttemptsBlocked}</p>}
          </div>
        </div>

        <ol className="space-y-3">
          <Step n={1} title="Read the full agreement & accept as designer" done={dAcc}>
            <div ref={box} onScroll={onScroll} tabIndex={0} aria-label="Full purchase agreement"
              className="max-h-64 overflow-y-auto rounded-xl border border-[#ece3d9] bg-cream/50 p-3 text-xs leading-relaxed">
              {o.agreement.sections.map((s) => (
                <div key={s.heading} className="mb-2">
                  <p className="font-semibold text-violet-900">{s.heading}</p>
                  {s.body.map((p, i) => <p key={i} className="mt-0.5">{p}</p>)}
                </div>
              ))}
              <p className="text-center text-stone-400">— end of agreement —</p>
            </div>
            {dAcc ? (
              <p>✅ Accepted by {o.designerAcceptance!.by} · {when(o.designerAcceptance!.acceptedAt)}</p>
            ) : (
              <>
                {!readToEnd && <p className="text-xs text-stone-500">Scroll to the end of the agreement to accept.</p>}
                <button onClick={() => act("designer_accept")} disabled={!readToEnd || Boolean(busy) || done} className={primary}>
                  {busy === "designer_accept" ? "Recording…" : "I've read it: accept as designer"}
                </button>
              </>
            )}
          </Step>
          <Step n={2} title="Buyer accepts (simulated)" done={bAcc}>
            {bAcc ? <p>✅ SIMULATED · {o.buyerAcceptance!.by} · {when(o.buyerAcceptance!.acceptedAt)}</p> : (
              <button onClick={() => act("buyer_accept")} disabled={Boolean(busy) || done} className={sim}>
                {busy === "buyer_accept" ? "Simulating…" : "Simulate buyer acceptance"}
              </button>
            )}
          </Step>
          <Step n={3} title="Payment confirmed (simulated)" done={paid}>
            {paid ? <p>✅ SIMULATED · {o.payment.reference} · {when(o.payment.confirmedAt)} · no money moved</p> : (
              <>
                <button onClick={() => act("confirm_payment")} disabled={!bAcc || Boolean(busy) || done} className={sim}>
                  {busy === "confirm_payment" ? "Simulating…" : "Simulate payment confirmation"}
                </button>
                {!bAcc && <p className="text-xs text-stone-500">Available after the buyer accepts.</p>}
              </>
            )}
          </Step>
          <Step n={4} title="Approve & transfer ownership" done={done}>
            {done ? <p>✅ Transferred · {when(o.transfer.completedAt)}</p> : (
              <>
                <button onClick={() => act("approve")} disabled={!o.canApprove || Boolean(busy)} className={primary}>
                  {busy === "approve" ? "Transferring…" : "Approve & Transfer"}
                </button>
                {!o.canApprove && <p className="text-xs text-stone-500">Needs {missing}. Both parties must accept the same agreement version.</p>}
              </>
            )}
          </Step>
        </ol>
      </div>

      {/* Simulated buyer view */}
      <div className="rounded-2xl border border-dashed border-amber-300 bg-white p-4">
        <button onClick={() => setBuyerTab((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={buyerTab}>
          <span className="font-semibold text-violet-900">👤 Simulated buyer view: {o.buyer.name} <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">SIMULATED · fictional buyer</span></span>
          <span className="text-stone-400">{buyerTab ? "▲" : "▼"}</span>
        </button>
        {buyerTab && (
          <div className="mt-3 space-y-2 text-sm">
            {done ? (
              <>
                <p>You own <b>{o.design.title}</b> (demo). Original creator: <b>{o.design.creatorCredit}</b>.</p>
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/demo/${o.orderId}/original`} className={primary}>⬇ Download demo original file</a>
                  <a href={`/api/demo/${o.orderId}/agreement`} className={outline}>📄 Download demo agreement (PDF)</a>
                </div>
                <p className="text-xs text-stone-500">Demo files only. Real designs keep their normal download protections.</p>
              </>
            ) : (
              <p className="text-stone-600">🔒 The original file and the agreement unlock here after the designer approves the transfer.</p>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-[#ece3d9] bg-white p-4">
        <p className="mb-2 font-semibold text-violet-900">🕒 Timeline <span className="text-xs font-normal text-stone-500">(server timestamps)</span></p>
        <ol className="space-y-1.5 border-l-2 border-violet-200 pl-4 text-sm">
          {o.timeline.map((t, i) => (
            <li key={i}><span className="text-stone-500">{when(t.at)}</span> · <span className="text-stone-800">{t.label}</span></li>
          ))}
        </ol>
        {archived > 0 && <p className="mt-2 text-xs text-stone-500">{archived} earlier demo order{archived === 1 ? "" : "s"} archived for the audit trail.</p>}
      </div>
    </section>
  );
}
