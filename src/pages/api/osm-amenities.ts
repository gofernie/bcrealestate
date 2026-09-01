import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )
  );
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const city = String(url.searchParams.get("city") || "nanaimo")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");

    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));

    const radius = Math.max(
      0.5,
      Math.min(Number(url.searchParams.get("radius") || 8), 20)
    );

    const maxDistKm = Math.max(
      0.5,
      Math.min(
        Number(url.searchParams.get("maxDistKm") || radius),
        radius
      )
    );

    const limit = Math.max(
      1,
      Math.min(Number(url.searchParams.get("limit") || 250), 500)
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(
        JSON.stringify({
          error: "Valid lat and lng are required",
          categories: {},
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const latitudeDelta = radius / 111;

    const longitudeDelta =
      radius /
      (
        111 *
        Math.max(
          Math.cos((lat * Math.PI) / 180),
          0.1
        )
      );
    const amenityRows: any[] = [];
    const pageSize = 1000;
    const maximumRows = 5000;

    for (let from = 0; from < maximumRows; from += pageSize) {
      const {
        data: batch = [],
        error,
      } = await supabase
        .from("osm_amenities")
        .select("*")
        .eq("city", city)
        .gte("lat", lat - latitudeDelta)
        .lte("lat", lat + latitudeDelta)
        .gte("lng", lng - longitudeDelta)
        .lte("lng", lng + longitudeDelta)
        .range(from, from + pageSize - 1);

      if (error) {
        throw error;
      }

      amenityRows.push(...(batch || []));

      if ((batch || []).length < pageSize) {
        break;
      }
    }

    const categories: Record<string, any[]> = {};

    for (const row of amenityRows || []) {
      const rowLat = Number(row.lat);
      const rowLng = Number(row.lng);

      if (
        !Number.isFinite(rowLat) ||
        !Number.isFinite(rowLng)
      ) {
        continue;
      }

      const distKm = haversineKm(
        lat,
        lng,
        rowLat,
        rowLng
      );

      if (distKm > maxDistKm) continue;

      const category = String(row.category || "")
        .toLowerCase()
        .trim();

      if (!category) continue;

      if (!categories[category]) {
        categories[category] = [];
      }

      categories[category].push({
        ...row,
        lat: rowLat,
        lng: rowLng,
        distKm,
      });
    }

    for (const items of Object.values(categories)) {
      items.sort(
        (a: any, b: any) =>
          Number(a.distKm || 0) - Number(b.distKm || 0)
      );
    }

    return new Response(
      JSON.stringify({
        city,
        lat,
        lng,
        radius,
        maxDistKm,
        count: Object.values(categories).reduce(
          (sum, items) => sum + items.length,
          0
        ),
        categories,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
        },
      }
    );
  } catch (error: any) {
    console.error("osm-amenities API error", error);

    return new Response(
      JSON.stringify({
        error: error?.message || "Could not load amenities",
        categories: {},
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};