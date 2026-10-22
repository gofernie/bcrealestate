import fs from "node:fs";
import readline from "node:readline/promises";

const envText = fs.readFileSync(".env", "utf8");
function env(name) {
  const match = envText.match(
    new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m")
  );
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

const supabaseUrl =
  env("SUPABASE_URL") || env("PUBLIC_SUPABASE_URL");
const serviceKey =
  env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("Could not find Supabase URL or service key in .env.");
}

const kmlPath = `${process.env.USERPROFILE}\\Downloads\\Victoria District.kml`;
if (!fs.existsSync(kmlPath)) {
  throw new Error(`KML not found: ${kmlPath}`);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const sitesResponse = await fetch(
  `${supabaseUrl}/rest/v1/sites?select=id,site_name&order=site_name`,
  { headers }
);
const sites = await sitesResponse.json();

if (!sitesResponse.ok || !Array.isArray(sites) || !sites.length) {
  throw new Error(`Could not load sites: ${JSON.stringify(sites)}`);
}

console.log("\nChoose your Chris Crump site:");
sites.forEach((site, index) => console.log(`${index + 1}. ${site.site_name}`));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("\nNumber: ");
rl.close();

const site = sites[Number(answer) - 1];
if (!site) throw new Error("Invalid site number.");

const decode = (value = "") =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const kml = fs.readFileSync(kmlPath, "utf8");
const placemarks = [...kml.matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)];

const rows = placemarks.flatMap(([placemark]) => {
  const nameMatch = placemark.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
  const coordinatesMatch = placemark.match(
    /<Polygon[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i
  );

  if (!nameMatch || !coordinatesMatch) return [];

  const coordinates = coordinatesMatch[1]
    .trim()
    .split(/\s+/)
    .map((point) => point.split(",").slice(0, 2).map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

  if (coordinates.length < 4) return [];

  const openRing =
    coordinates[0][0] === coordinates.at(-1)[0] &&
    coordinates[0][1] === coordinates.at(-1)[1]
      ? coordinates.slice(0, -1)
      : coordinates;

  const centerLat = openRing.reduce((sum, [, lat]) => sum + lat, 0) / openRing.length;
  const centerLng = openRing.reduce((sum, [lng]) => sum + lng, 0) / openRing.length;
  const areaName = decode(nameMatch[1]);

  return [{
    site_id: site.id,
    city: "victoria",
    area_slug: slugify(areaName),
    area_name: areaName,
    polygon_geojson: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    center_lat: centerLat,
    center_lng: centerLng,
  }];
});

if (!rows.length) throw new Error("No polygons found in the KML.");

const importResponse = await fetch(
  `${supabaseUrl}/rest/v1/area_boundaries?on_conflict=city,area_slug`,
  {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  }
);

const imported = await importResponse.json();

if (!importResponse.ok) {
  throw new Error(JSON.stringify(imported));
}

console.log(`\nImported ${imported.length} Victoria boundaries for ${site.site_name}.`);
console.log(imported.map((row) => row.area_name).join("\n"));

