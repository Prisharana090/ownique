// Tiger Data (TimescaleDB on Postgres): logs every important event as time-series data
// for the live dashboard. If TIGER_DATABASE_URL isn't set, logging is silently skipped.
import "server-only";
import { Pool } from "pg";

export type EventType = "view" | "upload" | "try_on" | "purchase" | "blocked_upload" | "report";

const g = globalThis as unknown as { _tigerPool?: Pool; _tigerReady?: Promise<void> };
export const hasTiger = () => Boolean(process.env.TIGER_DATABASE_URL);

function pool() {
  // sslmode in the URL would override our ssl setting (and fail behind some campus/antivirus networks),
  // so we remove it and keep the connection encrypted with our own ssl option.
  const url = new URL(process.env.TIGER_DATABASE_URL!);
  url.searchParams.delete("sslmode");
  g._tigerPool ??= new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 5_000, // don't let a slow network hang requests
    idleTimeoutMillis: 30_000,
    query_timeout: 8_000,
    statement_timeout: 8_000,
  });
  g._tigerPool.on("error", (err) => console.error("Tiger Data pool error:", err.message));
  return g._tigerPool;
}

/** Creates the hypertable + a per-minute continuous aggregate the first time. */
function ready() {
  g._tigerReady ??= (async () => {
    const db = pool();
    await db.query(`CREATE TABLE IF NOT EXISTS events (
      time timestamptz NOT NULL DEFAULT now(),
      event_type text NOT NULL,
      design_id text,
      wallet text,
      amount_sol double precision DEFAULT 0
    )`);
    try {
      await db.query(`SELECT create_hypertable('events', 'time', if_not_exists => TRUE)`);
      await db.query(`CREATE MATERIALIZED VIEW IF NOT EXISTS events_per_minute
        WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
        SELECT time_bucket('1 minute', time) AS bucket, event_type,
               count(*) AS events, sum(amount_sol) AS sol
        FROM events GROUP BY bucket, event_type WITH NO DATA`);
      await db.query(`SELECT add_continuous_aggregate_policy('events_per_minute',
        start_offset => INTERVAL '2 hours', end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 minute', if_not_exists => TRUE)`);
    } catch (err) {
      console.warn("TimescaleDB features unavailable, using plain table:", (err as Error).message);
    }
  })().catch((err) => {
    g._tigerReady = undefined; // don't cache a failure: try again on the next request
    throw err;
  });
  return g._tigerReady;
}

/** Fire-and-forget: never slows down or breaks the page. */
export function logEvent(type: EventType, data: { designId?: string; wallet?: string; amountSol?: number } = {}) {
  if (!hasTiger()) return;
  ready()
    .then(() =>
      pool().query(`INSERT INTO events (event_type, design_id, wallet, amount_sol) VALUES ($1, $2, $3, $4)`, [
        type,
        data.designId ?? null,
        data.wallet ?? null,
        data.amountSol ?? 0,
      ])
    )
    .catch((err) => console.error("Tiger Data log failed:", err.message));
}

// Every open dashboard polls this; share one query result for a few seconds instead of hitting the DB per tab.
const statsCache = globalThis as unknown as { _stats?: { at: number; p: Promise<unknown> } };
export function getStatsCached(maxAgeMs = 4_000) {
  const c = statsCache._stats;
  if (c && Date.now() - c.at < maxAgeMs) return c.p as ReturnType<typeof getStats>;
  const p = getStats();
  statsCache._stats = { at: Date.now(), p };
  p.catch(() => { if (statsCache._stats?.p === p) statsCache._stats = undefined; });
  return p;
}

/** Per-minute counts for the last hour + all-time totals, for the dashboard. */
export async function getStats() {
  await ready();
  const db = pool();
  let series;
  try {
    series = await db.query(`SELECT bucket, event_type, events::int, coalesce(sol,0)::float AS sol
      FROM events_per_minute WHERE bucket > now() - INTERVAL '60 minutes' ORDER BY bucket`);
  } catch {
    series = await db.query(`SELECT date_trunc('minute', time) AS bucket, event_type, count(*)::int AS events,
      coalesce(sum(amount_sol),0)::float AS sol FROM events WHERE time > now() - INTERVAL '60 minutes'
      GROUP BY 1, 2 ORDER BY 1`);
  }
  const totals = await db.query(`SELECT event_type, count(*)::int AS events, coalesce(sum(amount_sol),0)::float AS sol
    FROM events GROUP BY event_type`);
  const top = await db.query(`SELECT design_id, count(*)::int AS views FROM events
    WHERE event_type = 'view' AND design_id IS NOT NULL GROUP BY design_id ORDER BY views DESC LIMIT 5`);
  return { series: series.rows, totals: totals.rows, top: top.rows };
}
