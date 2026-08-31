import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const listingId = String(url.searchParams.get("id") || "").trim();

  if (!listingId) {
    return new Response(
      JSON.stringify({
        error: "Missing listing id",
        images: [],
        floorplans: [],
        rooms: [],
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [floorplanResult, roomResult] = await Promise.all([
    supabase
      .from("listing_floorplans")
      .select("listing_id,image_url")
      .eq("listing_id", listingId),

    supabase
      .from("listing_rooms")
      .select("*")
      .eq("listing_id", listingId),
  ]);

  if (floorplanResult.error) {
    console.error(
      "listing-detail floorplan query failed:",
      floorplanResult.error
    );
  }

  if (roomResult.error) {
    console.error(
      "listing-detail room query failed:",
      roomResult.error
    );
  }

  const floorplans = (floorplanResult.data || [])
    .map((row) => row.image_url)
    .filter(Boolean);

  return new Response(
    JSON.stringify({
      images: [],
      floorplans,
      rooms: roomResult.data || [],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
      },
    }
  );
};