// Short-lived HMAC session tokens after one wallet signature (so buyers don't sign every click).
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { verifyWalletMessage } from "@/lib/walletAuth";

const secret = () => process.env.AGREEMENT_SESSION_SECRET || createHash("sha256").update(`ownique-session:${process.env.MONGODB_URI ?? ""}`).digest("hex");
const mac = (s: string) => createHmac("sha256", secret()).update(s).digest("hex");

export function issueSession(scope: string, wallet: string, message: string, signature: string) {
  if (!verifyWalletMessage({ wallet, message, signature, prefix: `Ownique: ${scope}` })) return null;
  const payload = `${scope}|${wallet}|${Date.now() + 60 * 60 * 1000}`;
  return Buffer.from(`${payload}|${mac(payload)}`).toString("base64url");
}

export function sessionWallet(scope: string, token: unknown): string | null {
  if (typeof token !== "string") return null;
  const [s, wallet, exp, m] = Buffer.from(token, "base64url").toString().split("|");
  if (s !== scope || !wallet || Number(exp) < Date.now() || !m) return null;
  const good = mac(`${s}|${wallet}|${exp}`);
  return m.length === good.length && timingSafeEqual(Buffer.from(m), Buffer.from(good)) ? wallet : null;
}
