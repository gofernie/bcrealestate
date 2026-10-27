import { existsSync } from "node:fs";
import { resolve } from "node:path";

const MARKETS = [
  { city: "Revelstoke" },
  { city: "Golden" },
  { city: "Columbia Valley" }, // fetch group: Invermere, Windermere, Radium Hot Springs, Panorama
  { city: "Kimberley" },
  { city: "Rossland" },
  { city: "Nelson" },
  { city: "Sun Peaks" },
];
const CV_TOWNS = ["invermere", "windermere", "radium hot springs", "panorama", "Invermere", "Windermere", "Radium Hot Springs", "Panorama"];

async function main() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    if (typeof process.loadEnvFile === "function") process.loadEnvFile(path);
    else { const dotenv = await import("dotenv"); dotenv.config({ path, override: false }); }
  }
  const missing = ["PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REPLIERS_API_KEY"].filter((n) => !process.env[n]);
  if (missing.length) throw new Error(`Missing local settings: ${missing.join(", ")}`);

  const only = (process.argv[2] || "").toLowerCase();
  const { refreshListingMarket } = await import("../lib/listings/refreshListingMarket.ts");
  const env = {
    PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    REPLIERS_API_KEY: process.env.REPLIERS_API_KEY,
    REPLIERS_BASE_URL: process.env.REPLIERS_BASE_URL,
  };

  for (const m of MARKETS) {
    if (only && m.city.toLowerCase() !== only) continue;
    try {
      console.log(`\n>> ${m.city}`);
      const r: any = await refreshListingMarket({ city: m.city, boardId: "86", trigger: "manual-mountain", env } as any);
      console.log("   done:", { city: r?.city, mode: r?.mode, count: r?.count ?? r?.listingsCount ?? r?.upserted });
    } catch (e: any) {
      console.log(`   FAILED ${m.city}: ${e?.message || e}`);
    }
  }

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { error: cvErr, count: cvCount } = await db.from("listing_rows")
    .update({ normalized_city: "columbia valley" }, { count: "exact" })
    .in("normalized_city", CV_TOWNS);
  console.log(cvErr ? `\nColumbia Valley relabel FAILED: ${cvErr.message}` : `\nColumbia Valley rows relabelled: ${cvCount ?? 0}`);

  const keys = ["revelstoke", "golden", "columbia valley", "columbia-valley", "kimberley", "rossland", "nelson", "sun peaks", "sun-peaks", ...CV_TOWNS];
  const tally = new Map<string, number>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("listing_rows").select("normalized_city").eq("status", "A")
      .in("normalized_city", keys).range(offset, offset + 999);
    if (error) throw error;
    for (const r of data || []) tally.set(r.normalized_city, (tally.get(r.normalized_city) || 0) + 1);
    if (!data || data.length < 1000) break;
  }
  console.log("\nActive listing_rows by normalized_city:");
  console.table([...tally].map(([city, active]) => ({ city, active })));
  console.log("Check http://localhost:4321/ (Mountain section) and /revelstoke, /columbia-valley, /sun-peaks");
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
