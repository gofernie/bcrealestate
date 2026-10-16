import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  // Load local settings without printing credentials. Local settings take priority.
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(path);
    } else {
      const dotenv = await import("dotenv");
      dotenv.config({ path, override: false });
    }
  }
  const required = ["PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REPLIERS_API_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing local settings: ${missing.join(", ")}. Import not started.`);

  const { refreshListingMarket } = await import("../lib/listings/refreshListingMarket.ts");
  console.log("Importing active Metchosin listings through the existing refresh pipeline...");
  const result = await refreshListingMarket({
    city: "Metchosin",
    trigger: "manual-metchosin",
    env: {
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      REPLIERS_API_KEY: process.env.REPLIERS_API_KEY,
      REPLIERS_BASE_URL: process.env.REPLIERS_BASE_URL,
    },
  });
  console.log("Refresh completed:", { city: result.city, mode: result.mode });

  const { createClient } = await import("@supabase/supabase-js");
  const { booleanPointInPolygon } = await import("@turf/turf");
  const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const cityKeys = ["metchosin", "Metchosin"];
  const { data: boundaries, error: boundaryError } = await db.from("area_boundaries")
    .select("area_slug,area_name,polygon_geojson").in("city", cityKeys).order("area_slug");
  if (boundaryError) throw boundaryError;
  const areas = (boundaries || []).map((area: any) => {
    const geometry = typeof area.polygon_geojson === "string"
      ? JSON.parse(area.polygon_geojson) : area.polygon_geojson;
    return { ...area, geometry };
  }).filter((area: any) => area.geometry);
  if (areas.length !== 8) throw new Error(`Expected 5 Metchosin boundaries; found ${areas.length}. Refresh completed, but neighbourhood assignment stopped.`);

  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("listing_rows")
      .select("id,normalized_city,normalized_area,lat,lng").eq("status", "A")
      .in("normalized_city", cityKeys).order("id").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  if (!rows.length) throw new Error("No active Metchosin rows were found after the refresh. Paste the refresh output so we can check the feed's city label.");

  const counts = new Map<string, number>(areas.map((area: any) => [area.area_slug, 0]));
  let changed = 0;
  let unassigned = 0;
  for (const row of rows) {
    const lat = Number(row.lat), lng = Number(row.lng);
    let area: any;
    if (row.lat !== null && row.lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      area = areas.find((candidate: any) => {
        const geometry = candidate.geometry;
        if (geometry.type === "FeatureCollection") {
          return geometry.features.some((feature: any) => booleanPointInPolygon([lng, lat], feature));
        }
        return booleanPointInPolygon([lng, lat], geometry);
      });
    }
    if (!area) { unassigned++; continue; }
    const normalizedArea = String(area.area_slug).replace(/-neighbou?rhood$/, "").replace(/-/g, " ").toLowerCase();
    counts.set(area.area_slug, (counts.get(area.area_slug) || 0) + 1);
    if (row.normalized_city === "metchosin" && row.normalized_area === normalizedArea) continue;
    const { error } = await db.from("listing_rows")
      .update({ normalized_city: "metchosin", normalized_area: normalizedArea })
      .eq("id", row.id).eq("status", "A");
    if (error) throw error;
    changed++;
  }
  console.table(areas.map((area: any) => ({ neighbourhood: area.area_name, activeHomes: counts.get(area.area_slug) || 0 })));
  console.log(`Active Metchosin rows: ${rows.length}. Neighbourhood assignments updated: ${changed}. Unassigned coordinates: ${unassigned}.`);
  const schedulerCity = "metchosin";
  const { data: existingMarkets, error: marketLookupError } = await db
    .from("listing_markets")
    .select("id")
    .eq("city", schedulerCity);

  if (marketLookupError) throw marketLookupError;
  if ((existingMarkets || []).length > 1) {
    throw new Error(`Found multiple listing_markets rows for ${schedulerCity}; stopped without changing anything.`);
  }

  let marketError;
  if (existingMarkets?.length) {
    ({ error: marketError } = await db
      .from("listing_markets")
      .update({ enabled: true, refresh_priority: 20, provider_city: null })
      .eq("id", existingMarkets[0].id));
  } else {
    ({ error: marketError } = await db
      .from("listing_markets")
      .insert({
        city: schedulerCity,
        enabled: true,
        refresh_priority: 20,
        provider_city: null,
      }));
  }

  if (marketError) {
    console.warn(`Listings are live, but Metchosin was not added to the automatic scheduler: ${marketError.message}`);
  } else {
    console.log("Metchosin is enabled for the regular listing and market-history schedulers.");

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.warn("CRON_SECRET is missing, so the one-time market-history backfill was not started.");
    } else {
      const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://bc.realestate").replace(/\/$/, "");
      const response = await fetch(
        `${siteUrl}/.netlify/functions/market-history-background?city=metchosin`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${cronSecret}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ city: "metchosin" }),
        }
      );
      console.log("Market-history backfill request:", response.status, await response.text());
    }
  }
  console.log("Refresh http://localhost:4321/metchosin/ and /metchosin/areas. Regional data can take 30 seconds to refresh.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Metchosin import failed.");
  process.exitCode = 1;
});
