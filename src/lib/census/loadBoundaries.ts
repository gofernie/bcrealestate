import fs from "node:fs";
import path from "node:path";
import shp from "shpjs";

export async function loadBoundaries() {
  const shpZipPath = path.join(
    process.cwd(),
    "data",
    "census",
    "raw",
    "2021",
    "boundaries",
    "lda_000a21a_e.zip"
  );

  const shpZipBuffer = fs.readFileSync(shpZipPath);
  const rawDaBoundaries: any = await shp(shpZipBuffer);

  return {
    ...rawDaBoundaries,
    features: (rawDaBoundaries.features ?? []).filter(
      (feature: any) => String(feature.properties?.PRUID) === "59"
    ),
  };
}