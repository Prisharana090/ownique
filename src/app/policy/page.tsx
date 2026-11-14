const sections = [
  {
    title: "🎨 For designers",
    items: [
      "You upload original work and set your price.",
      "When it sells, ownership moves to the buyer, permanently.",
      "You keep your name on it forever as the creator.",
      "You can show it in your portfolio, but you can't sell or reuse it again.",
    ],
  },
  {
    title: "🛍️ For buyers",
    items: [
      "You get full rights to use the design on your products.",
      "No one else can ever buy the same design.",
      "Your ownership is recorded on Solana, so it's permanent and can't be faked.",
    ],
  },
  {
    title: "🔒 How payment stays safe",
    items: [
      "You pay → your money waits in a safe holding box (escrow).",
      "The full file is delivered to you.",
      "The designer gets paid, and the ownership token moves to you.",
    ],
  },
  {
    title: "🚩 If something goes wrong",
    items: [
      "Stolen design? Tap Report. The design is hidden while we review it.",
      "Broken file, or it doesn't match the preview? You can request a refund.",
      "Proven copied designs are removed, and repeat offenders lose their account.",
    ],
  },
];

export default function Policy() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-4xl font-bold">How ownership works</h1>
        <p className="mt-2 text-lg text-stone-600">One design. One owner. Credit forever.</p>
      </div>
      {sections.map((s) => (
        <section key={s.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">{s.title}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-stone-700">
            {s.items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
