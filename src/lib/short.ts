// Shortens a wallet address for display: 7xKX...9fQe
export const short = (w?: string | null) => (w ? `${w.slice(0, 4)}...${w.slice(-4)}` : "");
