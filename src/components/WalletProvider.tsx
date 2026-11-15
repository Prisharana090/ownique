"use client";
// Wraps the site so any page can use the connected Solana wallet (Phantom, devnet).
import { useEffect, useMemo } from "react";
import { ConnectionProvider, WalletProvider as SolWalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { DemoWalletAdapter, isDevnet } from "@/lib/DemoWalletAdapter";

// Saves the user in MongoDB the first time their wallet connects.
function SaveUserOnConnect() {
  const { publicKey } = useWallet();
  useEffect(() => {
    if (!publicKey) return;
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
    }).catch(() => {});
  }, [publicKey]);
  return null;
}

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  // Phantom and other modern wallets are detected automatically (Wallet Standard).
  // On devnet only, also offer a built-in test wallet so the demo works without installing Phantom.
  const wallets = useMemo(() => (isDevnet(endpoint) ? [new DemoWalletAdapter()] : []), [endpoint]);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SaveUserOnConnect />
          {children}
        </WalletModalProvider>
      </SolWalletProvider>
    </ConnectionProvider>
  );
}
