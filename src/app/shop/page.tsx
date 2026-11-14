import Link from "next/link";
import { connectDb, hasDb } from "@/lib/db";
import { Design, CATEGORIES } from "@/models/Design";
import DesignCard, { type DesignSummary } from "@/components/DesignCard";

export const dynamic = "force-dynamic";

export default async function Shop({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;

  let designs: DesignSummary[] = [];
  if (hasDb()) {
    await connectDb();
    const filter: Record<string, unknown> = { status: { $ne: "hidden" } };
    if (category) filter.category = category;
    const docs = await Design.find(filter).sort({ createdAt: -1 }).lean();
    designs = JSON.parse(JSON.stringify(docs));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">The collection</p>
          <h1 className="mt-2 text-4xl font-semibold text-violet-900">Shop designs</h1>
          <p className="text-stone-600">Every design here can only ever have one owner.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/shop" className={`rounded-full border px-4 py-1.5 transition ${!category ? "border-violet-700 bg-violet-700 text-white" : "border-[#e5d9cc] bg-white/70 hover:border-violet-400"}`}>
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/shop?category=${encodeURIComponent(c)}`}
              className={`rounded-full border px-4 py-1.5 transition capitalize ${category === c ? "border-violet-700 bg-violet-700 text-white" : "border-[#e5d9cc] bg-white/70 hover:border-violet-400"}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {!hasDb() ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
          Almost there! Add your <code>MONGODB_URI</code> to <code>.env.local</code> and restart the site.
        </p>
      ) : designs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#e0d3c4] bg-white/50 p-12 text-center text-stone-500">
          No designs yet. <Link href="/upload" className="font-semibold text-violet-700">Be the first to sell one →</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <DesignCard key={d._id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
