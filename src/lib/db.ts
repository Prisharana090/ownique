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
  // Fail fast (10s) instead of hanging, and never cache a failed connection attempt.
  cache.promise ??= mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 }).catch((err) => {
    cache.promise = null;
    throw err;
  });
  cache.conn = await cache.promise;
  return cache.conn;
}
