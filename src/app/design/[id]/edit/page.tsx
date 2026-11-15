"use client";
// Edit an unsold listing. The server re-checks that you're its designer and that it's still unsold.
import Link from "next/link";
import { use, useEffect, useState } from "react";
import ListingFields, { listingValid, type ListingState } from "@/components/ListingFields";
import { fetchMe } from "@/lib/meClient";
import type { Currency } from "@/lib/designOptions";

type D = { _id: string; title: string; description: string; listPrice: number; currency: Currency; category: string; style?: string; material?: string; status: string; designerWallet: string; imageHash?: string };

export default function EditDesign({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<D | null>(null);
  const [listing, setListing] = useState<ListingState | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetch(`/api/designs/${id}`).then((r) => r.json()), fetchMe(true)])
      .then(([res, me]) => {
        if (!alive) return;
        if (!res.design) return setAllowed(false);
        const x = res.design as D;
        setD(x);
        setListing({
          title: x.title, description: x.description ?? "", price: String(x.currency === "SOL" ? x.listPrice : Number(x.listPrice.toFixed(2))),
          currency: x.currency, category: x.category, style: x.style || "other", material: x.material || "any",
        });
        setAllowed(Boolean(me && me.role === "designer" && me.walletAddress === x.designerWallet));
      })
      .catch(() => alive && setAllowed(false));
    return () => { alive = false; };
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!listing || !listingValid(listing)) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/designs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...listing, price: Number(listing.price) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save your changes.");
      setMsg({ ok: true, text: "Saved! Your listing is updated." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save your changes." });
    } finally {
      setSaving(false);
    }
  }

  if (allowed === null) return <p className="text-stone-500">Loading…</p>;
  if (!d || !listing) return <p className="text-stone-600">Design not found.</p>;
  if (!allowed) return <p className="rounded-2xl bg-amber-50 p-4 text-amber-900">Only this design&apos;s designer can edit it. <Link href={`/design/${id}`} className="underline">Back to the design</Link></p>;
  if (d.status !== "listed") return <p className="rounded-2xl bg-stone-100 p-4 text-stone-700">This design is sold, so it can&apos;t be edited. <Link href={`/design/${id}`} className="underline">Back to the design</Link></p>;

  return (
    <form onSubmit={save} className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold text-violet-900">Edit listing</h1>
        <p className="text-stone-600">Change the details or price while it&apos;s unsold. The artwork itself can&apos;t be swapped.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${id}/image${d.imageHash ? `?v=${d.imageHash.slice(0, 8)}` : ""}`} alt={d.title} className="w-full rounded-3xl border border-[#ece3d9] bg-white object-contain" />
        <p className="text-xs text-stone-500">Prices already accepted by a buyer stay as recorded. If the price changes, the buyer re-confirms the new terms before paying.</p>
      </div>
      <div className="space-y-5 rounded-3xl border border-[#ece3d9] bg-white/80 p-6 shadow-sm">
        <ListingFields value={listing} onChange={setListing} disabled={saving} />
        {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <div className="flex flex-wrap gap-3">
          <button disabled={saving || !listingValid(listing)} className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link href={`/design/${id}`} className="rounded-full border border-violet-300 px-6 py-3 font-semibold text-violet-800 hover:border-violet-500">View design</Link>
        </div>
      </div>
    </form>
  );
}
