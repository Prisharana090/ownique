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
  ownershipConfirmed?: boolean;
  rightsReview?: string;
  imageHash?: string;
};

/** `masonry`: image keeps its natural shape (Pinterest-style columns). Default: square grid tile. */
export default function DesignCard({ d, masonry = false }: { d: DesignSummary; masonry?: boolean }) {
  const sold = d.status === "sold";
  return (
    <Link
      href={`/design/${d._id}`}
      aria-label={`${d.title}, ${sold ? "sold" : `${d.price} SOL`}, designed by ${short(d.designerWallet)}`}
      className={`group block overflow-hidden rounded-3xl border border-[#ece3d9] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-200/50 ${masonry ? "mb-4 break-inside-avoid sm:mb-5" : ""}`}
    >
      <div className={`relative overflow-hidden bg-blush ${masonry ? "min-h-32" : "aspect-square"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/designs/${d._id}/image${d.imageHash ? `?v=${d.imageHash.slice(0, 8)}` : ""}`} alt="" loading="lazy"
          className={`w-full transition duration-500 group-hover:scale-105 ${masonry ? "h-auto" : "h-full object-cover"}`} />
        <span className="absolute left-3 top-3 rounded-full bg-violet-100/95 px-3 py-1 text-xs font-medium capitalize text-violet-800 backdrop-blur">
          {d.category}
        </span>
        {!sold && (!d.ownershipConfirmed || d.rightsReview === "pending") && (
          <span className="absolute bottom-2 left-2 right-2 w-fit rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium leading-tight text-fuchsia-800 backdrop-blur sm:bottom-3 sm:left-3 sm:text-xs">
            {d.ownershipConfirmed ? "⚖️ Rights review" : "🔒 Awaiting designer confirmation"}
          </span>
        )}
        {sold && (
          <span className="absolute right-3 top-3 rounded-full bg-violet-900 px-3 py-1 text-xs font-semibold text-white">
            👑 Sold · Owned
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="truncate font-serif text-base text-violet-900 sm:text-lg">{d.title}</p>
          <p className="truncate text-xs text-stone-600">Designed by {short(d.designerWallet)}</p>
        </div>
        <p className={`w-fit shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${sold ? "bg-stone-100 text-stone-600" : "bg-fuchsia-50 text-fuchsia-700"}`}>
          {sold ? "Sold" : `${d.price} SOL`}
        </p>
      </div>
    </Link>
  );
}
