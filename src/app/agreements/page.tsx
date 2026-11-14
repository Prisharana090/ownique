"use client";
// My Agreements: purchase agreements (as buyer), sales agreements and ownership declarations (as designer).
import { useState } from "react";
import Link from "next/link";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

type Party = { account: string; username: string | null; legalName?: string; acceptedAt: string; acceptedVersion: string };
type Agreement = {
  agreementId: string; transactionId?: string; designId: string; designTitle: string; priceSol: number; agreementVersion: string;
  isDemo: boolean; status: string; transferStatus: string; governingLaw: string | null; designer: Party; buyer: Party; createdAt: string;
  payment: { method: string | null; amountSol: number | null; amountUsd: number | null; status: string; reference: string | null; verifiedAt: string | null };
};
type Declaration = { designId: string; agreementVersion: string; acceptedAt: string; status: string; rightsReview: string; design: { title: string; status: string } | null };
type Data = { token: string; purchases: Agreement[]; sales: Agreement[]; declarations: Declaration[] };

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const TRANSFER: Record<string, [string, string]> = {
  awaiting_payment: ["Awaiting payment", "bg-stone-100 text-stone-700"],
  demo_not_legally_effective: ["Test purchase · not legally effective", "bg-amber-100 text-amber-900"],
  payment_confirmed_pending_execution: ["Paid · transfer pending execution", "bg-violet-100 text-violet-800"],
  superseded: ["Superseded by a newer version", "bg-stone-100 text-stone-500"],
};

function Card({ a, role, token }: { a: Agreement; role: "buyer" | "designer"; token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [label, cls] = TRANSFER[a.transferStatus] ?? [a.transferStatus, "bg-stone-100"];
  async function download() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/agreements/${a.agreementId}/pdf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const link = Object.assign(document.createElement("a"), { href: url, download: `${a.isDemo ? "TEST-" : ""}Ownique-Purchase-Agreement-${a.agreementId}.pdf` });
      link.click(); URL.revokeObjectURL(url);
    } catch (e) { setErr(e instanceof Error ? e.message : "Download failed"); } finally { setBusy(false); }
  }
  const party = (title: string, p: Party) => (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{title}</p>
      <p className="font-medium text-stone-800">{p.legalName ?? "Shared after payment"}</p>
      <p className="text-xs text-stone-500">{p.username ?? short(p.account)} · accepted v{p.acceptedVersion} on {fmt(p.acceptedAt)}</p>
    </div>
  );
  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/designs/${a.designId}/image`} alt="" className="h-28 w-28 shrink-0 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/design/${a.designId}`} className="font-serif text-lg font-semibold text-violet-900 hover:underline">{a.designTitle}</Link>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
          {a.isDemo && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">🧪 TEST</span>}
        </div>
        <p className="break-all text-xs text-stone-500">Agreement {a.agreementId} · version {a.agreementVersion}{a.transactionId ? ` · ${a.transactionId}` : ""}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {party("Designer acceptance", a.designer)}
          {party("Buyer acceptance", a.buyer)}
        </div>
        <p className="text-sm text-stone-700">
          <span className="font-medium">Payment:</span>{" "}
          {a.payment.status === "verified"
            ? `Verified · ${a.payment.method === "bank" ? `US$${a.payment.amountUsd} by bank` : `${a.payment.amountSol} SOL`} · ${fmt(a.payment.verifiedAt)}`
            : "Not paid yet"}
        </p>
        {a.payment.reference && <p className="break-all text-xs text-stone-400">Reference: {a.payment.reference}</p>}
        {a.status === "paid" && (
          <button onClick={download} disabled={busy}
            className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
            {busy ? "Preparing PDF…" : "Download Purchase Agreement PDF"}
          </button>
        )}
        {err && <p className="text-sm text-red-700">{err}</p>}
        <p className="text-[11px] text-stone-400">You are the {role} on this agreement.</p>
      </div>
    </article>
  );
}

export default function MyAgreements() {
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!publicKey) return setVisible(true);
    if (!signMessage) return setError("Your wallet can't sign messages.");
    setBusy(true); setError(null);
    try {
      const message = `Ownique: show my agreements at ${Date.now()}`;
      const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
      const res = await fetch("/api/agreements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: publicKey.toBase58(), message, signature }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your agreements"); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold text-violet-900 sm:text-4xl">My Agreements</h1>
        <p className="text-sm text-stone-600">Only you and the other party to each agreement can see these records and download the PDFs.</p>
      </header>
      {!data && (
        <div className="rounded-3xl border border-violet-200 bg-white p-6 text-center">
          <p className="mb-4 text-stone-700">Sign a free message with your wallet to prove it&apos;s you.</p>
          <button onClick={load} disabled={busy} className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
            {!publicKey ? "Connect wallet" : busy ? "Check your wallet…" : "Show my agreements"}
          </button>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      )}
      {data && (
        <>
          <section id="purchases" className="space-y-3">
            <h2 className="font-serif text-2xl font-semibold text-stone-900">My Purchase Agreements</h2>
            {data.purchases.length === 0 ? <p className="text-sm text-stone-500">No purchases yet.</p>
              : data.purchases.map((a) => <Card key={a.agreementId} a={a} role="buyer" token={data.token} />)}
          </section>
          <section className="space-y-3">
            <h2 className="font-serif text-2xl font-semibold text-stone-900">My Sales Agreements</h2>
            {data.sales.length === 0 ? <p className="text-sm text-stone-500">No sold designs yet.</p>
              : data.sales.map((a) => <Card key={a.agreementId} a={a} role="designer" token={data.token} />)}
          </section>
          <section className="space-y-3">
            <h2 className="font-serif text-2xl font-semibold text-stone-900">My Ownership Declarations</h2>
            {data.declarations.length === 0 ? <p className="text-sm text-stone-500">You haven&apos;t listed any designs yet.</p> : (
              <ul className="divide-y divide-stone-100 rounded-3xl border border-stone-200 bg-white">
                {data.declarations.map((d) => (
                  <li key={`${d.designId}-${d.agreementVersion}`} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <Link href={`/design/${d.designId}`} className="font-medium text-violet-900 hover:underline">{d.design?.title ?? d.designId}</Link>
                    <span className="text-stone-500">v{d.agreementVersion} · {d.status} · {fmt(d.acceptedAt)}{d.rightsReview === "pending" ? " · rights review pending" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-stone-400">
            Demo Agreement Acceptance — Not a Legal E-Signature Service. These records show the terms each party accepted; they are pending qualified legal review and don&apos;t by themselves prove a legal signature, identity, authorship or an effective transfer.
          </p>
        </>
      )}
    </main>
  );
}
