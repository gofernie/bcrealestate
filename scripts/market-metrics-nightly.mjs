// Nightly Island market pulse -> market_metrics. VIVA board only (avoids DDF duplicates).
// activity_index = pending (conditional sales, last 60d) / active. "sold" column = new conditional deals in last 7 days.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const H = { headers: { "REPLIERS-API-KEY": process.env.REPLIERS_API_KEY } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const today = iso(new Date());
const since7 = iso(new Date(Date.now() - 7 * DAY));
const since60 = iso(new Date(Date.now() - 60 * DAY));

const GROUPS = {
  "Comox Valley": ["Courtenay", "Comox", "Cumberland", "Royston", "Union Bay", "Fanny Bay", "Black Creek", "Merville", "Lazo"],
  "Parksville / Qualicum": ["Parksville", "Qualicum Beach", "Nanoose Bay", "Errington", "Coombs", "Qualicum Bay", "Bowser", "Dashwood"],
  "Malahat / Mill Bay": ["Mill Bay", "Shawnigan Lake", "Cobble Hill", "Malahat"],
  "North Island": ["Port Hardy", "Port McNeill", "Port Alice", "Sayward", "Woss", "Alert Bay", "Sointula", "Coal Harbour"],
  "Gulf Islands": ["Salt Spring Island", "Salt Spring", "Pender Island", "Galiano Island", "Mayne Island", "Saturna Island", "Gabriola Island", "Thetis Island", "Gabriola"],
  "Saanich": ["Saanich"],
};
const SKIP = new Set(["Saanich East", "Saanich West", "Islands", "Other Areas", "Victoria West"]);

async function count(cities, pairs) {
  const p = new URLSearchParams(pairs);
  for (const c of cities) p.append("city", c);
  p.set("boardId", "25"); p.set("type", "sale"); p.append("class", "Residential"); p.append("class", "Condo");
  p.set("listings", "false"); p.set("resultsPerPage", "1");
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch("https://api.repliers.io/listings?" + p, H);
      const j = await r.json();
      if (r.ok && j.count != null) return Number(j.count);
      console.warn("  repliers", r.status, JSON.stringify(j).slice(0, 160));
    } catch (e) { console.warn("  fetch failed:", e.message); }
    await sleep(800 * (a + 1));
  }
  return null;
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / DAY + 1) / 7) };
}

const { data: base, error } = await db.from("market_metrics").select("board, area_prefix, market_name").neq("snapshot_date", today);
if (error) { console.error(error.message); process.exit(1); }
const byName = new Map((base || []).filter((m) => m.market_name).map((m) => [m.market_name, m]));
if (!byName.has("Saanich")) byName.set("Saanich", { board: byName.get("Victoria")?.board || "VIVA", area_prefix: null, market_name: "Saanich" });
const { year, week } = isoWeek(new Date());
const rows = [];
for (const m of byName.values()) {
  const name = m.market_name;
  if (SKIP.has(name)) continue;
  const cities = GROUPS[name] || [name];
  const active = await count(cities, [["status", "A"]]);
  const pending = await count(cities, [["status", "U"], ["lastStatus", "Sc"], ["minUnavailableDate", since60]]);
  const newDeals = await count(cities, [["status", "U"], ["lastStatus", "Sc"], ["lastStatus", "Sld"], ["minUnavailableDate", since7]]);
  const failed = await count(cities, [["status", "U"], ["lastStatus", "Ter"], ["lastStatus", "Exp"], ["lastStatus", "Sus"], ["minUnavailableDate", since7]]);
  if (active == null || pending == null || active === 0) { console.warn(`${name}: skipped (no listings)`); continue; }
  const activity = Math.round((pending / active) * 100) / 100;
  console.log(`${name.padEnd(22)} active ${String(active).padStart(4)}  pending ${String(pending).padStart(4)}  new deals 7d ${String(newDeals ?? "-").padStart(3)}  failed 7d ${String(failed ?? "-").padStart(3)}  index ${activity}`);
  rows.push({ snapshot_date: today, board: m.board, area_prefix: m.area_prefix, market_name: name, active, pending, sold: newDeals ?? 0, failed: failed ?? 0, activity_index: activity, snapshot_year: year, snapshot_week: week });
  await sleep(150);
}
if (!rows.length) { console.error("No rows - nothing written"); process.exit(1); }
await db.from("market_metrics").delete().eq("snapshot_date", today);
const { error: insErr } = await db.from("market_metrics").insert(rows);
if (insErr) { console.error("insert failed:", insErr.message); process.exit(1); }
console.log(`Market metrics written: ${rows.length} markets for ${today}`);