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
  { href: "/agreements", label: "My Agreements" },
  { href: "/policy", label: "How it works & terms" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#ece3d9] bg-cream/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* Logo: replace this wordmark with your own logo later (e.g. <img src="/logo.svg" />) */}
        <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-violet-800">
          Own<span className="italic text-fuchsia-500">ique</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-medium text-stone-600">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-violet-700">
              {l.label}
            </Link>
          ))}
          <MyProfileLink />
          <WalletMultiButton style={{ height: 40, borderRadius: 999, fontSize: 14, padding: "0 18px" }} />
        </div>
      </nav>
    </header>
  );
}
