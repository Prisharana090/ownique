// Server-side Solana helpers (devnet).
// The platform "vault" wallet holds each design's ownership token until someone buys it.
import "server-only";
import { Connection, LAMPORTS_PER_SOL, type ParsedInstruction } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, publicKey, type Umi } from "@metaplex-foundation/umi";
import { create, fetchAsset, mplCore, transfer } from "@metaplex-foundation/mpl-core";
import bs58 from "bs58";

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

/** True when the vault wallet is configured, so we can mint and transfer ownership tokens. */
export function hasVault() {
  return Boolean(process.env.VAULT_SECRET_KEY);
}

let umiCache: Umi | null = null;
function getUmi() {
  if (umiCache) return umiCache;
  const secret = process.env.VAULT_SECRET_KEY;
  if (!secret) throw new Error("VAULT_SECRET_KEY is missing");
  // Accepts either a base58 string (Phantom export) or a JSON array (solana-keygen file).
  const bytes = secret.trim().startsWith("[") ? Uint8Array.from(JSON.parse(secret)) : bs58.decode(secret.trim());
  const umi = createUmi(RPC_URL).use(mplCore());
  const keypair = umi.eddsa.createKeypairFromSecretKey(bytes);
  umi.use(keypairIdentity(keypair));
  umiCache = umi;
  return umi;
}

/**
 * Mints a 1-of-1 Metaplex Core asset for a design.
 * Owner = vault (holds it like escrow). The designer's wallet is recorded on-chain forever
 * in the asset's Attributes, so the creator credit can never be removed.
 */
export async function mintDesignToken(opts: { name: string; uri: string; designerWallet: string }) {
  const umi = getUmi();
  const asset = generateSigner(umi);
  await create(umi, {
    asset,
    name: opts.name.slice(0, 32),
    uri: opts.uri,
    plugins: [
      {
        type: "Attributes",
        attributeList: [
          { key: "designer", value: opts.designerWallet },
          { key: "platform", value: "Ownique" },
          { key: "rule", value: "one design, one owner" },
        ],
      },
    ],
  }).sendAndConfirm(umi);
  return asset.publicKey.toString();
}

/** Moves the ownership token from the vault to the buyer. */
export async function transferDesignToken(mintAddress: string, buyerWallet: string) {
  const umi = getUmi();
  const asset = await fetchAsset(umi, publicKey(mintAddress));
  const result = await transfer(umi, { asset, newOwner: publicKey(buyerWallet) }).sendAndConfirm(umi);
  return bs58.encode(result.signature);
}

/**
 * Checks on-chain that `signature` is a confirmed transfer of at least `priceSol`
 * from the buyer's wallet to the designer's wallet.
 */
export async function verifyPayment(opts: {
  signature: string;
  buyerWallet: string;
  designerWallet: string;
  priceSol: number;
}) {
  const connection = new Connection(RPC_URL, "confirmed");
  const tx = await connection.getParsedTransaction(opts.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) return { ok: false, reason: "Payment not found or failed on Solana." };

  const needed = Math.round(opts.priceSol * LAMPORTS_PER_SOL);
  const paid = tx.transaction.message.instructions.some((ix) => {
    const p = ix as ParsedInstruction;
    if (p.program !== "system" || p.parsed?.type !== "transfer") return false;
    const info = p.parsed.info as { source: string; destination: string; lamports: number };
    return info.source === opts.buyerWallet && info.destination === opts.designerWallet && info.lamports >= needed;
  });
  return paid ? { ok: true as const } : { ok: false, reason: "Payment amount or wallets don't match." };
}
