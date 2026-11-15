import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDb, hasDb } from "@/lib/db";
import { Account } from "@/models/Account";
import { Design } from "@/models/Design";
import DesignCard, { type DesignSummary } from "@/components/DesignCard";
import ReviewsPanel from "@/components/ReviewsPanel";
import ProfileEditor from "@/components/ProfileEditor";
import { getSessionAccount } from "@/lib/auth";
import { withOwnershipStatus } from "@/lib/agreements";
import { summary } from "@/lib/reviews";

export const dynamic = "force-dynamic";

type Acc = { _id: unknown; username: string; displayName: string; role: "buyer" | "designer"; bio: string; hasAvatar: boolean; walletAddress?: string };

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="text-lg tracking-tight">
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= Math.round(value) ? "text-amber-500" : "text-stone-300"}>★</span>)}
    </span>
  );
}

export default async function UserProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!hasDb()) return <p>Add MONGODB_URI to .env.local first.</p>;
  await connectDb();
  const a = await Account.findOne({ username: username.toLowerCase() }).lean<Acc>();
  if (!a) notFound();
  const me = await getSessionAccount();
  const isOwner = me?.username === a.username;
  const wallet = a.walletAddress;

  let designs: DesignSummary[] = [];
  if (wallet) {
    const filter = a.role === "designer" ? { designerWallet: wallet, status: { $ne: "hidden" } } : { ownerWallet: wallet, status: "sold" };
    designs = await withOwnershipStatus(JSON.parse(JSON.stringify(await Design.find(filter).sort({ createdAt: -1 }).lean())));
  }
  const rating = a.role === "designer" && wallet ? await summary(wallet) : null;

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-[#ece3d9] bg-white/90 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          {a.hasAvatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/accounts/${a.username}/avatar`} alt={`${a.displayName}'s profile picture`} className="h-24 w-24 rounded-full object-cover ring-4 ring-violet-100 sm:h-32 sm:w-32" />
            : <div aria-hidden className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-300 font-serif text-4xl font-semibold text-violet-900 ring-4 ring-violet-50 sm:h-32 sm:w-32">{a.displayName.slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-semibold text-violet-900 sm:text-4xl">{a.displayName}</h1>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800">{a.role === "designer" ? "Designer" : "Buyer"}</span>
            </div>
            <p className="text-stone-600">@{a.username}</p>
            {a.bio && <p className="max-w-2xl text-stone-800">{a.bio}</p>}
            {rating && (
              <p className="flex flex-wrap items-center gap-2 text-stone-800">
                {rating.count ? <><Stars value={rating.average ?? 0} /><span className="font-semibold">{rating.average} / 5</span><span className="text-stone-500">·</span><span>{rating.count} verified review{rating.count === 1 ? "" : "s"}</span></> : <span className="text-stone-600">No reviews yet</span>}
              </p>
            )}
          </div>
        </div>
        {isOwner && <ProfileEditor initial={{ displayName: a.displayName, bio: a.bio, role: a.role, walletAddress: wallet ?? null, username: a.username }} />}
      </header>

      {a.role === "designer" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="space-y-4 rounded-3xl border border-[#ece3d9] bg-white/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold text-violet-900">Original designs{designs.length ? <span className="ml-2 text-base font-normal text-stone-500">({designs.length})</span> : null}</h2>
              {isOwner && <Link href="/upload" className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800">+ Upload New Design</Link>}
            </div>
            {!wallet ? <p className="text-sm text-stone-600">{isOwner ? "Link your wallet below to list and sell designs." : "No designs yet."}</p>
              : designs.length === 0 ? <p className="text-sm text-stone-600">No designs yet.{isOwner && <> <Link href="/upload" className="font-semibold text-violet-700 underline">List your first design →</Link></>}</p>
              : <div className="grid grid-cols-2 gap-4">{designs.map((d) => (
                  <div key={d._id}>
                    <DesignCard d={d} />
                    {isOwner && d.status === "listed" && (
                      <Link href={`/design/${d._id}/edit`} className="mt-1.5 inline-block text-xs font-semibold text-violet-700 hover:underline">✏️ Edit listing</Link>
                    )}
                  </div>
                ))}</div>}
          </section>
          <ReviewsPanel designerWallet={wallet ?? ""} designerName={a.displayName} />
        </div>
      ) : (
        <section className="space-y-4 rounded-3xl border border-[#ece3d9] bg-white/70 p-5">
          <h2 className="font-serif text-2xl font-semibold text-violet-900">Collected designs</h2>
          {designs.length === 0 ? <p className="text-sm text-stone-600">No purchases yet.{isOwner && <> <Link href="/shop" className="font-semibold text-violet-700 underline">Explore designs →</Link></>}</p>
            : <div className="columns-2 gap-4 md:columns-3">{designs.map((d) => <DesignCard key={d._id} d={d} masonry />)}</div>}
        </section>
      )}
    </div>
  );
}
