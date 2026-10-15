import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function upsertDaMatches(matches: any[]) {
  if (!matches.length) {
    console.log("No DA matches to upsert.");
    return;
  }

  const payload = matches.map((match) => ({
    city: match.city,
    area_slug: match.area_slug,
    da_uid: match.da_uid,
    match_method: match.match_method ?? "centroid",
    centroid_lat: match.centroid_lat ?? null,
    centroid_lng: match.centroid_lng ?? null,
    intersection_pct: match.intersection_pct ?? null,
  }));

  const { error } = await supabase
    .from("neighbourhood_da_matches")
    .upsert(payload, {
      onConflict: "city,area_slug,da_uid",
    });

  if (error) throw error;

  console.log("Upserted DA matches:", payload.length);
}