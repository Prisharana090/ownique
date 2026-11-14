"use client";
// Live dashboard powered by Tiger Data (refreshes every 5 seconds).
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { bucket: string; event_type: string; events: number; sol: number };
type Stats = {
  configured: boolean;
  error?: string;
  series?: Row[];
  totals?: { event_type: string; events: number; sol: number }[];
  top?: { design_id: string; views: number }[];
};

const COLORS: Record<string, string> = {
  view: "#a78bfa", try_on: "#f472b6", purchase: "#7c3aed", upload: "#38bdf8", blocked_upload: "#ef4444", report: "#f59e0b",
};
const LABELS: Record<string, string> = {
  view: "Views", try_on: "Try-ons", purchase: "Sales", upload: "Uploads", blocked_upload: "Copies blocked", report: "Reports",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return <p className="text-stone-500">Loading live data…</p>;
  if (!stats.configured)
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
        Add your <code>TIGER_DATABASE_URL</code> to <code>.env.local</code> to turn on the live dashboard.
      </p>
    );

  const total = (t: string) => stats.totals?.find((x) => x.event_type === t);
  const sol = total("purchase")?.sol ?? 0;

  // Turn rows into one object per minute: { time, view: 3, purchase: 1, ... }
  const byMinute = new Map<string, Record<string, number | string>>();
  for (const r of stats.series ?? []) {
    const time = new Date(r.bucket).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const row = byMinute.get(time) ?? { time };
    row[r.event_type] = r.events;
    byMinute.set(time, row);
  }
  const chart = [...byMinute.values()];

  const tiles = [
    { label: "SOL earned by designers", value: sol.toFixed(2) },
    { label: "Designs sold", value: total("purchase")?.events ?? 0 },
    { label: "Copies blocked", value: total("blocked_upload")?.events ?? 0 },
    { label: "Try-ons", value: total("try_on")?.events ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">📈 Live dashboard</h1>
          <p className="text-stone-600">Real-time activity, powered by Tiger Data. Updates every 5 seconds.</p>
        </div>
        <span className="flex items-center gap-2 text-sm text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live
        </span>
      </div>
      {stats.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{stats.error}</p>}

      <div className="grid gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">{t.label}</p>
            <p className="mt-1 text-3xl font-bold">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="mb-4 font-semibold">Activity per minute (last hour)</p>
        {chart.length === 0 ? (
          <p className="py-16 text-center text-stone-400">No activity yet. Open a design page and watch this move!</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              {Object.keys(LABELS).map((k) => (
                <Bar key={k} dataKey={k} name={LABELS[k]} stackId="a" fill={COLORS[k]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {!!stats.top?.length && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-3 font-semibold">🔥 Most viewed designs</p>
          <ol className="space-y-1 text-sm">
            {stats.top.map((t, i) => (
              <li key={t.design_id}>
                {i + 1}. <a className="text-violet-700 underline" href={`/design/${t.design_id}`}>Design {t.design_id.slice(-6)}</a> — {t.views} views
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
