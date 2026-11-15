// 🧪 Ownique Demo Wallet (DEVNET ONLY): a throwaway test wallet that lives in this browser, so the demo can
// publish and sign without installing Phantom (e.g. inside the Claude app's browser panel).
// - Only offered when the site runs on Solana devnet. Never use it for real funds.
// - The test key is kept in this browser's localStorage. Clearing site data removes it.
import {
  BaseMessageSignerWalletAdapter,
  WalletName,
  WalletNotConnectedError,
  WalletReadyState,
  isVersionedTransaction,
  type SupportedTransactionVersions,
  type TransactionOrVersionedTransaction,
} from "@solana/wallet-adapter-base";
import { Keypair, type PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const DemoWalletName = "Ownique Demo Wallet (devnet)" as WalletName<"Ownique Demo Wallet (devnet)">;
const STORAGE_KEY = "ownique-demo-wallet-devnet";

const ICON =
  "data:image/svg+xml;base64," +
  (typeof btoa === "function"
    ? btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6b3f7a"/><text x="32" y="42" font-size="26" text-anchor="middle" fill="#faf5ee" font-family="Georgia,serif">ow</text><circle cx="50" cy="14" r="7" fill="#f2b8c6"/></svg>`)
    : "");

export const isDevnet = (endpoint: string) => /devnet|localhost|127\.0\.0\.1/i.test(endpoint);

function loadOrCreate(): Keypair {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return Keypair.fromSecretKey(bs58.decode(saved));
  } catch { /* fall through to a new key */ }
  const kp = Keypair.generate();
  try { localStorage.setItem(STORAGE_KEY, bs58.encode(kp.secretKey)); } catch { /* storage blocked: key lasts this page only */ }
  return kp;
}

export class DemoWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = DemoWalletName;
  url = "https://ownique.app/demo-wallet";
  icon = ICON as `data:image/svg+xml;base64,${string}`;
  supportedTransactionVersions: SupportedTransactionVersions = new Set(["legacy", 0] as const);

  private _keypair: Keypair | null = null;
  private _connecting = false;

  get publicKey(): PublicKey | null { return this._keypair?.publicKey ?? null; }
  get connecting() { return this._connecting; }
  get readyState() { return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Installed; }

  async connect() {
    if (this._keypair || this._connecting) return;
    this._connecting = true;
    try {
      this._keypair = loadOrCreate();
      this.emit("connect", this._keypair.publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect() {
    this._keypair = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(tx: T): Promise<T> {
    if (!this._keypair) throw new WalletNotConnectedError();
    if (isVersionedTransaction(tx)) tx.sign([this._keypair]);
    else tx.partialSign(this._keypair);
    return tx;
  }

  async signAllTransactions<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(txs: T[]): Promise<T[]> {
    for (const tx of txs) await this.signTransaction(tx);
    return txs;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._keypair) throw new WalletNotConnectedError();
    return nacl.sign.detached(message, this._keypair.secretKey);
  }
}
