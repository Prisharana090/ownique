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

export const dynamic = "force-dynamic";

type D = {
  _id: string; title: string; price: number; category: string; status: string;
  designerWallet: string; ownerWallet?: string | null; description: string; tags: string[];
  describedByGrok: boolean; soldAt?: string | null; txSignature?: string | null; mintAddress?: string | null;
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

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-[2rem] border-8 border-white bg-white shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${d._id}/image`} alt={d.title} className="w-full object-cover" />
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Made for {d.category}</p>
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
            <p className="font-serif text-4xl text-violet-900">{d.price} <span className="text-2xl text-fuchsia-500">SOL</span></p>
            <div id="buy" className="scroll-mt-24">
              {!gate.accepted ? (
                <ConfirmOwnership designId={d._id} designerWallet={d.designerWallet} />
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
