import fs from "node:fs";
import readline from "node:readline";

export async function extract2021BcDaPopulation(csvPath: string) {
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

    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

    const altGeoCode = cols[2]?.replaceAll('"', "");
    const geoLevel = cols[3]?.replaceAll('"', "");
    const characteristicId = cols[8]?.replaceAll('"', "");
    const countTotal = cols[11]?.replaceAll('"', "");

    if (geoLevel !== "Dissemination area") continue;
    if (characteristicId !== "1") continue;

    populations.set(altGeoCode, Number(countTotal || 0));
  }

  return populations;
}