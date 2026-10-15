import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await db
  .from("area_boundaries")
  .select("city,area_slug,area_name")
  .ilike("city", "%saanich%")
  .order("city")
  .order("area_name");

if (error) throw error;
console.table(data);
