import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const CITY = "oak bay";
const BBOX = "48.405,-123.328,48.468,-123.288";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        headers: { accept: "application/json", "user-agent": "bc.realestate amenity importer" },
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const payload = await response.json();
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
if (!rows.length) throw new Error("OpenStreetMap returned no usable Oak Bay places. No database rows were changed.");

const { error: deleteError } = await supabase.from("osm_amenities").delete().eq("city", CITY);
if (deleteError) throw deleteError;
for (let index = 0; index < rows.length; index += 500) {
  const { error } = await supabase.from("osm_amenities").insert(rows.slice(index, index + 500));
  if (error) throw error;
  console.log(`Saved ${Math.min(index + 500, rows.length)} / ${rows.length}`);
}
console.log("Oak Bay OSM import complete:", rows.reduce((totals: Record<string, number>, row: any) => {
  totals[row.category] = (totals[row.category] || 0) + 1;
  return totals;
}, {}));
