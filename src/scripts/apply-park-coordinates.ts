import {
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";

type CoordinateRecord = {
  slug: string;
  lat: number | null;
  lng: number | null;
};

const projectRoot = process.cwd();

const coordinatesPath = path.join(
  projectRoot,
  "nanaimo-park-coordinates.json"
);

// Change this only if your parks page lives elsewhere.
const parksPagePath = path.join(
  projectRoot,
  "src",
  "pages",
  "park-directory",
  "index.astro"
);

const backupPath = `${parksPagePath}.backup`;

async function main() {
  const coordinatesText = await readFile(
    coordinatesPath,
    "utf8"
  );

  const coordinates =
    JSON.parse(coordinatesText) as CoordinateRecord[];

  let page = await readFile(parksPagePath, "utf8");

  await copyFile(parksPagePath, backupPath);

  let updatedCount = 0;
  const missing: string[] = [];

  for (const park of coordinates) {
    if (
      park.lat === null ||
      park.lng === null
    ) {
      missing.push(park.slug);
      continue;
    }

    const escapedSlug = park.slug.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    /*
     * Finds:
     *
     * slug: "cedar-ridge",
     * address: "...",
     *
     * It also removes existing lat/lng values before
     * inserting the latest coordinates.
     */
    const parkPattern = new RegExp(
      `(slug:\\s*["']${escapedSlug}["'],\\s*\\r?\\n` +
        `\\s*address:\\s*["'][^"'\\r\\n]+["'],)` +
        `(?:\\s*\\r?\\n\\s*lat:\\s*-?\\d+(?:\\.\\d+)?,` +
        `\\s*\\r?\\n\\s*lng:\\s*-?\\d+(?:\\.\\d+)?,)?`
    );

    if (!parkPattern.test(page)) {
      console.warn(
        `Could not find park object for: ${park.slug}`
      );
      missing.push(park.slug);
      continue;
    }

    page = page.replace(
      parkPattern,
      `$1\n    lat: ${park.lat},\n    lng: ${park.lng},`
    );

    updatedCount += 1;
  }

  await writeFile(parksPagePath, page, "utf8");

  console.log(
    `Updated ${updatedCount} park records.`
  );

  console.log(`Backup created at:\n${backupPath}`);

  if (missing.length) {
    console.log(
      `\nNot updated:\n${missing.join("\n")}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});