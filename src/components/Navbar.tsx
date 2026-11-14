"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import MyProfileLink from "./MyProfileLink";

// Loaded only in the browser to avoid hydration errors.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/upload", label: "Sell a design" },
  { href: "/try-on", label: "Try It On" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/policy", label: "How it works & terms" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Own<span className="text-violet-600">ique</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-medium text-stone-600">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-stone-900">
              {l.label}
            </Link>
          ))}
          <MyProfileLink />
          <WalletMultiButton style={{ height: 40, borderRadius: 12, fontSize: 14, background: "#7c3aed" }} />
        </div>
      </nav>
    </header>
  );
}
