import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { connectDb, hasDb } from "@/lib/db";
import { Design } from "@/models/Design";
import { User } from "@/models/User";
import { short } from "@/lib/short";
import { solToUsd } from "@/lib/nessie";

export const dynamic = "force-dynamic";

type D = {
  _id: string; title: string; price: number; category: string; status: string;
  designerWallet: string; ownerWallet?: string | null; createdAt: string;
};

const gettingRights = [
  ["©️", "Exclusive copyright ownership", "The copyright in this design transfers to you exclusively, subject to the executed purchase agreement."],
  ["💼", "Commercial use", "Use the design for business and commercial purposes."],
  ["🖨️", "Reproduce it", "Make copies of the design in any format."],
  ["✏️", "Modify it", "Edit, recolor, resize or adapt the design."],
  ["🏭", "Manufacture with it", "Put the design on products you make, like cups, shirts or cases."],
  ["🛍️", "Sell products with it", "Sell products that include the design."],
];

const creditPoints = [
  "The original designer stays credited as the creator of this design, forever.",
  "Being credited as the creator does not mean the designer keeps any commercial ownership.",
  "If the designer wants to show this design in their portfolio, that must be agreed separately between you and the designer.",
];

const importantPoints = [
  "This design is intended to be sold to one buyer only.",
  "After a successful purchase and effective transfer, the designer cannot sell it again.",
  "The ownership transfer is subject to the completed purchase agreement.",
];

// 📄 Exclusive Ownership Terms Preview: what the buyer gets, shown before checkout.
export default async function OwnershipTermsPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDb() || !isValidObjectId(id)) notFound();
  await connectDb();
  const doc = await Design.findById(id).lean();
  if (!doc) notFound();
  const d: D = JSON.parse(JSON.stringify(doc));
  if (d.status === "hidden") notFound();

  const designer = await User.findOne({ walletAddress: d.designerWallet }).select("username").lean<{ username?: string }>();
  const designerName = designer?.username || short(d.designerWallet);
  const available = d.status === "listed";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href={`/design/${d._id}`} className="text-sm text-stone-500 hover:text-violet-700">← Back to design</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-600">Before you buy</p>
        <h1 className="mt-2 text-4xl font-semibold text-violet-900 sm:text-5xl">Exclusive ownership terms</h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          Please read exactly what you&apos;re getting with this design. These terms apply only to the design shown below.
        </p>
      </div>

      {/* Design summary */}
      <section className="grid gap-6 rounded-[2rem] border border-[#ece3d9] bg-white/80 p-6 shadow-sm sm:grid-cols-[220px_1fr] sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${d._id}/image`} alt={d.title} className="aspect-square w-full rounded-2xl border border-white object-cover shadow-md" />
        <dl className="grid content-center gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Design</dt>
            <dd className="font-serif text-3xl text-violet-900">{d.title}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Original designer</dt>
            <dd className="text-base text-stone-800">
              <Link href={`/profile/${d.designerWallet}`} className="text-violet-700 hover:underline">{designerName}</Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Purchase price</dt>
            <dd className="text-base text-stone-800">
              <span className="font-serif text-2xl text-violet-900">{d.price} SOL</span>
              <span className="ml-2 text-stone-500">or ${solToUsd(d.price)} by bank</span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Unique design ID</dt>
            <dd><code className="break-all rounded-lg bg-blush px-2 py-1 text-xs text-violet-900">{d._id}</code></dd>
          </div>
        </dl>
      </section>

      {/* What You're Getting */}
      <section className="rounded-[2rem] border border-[#ece3d9] bg-white/80 p-6 shadow-sm sm:p-8">
        <h2 className="text-3xl font-semibold text-violet-900">What You&apos;re Getting</h2>
        <p className="mt-2 text-stone-600">When your purchase is complete, you receive:</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {gettingRights.map(([icon, title, text]) => (
            <li key={title} className="flex gap-3 rounded-2xl bg-cream p-4">
              <span className="text-2xl" aria-hidden>{icon}</span>
              <div>
                <p className="font-semibold text-violet-900">{title}</p>
                <p className="text-sm leading-relaxed text-stone-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Designer Credit */}
        <section className="rounded-[2rem] border border-[#ece3d9] bg-white/80 p-6 shadow-sm sm:p-8">
          <h2 className="text-3xl font-semibold text-violet-900">Designer Credit</h2>
          <ul className="mt-5 space-y-3 text-stone-700">
            {creditPoints.map((p) => (
              <li key={p} className="flex gap-3"><span className="text-fuchsia-500">✦</span><span className="leading-relaxed">{p}</span></li>
            ))}
          </ul>
        </section>

        {/* Important Ownership Information */}
        <section className="rounded-[2rem] bg-violet-900 p-6 text-violet-100 shadow-sm sm:p-8">
          <h2 className="text-3xl font-semibold text-white">Important Ownership Information</h2>
          <ul className="mt-5 space-y-3">
            {importantPoints.map((p) => (
              <li key={p} className="flex gap-3"><span className="text-fuchsia-300">✦</span><span className="leading-relaxed">{p}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-col items-center gap-3 pb-4 text-center">
        {available ? (
          <>
            <Link href={`/design/${d._id}?checkout=1#buy`}
              className="rounded-full bg-violet-700 px-10 py-4 font-semibold text-white shadow-sm transition hover:bg-violet-800">
              Review and Continue
            </Link>
            <p className="max-w-md text-xs text-stone-500">
              Next you&apos;ll confirm the purchase agreement and pay. Nothing is charged until you approve the payment.
              These terms are a plain-language summary, not legal advice.
            </p>
          </>
        ) : (
          <p className="rounded-2xl bg-blush px-6 py-4 text-violet-900">
            This design already has its one owner, so it&apos;s no longer available to buy.
          </p>
        )}
      </div>
    </div>
  );
}
