import fs from "node:fs/promises";
import path from "node:path";

import {
  mobileHomeParks,
} from "../data/mobileHomeParks";

type GeocodeResult = {
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    formatted_address?: string;
  }>;
  status?: string;
  error_message?: string;
};

const apiKey =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.PUBLIC_GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing GOOGLE_MAPS_API_KEY or PUBLIC_GOOGLE_MAPS_API_KEY."
  );
}

const sourcePath = path.resolve(
  process.cwd(),
  "src/data/mobileHomeParks.ts"
);

const wait = (milliseconds: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

const geocodeAddress = async (
  address: string
): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
} | null> => {
  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: "ca",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `Geocoding request failed with HTTP ${response.status}`
    );
  }

  const data =
    (await response.json()) as GeocodeResult;

  if (
    data.status !== "OK" ||
    !data.results?.length
  ) {
    console.warn(
      `No result for "${address}":`,
      data.status,
      data.error_message || ""
    );

    return null;
  }

  const result = data.results[0];
  const location = result.geometry?.location;

  if (
    typeof location?.lat !== "number" ||
    typeof location?.lng !== "number"
  ) {
    return null;
  }

  return {
    lat: location.lat,
    lng: location.lng,
    formattedAddress:
      result.formatted_address || address,
  };
};

const replaceParkCoordinates = (
  source: string,
  slug: string,
  lat: number,
  lng: number
) => {
  const escapedSlug = slug.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const parkPattern = new RegExp(
    `(slug:\\s*"${escapedSlug}"[\\s\\S]*?lat:\\s*)(null|-?\\d+(?:\\.\\d+)?)(,\\s*\\n\\s*lng:\\s*)(null|-?\\d+(?:\\.\\d+)?)`,
    "m"
  );

  if (!parkPattern.test(source)) {
    console.warn(
      `Could not find coordinate fields for ${slug}`
    );

    return source;
  }

  return source.replace(
    parkPattern,
    `$1${lat}$3${lng}`
  );
};

const run = async () => {
  let source = await fs.readFile(
    sourcePath,
    "utf8"
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const park of mobileHomeParks) {
    if (
      typeof park.lat === "number" &&
      Number.isFinite(park.lat) &&
      typeof park.lng === "number" &&
      Number.isFinite(park.lng)
    ) {
      console.log(
        `Skipping ${park.name}: coordinates already exist.`
      );

      skipped += 1;
      continue;
    }

    const address =
      `${park.address}, ${park.city}, BC, Canada`;

    console.log(`Geocoding: ${address}`);

    try {
      const result =
        await geocodeAddress(address);

      if (!result) {
        failed += 1;
        continue;
      }

      source = replaceParkCoordinates(
        source,
        park.slug,
        result.lat,
        result.lng
      );

      console.log(
        `  ${result.lat}, ${result.lng}`
      );

      console.log(
        `  ${result.formattedAddress}`
      );

      updated += 1;

      // Avoid sending requests too quickly.
      await wait(150);
    } catch (error) {
      console.error(
        `Failed to geocode ${park.name}:`,
        error
      );

      failed += 1;
    }
  }

  const backupPath =
    `${sourcePath}.backup`;

  await fs.copyFile(
    sourcePath,
    backupPath
  );

  await fs.writeFile(
    sourcePath,
    source,
    "utf8"
  );

  console.log("");
  console.log("Finished.");
  console.log(`Updated: ${updated}`);
  console.log(`Already complete: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Backup: ${backupPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});