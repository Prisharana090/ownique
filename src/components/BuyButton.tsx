"use client";
import RoleNotice from "./RoleNotice";
import { useEffect, useState } from "react";
import bs58 from "bs58";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

type Terms = {
  version: string; termsHash: string; sections: { heading: string; body: string[] }[]; isDemo: boolean;
  governingLaw: string | null; acceptLabel: string; demoLabel: string; legalNotice: string;
};
const validName = (n: string) => { const t = n.replace(/\s+/g, " ").trim(); return t.length >= 3 && t.length <= 100 && /\p{L}/u.test(t) && t.includes(" "); };

export default function BuyButton(props: { designId: string; title: string; price: number; designerWallet: string; initialOpen?: boolean }) {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  const [terms, setTerms] = useState<Terms | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [legalName, setLegalName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [accepted, setAccepted] = useState<{ agreementId: string; key: string } | null>(null);
  const canContinue = Boolean(terms) && agreed && validName(legalName);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null && !error && !status.startsWith("🎉");
  const [method, setMethod] = useState<"sol" | "bank">("sol");
  const [bank, setBank] = useState<{ available: boolean; priceUsd?: number } | null>(null);

  // The full design-specific agreement comes from the server (with its version + integrity hash).
  useEffect(() => {
    if (!open || terms) return;
    fetch(`/api/designs/${props.designId}/purchase-agreement`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setTerms(d); })
      .catch((e) => setTermsError(e instanceof Error ? e.message : "Couldn't load the agreement."));
  }, [open, terms, props.designId]);

  /** Step 1 of checkout: the buyer accepts the agreement (signed with their wallet). Returns the agreement id. */
  async function acceptAgreement(): Promise<string> {
    if (!publicKey || !signMessage || !terms) throw new Error("Your wallet can't sign messages.");
    const name = legalName.replace(/\s+/g, " ").trim();
    const key = `${publicKey.toBase58()}|${name}|${terms.termsHash}`;
    if (accepted?.key === key) return accepted.agreementId; // already accepted in this checkout
    setStatus("✍️ Sign the agreement acceptance in your wallet (free, no payment)…");
    const message = `Ownique purchase agreement ${terms.version} ${terms.termsHash} for design ${props.designId} accepted by ${name} at ${Date.now()}`;
    const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
    const res = await fetch(`/api/designs/${props.designId}/purchase-agreement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerWallet: publicKey.toBase58(), legalName: name, accepted: agreed, version: terms.version, termsHash: terms.termsHash, message, signature }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) setTerms(null); // terms changed: reload the new version
      throw new Error(data.error || "Couldn't record your acceptance.");
    }
    setAccepted({ agreementId: data.agreementId, key });
    return data.agreementId;
  }

  // Is Capital One "Pay with bank" available for this design?
  useEffect(() => {
    if (!open || bank) return;
    fetch(`/api/designs/${props.designId}/buy-bank`).then((r) => r.json()).then(setBank).catch(() => setBank({ available: false }));
  }, [open, bank, props.designId]);

  async function buyWithBank() {
    if (!publicKey) return setVisible(true);
    if (!signMessage) return setError("Your wallet can't sign messages.");
    setError(null);
    try {
      const agreementId = await acceptAgreement();
      setStatus("🏦 Paying the designer from your Capital One test account…");
      const res = await fetch(`/api/designs/${props.designId}/buy-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerWallet: publicKey.toBase58(), agreementId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      const left = typeof data.buyerBalance === "number" ? ` Bank balance left: $${data.buyerBalance}.` : "";
      setStatus(`🎉 You now own "${props.title}"! Paid $${data.amountUsd} by bank.${left}`);
      setTimeout(() => router.refresh(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    }
  }

  async function buy() {
    if (!publicKey) return setVisible(true);
    setError(null);
    try {
      const agreementId = await acceptAgreement(); // accepted BEFORE any money moves
      setStatus("Confirm the payment in your wallet…");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(props.designerWallet),
          lamports: Math.round(props.price * LAMPORTS_PER_SOL),
        })
      );
      const signature = await sendTransaction(tx, connection);
      setStatus("⏳ Payment sent. Waiting for Solana to confirm…");
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, ...latest }, "confirmed");

      setStatus("🔐 Verifying payment and moving ownership to you…");
      const res = await fetch(`/api/designs/${props.designId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerWallet: publicKey.toBase58(), signature, agreementId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setStatus(`🎉 You now own "${props.title}"! Your purchase agreement is in My Agreements.`);
      setTimeout(() => router.refresh(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800">
        Buy &amp; Own It
      </button>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-serif text-lg font-semibold text-violet-900">Exclusive Design Purchase Agreement</p>
        {terms && <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">Version {terms.version}</span>}
      </div>
      <RoleNotice need="buyer" action="buy designs" />
      {terms?.isDemo && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          🧪 {terms.demoLabel} · Test purchase, no real money, never legally effective.
        </p>
      )}
      {termsError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{termsError}</p>}
      {!terms && !termsError && <p className="text-sm text-stone-500">Loading the agreement…</p>}
      {terms && (
        <div className="max-h-80 overflow-y-auto rounded-xl [overflow-wrap:anywhere] border border-stone-200 bg-stone-50 p-4 text-[13px] leading-relaxed text-stone-700 sm:max-h-96"
          tabIndex={0} aria-label="Full agreement text">
          {terms.sections.map((sec) => (
            <section key={sec.heading} className="mb-3 last:mb-0">
              <h3 className="mb-1 font-semibold text-stone-900">{sec.heading}</h3>
              {sec.body.map((b, i) => <p key={i} className="mb-1.5">{b}</p>)}
            </section>
          ))}
          <p className="mt-3 break-all text-[11px] text-stone-400">Integrity hash (SHA-256): {terms.termsHash}</p>
        </div>
      )}
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Your full legal name</span>
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={busy} autoComplete="name"
          placeholder="First and last name" maxLength={100}
          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none sm:text-sm" />
        <span className="mt-1 block text-xs text-stone-500">Shared only with the designer in your executed agreement. Never shown publicly.</span>
      </label>
      <label className="flex gap-2.5 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600" checked={agreed} disabled={busy || !terms}
          onChange={(e) => setAgreed(e.target.checked)} />
        <span className="font-medium text-stone-800">{terms?.acceptLabel ?? "I have read and agree to the Exclusive Design Purchase Agreement."}</span>
      </label>
      {bank?.available && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {([
            ["sol", "⛓️ Pay with SOL", "Phantom wallet"],
            ["bank", "🏦 Pay with bank", "Capital One (Nessie)"],
          ] as const).map(([value, label, sub]) => (
            <button key={value} type="button" disabled={busy} onClick={() => setMethod(value)}
              className={`rounded-xl border p-3 text-left ${method === value ? "border-violet-500 bg-violet-50" : "border-stone-200"}`}>
              <span className="block font-semibold">{label}</span>
              <span className="text-xs text-stone-500">{sub}</span>
            </button>
          ))}
        </div>
      )}
      {status && !error && <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-800">{status}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button onClick={method === "bank" ? buyWithBank : buy} disabled={!canContinue || busy}
        className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
        {!publicKey
          ? "Connect wallet to buy"
          : method === "bank"
            ? `Pay $${bank?.priceUsd ?? "…"} by bank & Own It`
            : `Pay ${props.price} SOL & Own It`}
      </button>
      {terms && (
        <p className="text-[11px] leading-snug text-stone-500">{terms.legalNotice}</p>
      )}
      {method === "bank" && (
        <p className="text-xs text-stone-500">
          No crypto needed to pay. Your wallet is only used to receive the ownership token. Demo bank accounts run on Capital One&apos;s Nessie sandbox.
        </p>
      )}
      <button onClick={() => setOpen(false)} disabled={busy} className="w-full text-sm text-stone-500 hover:text-stone-800">
        Cancel
      </button>
    </div>
  );
}
