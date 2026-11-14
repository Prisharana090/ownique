import Link from "next/link";

type Section = { id: string; title: string; intro?: string; items: string[] };

const ownership: Section[] = [
  {
    id: "designers",
    title: "🎨 For designers",
    items: [
      "You upload original work and set your price.",
      "Before a design can be sold, you sign an ownership transfer declaration with your full legal name and your wallet, confirming you created it (or have the authority to transfer its rights).",
      "If your design includes third-party content (stock images, licensed fonts, someone else's artwork), it needs a separate rights review before it can be sold.",
      "When it sells, ownership moves to the buyer, permanently.",
      "You keep your name on it forever as the creator.",
      "After it sells, you can't sell or reuse it again. Showing it in your portfolio needs the buyer's separate permission.",
    ],
  },
  {
    id: "buyers",
    title: "🛍️ For buyers",
    items: [
      "You get exclusive copyright ownership (subject to the purchase agreement) plus the right to use, reproduce, modify, manufacture and sell products with the design.",
      "Every design shows its Exclusive Ownership Terms before you buy.",
      "No one else can ever buy the same design.",
      "Your ownership is recorded on Solana, so it's permanent and can't be faked.",
    ],
  },
  {
    id: "payment",
    title: "🔒 How payment stays safe",
    items: [
      "Each design's ownership token waits in a secure Ownique vault until it's sold.",
      "You pay the designer directly in SOL, and we check the payment on Solana.",
      "Only after the payment is confirmed does the ownership token move to your wallet.",
      "Each payment can only be used once, and each design can only be sold once.",
    ],
  },
];

const copyright: Section[] = [
  {
    id: "copyright",
    title: "©️ Copyright: only sell what you made",
    intro: "Copyright protects original creative work, like drawings, patterns, illustrations and photos, from the moment it's created.",
    items: [
      "Only upload designs you created yourself, or that you have written permission to sell.",
      "Don't copy, trace or lightly edit someone else's artwork, even if you found it for free online.",
      "Fan art of characters from movies, shows, games or cartoons isn't allowed, because the characters belong to their owners.",
      "When a design sells, the buyer gets the rights the designer had. A designer can't pass on rights they never owned.",
    ],
  },
  {
    id: "trademarks",
    title: "™️ Trademarks: no brand logos",
    intro: "Trademarks protect brand names, logos and mascots, like a soda brand's script logo or a sportswear swoosh.",
    items: [
      "No brand logos, brand names, mascots or sports team logos, and nothing made to look confusingly similar to them.",
      "Changing the colors or a few letters of a famous logo is still not allowed.",
      "Not sure? Attach your design to 💬 Ask Ownique before listing. It checks for look-alikes of famous brands and characters.",
      "Ask Ownique is a helpful first check, not a legal trademark search. For anything serious, check official sources like the USPTO trademark search.",
    ],
  },
  {
    id: "takedowns",
    title: "📨 Reporting stolen work (takedowns)",
    items: [
      "If your work or your brand appears on Ownique without permission, tap 🚩 Report on that design and tell us why.",
      "Reported designs that are still for sale are hidden right away while we review them.",
      "If the report is right, the design is removed. If it's wrong, the design is restored.",
      "Designers who repeatedly upload other people's work lose their account.",
      "Because the designer's wallet is recorded on Solana when a design is listed, there's always a permanent record of who listed what, and when.",
      "A signed declaration records the designer's promise; it doesn't by itself prove authorship or ownership, so reports are still reviewed on the evidence.",
    ],
  },
];

const privacy: Section[] = [
  {
    id: "privacy",
    title: "🔐 Privacy: what we store",
    items: [
      "Your wallet address, which is your Ownique identity. We never see or store your wallet's secret key or recovery phrase.",
      "The designs you upload, with their title, price and the time you agreed to these terms.",
      "Activity like views, try-ons and sales, used only to power the live dashboard.",
      "Reports you send, so we can review them.",
      "Your legal name when you sign an ownership transfer declaration. It's stored privately with that agreement and never shown publicly.",
      "Photos you upload to Try It On are used to make your preview and are not saved.",
      "Messages to Ask Ownique are sent to Grok (xAI) to get an answer and are not saved by Ownique.",
      "Anything recorded on Solana, like ownership and payments, is public and permanent by design.",
    ],
  },
];

function Card({ s }: { s: Section }) {
  return (
    <section id={s.id} className="scroll-mt-24 rounded-3xl border border-[#ece3d9] bg-white/80 p-6 shadow-sm">
      <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
      {s.intro && <p className="mb-3 text-stone-600">{s.intro}</p>}
      <ul className="list-disc space-y-1.5 pl-5 text-stone-700">
        {s.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

export default function Policy() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-4xl font-semibold text-violet-900">How it works &amp; our terms</h1>
        <p className="mt-2 text-lg text-stone-600">One design. One owner. Credit forever.</p>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            ["#designers", "Ownership"],
            ["#copyright", "Copyright"],
            ["#trademarks", "Trademarks"],
            ["#takedowns", "Reporting"],
            ["#privacy", "Privacy"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full border border-stone-300 bg-white px-3 py-1 hover:border-violet-400">
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="space-y-5">
        <h2 className="text-2xl font-bold">Ownership</h2>
        {ownership.map((s) => <Card key={s.id} s={s} />)}
      </div>

      <div className="space-y-5">
        <h2 className="text-2xl font-bold">Copyright &amp; trademarks</h2>
        {copyright.map((s) => <Card key={s.id} s={s} />)}
      </div>

      <div className="space-y-5">
        <h2 className="text-2xl font-bold">Privacy</h2>
        {privacy.map((s) => <Card key={s.id} s={s} />)}
      </div>

      <p className="text-center text-xs text-stone-400">
        Ownique is a HackPrinceton Fall 2026 prototype running on Solana devnet. These terms are a plain-language summary,
        not legal advice.
      </p>
    </div>
  );
}
