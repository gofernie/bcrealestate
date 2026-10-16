import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";
import * as turf from "@turf/turf";
import shp from "shpjs";

const CITY = (process.argv[2] || "oak bay").trim().toLowerCase();
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
      indexes = Object.fromEntries(values.map((name, index) => [name, index]));
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
  let processed = 0;

  for (const da of features) {
    processed++;
    if (processed % 5000 === 0) {
      console.log(`Processed ${processed} / ${features.length} dissemination areas...`);
    }
    if (String(da.properties?.PRUID) !== "59" || !da.geometry) continue;
    const daId = String(da.properties?.DAUID || "").trim();
    const population = populations.get(daId);
    if (population === undefined) continue;
    try {
      const centroid = turf.centroid(da as turf.Feature<turf.Polygon | turf.MultiPolygon>);
      let area = areas.find((candidate) =>
        turf.booleanPointInPolygon(centroid, candidate.polygon_geojson)
      );

      if (!area) {
        const intersecting = areas.filter((candidate) => {
          const geometry = candidate.polygon_geojson;
          const features = geometry?.type === "FeatureCollection"
            ? geometry.features || []
            : [geometry];

          return features.some((feature: any) => {
            try {
              return feature && turf.booleanIntersects(da as any, feature);
            } catch {
              return false;
            }
          });
        });

        if (intersecting.length === 1) {
          area = intersecting[0];
        } else if (intersecting.length > 1) {
          let bestArea: any;
          let largestOverlap = -1;

          for (const candidate of intersecting) {
            const geometry = candidate.polygon_geojson;
            const features = geometry?.type === "FeatureCollection"
              ? geometry.features || []
              : [geometry];

            for (const feature of features) {
              try {
                const overlap = turf.intersect(
                  turf.featureCollection([da as any, feature as any])
                );
                const overlapArea = overlap ? turf.area(overlap) : 0;
                if (overlapArea > largestOverlap) {
                  largestOverlap = overlapArea;
                  bestArea = candidate;
                }
              } catch {}
            }
          }

          area = bestArea;
        }
      }

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
if (areasError || !areas?.length) throw new Error(`Langford boundaries are required first: ${areasError?.message || "none found"}`);

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
  const rawPopulation2021 = census2021.totals.get(area.area_slug) || 0;
  const population_2021 = population_2016 > 0 && rawPopulation2021 === 0
    ? null
    : rawPopulation2021;
  return {
    city: CITY,
    neighbourhood: area.area_name,
    slug: area.area_slug,
    population_2016,
    population_2021,
    pop_change_pct: population_2016 > 0 && population_2021 !== null
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
console.log(`Updated ${rows.length} Langford neighbourhoods from ${census2016.matched} matched 2016 DAs and ${census2021.matched} matched 2021 DAs.`);
