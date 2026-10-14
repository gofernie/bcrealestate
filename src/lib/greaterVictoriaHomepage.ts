import { regionPolygons, regionSlug } from "./greaterVictoria";

// Adapt regional data to the existing city homepage's area selector and cards.
// Prefix neighbourhood keys with their district so identical names remain distinct.
export function greaterVictoriaHomepageBoundaries(region: any) {
  const geometryOf = (value: any) => {
    const polygons = regionPolygons(value);
    if (!polygons.length) return null;
    if (polygons.length === 1) return polygons[0].geometry;
    return {
      type: "MultiPolygon",
      coordinates: polygons.flatMap((feature: any) =>
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates
      ),
    };
  };

  return (region.districts || []).flatMap((district: any) => [
    {
      area_slug: district.slug,
      area_name: district.name,
      polygon_geojson: geometryOf(district.outline),
      __gvDistrict: district.slug,
      __gvCount: district.count,
      home_href: `/${district.slug}/`,
    },
    ...(district.areas || []).map((area: any) => {
      const originalSlug = regionSlug(area.area_slug || area.area_name);
      const prefix = `${district.slug}-`;
      return {
        ...area,
        area_slug: originalSlug.startsWith(prefix) ? originalSlug : `${prefix}${originalSlug}`,
        polygon_geojson: geometryOf(area.polygon_geojson ?? area.geometry),
        __gvDistrict: district.slug,
        __gvOriginalSlug: originalSlug,
        __gvCount: area.count || 0,
        home_href: `/${district.slug}/${originalSlug}`,
      };
    }),
  ]);
}

export function greaterVictoriaHomepageListing(normalized: any, raw: any = {}) {
  const usefulArea = String(normalized.area || "").trim();
  return {
    ...raw,
    id: normalized.id,
    mls_number: normalized.mls,
    price: normalized.rawPrice,
    address: normalized.address,
    image_url: normalized.image,
    images: normalized.images,
    beds: normalized.beds,
    baths: normalized.baths,
    sqft: normalized.sqft,
    year_built: normalized.year,
    lot_size: normalized.lotSize,
    description: normalized.description,
    normalized_type: normalized.type,
    normalized_city: normalized.city,
    normalized_area: usefulArea && usefulArea.toLowerCase() !== "unknown"
      ? usefulArea
      : normalized.districtLabel || "Greater Victoria",
    lat: normalized.lat,
    lng: normalized.lng,
    listing_brokerage: normalized.brokerage,
  };
}
