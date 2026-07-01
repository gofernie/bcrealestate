import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_DIR = path.join(process.cwd(), "data", "census");

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
  const rows2016 = readCsv(path.join(DATA_DIR, "bc_da_2016.csv"));
  const rows2021 = readCsv(path.join(DATA_DIR, "bc_da_2021.csv"));

  console.log("2016 rows:", rows2016.length);
  console.log("2021 rows:", rows2021.length);

  console.log("Next step: add DA boundary polygon matching.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});