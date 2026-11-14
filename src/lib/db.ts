// Connects to MongoDB Atlas once and reuses the connection (important in Next.js dev mode).
import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _mongo?: Cache };
const cache: Cache = g._mongo ?? (g._mongo = { conn: null, promise: null });

export function hasDb() {
  return Boolean(process.env.MONGODB_URI);
}

export async function connectDb() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Add it to .env.local");
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(process.env.MONGODB_URI);
  cache.conn = await cache.promise;
  return cache.conn;
}
