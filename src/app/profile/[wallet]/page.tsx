import Link from "next/link";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { User } from "@/models/User";
import DesignCard, { type DesignSummary } from "@/components/DesignCard";
import { short } from "@/lib/short";

export const dynamic = "force-dynamic";

// A designer's public page: everything they created (credit forever) + everything they own.
export default async function Profile({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!hasDb()) return <p>Add MONGODB_URI to .env.local first.</p>;
  await connectDb();

  const [user, created, owned] = await Promise.all([
    User.findOne({ walletAddress: wallet }).lean<{ username?: string; verified?: boolean; createdAt?: Date }>(),
    Design.find({ designerWallet: wallet, status: { $ne: "hidden" } }).sort({ createdAt: -1 }).lean(),
    Design.find({ ownerWallet: wallet, status: "sold" }).sort({ soldAt: -1 }).lean(),
  ]);
  const createdList: DesignSummary[] = JSON.parse(JSON.stringify(created));
  const ownedList: DesignSummary[] = JSON.parse(JSON.stringify(owned));
  const sales = createdList.filter((d) => d.status === "sold");
  const earned = sales.reduce((sum, d) => sum + d.price, 0);
  // Badge from real activity only: listed designs → Designer, owns designs → Buyer.
  const role = createdList.length && ownedList.length ? "Both" : createdList.length ? "Designer" : ownedList.length ? "Buyer" : null;

  return (
    <div className="space-y-10">
      <header className="rounded-3xl border border-[#ece3d9] bg-white/90 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          {/* No profile photos are stored yet, so the avatar is the first letter of the name. */}
          <div aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-300 font-serif text-3xl font-semibold text-violet-900 ring-4 ring-violet-50">
            {(user?.username ?? wallet).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-3xl font-semibold text-violet-900">{user?.username ?? short(wallet)}</h1>
              {user?.verified && <span title="Verified" aria-label="Verified">✅</span>}
              {role && <span className="rounded-full bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-800">{role}</span>}
            </div>
            {user?.username && <p className="text-sm text-stone-600">@{user.username}</p>}
            <a target="_blank" rel="noreferrer" className="block break-all text-xs text-stone-500 underline decoration-violet-200 hover:text-violet-700"
              href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}>{wallet}</a>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[["Designs", createdList.length], ["Sold", sales.length], ["SOL earned", earned.toFixed(2)]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-violet-50 px-3 py-3">
              <dt className="text-xs text-stone-600">{label}</dt>
              <dd className="font-serif text-2xl font-semibold text-violet-900">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-violet-900">Portfolio <span className="text-sm font-normal text-stone-600">· designed by them, credited forever</span></h2>
        {createdList.length === 0 ? (
          <p className="text-stone-600">No designs yet. <Link href="/upload" className="font-semibold text-violet-700 underline">Sell one →</Link></p>
        ) : (
          <div className="columns-2 gap-4 sm:gap-5 md:columns-3">{createdList.map((d) => <DesignCard key={d._id} d={d} masonry />)}</div>
        )}
      </section>

      {ownedList.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-violet-900">Owned by them</h2>
          <div className="columns-2 gap-4 sm:gap-5 md:columns-3">{ownedList.map((d) => <DesignCard key={d._id} d={d} masonry />)}</div>
        </section>
      )}
    </div>
  );
}
