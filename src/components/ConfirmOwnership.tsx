"use client";
// Shown on a design page when the designer hasn't accepted the Ownership Transfer Declaration yet.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import DeclarationFields, { declarationComplete, emptyDeclaration, signDeclaration, type DeclarationState } from "./DeclarationFields";
import { CONFIRMATION_REQUIRED, DECLARATION_VERSION, REACCEPT_REQUIRED, declarationPrefix } from "@/lib/declaration";

export default function ConfirmOwnership({ designId, designerWallet, needsReaccept = false }: { designId: string; designerWallet: string; needsReaccept?: boolean }) {
  const router = useRouter();
  const { publicKey, signMessage } = useWallet();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<DeclarationState>(emptyDeclaration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesigner = publicKey?.toBase58() === designerWallet;

  async function submit() {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await signDeclaration(d, signMessage, bs58.encode, (n) => declarationPrefix(n));
      const res = await fetch(`/api/designs/${designId}/agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerWallet: publicKey.toBase58(), ...signed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5">
      <p className="font-semibold text-fuchsia-900">🔒 {needsReaccept ? REACCEPT_REQUIRED : CONFIRMATION_REQUIRED}</p>
      <p className="text-sm text-fuchsia-900/80">
        This design can&apos;t be bought until its original designer accepts the ownership transfer declaration.
      </p>
      {isDesigner && !open && (
        <button onClick={() => setOpen(true)} className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800">
          {needsReaccept ? `I'm the designer: accept version ${DECLARATION_VERSION}` : "I'm the designer: confirm ownership"}
        </button>
      )}
      {isDesigner && open && (
        <div className="space-y-3">
          <DeclarationFields value={d} onChange={setD} disabled={busy} />
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button onClick={submit} disabled={!declarationComplete(d) || busy}
            className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
            {busy ? "Sign in your wallet…" : "Sign Declaration"}
          </button>
        </div>
      )}
    </div>
  );
}
