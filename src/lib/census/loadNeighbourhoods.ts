import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function loadNeighbourhoods() {
  const { data, error } = await supabase
    .from("area_boundaries")
    .select("id, site_id, city, area_slug, area_name, polygon_geojson");

  if (error) throw error;

  return data ?? [];
}