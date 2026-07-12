import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async ({ url }) => {
  const city = url.searchParams.get("city") || "nanaimo";
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
const radius = Math.min(
  parseFloat(url.searchParams.get("radius") || "8"),
  15
);

const limit = Math.min(
  parseInt(url.searchParams.get("limit") || "80", 10),
  250
);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response(JSON.stringify({ categories: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

const { data, error } = await supabase
  .from("osm_amenities")
  .select("name, category, osm_type, lat, lng")
  .eq("city", city);

  if (error) {
    return new Response(JSON.stringify({ categories: {}, error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
function normalizeOsmImage(row: any) {
  const directImage = String(row.image || "").trim();

  if (
    directImage.startsWith("https://") ||
    directImage.startsWith("http://")
  ) {
    return directImage;
  }

  const commons = String(row.wikimedia_commons || "").trim();

  if (commons) {
    return `/api/commons-image?file=${encodeURIComponent(commons)}`;
  }

  const wikidata = String(row.wikidata || "").trim();

  if (wikidata) {
    return `/api/wikidata-image?id=${encodeURIComponent(wikidata)}`;
  }

  return "";
}
  const categories: Record<string, any[]> = {};

  for (const row of data || []) {
    const rowLat = Number(row.lat);
    const rowLng = Number(row.lng);

    if (!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) continue;

    const distKm = haversineKm(lat, lng, rowLat, rowLng);

    if (distKm > radius) continue;

    const rawCategory = String(row.category || "").toLowerCase();

    const normalizedCategory =
      rawCategory.includes("school")
        ? "school"
        : rawCategory.includes("grocery") || rawCategory.includes("shop")
          ? "grocery"
          : rawCategory.includes("restaurant") || rawCategory.includes("cafe") || rawCategory.includes("coffee")
            ? "restaurant"
            : rawCategory.includes("park")
              ? "park"
              : rawCategory.includes("medical") || rawCategory.includes("doctor") || rawCategory.includes("clinic") || rawCategory.includes("pharmacy")
                ? "medical"
                : rawCategory.includes("transit") || rawCategory.includes("bus")
                  ? "transit"
                  : rawCategory;

    if (!categories[normalizedCategory]) categories[normalizedCategory] = [];

 categories[normalizedCategory].push({
  ...row,
  category: normalizedCategory,
  distKm,
});
  }

  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => a.distKm - b.distKm);
    categories[cat] = categories[cat].slice(0, limit);
  }

  return new Response(JSON.stringify({ categories }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};