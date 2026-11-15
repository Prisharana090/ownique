import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import PrintButton from "@/components/PrintButton";
import { getOwnershipGate } from "@/lib/agreements";
import { solText, usd } from "@/lib/price";

export const dynamic = "force-dynamic";

type D = {
  _id: string; title: string; category: string; status: string; designerWallet: string; ownerWallet?: string | null;
  imageHash: string; mintAddress?: string | null; txSignature?: string | null; tokenTransferSignature?: string | null;
  paymentMethod?: string | null; priceUsd?: number | null; price: number; agreedAt: string; createdAt: string; soldAt?: string | null;
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "medium", timeZone: "UTC" }) + " UTC" : "—";

// 📜 Certificate of Creation: a shareable, printable proof of who made a design, when, and who owns it now.
export default async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) notFound();
  await connectDb();
  const doc = await Design.findById(id).lean();
  if (!doc) notFound();
  const d: D = JSON.parse(JSON.stringify(doc));
  if (d.status === "hidden") notFound();
  const gate = await getOwnershipGate(d._id);
  const explorer = (kind: "address" | "tx", v: string) => `https://explorer.solana.com/${kind}/${v}?cluster=devnet`;

  const rows: [string, React.ReactNode][] = [
    ["Design", <b key="t">{d.title}</b>],
    ["Made for", <span key="c" className="capitalize">{d.category}</span>],
    ["Created by (wallet)", <code key="dw" className="break-all">{d.designerWallet}</code>],
    ["Created on", fmt(d.createdAt)],
    [
      "Ownership transfer declaration",
      gate.accepted
        ? `Accepted, version ${gate.agreementVersion}, ${fmt(gate.acceptedAt?.toISOString())}${gate.rightsReview === "pending" ? " · third-party rights under review" : ""}`
        : "Not yet accepted",
    ],
    ["Digital fingerprint (SHA-256)", <code key="h" className="break-all text-xs">{d.imageHash}</code>],
    [
      "Ownership token (Solana)",
      d.mintAddress ? (
        <a key="m" className="break-all text-violet-700 underline" target="_blank" href={explorer("address", d.mintAddress)}>{d.mintAddress}</a>
      ) : (
        "Not minted"
      ),
    ],
    ["Current owner", d.status === "sold" && d.ownerWallet ? <code key="o" className="break-all">{d.ownerWallet}</code> : d.mintAddress ? "Not sold yet: token held in the Ownique vault" : "Not sold yet"],
  ];
  if (d.status === "sold") {
    rows.push(["Sold on", fmt(d.soldAt)]);
    rows.push([
      "Payment",
      d.paymentMethod === "bank"
        ? `Bank transfer via Capital One${d.priceUsd ? `, $${d.priceUsd}` : ""}`
        : d.txSignature
          ? <a key="p" className="break-all text-violet-700 underline" target="_blank" href={explorer("tx", d.txSignature)}>{usd(d.price)} ({solText(d.price)}) · view on Solana</a>
          : `${usd(d.price)} (${solText(d.price)})`,
    ]);
    if (d.tokenTransferSignature)
      rows.push(["Ownership transfer", <a key="tt" className="break-all text-violet-700 underline" target="_blank" href={explorer("tx", d.tokenTransferSignature)}>View on Solana</a>]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-3xl border-4 border-double border-violet-300 bg-white p-8 shadow-sm sm:p-12">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-600">Ownique</p>
          <h1 className="mt-2 font-serif text-4xl font-bold">Certificate of Creation</h1>
          <p className="mt-2 text-stone-500">One design. One owner. Credit forever.</p>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-[200px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/designs/${d._id}/image${d.imageHash ? `?v=${String(d.imageHash).slice(0, 8)}` : ""}`} alt={d.title} className="w-full rounded-xl border border-stone-200" />
          <dl className="space-y-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">{k}</dt>
                <dd className="text-stone-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-8 border-t border-stone-200 pt-4 text-xs leading-relaxed text-stone-500">
          This certificate records what Ownique saw when the design was listed: the creator&apos;s wallet, the exact time,
          and a fingerprint of the original file. The ownership token on Solana (devnet) is public and permanent, so anyone
          can check it. The designer&apos;s signed declaration records their promise; it does not by itself prove authorship or ownership.
          Copyright belongs to the creator automatically by law; this certificate is evidence of creation and
          transfer, not an official copyright registration or legal advice.
        </p>
      </div>

      <div className="flex justify-center gap-3 print:hidden">
        <Link href={`/design/${d._id}`} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50">
          ← Back to design
        </Link>
        <PrintButton />
      </div>
    </div>
  );
}
