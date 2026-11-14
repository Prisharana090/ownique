"use client";
// Design My Object: buyers' object photos that are "Open to ideas".
import { useEffect, useState } from "react";
import Link from "next/link";

type R = { _id: string; material: string; style: string; budgetSol: number | null; replies: number; createdAt: string };

export default function Requests() {
  const [list, setList] = useState<R[] | null>(null);
  useEffect(() => { fetch("/api/requests").then((r) => r.json()).then((d) => setList(d.requests ?? [])).catch(() => setList([])); }, []);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Design My Object</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-violet-900">Objects open to ideas</h1>
          <p className="max-w-xl text-stone-600">Buyers share a photo of their cup, vase, tote or anything else. Designers reply with one of their listed designs shown right on it.</p>
        </div>
        <Link href="/requests/new" className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800">Design My Object</Link>
      </div>
      {list === null ? <p className="text-stone-500">Loading…</p> : list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-violet-200 bg-white/60 p-12 text-center text-stone-600">
          No objects yet. <Link href="/requests/new" className="font-semibold text-violet-700 underline">Post the first one →</Link>
        </div>
      ) : (
        <div className="columns-2 gap-4 sm:gap-5 md:columns-3 lg:columns-4">
          {list.map((r) => (
            <Link key={r._id} href={`/requests/${r._id}`} aria-label={`${r.material} object, ${r.replies} suggestions`}
              className="group mb-4 block break-inside-avoid overflow-hidden rounded-3xl border border-[#ece3d9] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:mb-5">
              <div className="relative min-h-32 bg-blush">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/requests/${r._id}/photo`} alt="" loading="lazy" className="h-auto w-full" />
                <span className="absolute left-3 top-3 rounded-full bg-fuchsia-100/95 px-3 py-1 text-xs font-semibold text-fuchsia-800">Open to ideas</span>
              </div>
              <div className="space-y-1 px-4 py-3">
                <p className="font-serif text-base capitalize text-violet-900">{r.material}{r.style ? ` · ${r.style}` : ""}</p>
                <p className="text-xs text-stone-600">
                  {r.replies} suggestion{r.replies === 1 ? "" : "s"}{r.budgetSol ? ` · budget ${r.budgetSol} SOL` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
