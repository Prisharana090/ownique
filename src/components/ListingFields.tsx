"use client";
// Title, description, price + currency, and category pickers, shared by the upload and edit forms.
import { CURRENCIES, LIMITS, MATERIALS, PRODUCT_CATEGORIES, STYLES, type Currency, priceLabel } from "@/lib/designOptions";
import { usdToSol } from "@/lib/price";

export type ListingState = {
  title: string;
  description: string;
  price: string;
  currency: Currency;
  category: string;
  style: string;
  material: string;
};

export const emptyListing: ListingState = { title: "", description: "", price: "", currency: "USD", category: "cup", style: "floral", material: "any" };

export const listingValid = (l: ListingState) =>
  l.title.trim().length > 0 && l.title.length <= LIMITS.title && l.description.length <= LIMITS.description && Number(l.price) > 0;

const input = "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 outline-violet-500";

export default function ListingFields({ value, onChange, disabled }: { value: ListingState; onChange: (v: ListingState) => void; disabled?: boolean }) {
  const set = (patch: Partial<ListingState>) => onChange({ ...value, ...patch });
  const n = Number(value.price);
  const sol = value.currency === "SOL" ? n : usdToSol(n);
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Title</span>
        <input value={value.title} maxLength={LIMITS.title} onChange={(e) => set({ title: e.target.value })} placeholder="Midnight Waves" className={input} required />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea value={value.description} maxLength={LIMITS.description} rows={3} onChange={(e) => set({ description: e.target.value })}
          placeholder="What it shows, colors, mood, where it looks best…" className={`${input} resize-y`} />
        <span className="mt-0.5 block text-right text-xs text-stone-400">{value.description.length}/{LIMITS.description}</span>
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="text-sm font-medium">Price</span>
          <input type="number" min="0" step={value.currency === "SOL" ? "0.001" : "0.01"} value={value.price}
            onChange={(e) => set({ price: e.target.value })} placeholder={value.currency === "SOL" ? "0.5" : "75"} className={input} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Currency</span>
          <select value={value.currency} onChange={(e) => set({ currency: e.target.value as Currency })} className={input}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c === "USD" ? "US$" : "SOL"}</option>)}
          </select>
        </label>
      </div>
      {n > 0 && (
        <p className="-mt-2 text-xs text-stone-500">
          Buyers see <b>{priceLabel(sol, value.currency)}</b>{value.currency === "USD" ? <> and pay {priceLabel(sol, "SOL")} on Solana devnet.</> : <> (about {priceLabel(sol, "USD")}).</>}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([
          ["Product", "category", PRODUCT_CATEGORIES],
          ["Style", "style", STYLES],
          ["Material", "material", MATERIALS],
        ] as const).map(([label, key, options]) => (
          <label key={key} className="block">
            <span className="text-sm font-medium">{label}</span>
            <select value={value[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<ListingState>)} className={`${input} capitalize`}>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
