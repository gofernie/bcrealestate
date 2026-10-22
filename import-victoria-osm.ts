import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// City of Victoria only — not greater Victoria/Saanich.
const bbox = "48.38,-123.43,48.47,-123.31";

const query = `
[out:json][timeout:180];
(
  nwr["amenity"~"^(school|college|university|kindergarten|childcare|restaurant|cafe|fast_food|bar|pub|hospital|clinic|doctors|pharmacy|dentist)$"](${bbox});
  nwr["leisure"~"^(park|playground|garden|nature_reserve|sports_centre)$"](${bbox});
  nwr["shop"~"^(supermarket|convenience|greengrocer|bakery|butcher)$"](${bbox});
  nwr["healthcare"](${bbox});
);
out center tags;
`;

const response = await fetch(
  `https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(query)}`,
  {
    headers: {
      accept: "application/json",
      "user-agent": "bc.realestate OSM importer",
    },
  }
);

if (!response.ok) {
  throw new Error(`OpenStreetMap request failed: ${response.status} ${await response.text()}`);
}

const payload = await response.json();

function categoryFor(tags = {}) {
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

const seen = new Set();
const rows = (payload.elements || []).flatMap((element) => {
  const tags = element.tags || {};
  const category = categoryFor(tags);
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  const key = `${element.type}:${element.id}`;

  if (!category || !Number.isFinite(lat) || !Number.isFinite(lng) || seen.has(key)) return [];
  seen.add(key);

  return [{
    city: "victoria",
    area: "victoria",
    osm_id: Number(element.id),
    osm_element_type: element.type,
    name: tags.name || tags.brand || tags.operator || category,
    category,
    osm_type: tags.amenity || tags.leisure || tags.shop || tags.healthcare || "place",
    lat,
    lng,
  }];
});

if (!rows.length) throw new Error("OpenStreetMap returned no usable Victoria places.");

const { error: deleteError } = await supabase
  .from("osm_amenities")
  .delete()
  .eq("city", "victoria");

if (deleteError) throw deleteError;

for (let i = 0; i < rows.length; i += 500) {
  const { error } = await supabase
    .from("osm_amenities")
    .insert(rows.slice(i, i + 500));

  if (error) throw error;
  console.log(`Saved ${Math.min(i + 500, rows.length)} / ${rows.length}`);
}

const totals = rows.reduce((result, row) => {
  result[row.category] = (result[row.category] || 0) + 1;
  return result;
}, {});

console.log("\nVictoria OSM import complete:", totals);



