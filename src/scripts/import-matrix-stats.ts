// Usage: npx tsx src/scripts/import-matrix-stats.ts <city-slug> "<path to Matrix GridExport.csv>" [--dry]
// Hand-loaded sold history for towns without board sold data. Same tables as Fernie:
//   market_sale_records (private, per sale - feeds trends) + market_monthly_stats (published aggregates).
// Listings are NOT touched - they still come from the DDF feed.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Which Matrix "Minor Area" values count as each town. Edit here to widen a town.
const CITY_AREAS: Record<string, string[]> = {
  nelson: ["NE - Nelson"],
};
const RESIDENTIAL = new Set([
  "Single Family - Detached", "Single Family - Detached w/Acreage", "Residential Acreage", "Residential Lot",
  "Townhouse", "Apartment", "Half Duplex", "Full Duplex", "Triplex", "Fourplex",
  "Manufactured Home on Land", "Manufactured Home in Park", "Park Model",
]);
const SOURCE = "mls_grid_export";

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift()!.map((h) => h.replace(/^\uFEFF/, "").trim());
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])) as Record<string, string>);
}
const money = (v: any) => { const n = Number(String(v || "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const num = (v: any) => { const n = Number(String(v || "").replace(/[,\s%]/g, "")); return Number.isFinite(n) ? n : null; };
const MON: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function date(v: any) { // "Jan 26/24"
  const m = String(v || "").trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = MON[m[1].toLowerCase()]; if (mo === undefined) return null;
  return `${y}-${String(mo + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return Math.round(s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2); };
const yes = (v: any) => /^(y|yes|true|1)$/i.test(String(v || "").trim());

async function main() {
  const [city, file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry");
  if (!city || !file) throw new Error('Usage: npx tsx src/scripts/import-matrix-stats.ts nelson "C:\\path\\GridExport.csv" [--dry]');
  const rows = parseCsv(readFileSync(file, "utf8"));
  const need = ["MLS #", "Minor Area", "Property Sub Type", "Status", "Sold Date", "Sold Price", "Date Entered", "DOM"];
  const missing = need.filter((c) => !(c in rows[0]));
  if (missing.length) throw new Error(`CSV is missing columns: ${missing.join(", ")}`);

  const areas = CITY_AREAS[city];
  const found = [...new Set(rows.map((r) => r["Minor Area"]))].filter(Boolean).sort();
  if (!areas) throw new Error(`No CITY_AREAS entry for "${city}". Minor Areas in this file:\n  ${found.join("\n  ")}\nAdd a line to CITY_AREAS and rerun.`);
  const inTown = rows.filter((r) => areas.includes(r["Minor Area"]) && RESIDENTIAL.has(r["Property Sub Type"]));
  console.log(`${city}: ${rows.length} rows in file, ${inTown.length} residential in [${areas.join(", ")}]`);

  const sales: any[] = [];
  for (const r of inTown) {
    if (!/^sold$/i.test(r.Status)) continue;
    const sold_date = date(r["Sold Date"]), sold_price = money(r["Sold Price"]);
    if (!sold_date || !sold_price) continue;
    const list_price = money(r["Current Price"]) ?? money(r["Original List Price"]);
    const original_list_price = money(r["Original List Price"]) ?? list_price;
    const ratio = num(r["Close Price / List Price"]) ?? (list_price ? sold_price / list_price : null);
    const is_fractional = yes(r["Fractional Interest YN"]);
    sales.push({
      city, mls_number: r["MLS #"], sold_date, sold_price, list_price, original_list_price,
      sale_to_list_ratio: ratio == null ? null : Math.round((ratio > 3 ? ratio : ratio * 100) * 1000) / 1000,
      days_on_market: num(r.DOM), property_sub_type: r["Property Sub Type"],
      is_single_family: r["Property Sub Type"].startsWith("Single Family"),
      is_fractional, eligible_for_market_stats: !is_fractional && sold_price >= 50000,
      source: `${SOURCE}_${new Date().toISOString().slice(0, 7).replace("-", "_")}`,
    });
  }
  const uniq = [...new Map(sales.map((s) => [s.mls_number, s])).values()];

  const months = new Map<string, any>();
  const bucket = (m: string) => { if (!months.has(m)) months.set(m, { sales: [], sfd: [], ratios: [], dom: [], newListings: 0 }); return months.get(m); };
  for (const s of uniq.filter((s) => s.eligible_for_market_stats)) {
    const b = bucket(s.sold_date.slice(0, 7) + "-01");
    b.sales.push(s.sold_price); if (s.is_single_family) b.sfd.push(s.sold_price);
    if (s.sale_to_list_ratio != null) b.ratios.push(s.sale_to_list_ratio / 100);
    if (s.days_on_market != null) b.dom.push(s.days_on_market);
  }
  const first = [...months.keys()].sort()[0];
  for (const r of inTown) { const d = date(r["Date Entered"]); if (d && first && d.slice(0, 7) + "-01" >= first) bucket(d.slice(0, 7) + "-01").newListings++; }
  const now = new Date().toISOString();
  const stats = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month_start, b]) => ({
    city, month_start, new_listings: b.newListings, sales: b.sales.length,
    median_sold_price: median(b.sales),
    average_sold_price: b.sales.length ? Math.round(b.sales.reduce((x: number, y: number) => x + y, 0) / b.sales.length) : null,
    average_sale_to_list_ratio: b.ratios.length ? Math.round((b.ratios.reduce((x: number, y: number) => x + y, 0) / b.ratios.length) * 10000) / 10000 : null,
    median_single_family_sold_price: median(b.sfd), median_days_on_market: median(b.dom),
    source: SOURCE, refreshed_at: now,
  }));
  console.table(stats.map(({ month_start, sales, new_listings, median_sold_price, median_single_family_sold_price, median_days_on_market, average_sale_to_list_ratio }) =>
    ({ month: month_start.slice(0, 7), sales, new_listings, median: median_sold_price, sfd_median: median_single_family_sold_price, dom: median_days_on_market, ratio: average_sale_to_list_ratio })));
  console.log(`sale records: ${uniq.length} (${uniq.filter((s) => s.eligible_for_market_stats).length} eligible), months: ${stats.length}`);
  if (dry) { console.log("--dry: nothing written."); return; }

  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name); if (!existsSync(p)) continue;
    if (typeof (process as any).loadEnvFile === "function") (process as any).loadEnvFile(p);
    else { const dotenv = await import("dotenv"); dotenv.config({ path: p, override: false }); }
  }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Replace this town's hand-loaded data in full, so re-imports never double count.
  for (const [t, col] of [["market_sale_records", "source"], ["market_monthly_stats", "source"]]) {
    const { error } = await db.from(t).delete().eq("city", city).like(col, `${SOURCE}%`);
    if (error) throw new Error(`clear ${t}: ${error.message}`);
  }
  for (let i = 0; i < uniq.length; i += 500) {
    const { error } = await db.from("market_sale_records").insert(uniq.slice(i, i + 500).map((s) => ({ ...s, imported_at: now })));
    if (error) throw new Error(`insert market_sale_records: ${error.message}`);
  }
  const { error: se } = await db.from("market_monthly_stats").insert(stats);
  if (se) throw new Error(`insert market_monthly_stats: ${se.message}`);
  console.log(`Wrote ${uniq.length} sale records and ${stats.length} monthly rows for ${city}.`);

  // Privacy check: individual sold prices must not be readable with the public key.
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_KEY;
  if (anonKey) {
    const pub = createClient(process.env.PUBLIC_SUPABASE_URL!, anonKey);
    const { data } = await pub.from("market_sale_records").select("sold_price").eq("city", city).limit(1);
    console.log(data?.length ? "WARNING: market_sale_records is readable with the public key - individual sold prices are exposed. Lock it down (RLS) before deploying." : "Privacy check OK: sale records are not readable with the public key.");
  } else console.log("No public anon key in .env - skipped the privacy check.");
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
