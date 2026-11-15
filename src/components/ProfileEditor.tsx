"use client";
// Owner-only profile editing (the server also checks ownership on every change).
import { useState } from "react";
import { useRouter } from "next/navigation";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WALLET_LINK_PREFIX } from "@/lib/accountShared";

export default function ProfileEditor({ initial }: { initial: { displayName: string; bio: string; role: "buyer" | "designer"; walletAddress: string | null; username: string } }) {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, init: RequestInit, done: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't save." });
    setMsg({ ok: true, text: done });
    router.refresh();
  }
  async function linkWallet() {
    if (!publicKey || !signMessage) return setVisible(true);
    const message = `${WALLET_LINK_PREFIX} @${initial.username} at ${Date.now()}`;
    const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
    await call("/api/account/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: publicKey.toBase58(), message, signature }) }, "Wallet linked.");
  }

  const field = "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2";
  return (
    <div className="mt-5 border-t border-stone-100 pt-4">
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-full border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50">Edit profile</button>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-stone-800">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={field} /></label>
            <label className="block text-sm font-medium text-stone-800">Bio <span className="font-normal text-stone-500">({bio.length}/300)</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className={field} /></label>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => call("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, bio }) }, "Profile saved.")}
                className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-40">Save</button>
              <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-stone-600">Close</button>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <label className="block font-medium text-stone-800">Profile picture
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("avatar", f); call("/api/account/avatar", { method: "POST", body: fd }, "Picture updated."); }}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-violet-100 file:px-4 file:py-2 file:font-semibold file:text-violet-800" />
            </label>
            <div>
              <p className="font-medium text-stone-800">Wallet</p>
              <p className="text-xs text-stone-600">{initial.walletAddress ? `Linked: ${initial.walletAddress.slice(0, 4)}…${initial.walletAddress.slice(-4)}` : `Link a Solana wallet to ${initial.role === "designer" ? "list and sell designs" : "buy designs and leave reviews"}.`}</p>
              <button disabled={busy} onClick={linkWallet} className="mt-1 rounded-full border border-violet-300 bg-white px-4 py-1.5 text-sm font-semibold text-violet-800 disabled:opacity-40">
                {publicKey ? (initial.walletAddress ? "Link connected wallet instead" : "Link connected wallet") : "Connect wallet"}
              </button>
            </div>
            <p className="text-xs text-stone-500">Your role ({initial.role === "designer" ? "Designer" : "Buyer"}) and username are permanent. Email, wallet signatures, payments and agreements are never shown publicly.</p>
          </div>
          {msg && <p className={`md:col-span-2 rounded-xl p-3 text-sm ${msg.ok ? "bg-violet-50 text-violet-900" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}
