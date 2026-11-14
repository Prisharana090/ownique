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

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl font-bold text-white">
          {(user?.username ?? wallet).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {user?.username ?? short(wallet)} {user?.verified && <span title="Verified">✅</span>}
          </h1>
          <a target="_blank" className="break-all text-xs text-stone-500 underline"
            href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}>{wallet}</a>
        </div>
        <div className="flex gap-6 text-center">
          <div><p className="text-2xl font-bold">{createdList.length}</p><p className="text-xs text-stone-500">Designs</p></div>
          <div><p className="text-2xl font-bold">{sales.length}</p><p className="text-xs text-stone-500">Sold</p></div>
          <div><p className="text-2xl font-bold">{earned.toFixed(2)}</p><p className="text-xs text-stone-500">SOL earned</p></div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">🎨 Designed by them <span className="text-sm font-normal text-stone-500">— credited forever, even after selling</span></h2>
        {createdList.length === 0 ? (
          <p className="text-stone-500">No designs yet. <Link href="/upload" className="text-violet-700 underline">Sell one →</Link></p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{createdList.map((d) => <DesignCard key={d._id} d={d} />)}</div>
        )}
      </section>

      {ownedList.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">👑 Owned by them</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{ownedList.map((d) => <DesignCard key={d._id} d={d} />)}</div>
        </section>
      )}
    </div>
  );
}
