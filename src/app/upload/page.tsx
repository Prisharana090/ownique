"use client";
import RoleNotice from "@/components/RoleNotice";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import DeclarationFields, { declarationComplete, emptyDeclaration, signDeclaration, type DeclarationState } from "@/components/DeclarationFields";
import { declarationPrefix } from "@/lib/declaration";
import { usdToSol } from "@/lib/price";

const CATEGORIES = ["cup", "glasses", "shirt", "phone case", "tote", "other"];

const CONFIRMATIONS = [
  "It doesn't use any brand logo, trademark, mascot or character.",
  "I understand I'll be credited as the creator, but the buyer will own the design.",
  "I agree to the Ownership Policy.",
];

export default function Upload() {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("cup");
  const [checked, setChecked] = useState<boolean[]>(CONFIRMATIONS.map(() => false));
  const [declaration, setDeclaration] = useState<DeclarationState>(emptyDeclaration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checked.every(Boolean);
  const ready = Boolean(publicKey && file && title && Number(price) > 0 && allChecked && declarationComplete(declaration));

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !file || !publicKey) return;
    if (!signMessage) return setError("Your wallet can't sign messages. Try Phantom.");
    setBusy(true);
    setError(null);
    // ✍️ Sign the ownership declaration with the wallet (free, no transaction)
    let signed: Record<string, string>;
    try {
      signed = await signDeclaration(declaration, signMessage, bs58.encode, (n) => declarationPrefix(n));
    } catch {
      setError("You need to approve the signature in your wallet to list the design.");
      setBusy(false);
      return;
    }
    const form = new FormData();
    form.append("image", file);
    form.append("title", title);
    form.append("price", String(usdToSol(Number(price)))); // stored in SOL for the Solana payment
    form.append("category", category);
    form.append("designerWallet", publicKey.toBase58());
    form.append("agreed", String(allChecked));
    for (const [k, v] of Object.entries(signed)) form.append(k, v);
    try {
      const res = await fetch("/api/designs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.push(`/design/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold text-violet-900">Sell a design</h1>
        <p className="text-stone-600">It sells once. You keep the credit forever.</p>
        <RoleNotice need="designer" action="list designs" />
        <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white hover:border-violet-400">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-stone-500">Click to choose an image (max 2MB)</span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="space-y-5 rounded-3xl border border-[#ece3d9] bg-white/80 p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Waves"
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 outline-violet-500" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Price (US$)</span>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="75"
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 outline-violet-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Made for</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 capitalize">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="space-y-2 rounded-xl bg-stone-50 p-4">
          <legend className="mb-1 text-sm font-semibold">Listing rules</legend>
          {CONFIRMATIONS.map((text, i) => (
            <label key={i} className="flex gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-violet-600" checked={checked[i]}
                onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
              <span>
                {i === CONFIRMATIONS.length - 1 ? <>I agree to the <a href="/policy" target="_blank" className="underline">Ownership, Copyright &amp; Privacy terms</a>.</> : text}
              </span>
            </label>
          ))}
        </fieldset>

        <DeclarationFields value={declaration} onChange={setDeclaration} disabled={busy} />

        <p className="text-xs text-stone-500">
          Not sure your design is original? Attach it to <b>💬 Ask Ownique</b> (bottom right) for a quick brand look-alike check.
        </p>
        {!publicKey && <p className="text-sm text-amber-700">Connect your wallet (top right) to sell.</p>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <button disabled={!ready || busy}
          className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Listing… (sign in your wallet, then Grok writes your description ✨)" : "Sign Declaration & List Design"}
        </button>
      </div>
    </form>
  );
}
