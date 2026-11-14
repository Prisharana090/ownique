// 💳 Capital One Nessie: Capital One's hackathon banking API with practice (mock) bank accounts.
// Ownique uses it for "Pay with bank": buyers without crypto pay the designer bank-to-bank,
// and Ownique still records ownership on Solana.
import "server-only";
import { User } from "@/models/User";

const BASE = () => (process.env.NESSIE_BASE_URL || "http://api.nessieisreal.com").replace(/\/$/, "");
export const hasNessie = () => Boolean(process.env.NESSIE_API_KEY);

/** Demo exchange rate so SOL prices can be paid in dollars. */
export const solToUsd = (sol: number) => Math.round(sol * Number(process.env.SOL_USD_RATE || 150) * 100) / 100;

async function nessie<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE()}${path}${path.includes("?") ? "&" : "?"}key=${process.env.NESSIE_API_KEY}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) throw new Error(`Nessie ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`.slice(0, 300));
  return body as T;
}

type Created = { code?: number; message?: string; objectCreated?: { _id: string } & Record<string, unknown> };

/**
 * Makes sure this wallet has a practice Capital One customer + checking account.
 * New accounts start with a demo balance so buyers can try "Pay with bank".
 */
export async function ensureBankAccount(walletAddress: string) {
  const user = await User.findOneAndUpdate(
    { walletAddress },
    { $setOnInsert: { walletAddress } },
    { upsert: true, new: true }
  );
  if (user.nessieAccountId) return user.nessieAccountId as string;

  const short = walletAddress.slice(0, 6);
  const customer = await nessie<Created>("/customers", {
    method: "POST",
    body: JSON.stringify({
      first_name: "Ownique",
      last_name: `User ${short}`,
      address: { street_number: "1", street_name: "Nassau Street", city: "Princeton", state: "NJ", zip: "08544" },
    }),
  });
  const customerId = customer.objectCreated?._id;
  if (!customerId) throw new Error("Nessie didn't return a customer id.");

  const account = await nessie<Created>(`/customers/${customerId}/accounts`, {
    method: "POST",
    body: JSON.stringify({
      type: "Checking",
      nickname: `Ownique ${short}`,
      rewards: 0,
      balance: Number(process.env.NESSIE_START_BALANCE || 1000),
    }),
  });
  const accountId = account.objectCreated?._id;
  if (!accountId) throw new Error("Nessie didn't return an account id.");

  user.nessieCustomerId = customerId;
  user.nessieAccountId = accountId;
  await user.save();
  return accountId;
}

export async function getBalance(accountId: string) {
  const acct = await nessie<{ balance?: number }>(`/accounts/${accountId}`);
  return typeof acct.balance === "number" ? acct.balance : null;
}

/** Moves money from the buyer's account to the designer's account. Returns the transfer id. */
export async function bankTransfer(opts: { fromAccountId: string; toAccountId: string; amountUsd: number; description: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const created = await nessie<Created>(`/accounts/${opts.fromAccountId}/transfers`, {
    method: "POST",
    body: JSON.stringify({
      medium: "balance",
      payee_id: opts.toAccountId,
      amount: opts.amountUsd,
      transaction_date: today,
      description: opts.description.slice(0, 100),
    }),
  });
  const id = created.objectCreated?._id;
  if (!id) throw new Error(created.message || "Nessie didn't confirm the transfer.");
  return id;
}
