import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { short } from "@/lib/short";
import BuyButton from "@/components/BuyButton";
import ReportButton from "@/components/ReportButton";
import OwnerDownload from "@/components/OwnerDownload";
import Link from "next/link";
import ConfirmOwnership from "@/components/ConfirmOwnership";
import { getOwnershipGate } from "@/lib/agreements";
import { logEvent } from "@/lib/events";
import { solText, usd } from "@/lib/price";
import { priceLabel } from "@/lib/designOptions";
import { getSessionAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

type D = {
  imageHash?: string;
  _id: string; title: string; price: number; category: string; status: string;
  designerWallet: string; ownerWallet?: string | null; description: string; tags: string[];
  describedByGrok: boolean; currency?: string; style?: string; material?: string; isDemo?: boolean; soldAt?: string | null; txSignature?: string | null; mintAddress?: string | null;
  paymentMethod?: string | null; priceUsd?: number | null; tokenTransferSignature?: string | null;
};

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  if (!hasDb() || !isValidObjectId(id)) notFound();
  await connectDb();
  const doc = await Design.findById(id).lean();
  if (!doc) notFound();
  const d: D = JSON.parse(JSON.stringify(doc));
  const sold = d.status === "sold";
  if (d.status === "hidden") notFound();
  logEvent("view", { designId: d._id });
  const gate = await getOwnershipGate(d._id);
  const me = await getSessionAccount();
  const canEdit = !sold && me?.role === "designer" && Boolean(me.walletAddress) && me.walletAddress === d.designerWallet;

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-[2rem] border-8 border-white bg-white shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${d._id}/image${d.imageHash ? `?v=${String(d.imageHash).slice(0, 8)}` : ""}`} alt={d.title} className="w-full object-cover" />
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Made for {d.category}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sold ? "bg-violet-900 text-white" : "bg-emerald-50 text-emerald-700"}`}>{sold ? "Sold" : "Available"}</span>
            {d.isDemo && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Demo data</span>}
          </div>
          <h1 className="mt-2 text-5xl font-semibold text-violet-900">{d.title}</h1>
          <p className="mt-1 text-stone-500">
            Designed by{" "}
            <Link href={`/profile/${d.designerWallet}`} className="font-medium text-violet-700 hover:underline">
              {short(d.designerWallet)}
            </Link>
          </p>
        </div>

        <div className="rounded-3xl border border-[#ece3d9] bg-white/80 p-6 shadow-sm">
          <p className="leading-relaxed text-stone-700">{d.description}</p>
          {d.describedByGrok && <p className="mt-2 text-xs text-stone-400">✨ Written by Grok</p>}
          {(d.style || d.material) && (
            <p className="mt-3 text-sm text-stone-600 capitalize">
              {d.style && d.style !== "other" && <>Style: <b className="font-medium text-stone-800">{d.style}</b></>}
              {d.material && d.material !== "any" && <> · Material: <b className="font-medium text-stone-800">{d.material}</b></>}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {d.tags.map((t) => (
              <span key={t} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">#{t}</span>
            ))}
          </div>
        </div>

        {sold ? (
          <div className="space-y-3">
          <div className="rounded-3xl bg-violet-900 p-6 text-sm leading-relaxed text-violet-100">
            <b>Owned by</b> {short(d.ownerWallet)} · <b>Designed by</b> {short(d.designerWallet)}
            {d.soldAt && <> · <b>Sold</b> {new Date(d.soldAt).toLocaleDateString()}</>}
            {d.paymentMethod === "bank" && <> · <b>Paid by bank</b> (Capital One){d.priceUsd ? ` $${d.priceUsd}` : ""}</>}
            {d.txSignature && (
              <> · <a className="underline" target="_blank" href={`https://explorer.solana.com/tx/${d.txSignature}?cluster=devnet`}>View on Solana</a></>
            )}
          </div>
          {d.ownerWallet && <OwnerDownload designId={d._id} ownerWallet={d.ownerWallet} />}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-serif text-4xl text-violet-900">{priceLabel(d.price, d.currency)} <span className="text-base text-stone-500">{d.currency === "SOL" ? `≈ ${usd(d.price)} · paid on devnet` : `USD · paid as ${solText(d.price)} on devnet`}</span></p>
            {canEdit && (
              <Link href={`/design/${d._id}/edit`} className="inline-block rounded-full border border-violet-300 bg-white px-5 py-2 text-sm font-semibold text-violet-800 hover:border-violet-500">✏️ Edit listing</Link>
            )}
            <div id="buy" className="scroll-mt-24">
              {!gate.accepted ? (
                <ConfirmOwnership designId={d._id} designerWallet={d.designerWallet} needsReaccept={gate.needsReaccept} />
              ) : gate.blockReason ? (
                <p className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5 text-sm text-fuchsia-900">⚖️ {gate.blockReason}</p>
              ) : checkout === "1" ? (
                // Buyer has read the Exclusive Ownership Terms → show the checkout
                <BuyButton designId={d._id} title={d.title} price={d.price} designerWallet={d.designerWallet} initialOpen />
              ) : (
                <Link href={`/design/${d._id}/terms`}
                  className="block w-full rounded-full bg-violet-700 py-3 text-center font-semibold text-white hover:bg-violet-800">
                  Buy &amp; Own It
                </Link>
              )}
            </div>
            <a href={`/try-on?design=${d._id}`}
              className="block w-full rounded-xl border border-stone-300 py-3 text-center font-semibold hover:bg-stone-50">
              ☕ Try It On
            </a>
          </div>
        )}
        {d.mintAddress && (
          <a target="_blank" className="block text-xs text-stone-500 underline"
            href={`https://explorer.solana.com/address/${d.mintAddress}?cluster=devnet`}>
            ⛓️ Ownership token on Solana: {short(d.mintAddress)}
          </a>
        )}
        {gate.accepted && (
          <p className="text-xs text-stone-500">
            ✍️ Designer accepted the ownership transfer declaration (v{gate.agreementVersion}) on{" "}
            {new Date(gate.acceptedAt!).toLocaleDateString()}.
          </p>
        )}
        <Link href={`/certificate/${d._id}`} className="block text-sm font-semibold text-violet-700 hover:underline">
          📜 View Certificate of Creation
        </Link>
        <ReportButton designId={d._id} />
      </div>
    </div>
  );
}
