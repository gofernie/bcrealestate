import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";
import * as turf from "@turf/turf";
import shp from "shpjs";

/**
 * Writes accurate 2016 population totals for the existing neighbourhood
 * polygons.  It deliberately does not join 2016 values to 2021 DA IDs:
 * Statistics Canada redraws dissemination areas between censuses.
 */

const CITY = String(process.argv[2] || "victoria").trim().toLowerCase();
const ROOT = path.join(process.cwd(), "data", "census", "raw", "2016");
const PROFILE_PATH = path.join(
  ROOT,
  "profile",
  "98-401-X2016044_BRITISH_COLUMBIA_English_CSV_data.csv"
);
const BOUNDARY_PATH = path.join(ROOT, "boundaries", "lda_000a16a_e.zip");
const BOUNDARY_URL =
  "https://data.source.coop/dataforcanada/d4c-datapkg-statistical/archive/statcan/boundaries/2016/lda_000a16a_e.zip";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function csv(line: string) {
  return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((value) =>
    value.replaceAll('"', "").trim()
  );
}

function normalCode(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\.0+$/, "")
    .padStart(8, "0");
}

function asPopulation(value: unknown) {
  const population = Number(String(value || "").replaceAll(",", ""));
  return Number.isFinite(population) ? population : 0;
}

async function ensureBoundaryZip() {
  if (fs.existsSync(BOUNDARY_PATH)) return;

  fs.mkdirSync(path.dirname(BOUNDARY_PATH), { recursive: true });
  console.log("Downloading 2016 BC dissemination-area boundaries...");
  const response = await fetch(BOUNDARY_URL);

  if (!response.ok) {
    throw new Error(`Could not download 2016 boundaries: ${response.status}`);
  }

  fs.writeFileSync(BOUNDARY_PATH, Buffer.from(await response.arrayBuffer()));
}

async function load2016Population() {
  if (!fs.existsSync(PROFILE_PATH)) {
    throw new Error(`Missing 2016 Census profile: ${PROFILE_PATH}`);
  }

  const populations = new Map<string, number>();
  const stream = fs.createReadStream(PROFILE_PATH);
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let indexes: Record<string, number> | null = null;

  for await (const line of lines) {
    const values = csv(line);

    if (!indexes) {
      indexes = Object.fromEntries(values.map((name, index) => [name, index]));
      continue;
    }

    const geoLevel = values[indexes["GEO_LEVEL"]];
    const memberId = values[indexes["Member ID: Profile of Dissemination Areas (2247)"]];
    const daUid = normalCode(values[indexes["GEO_CODE (POR)"]]);
    const total = values[
      indexes["Dim: Sex (3): Member ID: [1]: Total - Sex"]
    ];

    if (geoLevel !== "4" || memberId !== "1" || !daUid.startsWith("59")) {
      continue;
    }

    populations.set(daUid, asPopulation(total));
  }

  return populations;
}

async function run() {
  await ensureBoundaryZip();
  const populationByDa = await load2016Population();
  const rawBoundaries: any = await shp(fs.readFileSync(BOUNDARY_PATH));
  const boundaries = (rawBoundaries.features || []).filter(
    (feature: any) => String(feature.properties?.PRUID) === "59"
  );

  const { data: areas, error: areasError } = await supabase
    .from("area_boundaries")
    .select("city,area_slug,area_name,polygon_geojson")
    .eq("city", CITY);

  if (areasError) throw areasError;
  if (!areas?.length) throw new Error(`No boundaries found for ${CITY}.`);

  const totals = new Map(
    areas.map((area: any) => [area.area_slug, 0])
  );
  let matched = 0;

  for (const da of boundaries) {
    const daUid = normalCode(da.properties?.DAUID);
    const population = populationByDa.get(daUid);
    if (population === undefined || !da.geometry) continue;

    let point: turf.Feature<turf.Point>;
    try {
      point = turf.centroid(da as turf.Feature<turf.Polygon | turf.MultiPolygon>);
    } catch {
      continue;
    }

    for (const area of areas as any[]) {
      try {
        if (turf.booleanPointInPolygon(point, area.polygon_geojson)) {
          totals.set(area.area_slug, (totals.get(area.area_slug) || 0) + population);
          matched += 1;
          break;
        }
      } catch {
        // Ignore one malformed area instead of discarding the entire import.
      }
    }
  }

  const { data: current, error: currentError } = await supabase
    .from("neighbourhood_census_data")
    .select("slug,population_2021")
    .eq("city", CITY);

  if (currentError) throw currentError;
  const population2021ByArea = new Map(
    (current || []).map((row: any) => [row.slug, Number(row.population_2021) || 0])
  );

  const rows = (areas as any[]).map((area) => {
    const population2016 = totals.get(area.area_slug) || 0;
    const population2021 = population2021ByArea.get(area.area_slug) || 0;

    return {
      city: CITY,
      neighbourhood: area.area_name,
      slug: area.area_slug,

      population_2016: population2016,
      population_2021: population2021,
      pop_change_pct:
        population2016 > 0
          ? Math.round(((population2021 - population2016) / population2016) * 1000) / 10
          : null,
    };
  });

  const { error: upsertError } = await supabase
    .from("neighbourhood_census_data")
    .upsert(rows, { onConflict: "city,slug" });

  if (upsertError) throw upsertError;

  console.table(rows.map(({ area_name, population_2016, population_2021, pop_change_pct }) => ({
    area_name,
    population_2016,
    population_2021,
    pop_change_pct,
  })));
  console.log(`Updated ${rows.length} ${CITY} neighbourhoods from ${matched} matched 2016 DAs.`);
}

run().catch((error) => {
  console.error("2016 population import failed:", error);
  process.exitCode = 1;
});






