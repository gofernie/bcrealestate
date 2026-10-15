import fs from "node:fs";
import path from "node:path";

const CITY = "duncan";
const WRITE = process.argv.includes("--write");
const ENV_PATH = path.resolve(".env");
const REVIEW_PATH = path.resolve("duncan-neighbourhood-copy-review.md");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(".env was not found.");

  for (const rawLine of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openAiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
  throw new Error(
    "Missing PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY in .env."
  );
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

type IntentPage = {
  id: string;
  area: string;
  slug: string;
  neighbourhood_copy: string | null;
};

type CensusRow = {
  neighbourhood: string;
  population_2016: number | null;
  population_2021: number | null;
  pop_change_pct: number | null;
};

async function supabaseGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, { headers });
  if (!response.ok) throw new Error(`Supabase read failed: ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function generateCopy(area: string, census: CensusRow) {
  const populationLine =
    census.population_2021 && census.pop_change_pct !== null
      ? `2021 population: ${census.population_2021.toLocaleString()}; population change since 2016: ${census.pop_change_pct > 0 ? "+" : ""}${census.pop_change_pct}%.`
      : "No population data is available.";

  const prompt = `Write neighbourhood overview copy for a real-estate search page.

Area: ${area}, in the Duncan / Cowichan region of British Columbia.
Verified data: ${populationLine}

Return exactly two concise paragraphs (100–145 words total), with no heading, bullets, citations, sales pitch, or markdown.
Make it useful to someone deciding whether to browse homes here.
Use clear, neutral Canadian real-estate language.
You may describe the area's broad character only where commonly established, but do not invent amenities, schools, commute times, businesses, trails, views, prices, market trends, or lifestyle claims.
Work the verified population context in naturally if it helps. Avoid phrases such as "nestled," "vibrant," "perfect," "dream home," and "something for everyone."`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      temperature: 0.55,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI failed for ${area}: ${await response.text()}`);

  const data = await response.json() as { output_text?: string };
  const copy = data.output_text?.trim();

  if (!copy) throw new Error(`OpenAI returned no usable copy for ${area}.`);
  return copy;
}

async function main() {
  const pages = await supabaseGet<IntentPage[]>(
    `intent_pages?select=id,area,slug,neighbourhood_copy&city=eq.${CITY}&site_id=is.null&area=not.is.null&order=area.asc`
  );

  const censusRows = await supabaseGet<CensusRow[]>(
    `neighbourhood_census_data?select=neighbourhood,population_2016,population_2021,pop_change_pct&city=eq.${CITY}`
  );

  const censusByName = new Map(
    censusRows.map((row) => [row.neighbourhood.trim().toLowerCase(), row])
  );

  const targets = pages.filter((page) => {
    const hasCopy = Boolean(page.neighbourhood_copy?.trim());
    const hasCensus = censusByName.has(page.area.trim().toLowerCase());
    return !hasCopy && hasCensus;
  });

  if (!targets.length) {
    console.log("No blank Duncan neighbourhood_copy rows with census data were found.");
    return;
  }

  console.log(`Drafting ${targets.length} Duncan areas. Write mode: ${WRITE ? "ON" : "OFF"}.`);

  const drafts: Array<{ page: IntentPage; copy: string }> = [];

  for (const page of targets) {
    const census = censusByName.get(page.area.trim().toLowerCase())!;
    console.log(`Generating: ${page.area}`);
    const copy = await generateCopy(page.area, census);
    drafts.push({ page, copy });
  }

  const review = [
    "# Duncan neighbourhood-copy review",
    "",
    `Generated ${new Date().toLocaleString("en-CA")}.`,
    WRITE
      ? "These drafts were also written to Supabase."
      : "Preview only — nothing has been written to Supabase.",
    "",
    ...drafts.flatMap(({ page, copy }) => [
      `## ${page.area} — /${CITY}/${page.slug}`,
      "",
      copy,
      "",
    ]),
  ].join("\n");

  fs.writeFileSync(REVIEW_PATH, review, "utf8");
  console.log(`Review saved: ${REVIEW_PATH}`);

  if (!WRITE) {
    console.log("Preview complete. Review it, then rerun with --write to update Supabase.");
    return;
  }

  for (const { page, copy } of drafts) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/intent_pages?id=eq.${page.id}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ neighbourhood_copy: copy }),
      }
    );

    if (!response.ok) {
      throw new Error(`Could not update ${page.area}: ${await response.text()}`);
    }
    console.log(`Updated: ${page.area}`);
  }

  console.log(`Done. Updated ${drafts.length} Duncan neighbourhood pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
