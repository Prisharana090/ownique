// Listing options shared by the upload form, the edit form and the server (safe to import in the browser).
import { solText, usd } from "@/lib/price";

export const PRODUCT_CATEGORIES = ["cup", "glasses", "shirt", "phone case", "tote", "other"] as const;
export const STYLES = ["floral", "botanical", "line art", "watercolor", "minimalist", "abstract", "vintage", "illustration", "typography", "pattern", "other"] as const;
export const MATERIALS = ["any", "ceramic", "glass", "cotton", "canvas", "paper", "plastic", "metal", "other"] as const;
export const CURRENCIES = ["USD", "SOL"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LIMITS = { title: 80, description: 1000, maxPriceUsd: 100_000, maxPriceSol: 1_000 };

/** The price as the designer listed it: "$75" for USD listings, "0.5 SOL" for SOL listings. Stored price is always SOL. */
export const priceLabel = (sol: number, currency?: string | null) => (currency === "SOL" ? solText(sol) : usd(sol));
