import type { ListingFilters } from "./types";

function optionalNumber(
  value: string | null
): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function optionalBoolean(
  value: string | null
): boolean {
  return (
    value === "1" ||
    value === "true"
  );
}

export function getListingFiltersFromUrl(
  url: URL
): ListingFilters {
  const params =
    url.searchParams;

  return {
    city:
      params.get("city") ||
      undefined,

    type:
      params.get("type") ||
      undefined,

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

    primaryOnMain:
      optionalBoolean(
        params.get(
          "primaryOnMain"
        )
      ),

    bedsTogether:
  optionalBoolean(
    params.get(
      "bedsTogether"
    )
  ),
fourBedsTogether:
  optionalBoolean(
    params.get(
      "fourBedsTogether"
    )
  ),

hasFloorplan:
  optionalBoolean(
    params.get(
      "hasFloorplan"
    )
  ),

hasUpdatedKitchen:
  optionalBoolean(
    params.get(
      "hasUpdatedKitchen"
    )
  ),

hasDetachedShop:
  optionalBoolean(
    params.get(
      "hasDetachedShop"
    )
  ),

    sort:
      (
        params.get("sort") ||
        "newest"
      ) as ListingFilters["sort"],

    page: Math.max(
      1,
      Number(
        params.get("page") ||
          1
      )
    ),

    pageSize: 24,
  };
}