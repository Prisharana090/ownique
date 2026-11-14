"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { MATERIALS, POST_PREFIX } from "@/lib/objectRequests";

export default function NewRequest() {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [material, setMaterial] = useState("");
  const [style, setStyle] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError("Please choose a JPG, PNG or WebP photo.");
    if (f.size > 8 * 1024 * 1024) return setError("Photo must be under 8MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return setVisible(true);
    if (!signMessage || !file) return;
    setBusy(true); setError(null);
    try {
      const message = `${POST_PREFIX} at ${Date.now()}`;
      const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
      const form = new FormData();
      Object.entries({ material, style, budget, wallet: publicKey.toBase58(), message, signature }).forEach(([k, v]) => form.append(k, v));
      form.append("photo", file);
      const res = await fetch("/api/requests", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/requests/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post your object.");
      setBusy(false);
    }
  }

  const field = "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5";
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#ece3d9] bg-white/90 p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Design My Object</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-violet-900">Show designers your object</h1>
        <p className="text-sm text-stone-600">Designers will reply with designs from their shop, shown on your photo.</p>
      </div>
      <label className="block text-sm font-medium text-stone-800">Photo of your object
        <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-violet-100 file:px-4 file:py-2 file:font-semibold file:text-violet-800" />
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="Your object" className="max-h-72 rounded-2xl border border-stone-200 object-contain" />}
      <label className="block text-sm font-medium text-stone-800">Material
        <select required value={material} onChange={(e) => setMaterial(e.target.value)} className={field}>
          <option value="">Choose…</option>
          {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-stone-800">Preferred style <span className="font-normal text-stone-500">(optional)</span>
        <input value={style} onChange={(e) => setStyle(e.target.value)} maxLength={200} placeholder="e.g. soft florals, minimal lines, bold retro" className={field} />
      </label>
      <label className="block text-sm font-medium text-stone-800">Budget in SOL <span className="font-normal text-stone-500">(optional)</span>
        <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" placeholder="e.g. 0.5" className={field} />
      </label>
      <p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-900">Your photo will be shown publicly on this request so designers can work with it. Hidden photo data (like location) is removed.</p>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !file || !material} className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
        {!publicKey ? "Connect wallet to post" : busy ? "Sign in your wallet…" : "Post · Open to ideas"}
      </button>
    </form>
  );
}
