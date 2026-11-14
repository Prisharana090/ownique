// Tiger Data (TimescaleDB on Postgres): logs every important event as time-series data
// for the live dashboard. If TIGER_DATABASE_URL isn't set, logging is silently skipped.
import "server-only";
import { Pool } from "pg";

export type EventType = "view" | "upload" | "try_on" | "purchase" | "blocked_upload" | "report";

const g = globalThis as unknown as { _tigerPool?: Pool; _tigerReady?: Promise<void> };
export const hasTiger = () => Boolean(process.env.TIGER_DATABASE_URL);

function pool() {
  g._tigerPool ??= new Pool({
    connectionString: process.env.TIGER_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
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
  })();
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
