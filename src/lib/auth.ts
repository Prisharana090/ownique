// Email/password sessions (server only): scrypt password hashes + signed, httpOnly session cookie.
import "server-only";
import { cookies } from "next/headers";
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { connectDb } from "@/lib/db";
import { Account } from "@/models/Account";

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, len: number) => Promise<Buffer>;
export const SESSION_COOKIE = "ownique_session";
const secret = () => process.env.AUTH_SECRET || process.env.AGREEMENT_SESSION_SECRET || createHash("sha256").update(`ownique-auth:${process.env.MONGODB_URI ?? ""}`).digest("hex");

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await scrypt(pw, salt, 64)).toString("hex")}`;
}
export async function checkPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const got = await scrypt(pw, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
export const validPassword = (p: string) => p.length >= 8 && p.length <= 200;

const sign = (s: string) => createHmac("sha256", secret()).update(s).digest("hex");
export function sessionValue(accountId: string) {
  const payload = `${accountId}|${Date.now() + 14 * 24 * 3600 * 1000}`;
  return Buffer.from(`${payload}|${sign(payload)}`).toString("base64url");
}
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 24 * 3600 };

function accountIdFrom(value: string | undefined): string | null {
  if (!value) return null;
  const [id, exp, mac] = Buffer.from(value, "base64url").toString().split("|");
  if (!id || !exp || !mac || Number(exp) < Date.now()) return null;
  const good = sign(`${id}|${exp}`);
  return mac.length === good.length && timingSafeEqual(Buffer.from(mac), Buffer.from(good)) ? id : null;
}

export type SessionAccount = { _id: string; email: string; displayName: string; username: string; role: "buyer" | "designer"; bio: string; hasAvatar: boolean; walletAddress?: string };

/** The signed-in account (or null). */
export async function getSessionAccount(): Promise<SessionAccount | null> {
  const id = accountIdFrom((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  await connectDb();
  const a = await Account.findById(id).lean<SessionAccount & { _id: unknown }>();
  return a ? { ...a, _id: String(a._id) } : null;
}

/** Public fields only (never email, wallet-free unless public on Solana anyway). */
export const publicAccount = (a: SessionAccount) => ({ displayName: a.displayName, username: a.username, role: a.role, bio: a.bio, hasAvatar: a.hasAvatar });

// Small in-memory throttle for login / reset attempts.
const hits = new Map<string, number[]>();
export function throttled(key: string, max = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now(), list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
