import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase settings in .env.local or .env");
}


import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";
import * as turf from "@turf/turf";
import shp from "shpjs";

const CITY = (process.argv[2] || "central saanich").trim().toLowerCase();
const ROOT = path.join(process.cwd(), "data", "census", "raw");
const FILES = {
  profile2016: path.join(ROOT, "2016", "profile", "98-401-X2016044_BRITISH_COLUMBIA_English_CSV_data.csv"),
  boundary2016: path.join(ROOT, "2016", "boundaries", "lda_000a16a_e.zip"),
  profile2021: path.join(ROOT, "2021", "profile", "98-401-X2021006_English_CSV_data_BritishColumbia.csv"),
  boundary2021: path.join(ROOT, "2021", "boundaries", "lda_000a21a_e.zip"),
};

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function csv(line: string) {
  return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((value) =>
    value.replaceAll('"', "").trim()
  );
}

function valueAsNumber(value: unknown) {
  const number = Number(String(value || "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : 0;
}

async function readPopulation(
  csvPath: string,
  columns: { id: string; level: string; levelValue: string; characteristic: string; total: string }
) {
  if (!fs.existsSync(csvPath)) throw new Error(`Required Census file is missing: ${csvPath}`);
  const populations = new Map<string, number>();
  const lines = readline.createInterface({ input: fs.createReadStream(csvPath), crlfDelay: Infinity });
  let indexes: Record<string, number> | undefined;

  for await (const line of lines) {
    const values = csv(line);
    if (!indexes) {
      indexes = Object.fromEntries(values.map((name, index) => [name.replace(/^\uFEFF/, ""), index]));
      for (const name of [columns.id, columns.level, columns.characteristic, columns.total]) {
        if (indexes[name] === undefined) throw new Error(`Missing CSV column ${name} in ${csvPath}`);
      }
      continue;
    }
    if (values[indexes[columns.level]] !== columns.levelValue) continue;
    if (values[indexes[columns.characteristic]] !== "1") continue;
    const id = String(values[indexes[columns.id]] || "").trim();
    if (id) populations.set(id, valueAsNumber(values[indexes[columns.total]]));
  }
  return populations;
}

async function sumPopulation(boundaryPath: string, populations: Map<string, number>, areas: any[]) {
  if (!fs.existsSync(boundaryPath)) throw new Error(`Required DA boundary file is missing: ${boundaryPath}`);
  const raw: any = await shp(fs.readFileSync(boundaryPath));
  const features = Array.isArray(raw)
    ? raw.flatMap((layer) => layer?.features || [])
    : raw?.type === "FeatureCollection"
      ? raw.features || []
      : Object.values(raw || {}).flatMap((layer: any) =>
          Array.isArray(layer?.features) ? layer.features : []
        );

  const totals = new Map(areas.map((area) => [area.area_slug, 0]));
  let matched = 0;

  for (const da of features) {
    if (String(da.properties?.PRUID) !== "59" || !da.geometry) continue;
    const daId = String(da.properties?.DAUID || "").trim();
    const population = populations.get(daId);
    if (population === undefined) continue;
    try {
      const centroid = turf.centroid(da as turf.Feature<turf.Polygon | turf.MultiPolygon>);
      const area = areas.find((candidate) => turf.booleanPointInPolygon(centroid, candidate.polygon_geojson));
      if (area) {
        totals.set(area.area_slug, (totals.get(area.area_slug) || 0) + population);
        matched += 1;
      }
    } catch {
      // One invalid geometry must not prevent the remaining neighbourhoods from importing.
    }
  }
  return { totals, matched };
}

const { data: areas, error: areasError } = await supabase
  .from("area_boundaries")
  .select("area_slug,area_name,polygon_geojson")
  .ilike("city", CITY === "saanich" ? "%saanich%" : CITY)
  .not("area_slug", "in", '("saanich-east","saanich-west")')
  .order("area_name");
if (areasError || !areas?.length) throw new Error(`Central Saanich boundaries are required first: ${areasError?.message || "none found"}`);

for (const area of areas) {
  let geometry = area.polygon_geojson;
  if (typeof geometry === "string") geometry = JSON.parse(geometry);
  if (geometry?.type === "Feature") geometry = geometry.geometry;
  if (!["Polygon", "MultiPolygon"].includes(geometry?.type)) throw new Error(`Invalid polygon: ${area.area_slug}`);
  area.polygon_geojson = geometry;
}
for (const file of Object.values(FILES)) {
  if (!fs.existsSync(file)) throw new Error(`Required Census file is missing: ${file}`);
}
const population2016 = await readPopulation(FILES.profile2016, {
  id: "GEO_CODE (POR)", level: "GEO_LEVEL", levelValue: "4",
  characteristic: "Member ID: Profile of Dissemination Areas (2247)",
  total: "Dim: Sex (3): Member ID: [1]: Total - Sex",
});
const population2021 = await readPopulation(FILES.profile2021, {
  id: "ALT_GEO_CODE", level: "GEO_LEVEL", levelValue: "Dissemination area",
  characteristic: "CHARACTERISTIC_ID",
  total: "C1_COUNT_TOTAL",
});

const census2016 = await sumPopulation(FILES.boundary2016, population2016, areas);
const census2021 = await sumPopulation(FILES.boundary2021, population2021, areas);

if (census2016.matched === 0 || census2021.matched === 0) {
  throw new Error(
    `Import stopped without saving: matched ${census2016.matched} 2016 DAs and ${census2021.matched} 2021 DAs.`
  );
}

const rows = areas.map((area) => {
  const population_2016 = census2016.totals.get(area.area_slug) || 0;
  const population_2021 = census2021.totals.get(area.area_slug) || 0;
  return {
    city: CITY,
    neighbourhood: area.area_name,
    slug: area.area_slug,
    population_2016,
    population_2021,
    pop_change_pct: population_2016 > 0
      ? Math.round(((population_2021 - population_2016) / population_2016) * 1000) / 10
      : null,
  };
});

const { error: upsertError } = await supabase
  .from("neighbourhood_census_data")
  .upsert(rows, { onConflict: "city,slug" });
if (upsertError) throw upsertError;

console.table(rows.map(({ neighbourhood, population_2016, population_2021, pop_change_pct }) => ({
  neighbourhood, population_2016, population_2021, pop_change_pct,
})));
console.log(`Updated ${rows.length} Central Saanich neighbourhoods from ${census2016.matched} matched 2016 DAs and ${census2021.matched} matched 2021 DAs.`);
