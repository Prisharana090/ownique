// Prices are shown in US dollars. Under the hood a design's price is stored in SOL, because buyers pay
// on Solana (devnet). SOL_USD_RATE in .env.local sets the demo exchange rate (default $150 per SOL).
export const SOL_USD_RATE = Number(process.env.NEXT_PUBLIC_SOL_USD_RATE || process.env.SOL_USD_RATE || 150) || 150;

/** SOL → dollars, rounded to cents. */
export const solToUsd = (sol: number) => Math.round(sol * SOL_USD_RATE * 100) / 100;

/** Dollars → SOL (6 decimals, enough for exact cents). */
export const usdToSol = (usd: number) => Math.round((usd / SOL_USD_RATE) * 1e6) / 1e6;

/** "$75" or "$12.50". */
export const usd = (sol: number) => {
  const n = solToUsd(sol);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

/** SOL amount for the payment note, trimmed: "0.5 SOL", "0.166667 SOL". */
export const solText = (sol: number) => `${Number(sol.toFixed(6))} SOL`;
