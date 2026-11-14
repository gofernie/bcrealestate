// Refresh market_monthly_stats (source=repliers) for every city: last N settled months (default 2).
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

const months = String(process.argv[2] || 2);
const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await db.from("market_monthly_stats").select("city").eq("source", "repliers").limit(5000);
if (error) { console.error(error.message); process.exit(1); }
const cities = [...new Set((data || []).map((r) => String(r.city || "").trim()).filter(Boolean))].sort();
const title = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
console.log(`Refreshing ${months} month(s) for ${cities.length} cities`);
let ok = 0; const failed = [];
for (const c of cities) {
  const r = spawnSync(process.execPath, ["scripts/backfill-market-monthly-stats.mjs", title(c), months], { stdio: "inherit", env: process.env });
  if (r.status === 0) ok++; else failed.push(c);
  await new Promise((res) => setTimeout(res, 2000));
}
console.log(`Monthly stats refreshed: ${ok}/${cities.length}${failed.length ? "  failed: " + failed.join(", ") : ""}`);