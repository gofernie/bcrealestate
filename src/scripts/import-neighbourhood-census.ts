import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Add real 2016 neighbourhood population values here.
 * 2021 already exists in neighbourhood_census_data.population_2021.
 */
const population2016BySlug: Record<string, number> = {
  "brechin-hill": 0,
  "chase-river": 0,
  "departure-bay": 0,
  "hammond-bay": 0,
  "harewood": 0,
  "lantzville": 0,
  "north-nanaimo": 0,
  "old-city-quarter": 0,
  "south-nanaimo": 0,
  "university-district": 0,
};

async function run() {
  console.log("Importing neighbourhood census growth...");

  for (const [slug, population2016] of Object.entries(population2016BySlug)) {
    if (!population2016 || population2016 <= 0) {
      console.log(`Skipping ${slug}: missing 2016 population`);
      continue;
    }

    const { data: row, error: fetchError } = await supabase
      .from("neighbourhood_census_data")
      .select("id, slug, neighbourhood, population_2021")
      .eq("slug", slug)
      .maybeSingle();

    if (fetchError) {
      console.error(`Fetch error for ${slug}:`, fetchError.message);
      continue;
    }

    if (!row) {
      console.warn(`No row found for slug: ${slug}`);
      continue;
    }

    const population2021 = Number(row.population_2021 || 0);

    if (!population2021) {
      console.warn(`Missing 2021 population for ${slug}`);
      continue;
    }

    const popChangePct =
      Math.round(((population2021 - population2016) / population2016) * 1000) /
      10;

    const { error: updateError } = await supabase
      .from("neighbourhood_census_data")
      .update({
        population_2016: population2016,
        pop_change_pct: popChangePct,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error(`Update error for ${slug}:`, updateError.message);
      continue;
    }

    console.log(
      `Updated ${row.neighbourhood}: 2016=${population2016}, 2021=${population2021}, growth=${popChangePct}%`
    );
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});