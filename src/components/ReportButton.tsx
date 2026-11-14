"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export default function ReportButton({ designId }: { designId: string }) {
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    const res = await fetch(`/api/designs/${designId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, reporterWallet: publicKey?.toBase58() }),
    });
    const data = await res.json();
    setMsg(res.ok ? "🚩 Thanks for reporting. This design is hidden while we review it." : data.error);
  }

  if (msg) return <p className="rounded-xl bg-stone-100 p-3 text-sm">{msg}</p>;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-stone-500 underline hover:text-red-600">
        🚩 Report this design
      </button>
    );
  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold">What&apos;s wrong?</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
        placeholder="e.g. This is my design, it was stolen from my Instagram"
        className="w-full rounded-lg border border-stone-300 p-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={send} disabled={reason.trim().length < 5}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Send report</button>
        <button onClick={() => setOpen(false)} className="text-sm text-stone-500">Cancel</button>
      </div>
    </div>
  );
}
