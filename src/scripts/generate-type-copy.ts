import "dotenv/config";
import { generateTypeCopy, listTypePageCities } from "../lib/copy/generateTypeCopy";

// Usage: npx tsx src/scripts/generate-type-copy.ts <city|all> [--dry] [--force]
const [city] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");
if (!city) throw new Error("Usage: npx tsx src/scripts/generate-type-copy.ts fernie [--dry] [--force]");
(async () => {
  const cities = city === "all" ? await listTypePageCities() : [city];
  for (const c of cities) await generateTypeCopy(c, { dry, force, verbose: true });
})().catch((e) => { console.error(e); process.exit(1); });
