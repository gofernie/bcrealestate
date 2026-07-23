import type { ListingFilters } from "./types";

function optionalNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function getListingFiltersFromUrl(
  url: URL
): ListingFilters {
  const params = url.searchParams;

  return {
    city: params.get("city") || undefined,

    type: params.get("type") || undefined,

    areas: params
      .getAll("area")
      .filter(Boolean),

    beds: optionalNumber(
      params.get("beds")
    ),

    baths: optionalNumber(
      params.get("baths")
    ),

    minPrice: optionalNumber(
      params.get("minPrice")
    ),

    maxPrice: optionalNumber(
      params.get("maxPrice")
    ),

    minSqft: optionalNumber(
      params.get("minSqft")
    ),

    maxSqft: optionalNumber(
      params.get("maxSqft")
    ),

    sort:
      (params.get("sort") ||
        "newest") as ListingFilters["sort"],

    page: Math.max(
      1,
      Number(
        params.get("page") || 1
      )
    ),

    pageSize: 24,
  };
}