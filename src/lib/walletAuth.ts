// Proves a request really comes from the owner of a Solana wallet:
// the wallet signs a short message (free, no transaction), and we check the signature.
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

/** Checks the signature and that the message is "<prefix> at <timestamp>" and less than 5 minutes old. */
export function verifyWalletMessage(opts: { wallet: string; message: string; signature: string; prefix: string }) {
  const m = new RegExp(`^${opts.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} at (\\d+)$`).exec(opts.message);
  if (!m || Math.abs(Date.now() - Number(m[1])) > 5 * 60 * 1000) return false;
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(opts.message),
      bs58.decode(opts.signature),
      new PublicKey(opts.wallet).toBytes()
    );
  } catch {
    return false;
  }
}
