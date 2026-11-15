"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import AccountMenu from "./AccountMenu";

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
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        {/* Logo: replace this wordmark with your own logo later (e.g. <img src="/logo.svg" />) */}
        <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-violet-800">
          Own<span className="italic text-fuchsia-500">ique</span>
        </Link>
        <div className="flex items-center gap-3 md:order-last">
          <AccountMenu />
          <WalletMultiButton style={{ height: 40, borderRadius: 999, fontSize: 14, padding: "0 18px" }} />
        </div>
        {/* On phones the links become one swipeable row under the logo. */}
        <div className="-mx-1 flex w-full gap-5 overflow-x-auto whitespace-nowrap px-1 pb-1 [scrollbar-width:none] text-sm font-medium text-stone-700 md:w-auto md:flex-1 md:justify-end md:overflow-visible md:pb-0">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded transition hover:text-violet-700">
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
