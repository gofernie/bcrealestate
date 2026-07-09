import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function buildNeighbourhoodBrief({
  city,
  areaSlug,
}: {
  city: string;
  areaSlug: string;
}) {
  const { data: area } = await supabase
    .from("area_boundaries")
    .select("*")
    .eq("city", city)
    .eq("area_slug", areaSlug)
    .maybeSingle();

  const { data: census } = await supabase
    .from("neighbourhood_census_data")
    .select("*")
    .eq("city", String(city).toLowerCase())
    .eq("slug", String(areaSlug).toLowerCase())
    .maybeSingle();

  const { data: listings = [] } = await supabase
    .from("listing_rows")
    .select("price, normalized_type")
    .eq("status", "A")
    .eq("normalized_city", city)
    .or(
      `normalized_area.ilike.${area?.area_name || areaSlug},normalized_area.ilike.${String(
        areaSlug
      ).replace(/-/g, " ")}`
    );

const { data: amenities = [] } = await supabase
  .from("osm_amenities")
  .select("name, category, osm_type, lat, lng")
  .eq("city", String(city).toLowerCase())
  .eq("area", String(city).toLowerCase())
  .in("category", ["park", "restaurant", "grocery", "school"])
  .limit(80);

  const prices = listings
    .map((l) => Number(l.price || 0))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  const medianPrice = prices.length
    ? prices[Math.floor(prices.length / 2)]
    : null;

  const typeCounts = listings.reduce((acc, listing) => {
    const type = listing.normalized_type || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    place: {
      city,
      area: area?.area_name || areaSlug,
      slug: areaSlug,
      shortDescription: area?.short_description || null,
    },

    market: {
      homesForSale: listings.length,
      medianPrice,
      typeMix: typeCounts,
    },

    census: {
      population: census?.population_2021,
      populationChange: census?.pop_change_pct,
      medianHouseholdIncome: census?.median_household_income,
      medianAge: census?.median_age,
      ownerOccupied: census?.pct_owned,
    },

    amenities: {
      parks: amenities
        .filter((a) => a.category === "park")
        .slice(0, 5)
        .map((a) => a.name),

      cafes: amenities
        .filter((a) => a.osm_type === "cafe")
        .slice(0, 5)
        .map((a) => a.name),

      restaurants: amenities
        .filter((a) => a.category === "restaurant")
        .slice(0, 5)
        .map((a) => a.name),

      groceries: amenities
        .filter((a) => a.category === "grocery")
        .slice(0, 5)
        .map((a) => a.name),

      schools: amenities
        .filter((a) => a.category === "school")
        .slice(0, 5)
        .map((a) => a.name),
    },

    editorialHints: {
      useShortDescriptionAsPrimaryLocalContext: true,
      avoidInventingAmenities: true,
      writeLikeLocalGuide: true,
    },
  };
}