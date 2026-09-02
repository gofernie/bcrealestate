import type {
  SupabaseClient,
} from "@supabase/supabase-js";

type SavedSearch = {
  id: string;
  city: string;
  filters: Record<string, any>;
};

export async function findSavedSearchMatches(
  supabase: SupabaseClient,
  savedSearch: SavedSearch
) {
  const filters =
    savedSearch.filters || {};

  let query =
    supabase
      .from("listing_rows")
      .select(
        `
          id,
          mls_number,
          normalized_city,
          normalized_area,
normalized_type,
property_type,
beds,
          baths,
          price,
          sqft,
          primary_on_main,
          three_plus_beds_same_floor,
          four_plus_beds_same_floor,
          status
        `
      )
      .eq(
        "normalized_city",
        savedSearch.city
      )
      .eq("status", "A");

if (filters.type) {
  query =
    query.eq(
      "normalized_type",
      String(
        filters.type
      ).toLowerCase()
    );
}

  if (filters.area) {
    const areas =
      Array.isArray(filters.area)
        ? filters.area
        : [filters.area];

    const normalizedAreas =
      areas.map(
        (area: string) =>
          String(area)
            .replace(/-/g, " ")
            .toLowerCase()
            .trim()
      );

    query =
      query.in(
        "normalized_area",
        normalizedAreas
      );
  }

  if (filters.beds) {
    query =
      query.gte(
        "beds",
        Number(filters.beds)
      );
  }

  if (filters.baths) {
    query =
      query.gte(
        "baths",
        Number(filters.baths)
      );
  }

  if (filters.minPrice) {
    query =
      query.gte(
        "price",
        Number(filters.minPrice)
      );
  }

  if (filters.maxPrice) {
    query =
      query.lte(
        "price",
        Number(filters.maxPrice)
      );
  }

  if (filters.minSqft) {
    query =
      query.gte(
        "sqft",
        Number(filters.minSqft)
      );
  }

  if (filters.maxSqft) {
    query =
      query.lte(
        "sqft",
        Number(filters.maxSqft)
      );
  }

  if (
    filters.primaryOnMain ===
      "true" ||
    filters.primaryOnMain ===
      "1"
  ) {
    query =
      query.eq(
        "primary_on_main",
        true
      );
  }

  if (
    filters.bedsTogether ===
      "true" ||
    filters.bedsTogether ===
      "1"
  ) {
    query =
      query.eq(
        "three_plus_beds_same_floor",
        true
      );
  }

  if (
    filters.fourBedsTogether ===
      "true" ||
    filters.fourBedsTogether ===
      "1"
  ) {
    query =
      query.eq(
        "four_plus_beds_same_floor",
        true
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}