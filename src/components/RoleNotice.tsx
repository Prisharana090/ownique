"use client";
// Tells people up front if their account can't do this (the server enforces it either way).
import { useEffect, useState } from "react";
import Link from "next/link";

export default function RoleNotice({ need, action }: { need: "buyer" | "designer"; action: string }) {
  const [me, setMe] = useState<{ role: string; username: string; walletAddress: string | null } | null | undefined>(undefined);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.account)).catch(() => setMe(null)); }, []);
  if (me === undefined) return null;
  const box = "rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 text-sm text-fuchsia-900";
  if (!me) return <p className={box}>Please <Link href="/login" className="font-semibold underline">log in</Link> or <Link href="/signup" className="font-semibold underline">create a {need === "designer" ? "Designer" : "Buyer"} account</Link> to {action}.</p>;
  if (me.role !== need) return <p className={box}>Only {need === "designer" ? "Designer" : "Buyer"} accounts can {action}. Your account is a {me.role === "designer" ? "Designer" : "Buyer"} account.</p>;
  if (!me.walletAddress) return <p className={box}>Link your Solana wallet on <Link href={`/u/${me.username}`} className="font-semibold underline">your profile</Link> to {action}.</p>;
  return null;
}
