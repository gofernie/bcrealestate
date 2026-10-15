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
  console.log("Importing active Central Saanich listings through the existing refresh pipeline...");
  const result = await refreshListingMarket({
    city: "Central Saanich",
    trigger: "manual-central-saanich",
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
  const cityKeys = ["central saanich", "central-saanich", "Central Saanich"];
  const { data: boundaries, error: boundaryError } = await db.from("area_boundaries")
    .select("area_slug,area_name,polygon_geojson").in("city", cityKeys).order("area_slug");
  if (boundaryError) throw boundaryError;
  const areas = (boundaries || []).map((area: any) => {
    const geometry = typeof area.polygon_geojson === "string"
      ? JSON.parse(area.polygon_geojson) : area.polygon_geojson;
    return { ...area, geometry };
  }).filter((area: any) => area.geometry);
  if (areas.length !== 11) throw new Error(`Expected 11 Central Saanich boundaries; found ${areas.length}. Refresh completed, but neighbourhood assignment stopped.`);

  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("listing_rows")
      .select("id,normalized_city,normalized_area,lat,lng").eq("status", "A")
      .in("normalized_city", cityKeys).order("id").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  if (!rows.length) throw new Error("No active Central Saanich rows were found after the refresh. Paste the refresh output so we can check the feed's city label.");

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
    if (row.normalized_city === "central saanich" && row.normalized_area === normalizedArea) continue;
    const { error } = await db.from("listing_rows")
      .update({ normalized_city: "central saanich", normalized_area: normalizedArea })
      .eq("id", row.id).eq("status", "A");
    if (error) throw error;
    changed++;
  }
  console.table(areas.map((area: any) => ({ neighbourhood: area.area_name, activeHomes: counts.get(area.area_slug) || 0 })));
  console.log(`Active Central Saanich rows: ${rows.length}. Neighbourhood assignments updated: ${changed}. Unassigned coordinates: ${unassigned}.`);
  console.log("Refresh http://localhost:4321/central-saanich/ and /central-saanich/areas. Regional data can take 30 seconds to refresh.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Central Saanich import failed.");
  process.exitCode = 1;
});
