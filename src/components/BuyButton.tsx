"use client";
import { useEffect, useState } from "react";
import bs58 from "bs58";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

const BUYER_CONFIRMATIONS = [
  "I understand I'm buying full ownership of this design.",
  "The designer will always be credited as its creator.",
  "I'll get the full-quality file right after payment.",
  "All sales are final once the file is delivered.",
  "I agree to the Ownership Policy.",
];

export default function BuyButton(props: { designId: string; title: string; price: number; designerWallet: string }) {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(BUYER_CONFIRMATIONS.map(() => false));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null && !error && !status.startsWith("🎉");
  const [method, setMethod] = useState<"sol" | "bank">("sol");
  const [bank, setBank] = useState<{ available: boolean; priceUsd?: number } | null>(null);

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
      setStatus("✍️ Approve the free signature in your wallet (this is where your design will be delivered)…");
      const message = `Ownique: buy design ${props.designId} with bank at ${Date.now()}`;
      const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
      setStatus("🏦 Paying the designer from your Capital One test account…");
      const res = await fetch(`/api/designs/${props.designId}/buy-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerWallet: publicKey.toBase58(), message, signature, agreed: true }),
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
        body: JSON.stringify({ buyerWallet: publicKey.toBase58(), signature, agreed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setStatus(`🎉 You now own "${props.title}"!`);
      setTimeout(() => router.refresh(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700">
        Buy &amp; Own It
      </button>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <p className="font-semibold">Before you buy</p>
      {BUYER_CONFIRMATIONS.map((text, i) => (
        <label key={i} className="flex gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 accent-violet-600" checked={checked[i]} disabled={busy}
            onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
          <span>{i === 4 ? <>I agree to the <a href="/policy" target="_blank" className="underline">Ownership, Copyright &amp; Privacy terms</a>.</> : text}</span>
        </label>
      ))}
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
      <button onClick={method === "bank" ? buyWithBank : buy} disabled={!checked.every(Boolean) || busy}
        className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
        {!publicKey
          ? "Connect wallet to buy"
          : method === "bank"
            ? `Pay $${bank?.priceUsd ?? "…"} by bank & Own It`
            : `Pay ${props.price} SOL & Own It`}
      </button>
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
