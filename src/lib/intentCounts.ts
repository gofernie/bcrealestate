const normalise = (value: unknown) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const matchesType = (listing: any, wanted: string) => {
  const actual = normalise(listing.normalized_type || listing.property_type);
  if (wanted === "mobile") return ["mobile", "mobiles", "mobile-home", "mobile-homes", "manufactured", "manufactured-home", "manufactured-homes"].includes(actual);
  if (wanted === "house") return ["house", "homes", "houses"].includes(actual);
  if (wanted === "townhouse") return ["townhouse", "townhouses", "townhome", "townhomes"].includes(actual);
  if (wanted === "land") return ["land", "lot", "lots"].includes(actual);
  return actual === wanted;
};

/* polygon-count-v1: same "inside any shape" rule as the intent page */
export const polygonRings = (raw: unknown): any[][] => {
  let g: any = raw;
  if (typeof g === "string") { try { g = JSON.parse(g); } catch { return []; } }
  if (g?.type === "Feature") g = g.geometry;
  else if (g?.type === "FeatureCollection") g = g.features?.[0]?.geometry;
  if (!g?.coordinates) return [];
  if (g.type === "MultiPolygon") return g.coordinates.flat();
  if (g.type === "Polygon") return g.coordinates;
  return [];
};

export const inRing = (x: number, y: number, ring: any[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]), yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]), yj = Number(ring[j][1]);
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Count active listings that match an intent page's filters. Mirrors RelatedIntentCards. */
export function countIntentListings(intent: any, inventory: any[]): number {
  let matching = Array.isArray(inventory) ? [...inventory] : [];
  const types = String(intent.property_type || "").split(",").map(normalise).filter(Boolean);
  const area = normalise(intent.area);
  if (types.length) matching = matching.filter((l) => types.some((t) => matchesType(l, t)));
  if (area) matching = matching.filter((l) => normalise(l.normalized_area || l.area) === area);
  const rings = polygonRings(intent.polygon_geojson);
  if (rings.length) {
    matching = matching.filter((l) => {
      const lat = Number(l.lat ?? l.latitude);
      const lng = Number(l.lng ?? l.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && rings.some((ring) => inRing(lng, lat, ring));
    });
  }

  const signals = `${intent.slug || ""} ${intent.hero_heading || ""} ${intent.seo_heading || ""}`;
  const viewType = String(intent.view_type || "").trim().toLowerCase() || (/ocean\s+view/i.test(signals) ? "ocean" : "");
  if (viewType) {
    matching = matching.filter((l) => {
      const v = String(l.view_type || l.viewType || "").trim().toLowerCase();
      return viewType === "ocean" ? /\bocean\b/.test(v) : v.includes(viewType);
    });
  }

  const waterfrontType = String(intent.waterfront_type || "").trim().toLowerCase() || (/lakefront/i.test(signals) ? "lakefront" : "");
  if (waterfrontType) {
    matching = matching.filter((l) => String(l.waterfront_type || "").trim().toLowerCase() === waterfrontType);
  } else if (intent.requires_waterfront === true) {
    matching = matching.filter((l) => ["true", "yes", "y", "1"].includes(String(l.waterfront ?? "").trim().toLowerCase()));
  }
  /* counts-newfilters-v1: suite / main-level / year built / lot size */
  if (intent.requires_suite === true) matching = matching.filter((l) => l.has_suite === true);
  if (intent.primary_on_main === true) matching = matching.filter((l) => l.primary_on_main === true);
  if (Number(intent.min_year || 0) > 0) matching = matching.filter((l) => Number(l.year_built || 0) >= Number(intent.min_year));

  const num = (v: unknown) => Number(v || 0);
  const lotSqftOf = (l: any) => num(l.lot_size_sqft) || num(l.lot_size_acres) * 43560;
  if (num(intent.price_min)) matching = matching.filter((l) => num(l.price) >= num(intent.price_min));
  if (num(intent.price_max)) matching = matching.filter((l) => num(l.price) <= num(intent.price_max));
  if (num(intent.beds_min)) matching = matching.filter((l) => num(l.beds) >= num(intent.beds_min));
  if (num(intent.baths_min)) matching = matching.filter((l) => num(l.baths) >= num(intent.baths_min));
  if (num(intent.min_sqft)) matching = matching.filter((l) => num(l.sqft) >= num(intent.min_sqft));
  if (num(intent.min_lot_sqft)) matching = matching.filter((l) => lotSqftOf(l) >= num(intent.min_lot_sqft));
  if (num(intent.min_year)) matching = matching.filter((l) => num(l.year_built || l.year) >= num(intent.min_year));

  return matching.length;
}

export const insidePolygon = (l: any, rings: any[][]) => {
  const lat = Number(l.lat ?? l.latitude);
  const lng = Number(l.lng ?? l.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && rings.some((ring) => inRing(lng, lat, ring));
};