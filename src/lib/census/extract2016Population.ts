import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function splitCsvLine(line: string) {
  return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
}

export async function extract2016Population() {
  const csvPath = path.join(
    process.cwd(),
    "data",
    "census",
    "raw",
    "2016",
    "profile",
   "98-401-X2016044_BRITISH_COLUMBIA_English_CSV_data.csv"
  );

  const populations = new Map<string, number>();

  const stream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const cols = splitCsvLine(line);

const daUid = cols[1]?.replaceAll('"', "");
const geoLevel = cols[2]?.replaceAll('"', "");
const characteristicId = cols[9]?.replaceAll('"', "");
const countTotal = cols[11]?.replaceAll('"', "").replaceAll(",", "");

if (geoLevel !== "4") continue;
if (characteristicId !== "1") continue;

populations.set(daUid, Number(countTotal || 0));
  }

  return [...populations.entries()].map(([da_uid, population]) => ({
    da_uid,
    population,
  }));
}