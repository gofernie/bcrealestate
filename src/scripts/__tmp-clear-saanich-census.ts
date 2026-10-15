import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await db
  .from("neighbourhood_census_data")
  .update({ population_2021: null, pop_change_pct: null })
  .in("city", ["saanich east", "saanich west"])
  .eq("population_2021", 0)
  .eq("pop_change_pct", -100)
  .select("city,slug");

if (error) throw error;
console.log(`Cleared ${data.length} invalid 2021 results. Preserved 2016 populations.`);
