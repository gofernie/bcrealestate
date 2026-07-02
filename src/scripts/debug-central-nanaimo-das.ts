import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getGeometry(input: any) {
  if (!input) return null;
  if (input.type === "Feature") return input.geometry;
  if (input.type === "FeatureCollection") return input.features?.[0]?.geometry ?? null;
  if (input.type === "Polygon" || input.type === "MultiPolygon") return input;
  return input.geometry ?? null;
}

function getPolygonCentroid(geometry: any): [number, number] | null {
  const geom = getGeometry(geometry);
  if (!geom) return null;

  let ring: number[][] | null = null;

  if (geom.type === "Polygon") ring = geom.coordinates?.[0] ?? null;
  if (geom.type === "MultiPolygon") ring = geom.coordinates?.[0]?.[0] ?? null;

  if (!ring?.length) return null;

  let lngSum = 0;
  let latSum = 0;
  let count = 0;

  for (const coord of ring) {
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);

    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      lngSum += lng;
      latSum += lat;
      count++;
    }
  }

  if (!count) return null;

  return [lngSum / count, latSum / count];
}

function distanceKm(a: [number, number], b: [number, number]) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;

  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(x));
}

const boundaryPath = path.join(
  process.cwd(),
  "data",
  "census",
  "boundaries",
  "bc_da_boundaries_2021.geojson"
);

const raw = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
const features = raw.type === "FeatureCollection" ? raw.features : [];

const { data: areas, error } = await supabase
  .from("area_boundaries")
  .select("city, area_slug, area_name, polygon_geojson")
  .eq("city", "nanaimo")
  .eq("area_slug", "central-nanaimo");

if (error) throw error;

const central = areas?.[0];

if (!central) {
  console.log("Central Nanaimo polygon not found.");
  process.exit(0);
}

const centralCentroid = getPolygonCentroid(central.polygon_geojson);

if (!centralCentroid) {
  console.log("Central Nanaimo centroid could not be calculated.");
  process.exit(0);
}

console.log("Central Nanaimo centroid:", centralCentroid);

const nearby = features
  .map((feature: any) => {
    const centroid = getPolygonCentroid(feature.geometry);
    if (!centroid) return null;

    return {
      da_uid:
        feature.properties?.DAUID ??
        feature.properties?.DA_UID ??
        feature.properties?.dauid ??
        feature.properties?.da_uid ??
        feature.properties?.uid,
      centroid,
      distanceKm: distanceKm(centralCentroid, centroid),
      properties: feature.properties,
    };
  })
  .filter(Boolean)
  .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
  .slice(0, 25);

console.log("\nNearest DA centroids to Central Nanaimo:");
console.table(
  nearby.map((item: any) => ({
    da_uid: item.da_uid,
    lng: item.centroid[0],
    lat: item.centroid[1],
    distanceKm: item.distanceKm.toFixed(2),
  }))
);