import path from "node:path";
import "dotenv/config";

import { aggregateNeighbourhoodStats } from "../lib/census/aggregateNeighbourhoodStats";
import { extract2016Population } from "../lib/census/extract2016Population";
import { extract2021BcDaPopulation } from "../lib/census/extract2021BcDaPopulation";
import { loadBoundaries } from "../lib/census/loadBoundaries";
import { loadNeighbourhoods } from "../lib/census/loadNeighbourhoods";
import { matchDaToNeighbourhood } from "../lib/census/matchDaToNeighbourhood";
import { upsertDaMatches } from "../lib/census/upsertDaMatches";
import { upsertNeighbourhoodStats } from "../lib/census/upsertNeighbourhoodStats";

const DATA_DIR = path.join(process.cwd(), "data", "census");

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
const neighbourhoods = await loadNeighbourhoods();

const firstDaGeometry = daBoundaries.features?.[0]?.geometry;
const firstAreaGeojson = neighbourhoods?.[0]?.polygon_geojson;

console.log("First DA geometry type:", firstDaGeometry?.type ?? null);

console.log(
  "First DA coord pair:",
  JSON.stringify(
    firstDaGeometry?.type === "Polygon"
      ? firstDaGeometry.coordinates?.[0]?.[0]
      : firstDaGeometry?.type === "MultiPolygon"
        ? firstDaGeometry.coordinates?.[0]?.[0]?.[0]
        : null
  )
);

console.log("First neighbourhood geojson type:", firstAreaGeojson?.type ?? null);

console.log(
  "First neighbourhood coord pair:",
  JSON.stringify(
    firstAreaGeojson?.type === "Polygon"
      ? firstAreaGeojson.coordinates?.[0]?.[0]
      : firstAreaGeojson?.type === "MultiPolygon"
        ? firstAreaGeojson.coordinates?.[0]?.[0]?.[0]
        : firstAreaGeojson?.type === "Feature"
          ? firstAreaGeojson.geometry?.coordinates?.[0]?.[0]
          : null
  )
);

  console.log("2016 rows:", rows2016.length);
  console.log("2021 rows:", rows2021.length);
  console.log("DA boundaries:", daBoundaries.features?.length ?? 0);
  console.log("Neighbourhood polygons:", neighbourhoods?.length ?? 0);

  const { matches, unmatched } = matchDaToNeighbourhood(
    daBoundaries,
    neighbourhoods ?? []
  );

  console.log("Matched DAs:", matches.length);

  await upsertDaMatches(matches);


  console.log("Unmatched DAs:", unmatched.length);

  const aggregated = aggregateNeighbourhoodStats(
    matches,
    rows2016,
    rows2021
  );

  await upsertNeighbourhoodStats(aggregated);


}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});