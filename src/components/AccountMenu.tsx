"use client";
// Navbar: "Log In" / "Create Account" for guests; avatar + @username + Log out when signed in.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Me = { username: string; displayName: string; role: "buyer" | "designer"; hasAvatar: boolean } | null;

export default function AccountMenu() {
  const [me, setMe] = useState<Me | undefined>(undefined);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.account)).catch(() => setMe(null)); }, [pathname]);
  if (me === undefined) return <span className="h-9 w-24" aria-hidden />;
  if (!me)
    return (
      <span className="flex items-center gap-2">
        <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50">Log In</Link>
        <Link href="/signup" className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">Create Account</Link>
      </span>
    );
  return (
    <span className="flex items-center gap-2">
      <Link href={`/u/${me.username}`} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-violet-900 hover:bg-violet-50">
        {me.hasAvatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/accounts/${me.username}/avatar`} alt="" className="h-8 w-8 rounded-full object-cover" />
          : <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-200 font-serif text-violet-900">{me.displayName.slice(0, 1).toUpperCase()}</span>}
        @{me.username}
      </Link>
      <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); setMe(null); router.refresh(); }}
        className="rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">Log out</button>
    </span>
  );
}
