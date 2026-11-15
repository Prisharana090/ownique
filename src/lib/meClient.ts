"use client";
// One shared "who is signed in?" request per page instead of one per component (with a short cache).
export type Me = { username: string; displayName: string; role: "buyer" | "designer"; email: string; bio: string; hasAvatar: boolean; walletAddress: string | null } | null;
let cached: { at: number; p: Promise<Me> } | null = null;

export function fetchMe(force = false): Promise<Me> {
  if (!force && cached && Date.now() - cached.at < 5000) return cached.p;
  const p = fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((d) => d.account as Me).catch(() => null);
  cached = { at: Date.now(), p };
  return p;
}
export const clearMe = () => { cached = null; };
