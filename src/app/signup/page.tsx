"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ROLES = [
  { id: "buyer", title: "Buyer", text: "Discover designs, try them on and buy one-of-a-kind ownership. Review designers after a purchase." },
  { id: "designer", title: "Designer", text: "Upload and sell original designs. Each design sells once and you're credited forever." },
] as const;

export default function SignUp() {
  const router = useRouter();
  const [role, setRole] = useState<"buyer" | "designer" | "">("");
  const [f, setF] = useState({ displayName: "", username: "", email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "username" ? e.target.value.toLowerCase() : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, role, acceptTerms: terms }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Couldn't create your account."); setBusy(false); return; }
    router.push(`/u/${d.username}`);
    router.refresh();
  }

  const field = "mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5";
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#ece3d9] bg-white/90 p-6 shadow-sm sm:p-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-violet-900">Create your Ownique account</h1>
        <p className="mt-1 text-sm text-stone-600">Already have one? <Link href="/login" className="font-semibold text-violet-700 underline">Log in</Link></p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-stone-800">I&apos;m joining as a…</legend>
        <p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-900">Choose one role. <strong>It can&apos;t be changed later</strong>, and an account can&apos;t be both. Use a separate account if you want to do both.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label key={r.id} className={`cursor-pointer rounded-2xl border p-4 ${role === r.id ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200" : "border-stone-200 bg-white"}`}>
              <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} className="sr-only" required />
              <span className="block font-serif text-lg font-semibold text-violet-900">{r.title}</span>
              <span className="block text-xs text-stone-600">{r.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-stone-800">Display name<input required value={f.displayName} onChange={set("displayName")} maxLength={60} autoComplete="name" className={field} /></label>
      <label className="block text-sm font-medium text-stone-800">Username
        <span className="mt-1 flex items-center rounded-xl border border-stone-300 bg-white pl-3"><span className="text-stone-500">@</span>
          <input required value={f.username} onChange={set("username")} pattern="[a-z0-9_]{3,20}" maxLength={20} autoComplete="username" className="block w-full rounded-xl px-1 py-2.5 outline-none" /></span>
        <span className="mt-1 block text-xs text-stone-500">3–20 lowercase letters, numbers or underscores. Shown publicly.</span>
      </label>
      <label className="block text-sm font-medium text-stone-800">Email<input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={field} />
        <span className="mt-1 block text-xs text-stone-500">Private. Never shown on your profile.</span></label>
      <label className="block text-sm font-medium text-stone-800">Password<input required type="password" minLength={8} value={f.password} onChange={set("password")} autoComplete="new-password" className={field} /></label>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
        <span>I agree to the <Link href="/policy" target="_blank" className="underline">Terms</Link> and <Link href="/policy#privacy" target="_blank" className="underline">Privacy Policy</Link>.</span>
      </label>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !role} className="w-full rounded-full bg-violet-700 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-40">
        {busy ? "Creating account…" : role ? `Create ${role === "buyer" ? "Buyer" : "Designer"} account` : "Choose a role to continue"}
      </button>
    </form>
  );
}
