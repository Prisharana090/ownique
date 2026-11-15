"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Reset() {
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch(token ? "/api/auth/reset" : "/api/auth/reset-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token, password } : { email }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Something went wrong." });
    setMsg({ ok: true, text: token ? "Your password was changed. You can log in now." : d.message || "If that email has an account, we've sent a reset link." });
  }
  const field = "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5";
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-3xl border border-[#ece3d9] bg-white/90 p-6 shadow-sm sm:p-8">
      <h1 className="font-serif text-3xl font-semibold text-violet-900">{token ? "Choose a new password" : "Reset your password"}</h1>
      {token
        ? <label className="block text-sm font-medium text-stone-800">New password<input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={field} /></label>
        : <label className="block text-sm font-medium text-stone-800">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} /></label>}
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-violet-50 text-violet-900" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <button disabled={busy} className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">{busy ? "Please wait…" : token ? "Save new password" : "Send reset link"}</button>
      <Link href="/login" className="block text-center text-sm text-violet-700 underline">Back to log in</Link>
    </form>
  );
}
export default function ResetPage() { return <Suspense><Reset /></Suspense>; }
