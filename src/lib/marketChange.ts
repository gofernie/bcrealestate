export type SoldRow = { month: string; sold_index: number | null; sold_count: number | null; thin?: boolean | null };
export type AskRow = { day: string; ask_index: number | null; actives?: number | null };
export type Yoy = { chg: number; basis: "sales" | "asking" } | null;

const DAY = 864e5;
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

/** 1Y change: confirmed sales when the sample is solid, else a full year of asking index, else null. */
export function yoyChange(sold: SoldRow[], ask: AskRow[], now = new Date()): Yoy {
  const thisMonth = ym(now);
  const prevMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)); // preliminary, still reporting
  const f = (sold || [])
    .map((r) => ({ d: String(r.month).slice(0, 10), v: r.sold_index == null ? null : Number(r.sold_index), k: Number(r.sold_count || 0), t: !!r.thin }))
    .filter((p) => p.v != null && !p.t && p.d < thisMonth && p.d !== prevMonth)
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const win = (i: number) => f.slice(Math.max(0, i - 2), i + 1).reduce((t, p) => t + p.k, 0);
  if (f.length >= 13 && win(f.length - 1) >= 30 && win(f.length - 13) >= 30)
    return { chg: (f[f.length - 1].v! / f[f.length - 13].v! - 1) * 100, basis: "sales" };

  const a = (ask || [])
    .filter((p) => p.ask_index != null)
    .map((p) => ({ t: Date.parse(p.day), v: Number(p.ask_index), n: Number(p.actives ?? 0) }))
    .sort((x, y) => x.t - y.t);
  if (a.length < 2) return null;
  const last = a[a.length - 1];
  const base = a.find((p) => p.t >= last.t - 365 * DAY);
  if (!base || last.t - base.t < 330 * DAY || base.n < 20 || last.n < 20) return null;
  return { chg: (last.v / base.v - 1) * 100, basis: "asking" };
}