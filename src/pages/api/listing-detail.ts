import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const listingId = String(url.searchParams.get("id") || "").trim();
  const listingMls = String(
    url.searchParams.get("mls") || ""
  ).trim();

  const candidateListingIds = Array.from(
    new Set(
      [listingId, listingMls].filter(Boolean)
    )
  );

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

  const listingResult =
    await supabase
      .from("listing_rows")
      .select("*")
      .or(
        `id.eq.${listingId},mls_number.eq.${listingId}`
      )
      .limit(1)
      .maybeSingle();

  // listing_floorplans.listing_id stores listing_rows.id, not MLS number.
  // Passing an MLS into this UUID lookup can make the whole query fail.
  const canonicalListingId = String(
    listingResult.data?.id || ""
  ).trim();

  const detailListingIds = canonicalListingId
    ? [canonicalListingId]
    : [];const [floorplanResult, roomResult] =
    await Promise.all([
      supabase
        .from("listing_floorplans")
        .select("listing_id,image_url")
        .in("listing_id", detailListingIds),

      supabase
        .from("listing_rooms")
        .select("*")
        .in("listing_id", detailListingIds),
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
      listing: listingResult.data || null,
      images: Array.isArray(listingResult.data?.images)
        ? listingResult.data.images
        : [],
      floorplans,
      rooms: (roomResult.data || []).map((room) => ({
        ...room,
        label:
          room.label ||
          room.room_label ||
          room.room_type ||
          "Room",
      })),
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
