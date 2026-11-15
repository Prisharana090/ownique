"use client";
// Ratings & Feedback for a designer: real verified-purchase reviews only.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Sum = { average: number | null; count: number; dist: { star: number; count: number }[] };
type Rev = { _id: string; designId: string; buyerUsername: string; rating: number; text: string; createdAt: string; updatedAt: string; mine: boolean };
type Elig = { designId: string; title: string };

const Stars = ({ n, size = "text-base" }: { n: number; size?: string }) => (
  <span className={size} aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? "text-amber-500" : "text-stone-300"}>★</span>)}</span>
);

export default function ReviewsPanel({ designerWallet, designerName }: { designerWallet: string; designerName: string }) {
  const [data, setData] = useState<{ summary: Sum; reviews: Rev[]; eligible: Elig[] } | null>(null);
  const [me, setMe] = useState<{ role: string } | null | undefined>(undefined);
  const [form, setForm] = useState<{ designId: string; rating: number; text: string }>({ designId: "", rating: 0, text: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/reviews?designer=${encodeURIComponent(designerWallet)}`).then((r) => r.json()).then(setData).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.account)).catch(() => setMe(null));
  }, [designerWallet]);
  useEffect(load, [load]);

  async function submit() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't save your review." });
    setMsg({ ok: true, text: "Thanks! Your review is saved." });
    setForm({ designId: "", rating: 0, text: "" });
    load();
  }
  async function report(id: string) {
    const reason = window.prompt("What's wrong with this feedback?") ?? "";
    if (!reason.trim()) return;
    const res = await fetch(`/api/reviews/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const d = await res.json().catch(() => ({}));
    setMsg({ ok: res.ok, text: res.ok ? "Reported. Our team will review it." : d.error || "Couldn't report." });
  }

  const sum = data?.summary;
  const mineFor = (designId: string) => data?.reviews.find((r) => r.mine && r.designId === designId);
  return (
    <section className="space-y-4 rounded-3xl border border-[#ece3d9] bg-white/70 p-5" aria-labelledby="ratings">
      <h2 id="ratings" className="font-serif text-2xl font-semibold text-violet-900">Ratings &amp; Feedback</h2>
      {!data ? <p className="text-sm text-stone-500">Loading…</p> : !sum?.count ? (
        <p className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">No reviews yet</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <p className="font-serif text-5xl font-semibold text-violet-950">{sum.average}</p>
            <div><Stars n={Math.round(sum.average ?? 0)} size="text-xl" /><p className="text-sm text-stone-600">{sum.count} verified review{sum.count === 1 ? "" : "s"}</p></div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {sum.dist.map((d) => {
              const pct = Math.round((d.count / sum.count) * 100);
              return (
                <li key={d.star} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2">
                  <span className="text-stone-700">{d.star} star{d.star === 1 ? "" : "s"}</span>
                  <span className="h-2.5 rounded-full bg-violet-100" aria-hidden><span className="block h-2.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} /></span>
                  <span className="text-right text-stone-600">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {data?.reviews.map((r) => (
        <article key={r._id} className="space-y-1 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 font-serif text-lg text-violet-950">
              <Link href={`/u/${r.buyerUsername}`} className="hover:underline">@{r.buyerUsername}</Link>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 font-sans text-xs font-medium text-violet-800">✓ Verified purchase</span>
            </p>
            <time className="text-xs text-stone-500" dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>
          </div>
          <Stars n={r.rating} />
          {r.text && <p className="text-sm text-stone-800">{r.text}</p>}
          <div className="flex justify-end gap-3 text-xs">
            {r.mine && <button onClick={() => setForm({ designId: r.designId, rating: r.rating, text: r.text })} className="font-semibold text-violet-700 underline">Edit</button>}
            {me && !r.mine && <button onClick={() => report(r._id)} className="text-stone-500 underline">Report</button>}
          </div>
        </article>
      ))}

      {me === null && (
        <p className="rounded-2xl bg-violet-100/70 p-4 text-center text-sm text-violet-900">💬 Purchased a design? <Link href="/login" className="font-semibold underline">Log in</Link> to leave feedback.</p>
      )}
      {me && data && (data.eligible.length > 0 || form.designId) && (
        <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="font-medium text-violet-900">{form.designId && mineFor(form.designId) ? "Edit your review" : `Review ${designerName}`}</p>
          <label className="block text-sm">Purchase
            <select value={form.designId} onChange={(e) => { const ex = mineFor(e.target.value); setForm(ex ? { designId: ex.designId, rating: ex.rating, text: ex.text } : { designId: e.target.value, rating: 0, text: "" }); }}
              className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2">
              <option value="">Choose a design you bought…</option>
              {data.eligible.map((e) => <option key={e.designId} value={e.designId}>{e.title}{mineFor(e.designId) ? " (reviewed)" : ""}</option>)}
            </select>
          </label>
          <fieldset><legend className="text-sm">Rating</legend>
            <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={form.rating === n}
                className={`text-2xl ${n <= form.rating ? "text-amber-500" : "text-stone-300"}`}>★</button>))}</div>
          </fieldset>
          <label className="block text-sm">Feedback (optional)
            <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} maxLength={1000} rows={3} className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2" /></label>
          <button onClick={submit} disabled={busy || !form.designId || !form.rating} className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-40">{busy ? "Saving…" : "Submit review"}</button>
        </div>
      )}
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-violet-50 text-violet-900" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </section>
  );
}
