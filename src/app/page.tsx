import Link from "next/link";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import DesignCard, { type DesignSummary } from "@/components/DesignCard";
import { withOwnershipStatus } from "@/lib/agreements";

export const dynamic = "force-dynamic";

const steps = [
  {
    n: "01",
    title: "A designer lists it",
    text: "They sign an originality agreement with their wallet. A one-of-a-kind ownership token is created on Solana, with their name on it forever.",
  },
  {
    n: "02",
    title: "A buyer makes it theirs",
    text: "Try it on your own product, then pay with SOL or by bank. Ownership moves to you, and only you get the full-quality file.",
  },
  {
    n: "03",
    title: "It can never be sold again",
    text: "Copies, even resized or edited ones, are blocked. The creator keeps the credit, and every design gets a Certificate of Creation.",
  },
];

const promises = [
  ["✍️", "Signed originality", "Every listing is signed by the designer's wallet."],
  ["🛡️", "Copy protection", "Look-alike uploads are caught before they go live."],
  ["📜", "Proof of creation", "A free certificate with time, creator and file fingerprint."],
  ["™️", "Brand check", "Ask Ownique flags designs that look like famous logos."],
];

const builtWith = ["Solana", "MongoDB Atlas", "Tiger Data", "Gemini", "Grok", "LangChain", "Capital One Nessie"];

async function getHomeData() {
  if (!hasDb()) return { featured: [] as DesignSummary[], listed: 0, sold: 0, designers: 0 };
  await connectDb();
  const [docs, listed, sold, designers] = await Promise.all([
    Design.find({ status: "listed" }).sort({ createdAt: -1 }).limit(4).lean(),
    Design.countDocuments({ status: "listed" }),
    Design.countDocuments({ status: "sold" }),
    Design.distinct("designerWallet").then((d) => d.length),
  ]);
  return { featured: await withOwnershipStatus(JSON.parse(JSON.stringify(docs)) as DesignSummary[]), listed, sold, designers };
}

export default async function Home() {
  const { featured, listed, sold, designers } = await getHomeData();

  return (
    <div className="space-y-24">
      {/* Hero */}
      <section className="grid items-center gap-12 pt-6 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">A marketplace for one-of-a-kind design</p>
          <h1 className="mt-5 text-5xl leading-[1.05] font-semibold text-violet-900 sm:text-6xl">
            One design.
            <br />
            One owner.
            <br />
            <span className="italic text-fuchsia-500">Credit forever.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600">
            Designers sell each piece exactly once. Buyers own it completely. Nobody can resell it, and the creator&apos;s
            name stays on it for good.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/shop" className="rounded-full bg-violet-700 px-7 py-3.5 font-semibold text-white shadow-sm transition hover:bg-violet-800">
              Browse designs
            </Link>
            <Link href="/upload" className="rounded-full border border-violet-300 bg-white/60 px-7 py-3.5 font-semibold text-violet-800 transition hover:border-violet-500">
              Sell your design
            </Link>
          </div>
          <dl className="mt-10 flex gap-10 text-sm">
            {[
              [listed, "designs for sale"],
              [sold, "owned forever"],
              [designers, "designers"],
            ].map(([n, label]) => (
              <div key={String(label)}>
                <dt className="font-serif text-3xl text-violet-800">{n}</dt>
                <dd className="text-stone-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Gallery collage */}
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-blush via-fuchsia-50 to-violet-50" />
          {featured.length >= 2 ? (
            <div className="grid grid-cols-2 gap-4">
              {featured.slice(0, 4).map((d, i) => (
                <Link
                  key={d._id}
                  href={`/design/${d._id}`}
                  className={`group overflow-hidden rounded-3xl border border-white bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl ${i % 2 ? "mt-10" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/designs/${d._id}/image${d.imageHash ? `?v=${String(d.imageHash).slice(0, 8)}` : ""}`} alt={d.title} className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" />
                  <p className="px-4 py-3 font-serif text-sm text-violet-900">{d.title}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-3xl border border-white bg-white/70 p-10 text-center font-serif text-2xl italic text-violet-800 shadow-md">
              “Every piece here will only ever belong to one person.”
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">How it works</p>
        <h2 className="mt-3 text-center text-4xl font-semibold text-violet-900">Owned, not just bought</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border border-[#ece3d9] bg-white/70 p-8 shadow-sm">
              <p className="font-serif text-4xl italic text-fuchsia-400">{s.n}</p>
              <h3 className="mt-4 text-xl font-semibold text-violet-900">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-stone-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured designs */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">New this week</p>
              <h2 className="mt-2 text-4xl font-semibold text-violet-900">Waiting for their one owner</h2>
            </div>
            <Link href="/shop" className="hidden font-semibold text-violet-700 hover:underline sm:block">
              See all →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((d) => (
              <DesignCard key={d._id} d={d} />
            ))}
          </div>
        </section>
      )}

      {/* Promises */}
      <section className="rounded-[2.5rem] bg-violet-900 px-8 py-14 text-white sm:px-14">
        <h2 className="max-w-xl text-4xl font-semibold">
          Built to protect the people who <span className="italic text-fuchsia-300">make</span> things.
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map(([icon, title, text]) => (
            <div key={title}>
              <p className="text-2xl">{icon}</p>
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-violet-200">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-white/15 pt-8 text-xs text-violet-200">
          <span className="mr-2 uppercase tracking-widest">Built with</span>
          {builtWith.map((b) => (
            <span key={b} className="rounded-full border border-white/20 px-3 py-1">{b}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
