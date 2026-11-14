"use client";
import { useState } from "react";
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
  const { publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(BUYER_CONFIRMATIONS.map(() => false));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null && !error;

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
          <span>{i === 4 ? <>I agree to the <a href="/policy" target="_blank" className="underline">Ownership Policy</a>.</> : text}</span>
        </label>
      ))}
      {status && !error && <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-800">{status}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button onClick={buy} disabled={!checked.every(Boolean) || busy}
        className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
        {publicKey ? `Pay ${props.price} SOL & Own It` : "Connect wallet to buy"}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} className="w-full text-sm text-stone-500 hover:text-stone-800">
        Cancel
      </button>
    </div>
  );
}
