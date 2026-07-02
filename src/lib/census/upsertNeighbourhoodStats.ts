import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function upsertNeighbourhoodStats(rows: any[]) {
  if (!rows.length) {
    console.log("No neighbourhood stats to upsert.");
    return;
  }

  const payload = rows.map((row) => ({
    city: row.city,
    neighbourhood: row.area_name,
    slug: row.area_slug,
    population_2016: row.population_2016,
    population_2021: row.population_2021,
    pop_change_pct: row.pop_change_pct,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("neighbourhood_census_data")
    .upsert(payload, {
      onConflict: "city,neighbourhood",
    });

  if (error) throw error;

  console.log("Upserted neighbourhood stats:", payload.length);
}