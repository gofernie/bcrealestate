import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";


import { extract2021BcDaPopulation } from "../lib/census/extract2021BcDaPopulation";
import { matchDaToNeighbourhood } from "../lib/census/matchDaToNeighbourhood";
import { upsertDaMatches } from "../lib/census/upsertDaMatches";
import { loadBoundaries } from "../lib/census/loadBoundaries";
import { loadNeighbourhoods } from "../lib/census/loadNeighbourhoods";
import { aggregateNeighbourhoodStats } from "../lib/census/aggregateNeighbourhoodStats";
import { upsertNeighbourhoodStats } from "../lib/census/upsertNeighbourhoodStats";
import { extract2016Population } from "../lib/census/extract2016Population";
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_DIR = path.join(process.cwd(), "data", "census");
const TARGET_CITY = String(process.argv[2] || "victoria")
  .trim()
  .toLowerCase();

const TARGET_AREA_SLUG = String(process.argv[3] || "")
  .trim()
  .toLowerCase();
const DRY_RUN = process.env.CENSUS_DRY_RUN === "1";

function readCsv(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = headerLine.split(",").map((h) => h.trim());

  return lines.map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}





async function run() {
const rows2016 = await extract2016Population();

  const pop2021ByDa = await extract2021BcDaPopulation(
    path.join(
      DATA_DIR,
      "raw",
      "2021",
      "profile",
      "98-401-X2021006_English_CSV_data_BritishColumbia.csv"
    )
  );

  const rows2021 = [...pop2021ByDa.entries()].map(([da_uid, population]) => ({
    da_uid,
    population,
  }));

const daBoundaries = await loadBoundaries();

const allNeighbourhoods = await loadNeighbourhoods();
const neighbourhoods = allNeighbourhoods.filter((area) => {
  const matchesCity =
    String(area.city ?? "").trim().toLowerCase() === TARGET_CITY;

  const matchesArea =
    !TARGET_AREA_SLUG ||
    String(area.area_slug ?? "").trim().toLowerCase() === TARGET_AREA_SLUG;

  return matchesCity && matchesArea;
});if (!neighbourhoods.length) {
  throw new Error(`No area boundaries found for ${TARGET_CITY}.`);
}

  const { matches, unmatched } = matchDaToNeighbourhood(
    daBoundaries,
    neighbourhoods ?? []
  );

const aggregated = aggregateNeighbourhoodStats(
  matches,
  rows2016,
  rows2021
);

  console.log("2016 rows:", rows2016.length);
  console.log("2021 rows:", rows2021.length);
  console.log("DA boundaries:", daBoundaries.features?.length ?? 0);
  console.log("Neighbourhood polygons:", neighbourhoods?.length ?? 0);

  console.log("Matched DAs:", matches.length);
  if (DRY_RUN) {
    console.log("Dry run: DA matches were not written.");
  } else {
    await upsertDaMatches(matches);
  }

  console.log("Unmatched DAs:", unmatched.length);
  console.log("Aggregated:", aggregated);

  // Keep this commented while using fake 2016 population CSVs.
  if (DRY_RUN) {
    console.log("Dry run: neighbourhood stats were not written.");
  } else {
    await upsertNeighbourhoodStats(aggregated);
  }

console.log("Next step: enable neighbourhood census stats upsert.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
