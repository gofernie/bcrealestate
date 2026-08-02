import "dotenv/config";

import {
  scanNewFloorplans,
} from "../lib/floorplans/scanFloorplans";

const limit = Number(
  process.argv[2] || 3
);

const city = String(
  process.argv[3] || "nanaimo"
)
  .trim()
  .toLowerCase();

if (
  !Number.isFinite(limit) ||
  limit < 1
) {
  throw new Error(
    "Limit must be a positive number"
  );
}

async function main() {
  console.log(
    `Scanning up to ${limit} new ${city} listings...\n`
  );

  const result =
    await scanNewFloorplans({
      city,
      limit,
    });

  console.log(
    "\nScan complete:"
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "Test scan failed:",
    error?.message || error
  );

  process.exit(1);
});