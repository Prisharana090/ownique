"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { short } from "@/lib/short";

type Req = { _id: string; buyerWallet: string; material: string; style: string; budgetSol: number | null; status: string; createdAt: string };
type Reply = {
  _id: string; designId: string; designerWallet: string; explanation: string; mockupKind: "manual" | "ai"; createdAt: string;
  design: { title: string; price: number | null; available: boolean };
};
type MyDesign = { _id: string; title: string; price: number; status: string; designerWallet: string };

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const me = publicKey?.toBase58();
  const [req, setReq] = useState<Req | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyDesign[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [onlyShort, setOnlyShort] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/requests/${id}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setReq(d.request); })
      .catch((e) => setError(e.message));
    fetch(`/api/requests/${id}/replies`).then((r) => r.json()).then((d) => setReplies(d.replies ?? [])).catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  const isBuyer = Boolean(me && req && me === req.buyerWallet);
  useEffect(() => {
    if (!me || isBuyer) return setMine([]);
    fetch("/api/designs").then((r) => r.json()).then((d) => setMine((d.designs ?? []).filter((x: MyDesign) => x.designerWallet === me && x.status === "listed"))).catch(() => {});
  }, [me, isBuyer]);

  async function shortlistCall(body: Record<string, unknown>) {
    const res = await fetch(`/api/requests/${id}/shortlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    setToken(d.token); setShortlist(d.shortlist);
  }
  async function unlock() {
    if (!publicKey || !signMessage) return setVisible(true);
    setBusy(true); setError(null);
    try {
      const message = `Ownique: manage shortlist at ${Date.now()}`;
      const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
      await shortlistCall({ wallet: publicKey.toBase58(), message, signature });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open your shortlist."); } finally { setBusy(false); }
  }
  async function toggle(replyId: string) {
    if (!token) return;
    try { await shortlistCall({ token, replyId, on: !shortlist.includes(replyId) }); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't update."); }
  }

  if (error && !req) return <p className="rounded-2xl bg-red-50 p-6 text-red-700">{error}</p>;
  if (!req) return <p className="text-stone-500">Loading…</p>;
  const shown = onlyShort ? replies.filter((r) => shortlist.includes(r._id)) : replies;

  return (
    <div className="space-y-10">
      <section className="grid gap-6 rounded-3xl border border-[#ece3d9] bg-white/90 p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:p-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/requests/${id}/photo`} alt={`The buyer's ${req.material} object`} className="w-full rounded-2xl border border-stone-200 bg-blush object-contain" />
        <div className="space-y-3">
          <span className="inline-block rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-800">Open to ideas</span>
          <h1 className="font-serif text-3xl font-semibold capitalize text-violet-900">Design my {req.material} object</h1>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-violet-50 p-3"><dt className="text-xs text-stone-600">Material</dt><dd className="font-medium capitalize text-violet-900">{req.material}</dd></div>
            <div className="rounded-2xl bg-violet-50 p-3"><dt className="text-xs text-stone-600">Budget</dt><dd className="font-medium text-violet-900">{req.budgetSol ? `${req.budgetSol} SOL` : "Open"}</dd></div>
            <div className="col-span-2 rounded-2xl bg-violet-50 p-3"><dt className="text-xs text-stone-600">Preferred style</dt><dd className="font-medium text-violet-900">{req.style || "Surprise me"}</dd></div>
          </dl>
          <p className="text-xs text-stone-500">Posted by {short(req.buyerWallet)} · {new Date(req.createdAt).toLocaleDateString()}</p>

          {isBuyer ? (
            <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-sm">
              <p className="font-medium text-violet-900">Your private shortlist</p>
              <p className="text-xs text-stone-600">Only you can see it. Shortlisting doesn&apos;t reserve or buy a design; each design still sells once, to whoever checks out first.</p>
              {token ? (
                <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-violet-600" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} /> Show shortlisted only ({shortlist.length})</label>
              ) : (
                <button onClick={unlock} disabled={busy} className="rounded-full bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Check your wallet…" : "Open my shortlist"}</button>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-sm">
              <p className="font-medium text-violet-900">Are you a designer? Suggest one of your designs</p>
              {!me ? (
                <button onClick={() => setVisible(true)} className="rounded-full bg-violet-700 px-4 py-2 font-semibold text-white">Connect wallet</button>
              ) : mine.length === 0 ? (
                <p className="text-xs text-stone-600">You don&apos;t have any designs for sale yet. <Link href="/upload" className="font-semibold text-violet-700 underline">List one →</Link></p>
              ) : (
                <ul className="space-y-2">
                  {mine.map((d) => (
                    <li key={d._id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/designs/${d._id}/image`} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <Link href={`/try-on?design=${d._id}&request=${id}`} className="shrink-0 rounded-full border border-violet-300 px-3 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50">Make mockup →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-violet-900">Suggestions <span className="text-base font-normal text-stone-600">({replies.length})</span></h2>
        {shown.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-violet-200 bg-white/60 p-10 text-center text-stone-600">{onlyShort ? "Nothing shortlisted yet." : "No suggestions yet. Designers will reply here."}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const saved = shortlist.includes(r._id);
              return (
                <article key={r._id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${saved ? "border-fuchsia-300 ring-2 ring-fuchsia-100" : "border-[#ece3d9]"}`}>
                  <div className="relative bg-blush">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/requests/${id}/replies/${r._id}/mockup`} alt={`${r.design.title} on the buyer's object`} className="h-auto w-full" />
                    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.mockupKind === "ai" ? "bg-fuchsia-100 text-fuchsia-800" : "bg-violet-100 text-violet-800"}`}>
                      {r.mockupKind === "ai" ? "✨ AI-generated preview" : "Manual mockup · no AI"}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/designs/${r.designId}/image`} alt="" className="absolute right-3 top-3 h-12 w-12 rounded-xl border-2 border-white object-cover shadow" />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/design/${r.designId}`} className="block truncate font-serif text-lg text-violet-900 hover:underline">{r.design.title}</Link>
                        <p className="text-xs text-stone-600">Designed by {short(r.designerWallet)}</p>
                      </div>
                      <p className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${r.design.available ? "bg-fuchsia-50 text-fuchsia-700" : "bg-stone-100 text-stone-600"}`}>
                        {r.design.available ? `${r.design.price} SOL` : "Sold"}
                      </p>
                    </div>
                    <p className="text-sm text-stone-700">{r.explanation}</p>
                    <p className="text-[11px] text-stone-500">{r.mockupKind === "ai" ? "AI-generated preview—details and final appearance may vary." : "Product mockup—final appearance may vary."}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.design.available ? (
                        <Link href={`/design/${r.designId}`} className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">View &amp; buy</Link>
                      ) : (
                        <span aria-disabled className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-500">No longer available</span>
                      )}
                      {isBuyer && token && (
                        <button onClick={() => toggle(r._id)} aria-pressed={saved}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold ${saved ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800" : "border-stone-300 bg-white text-stone-700"}`}>
                          {saved ? "♥ Shortlisted" : "♡ Shortlist"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
