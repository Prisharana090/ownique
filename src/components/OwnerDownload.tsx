"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

// Shows a "Download full file" button only to the wallet that owns this design.
export default function OwnerDownload({ designId, ownerWallet }: { designId: string; ownerWallet: string }) {
  const { publicKey, signMessage } = useWallet();
  const [msg, setMsg] = useState<string | null>(null);
  if (!publicKey || publicKey.toBase58() !== ownerWallet) return null;

  async function download() {
    if (!publicKey || !signMessage) return setMsg("Your wallet can't sign messages.");
    try {
      setMsg("Approve the free signature in your wallet…");
      const message = `Ownique: download design ${designId} at ${Date.now()}`;
      const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
      const res = await fetch(`/api/designs/${designId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), message, signature }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const name = /filename="(.+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "design";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setMsg("✅ Downloaded. It's all yours!");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={download} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700">
        ⬇️ Download your full-quality file
      </button>
      {msg && <p className="text-sm text-stone-600">{msg}</p>}
    </div>
  );
}
