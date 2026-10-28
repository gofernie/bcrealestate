import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase settings in .env.local or .env");
}

import * as turf from "@turf/turf";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CITY = "nelson";
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Search box: drawn Nelson boundaries plus a margin, or a fixed box covering Nelson,
// North Shore to Balfour, Harrop/Procter, West Arm to South Slocan and the Salmo road.
const { data: areas } = await supabase.from("area_boundaries").select("area_slug,polygon_geojson").eq("city", CITY);
let BBOX = "49.36,-117.56,49.66,-116.88";
const polygons = (areas || []).flatMap((area: any) => {
  let geometry = area.polygon_geojson;
  if (typeof geometry === "string") geometry = JSON.parse(geometry);
  if (geometry?.type === "Feature") geometry = geometry.geometry;
  return ["Polygon", "MultiPolygon"].includes(geometry?.type) ? [turf.feature(geometry)] : [];
});
if (polygons.length) {
  const [west, south, east, north] = turf.bbox(turf.featureCollection(polygons));
  BBOX = `${south - 0.025},${west - 0.04},${north + 0.025},${east + 0.04}`;
  console.log(`Using ${polygons.length} drawn Nelson boundaries.`);
} else {
  console.log("No Nelson boundaries drawn - using the fixed Nelson-area box.");
}

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const query = `[out:json][timeout:180];
(
  nwr["amenity"~"^(school|college|university|kindergarten|childcare|restaurant|cafe|fast_food|bar|pub|hospital|clinic|doctors|pharmacy|dentist)$"](${BBOX});
  nwr["leisure"~"^(park|playground|garden|nature_reserve|sports_centre)$"](${BBOX});
  nwr["shop"~"^(supermarket|convenience|greengrocer|bakery|butcher)$"](${BBOX});
  nwr["healthcare"](${BBOX});
);
out center tags;`;

async function fetchOverpass() {
  const failures: string[] = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(210000),
        headers: { accept: "application/json", "user-agent": "bc.realestate amenity importer" },
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const payload = await response.json();
      if (payload?.remark) throw new Error(String(payload.remark));
      if (Array.isArray(payload?.elements) && payload.elements.length) return payload;
      throw new Error("no elements returned");
    } catch (error: any) {
      failures.push(`${endpoint}: ${error?.message || String(error)}`);
    }
  }
  throw new Error(`All OpenStreetMap endpoints failed. No database rows were changed.\n${failures.join("\n")}`);
}

function categoryFor(tags: Record<string, string>) {
  const amenity = String(tags.amenity || "");
  const leisure = String(tags.leisure || "");
  const shop = String(tags.shop || "");
  if (["school", "college", "university", "kindergarten", "childcare"].includes(amenity)) return "schools";
  if (["park", "playground", "garden", "nature_reserve", "sports_centre"].includes(leisure)) return "parks";
  if (["restaurant", "cafe", "fast_food", "bar", "pub"].includes(amenity)) return "restaurants";
  if (["supermarket", "convenience", "greengrocer", "bakery", "butcher"].includes(shop)) return "grocery";
  if (["hospital", "clinic", "doctors", "pharmacy", "dentist"].includes(amenity) || tags.healthcare) return "medical";
  return "";
}

const payload = await fetchOverpass();
const seen = new Set<string>();
const rows = payload.elements.flatMap((element: any) => {
  const tags = element.tags || {};
  const category = categoryFor(tags);
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  const key = `${element.type}:${element.id}`;
  if (!category || !Number.isFinite(lat) || !Number.isFinite(lng) || seen.has(key)) return [];
  seen.add(key);
  return [{
    city: CITY, area: CITY, osm_id: Number(element.id), osm_element_type: element.type,
    name: tags.name || tags.brand || tags.operator || category, category,
    osm_type: tags.amenity || tags.leisure || tags.shop || tags.healthcare || "place", lat, lng,
  }];
});
if (!rows.length) throw new Error("OpenStreetMap returned no usable Nelson places. No database rows were changed.");

const existingRows: any[] = [];
for (let offset = 0; ; offset += 500) {
  const { data, error } = await supabase.from("osm_amenities").select("*").eq("city", CITY).order("id").range(offset, offset + 499);
  if (error) throw new Error(`Backup failed; nothing replaced: ${error.message}`);
  existingRows.push(...(data || []));
  if (!data || data.length < 500) break;
}

const backupPath = `src/scripts/nelson-osm-backup-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(existingRows, null, 2), "utf8");
console.log(`Backed up ${existingRows.length} existing amenities to ${backupPath}`);
console.log(`Fetched ${rows.length} places. Replacing Nelson amenities now.`);

const { error: deleteError } = await supabase.from("osm_amenities").delete().eq("city", CITY);
if (deleteError) throw deleteError;
for (let index = 0; index < rows.length; index += 500) {
  const { error } = await supabase.from("osm_amenities").insert(rows.slice(index, index + 500));
  if (error) {
    const cleared = await supabase.from("osm_amenities").delete().eq("city", CITY);
    if (cleared.error) throw new Error(`Import failed; cleanup failed. Restore backup ${backupPath}: ${error.message}`);
    for (let start = 0; start < existingRows.length; start += 500) {
      const restored = await supabase.from("osm_amenities").insert(existingRows.slice(start, start + 500));
      if (restored.error) throw new Error(`Import failed; restore failed. Backup: ${backupPath}. ${restored.error.message}`);
    }
    throw new Error(`Import failed; previous amenities restored: ${error.message}`);
  }
  console.log(`Saved ${Math.min(index + 500, rows.length)} / ${rows.length}`);
}
console.log("Nelson OSM import complete:", rows.reduce((totals: Record<string, number>, row: any) => {
  totals[row.category] = (totals[row.category] || 0) + 1;
  return totals;
}, {}));
