import Link from "next/link";

const steps = [
  { emoji: "🎨", title: "Designer uploads", text: "Grok writes the description. Your name is attached forever." },
  { emoji: "🛍️", title: "Buyer owns it", text: "One buyer gets full ownership, recorded on Solana." },
  { emoji: "🚫", title: "Never resold", text: "Sold designs can't be uploaded again — by anyone." },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 px-8 py-16 text-white shadow-lg sm:px-14">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-100">HackPrinceton Fall 2026</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          One design. One owner. Credit forever.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-violet-50">
          Designers sell each design exactly once. Buyers get full ownership. Nobody can resell it — and the
          creator is always credited.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/shop" className="rounded-xl bg-white px-5 py-3 font-semibold text-violet-700 hover:bg-violet-50">
            Browse designs
          </Link>
          <Link href="/upload" className="rounded-xl border border-white/60 px-5 py-3 font-semibold hover:bg-white/10">
            Sell a design
          </Link>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-3xl">{s.emoji}</p>
            <h2 className="mt-3 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{s.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
