import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from("osm_amenities")
  .select("*")
  .eq("city", "nanaimo")
  .limit(1);

console.log(error || data);
