// Victoria West is carved out of Victoria by map boundary.
// Before a Victoria refresh: move Vic West rows back to "victoria" so sold ones get deactivated.
// After it: re-split active Victoria rows that fall inside the Vic West boundaries.
import type { SupabaseClient } from "@supabase/supabase-js";
import { booleanPointInPolygon } from "@turf/turf";

const TARGET = "victoria west";
const SOURCE = "victoria";

export async function mergeVictoriaWestIntoVictoria(db: SupabaseClient) {
  const { error, count } = await db
    .from("listing_rows")
    .update({ normalized_city: SOURCE }, { count: "exact" })
    .eq("normalized_city", TARGET)
    .eq("status", "A");
  if (error) throw error;
  return count ?? 0;
}

export async function assignVictoriaWest(db: SupabaseClient) {
  const { data: boundaries, error: boundaryError } = await db
    .from("area_boundaries")
    .select("area_slug, polygon_geojson")
    .eq("city", TARGET)
    .order("area_slug");
  if (boundaryError) throw boundaryError;
  if (!boundaries || !boundaries.length) {
    console.warn("No Victoria West boundaries found; skipping split");
    return { changed: 0, counts: {} };
  }

  const areas = boundaries.map((a: any) => ({
    slug: String(a.area_slug),
    geometry: typeof a.polygon_geojson === "string" ? JSON.parse(a.polygon_geojson) : a.polygon_geojson,
  }));

  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("listing_rows")
      .select("id, normalized_city, normalized_area, lat, lng")
      .in("normalized_city", [SOURCE, TARGET])
      .eq("status", "A")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }

  const counts: Record<string, number> = {};
  let changed = 0;
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const area = areas.find((a) => booleanPointInPolygon([lng, lat], a.geometry));
    if (!area) continue;
    const normalizedArea = area.slug.replace(/-/g, " ").toLowerCase();
    counts[area.slug] = (counts[area.slug] || 0) + 1;
    if (row.normalized_city === TARGET && row.normalized_area === normalizedArea) continue;
    const { error } = await db
      .from("listing_rows")
      .update({ normalized_city: TARGET, normalized_area: normalizedArea })
      .eq("id", row.id)
      .eq("status", "A");
    if (error) throw error;
    changed++;
  }
  return { changed, counts };
}
