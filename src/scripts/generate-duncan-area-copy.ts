import fs from "node:fs";
import path from "node:path";

const CITY = "duncan";
const SITE_ID = "5e501142-4f44-4128-bc20-9360fcd49ebc";
const WRITE = process.argv.includes("--write");
const REVIEW_PATH = path.resolve("duncan-neighbourhood-copy-review.md");

for (const raw of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  const [, key, value] = match;
  if (!process.env[key]) process.env[key] = value.replace(/^['"]|['"]$/g, "");
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
  throw new Error("Missing Supabase or Anthropic credentials.");
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

type Boundary = { id: string; area_name: string; area_slug: string };
type Census = {
  neighbourhood: string;
  population_2016: number | null;
  population_2021: number | null;
  pop_change_pct: number | null;
};
type Override = {
  id: string;
  area_boundary_id: string;
  neighbourhood_copy: string | null;
};

async function get<T>(query: string): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

async function createCopy(area: string, census: Census) {
  const population =
    census.population_2021 && census.pop_change_pct !== null
      ? `Its 2021 population was ${census.population_2021.toLocaleString()}, a ${census.pop_change_pct >= 0 ? "+" : ""}${census.pop_change_pct}% change since 2016.`
      : "";

  const prompt = `Write exactly two concise paragraphs (100–145 words total) for a real-estate search page about ${area} in the Cowichan/Duncan region of British Columbia.

Verified fact: ${population}

Use plain, neutral Canadian real-estate language. Help a buyer understand the broad character of the area and why they might browse homes there. Do not invent amenities, schools, businesses, distances, commute times, views, prices, market trends, or specific lifestyle claims. No heading, markdown, bullets, citations, sales pitch, or filler. Avoid "nestled", "vibrant", "perfect", and "dream home".`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      temperature: 0.55,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic failed for ${area}: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const copy = result.content?.find((block) => block.type === "text")?.text?.trim();

  if (!copy) throw new Error(`No copy returned for ${area}.`);
  return copy;
}
async function main() {
  const [boundaries, censusRows, overrides] = await Promise.all([
    get<Boundary[]>(`area_boundaries?select=id,area_name,area_slug&city=eq.${CITY}&order=area_name.asc`),
    get<Census[]>(`neighbourhood_census_data?select=neighbourhood,population_2016,population_2021,pop_change_pct&city=eq.${CITY}`),
    get<Override[]>(`site_area_pages?select=id,area_boundary_id,neighbourhood_copy&site_id=eq.${SITE_ID}`),
  ]);

  const censusByName = new Map(censusRows.map((row) => [row.neighbourhood.trim().toLowerCase(), row]));
  const overrideByBoundary = new Map(overrides.map((row) => [row.area_boundary_id, row]));

  const targets = boundaries.filter((boundary) => {
    const override = overrideByBoundary.get(boundary.id);
    return censusByName.has(boundary.area_name.trim().toLowerCase()) &&
      !override?.neighbourhood_copy?.trim();
  });

  console.log(`Drafting ${targets.length} Duncan site-area pages. Write mode: ${WRITE ? "ON" : "OFF"}.`);

  const drafts: Array<{ boundary: Boundary; override?: Override; copy: string }> = [];

  for (const boundary of targets) {
    console.log(`Generating: ${boundary.area_name}`);
    const census = censusByName.get(boundary.area_name.trim().toLowerCase())!;
    drafts.push({
      boundary,
      override: overrideByBoundary.get(boundary.id),
      copy: await createCopy(boundary.area_name, census),
    });
  }

  fs.writeFileSync(
    REVIEW_PATH,
    [
      "# Duncan neighbourhood-copy review",
      "",
      WRITE ? "Written to site_area_pages." : "Preview only — nothing written.",
      "",
      ...drafts.flatMap(({ boundary, copy }) => [
        `## ${boundary.area_name} — /${CITY}/${boundary.area_slug}`,
        "",
        copy,
        "",
      ]),
    ].join("\n"),
    "utf8"
  );

  if (!WRITE) return console.log(`Review saved: ${REVIEW_PATH}`);

  for (const { boundary, override, copy } of drafts) {
    const endpoint = override
      ? `site_area_pages?id=eq.${override.id}`
      : "site_area_pages";

    const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      method: override ? "PATCH" : "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(
        override
          ? { neighbourhood_copy: copy, is_published: true }
          : {
              site_id: SITE_ID,
              area_boundary_id: boundary.id,
              neighbourhood_copy: copy,
              is_published: true,
            }
      ),
    });

    if (!response.ok) throw new Error(`Could not save ${boundary.area_name}: ${await response.text()}`);
    console.log(`Updated: ${boundary.area_name}`);
  }

  console.log(`Done. Updated ${drafts.length} Duncan area pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
