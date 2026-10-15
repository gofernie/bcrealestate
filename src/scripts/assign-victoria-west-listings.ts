import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { booleanPointInPolygon } from "@turf/turf";

dotenv.config({ path: ".env.local" });
dotenv.config();

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetCity = "victoria west";
const sourceCities = ["victoria", targetCity];

const { data: boundaries, error: boundaryError } = await db
  .from("area_boundaries")
  .select("area_slug, area_name, polygon_geojson")
  .eq("city", targetCity)
  .order("area_slug");

if (boundaryError) throw boundaryError;
if ((boundaries || []).length !== 2) {
  throw new Error(`Expected 2 Victoria West boundaries; found ${(boundaries || []).length}.`);
}

const areas = (boundaries || []).map((area: any) => ({
  ...area,
  geometry: typeof area.polygon_geojson === "string"
    ? JSON.parse(area.polygon_geojson)
    : area.polygon_geojson,
}));

const rows: any[] = [];
for (let offset = 0; ; offset += 500) {
  const { data, error } = await db
    .from("listing_rows")
    .select("id, normalized_city, normalized_area, lat, lng")
    .in("normalized_city", sourceCities)
    .eq("status", "A")
    .order("id")
    .range(offset, offset + 499);

  if (error) throw error;
  rows.push(...(data || []));
  if (!data || data.length < 500) break;
}

const counts = new Map(areas.map((area: any) => [area.area_slug, 0]));
let changed = 0;

for (const row of rows) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  const area = areas.find((candidate: any) =>
    booleanPointInPolygon([lng, lat], candidate.geometry)
  );
  if (!area) continue;

  const normalizedArea = String(area.area_slug).replace(/-/g, " ").toLowerCase();
  counts.set(area.area_slug, (counts.get(area.area_slug) || 0) + 1);

  if (row.normalized_city === targetCity && row.normalized_area === normalizedArea) {
    continue;
  }

  const { error } = await db
    .from("listing_rows")
    .update({
      normalized_city: targetCity,
      normalized_area: normalizedArea,
    })
    .eq("id", row.id)
    .eq("status", "A");

  if (error) throw error;
  changed++;
}

console.table(areas.map((area: any) => ({
  neighbourhood: area.area_name,
  activeHomes: counts.get(area.area_slug) || 0,
})));

console.log(
  `Victoria West assignment complete. Active listings reassigned: ${changed}.`
);
console.log(
  "Run this script after a full Victoria inventory rebuild until we fold it into the Greater Victoria scheduler."
);