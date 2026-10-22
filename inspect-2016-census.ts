import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import shp from "shpjs";

const root = process.cwd();
const zip = path.join(root, "data", "census", "raw", "2016", "boundaries", "lda_000a16a_e.zip");
const csvPath = path.join(root, "data", "census", "raw", "2016", "profile", "98-401-X2016044_BRITISH_COLUMBIA_English_CSV_data.csv");

const geojson = await shp(fs.readFileSync(zip));
const da = (geojson.features || []).find(
  (feature) => String(feature.properties?.PRUID) === "59"
);

console.log("2016 boundary properties:", da?.properties);

const lines = readline.createInterface({
  input: fs.createReadStream(csvPath),
  crlfDelay: Infinity,
});

let header;
for await (const line of lines) {
  const cols = line
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((value) => value.replaceAll('"', "").trim());

  if (!header) {
    header = cols;
    console.log("CSV header:", header);
    continue;
  }

  if (cols[2] === "4" && cols[8]?.startsWith("59") && cols[10] === "1") {
    console.log("2016 BC population row:", cols);
    break;
  }
}
