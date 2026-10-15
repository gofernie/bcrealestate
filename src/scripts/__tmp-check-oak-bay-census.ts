import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await db
  .from("neighbourhood_census_data")
  .select("city,slug,population_2021,pop_change_pct")
  .ilike("city", "%oak%");

if (error) throw error;
console.table(data);
