import { existsSync } from "node:fs";
import { resolve } from "node:path";
// resync-market: npx tsx src/scripts/resync-market.ts <city>
async function main() {
  for (const name of [".env.local", ".env"]) { const path = resolve(process.cwd(), name); if (!existsSync(path)) continue; if (typeof process.loadEnvFile === "function") process.loadEnvFile(path); else { const dotenv = await import("dotenv"); dotenv.config({ path, override: false }); } }
  const city = process.argv[2]; if (!city) throw new Error("Usage: npx tsx src/scripts/resync-market.ts <city>");
  const { refreshListingMarket } = await import("../lib/listings/refreshListingMarket.ts");
  console.log(`Re-syncing ${city}...`);
  const result: any = await refreshListingMarket({ city, trigger: "manual-resync", env: { PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, REPLIERS_API_KEY: process.env.REPLIERS_API_KEY, REPLIERS_BASE_URL: process.env.REPLIERS_BASE_URL } } as any);
  console.log("Done:", { city: result?.city, mode: result?.mode });
}
main().catch((e) => { console.error("Re-sync failed:", e?.message || e); process.exitCode = 1; });