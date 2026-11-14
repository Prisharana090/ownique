"use client";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

// "My profile" link that appears once a wallet is connected.
export default function MyProfileLink() {
  const { publicKey } = useWallet();
  if (!publicKey) return null;
  return (
    <Link href={`/profile/${publicKey.toBase58()}`} className="hover:text-stone-900">
      My profile
    </Link>
  );
}
