"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearMe } from "@/lib/meClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Couldn't log in."); setBusy(false); return; }
    clearMe();
    router.push(`/u/${d.username}`);
    router.refresh();
  }
  const field = "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5";
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-3xl border border-[#ece3d9] bg-white/90 p-6 shadow-sm sm:p-8">
      <h1 className="font-serif text-3xl font-semibold text-violet-900">Log in</h1>
      <label className="block text-sm font-medium text-stone-800">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} /></label>
      <label className="block text-sm font-medium text-stone-800">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} /></label>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">{busy ? "Logging in…" : "Log In"}</button>
      <div className="flex justify-between text-sm">
        <Link href="/reset" className="text-violet-700 underline">Forgot password?</Link>
        <Link href="/signup" className="font-semibold text-violet-700 underline">Create Account</Link>
      </div>
    </form>
  );
}
