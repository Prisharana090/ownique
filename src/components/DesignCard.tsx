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
      className="group overflow-hidden rounded-3xl border border-[#ece3d9] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-blush">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${d._id}/image`} alt={d.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium capitalize text-violet-800 backdrop-blur">
          {d.category}
        </span>
        {sold && (
          <span className="absolute right-3 top-3 rounded-full bg-violet-900 px-3 py-1 text-xs font-semibold text-fuchsia-200">
            👑 Owned
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-serif text-lg text-violet-900">{d.title}</p>
          <p className="text-xs text-stone-500">by {short(d.designerWallet)}</p>
        </div>
        <p className={`font-semibold ${sold ? "text-stone-400" : "text-fuchsia-600"}`}>{sold ? "Sold" : `${d.price} SOL`}</p>
      </div>
    </Link>
  );
}
