import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[#ece3d9] bg-blush/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm text-stone-600 sm:grid-cols-3">
        <div>
          <p className="font-serif text-xl font-semibold text-violet-800">
            Own<span className="italic text-fuchsia-500">ique</span>
          </p>
          <p className="mt-2 max-w-xs">One design. One owner. Credit forever.</p>
        </div>
        <div className="space-y-1.5">
          <p className="font-semibold text-stone-800">Explore</p>
          <Link href="/shop" className="block hover:text-violet-700">Shop designs</Link>
          <Link href="/upload" className="block hover:text-violet-700">Sell a design</Link>
          <Link href="/try-on" className="block hover:text-violet-700">Try It On</Link>
          <Link href="/dashboard" className="block hover:text-violet-700">Live dashboard</Link>
        </div>
        <div className="space-y-1.5">
          <p className="font-semibold text-stone-800">Trust</p>
          <Link href="/policy#designers" className="block hover:text-violet-700">How ownership works</Link>
          <Link href="/policy#copyright" className="block hover:text-violet-700">Copyright &amp; trademarks</Link>
          <Link href="/policy#privacy" className="block hover:text-violet-700">Privacy</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-stone-400">
        Built at HackPrinceton Fall 2026 · Running on Solana devnet
      </p>
    </footer>
  );
}
