import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";

const city = String(process.argv[2] || "").trim().toLowerCase();
const kmlPath = process.argv[3];

if (!city || !kmlPath) {
  throw new Error("Usage: npx tsx src/scripts/import-area-kml.ts <city> <path-to-kml>");
}

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const decode = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

const kml = fs.readFileSync(kmlPath, "utf8");
const seen = new Set<string>();
const rows = [...kml.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi)].flatMap((match) => {
  const placemark = match[1];
  const nameMatch = placemark.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i);
  const coordinatesMatch = placemark.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i);
  if (!nameMatch || !coordinatesMatch) return [];

  const coordinates = coordinatesMatch[1]
    .trim()
    .split(/\s+/)
    .map((point) => point.split(",").map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (coordinates.length < 4) return [];

  const rawAreaName = decode(nameMatch[1])
    .replace(/<[^>]+>/g, "")
    .trim();

  const area_name = rawAreaName
    .replace(/\s+neighbourhood$/i, "")
    .trim();
  const area_slug = slugify(area_name);
  if (!area_name || seen.has(area_slug)) return [];
  seen.add(area_slug);

  const closed = coordinates[0][0] === coordinates.at(-1)![0] && coordinates[0][1] === coordinates.at(-1)![1];
  const openRing = closed ? coordinates.slice(0, -1) : coordinates;
  return [{
    city,
    area_name,
    area_slug,
    polygon_geojson: { type: "Polygon", coordinates: [coordinates] },
    center_lat: openRing.reduce((sum, [, lat]) => sum + lat, 0) / openRing.length,
    center_lng: openRing.reduce((sum, [lng]) => sum + lng, 0) / openRing.length,
  }];
});

if (!rows.length) throw new Error("No polygon placemarks were found in that KML file.");

const { data: sites, error: sitesError } = await supabase
  .from("sites")
  .select("id,site_name")
  .order("site_name");
if (sitesError || !sites?.length) throw new Error(`Could not load sites: ${sitesError?.message || "none found"}`);

console.log("\nChoose the site that should own these area pages:");
sites.forEach((site: any, index: number) => console.log(`${index + 1}. ${site.site_name}`));
const answer = await readline.createInterface({ input, output }).question("\nNumber: ");
const site = sites[Number(answer) - 1] as any;
if (!site) throw new Error("No valid site was selected.");

const payload = rows.map((row) => ({ ...row, site_id: site.id }));
const { error } = await supabase
  .from("area_boundaries")
  .upsert(payload, { onConflict: "city,area_slug" });
if (error) throw error;

console.log(`\nImported ${payload.length} ${city} boundaries for ${site.site_name}:`);
payload.forEach((row) => console.log(`- ${row.area_name}`));
