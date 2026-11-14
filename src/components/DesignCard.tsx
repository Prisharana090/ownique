import Link from "next/link";
import { short } from "@/lib/short";

export type DesignSummary = {
  _id: string;
  title: string;
  price: number;
  category: string;
  status: string;
  designerWallet: string;
  ownerWallet?: string | null;
};

export default function DesignCard({ d }: { d: DesignSummary }) {
  const sold = d.status === "sold";
  return (
    <Link
      href={`/design/${d._id}`}
      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${d._id}/image`} alt={d.title} className="h-full w-full object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium capitalize">
          {d.category}
        </span>
        {sold && (
          <span className="absolute right-3 top-3 rounded-full bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">
            Owned
          </span>
        )}
      </div>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-semibold">{d.title}</p>
          <p className="text-xs text-stone-500">by {short(d.designerWallet)}</p>
        </div>
        <p className="font-semibold text-violet-700">{sold ? "Sold" : `${d.price} SOL`}</p>
      </div>
    </Link>
  );
}
