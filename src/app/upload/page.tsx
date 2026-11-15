"use client";
import RoleNotice from "@/components/RoleNotice";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import DeclarationFields, { declarationComplete, emptyDeclaration, signDeclaration, type DeclarationState } from "@/components/DeclarationFields";
import ListingFields, { emptyListing, listingValid, type ListingState } from "@/components/ListingFields";
import { declarationPrefix } from "@/lib/declaration";
import { fetchMe, type Me } from "@/lib/meClient";

const CONFIRMATIONS = [
  "It doesn't use any brand logo, trademark, mascot or character.",
  "I understand I'll be credited as the creator, but the buyer will own the design.",
  "I agree to the Ownership Policy.",
];
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

type Done = { id: string; title: string };

/** Sends the form with real upload progress (fetch can't report it). */
function postWithProgress(url: string, body: FormData, onProgress: (pct: number) => void) {
  return new Promise<{ ok: boolean; data: { id?: string; error?: string } }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { id?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { data = { error: "The server sent an unexpected reply." }; }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The upload took too long. Please try again."));
    xhr.timeout = 120_000;
    xhr.send(body);
  });
}

export default function Upload() {
  const { publicKey, signMessage } = useWallet();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingState>(emptyListing);
  const [isDemo, setIsDemo] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(CONFIRMATIONS.map(() => false));
  const [declaration, setDeclaration] = useState<DeclarationState>(emptyDeclaration);
  const [stage, setStage] = useState<"idle" | "signing" | "uploading" | "processing">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const username = me?.username ?? null;

  useEffect(() => { fetchMe(true).then(setMe).catch(() => {}).finally(() => setMeLoaded(true)); }, []);

  const busy = stage !== "idle";
  const allChecked = checked.every(Boolean);
  const walletLinked = Boolean(publicKey && me?.walletAddress === publicKey.toBase58());
  // Everything the server will check, listed in plain words so the button never looks "stuck".
  const missing = [
    meLoaded && !me && "Log in with a Designer account",
    me && me.role !== "designer" && "Use a Designer account (this one is a Buyer)",
    !publicKey && "Connect your wallet (Select Wallet, top right)",
    publicKey && me?.role === "designer" && !walletLinked && "Link this wallet on your profile (it's different from the one on your account)",
    !file && "Choose your artwork",
    !listing.title.trim() && "Add a title",
    !(Number(listing.price) > 0) && "Set a price",
    !allChecked && "Tick all 3 seller agreement boxes",
    declaration.legalName.trim().split(/\s+/).length < 2 && "Enter your full legal name (first and last)",
    !(declaration.reviewedDeclaration && declaration.acceptedDeclaration && declaration.authorityConfirmed) && "Tick all the ownership declaration boxes",
    declaration.thirdPartyContent === null && "Answer the third-party content question",
    declaration.thirdPartyContent === true && declaration.thirdPartyDetails.trim().length < 5 && "Describe the third-party content",
  ].filter(Boolean) as string[];
  const ready = Boolean(publicKey && file && walletLinked && me?.role === "designer" && listingValid(listing) && allChecked && declarationComplete(declaration));
  const last = done[done.length - 1];

  function pickFile(f: File | null) {
    setError(null);
    if (f && !TYPES.includes(f.type)) return setError("Artwork must be a PNG, JPG or WebP image.");
    if (f && f.size > MAX_BYTES) return setError(`That image is ${(f.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.`);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function startAnother() {
    setFile(null);
    setPreview(null);
    setListing({ ...emptyListing, currency: listing.currency, style: listing.style, category: listing.category });
    setChecked(CONFIRMATIONS.map(() => false));
    setDeclaration(emptyDeclaration);
    setProgress(0);
    setError(null);
    setShowSuccess(false); // the list of what was published this session is kept
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !file || !publicKey) return;
    if (!signMessage) return setError("Your wallet can't sign messages. Try Phantom.");
    setError(null);
    setStage("signing");
    // ✍️ Sign the ownership declaration with the wallet (free, no transaction)
    let signed: Record<string, string>;
    try {
      signed = await signDeclaration(declaration, signMessage, bs58.encode, (n) => declarationPrefix(n));
    } catch {
      setError("You need to approve the signature in your wallet to publish the design.");
      setStage("idle");
      return;
    }
    const form = new FormData();
    form.append("image", file);
    form.append("title", listing.title.trim());
    form.append("description", listing.description.trim());
    form.append("price", listing.price); // in the chosen currency; the server converts to SOL
    form.append("currency", listing.currency);
    form.append("category", listing.category);
    form.append("style", listing.style);
    form.append("material", listing.material);
    form.append("isDemo", String(isDemo));
    form.append("designerWallet", publicKey.toBase58());
    form.append("agreed", String(allChecked));
    for (const [k, v] of Object.entries(signed)) form.append(k, v);
    try {
      setStage("uploading");
      setProgress(0);
      const res = await postWithProgress("/api/designs", form, (p) => {
        setProgress(p);
        if (p >= 100) setStage("processing");
      });
      if (!res.ok || !res.data.id) throw new Error(res.data.error || "Upload failed. Please try again.");
      setDone((d) => [...d, { id: res.data.id!, title: listing.title.trim() }]);
      setShowSuccess(true);
      setStage("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setStage("idle");
    }
  }

  // ✅ Success screen after each publish
  if (showSuccess && last) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-[#ece3d9] bg-white/90 p-8 text-center shadow-sm">
        <p className="text-4xl">🎉</p>
        <h1 className="font-serif text-3xl font-semibold text-violet-900">&ldquo;{last.title}&rdquo; is live!</h1>
        <p className="text-stone-600">It&apos;s now in the shop and on your profile. Your other listings are untouched.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/design/${last.id}`} className="rounded-full bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800">View design</Link>
          {username && <Link href={`/u/${username}`} className="rounded-full border border-violet-300 px-6 py-3 font-semibold text-violet-800 hover:border-violet-500">My profile</Link>}
          <button type="button" onClick={startAnother}
            className="rounded-full border border-violet-300 px-6 py-3 font-semibold text-violet-800 hover:border-violet-500">+ Upload another design</button>
        </div>
        {done.length > 1 && (
          <div className="rounded-2xl bg-stone-50 p-4 text-left text-sm">
            <p className="mb-2 font-semibold text-stone-800">Published this session ({done.length})</p>
            <ul className="space-y-1">
              {done.map((d) => <li key={d.id}><Link href={`/design/${d.id}`} className="text-violet-700 underline">{d.title}</Link></li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold text-violet-900">Upload a new design</h1>
        <p className="text-stone-600">Each design sells once. You keep the credit forever. Add as many as you like.</p>
        <RoleNotice need="designer" action="list designs" />
        <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-violet-200 bg-white hover:border-violet-400">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your artwork" className="h-full w-full object-contain" />
          ) : (
            <span className="px-6 text-center text-stone-500">Click to choose your artwork<br /><span className="text-xs">PNG, JPG or WebP · at least 200×200 · max 2MB</span></span>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </label>
        <p className="text-xs text-stone-500">🔒 Your original file stays private. Shoppers only see a watermarked preview; the buyer gets the full file after paying.</p>
      </div>

      <div className="space-y-5 rounded-3xl border border-[#ece3d9] bg-white/80 p-6 shadow-sm">
        <ListingFields value={listing} onChange={setListing} disabled={busy} />

        <label className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" className="mt-0.5 accent-violet-600" checked={isDemo} disabled={busy} onChange={(e) => setIsDemo(e.target.checked)} />
          <span>This is a <b>demo / test listing</b> (shown with a &ldquo;Demo&rdquo; label).</span>
        </label>

        <fieldset disabled={busy} className="space-y-2 rounded-xl bg-stone-50 p-4">
          <legend className="mb-1 text-sm font-semibold">Seller agreement</legend>
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

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!busy && missing.length > 0 && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-sm text-violet-900">
            <p className="font-semibold">Still needed to publish:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {missing.map((m) => (
                <li key={m}>
                  {m.startsWith("Link this wallet") && username ? <Link href={`/u/${username}`} className="underline">{m}</Link>
                    : m.startsWith("Log in") ? <Link href="/login" className="underline">{m}</Link> : m}
                </li>
              ))}
            </ul>
          </div>
        )}
        {busy && (
          <div aria-live="polite" className="space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-violet-100">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all" style={{ width: `${stage === "signing" ? 5 : stage === "processing" ? 100 : progress}%` }} />
            </div>
            <p className="text-xs text-stone-600">
              {stage === "signing" ? "Approve the signature in your wallet…" : stage === "uploading" ? `Uploading… ${progress}%` : "Checking originality, making the preview and minting the ownership token…"}
            </p>
          </div>
        )}

        <button disabled={!ready || busy}
          className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Publishing…" : "Sign Declaration & Publish Design"}
        </button>
      </div>
    </form>
  );
}
