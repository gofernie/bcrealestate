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

/** Count active listings that match an intent page's filters. Mirrors RelatedIntentCards. */
export function countIntentListings(intent: any, inventory: any[]): number {
  let matching = Array.isArray(inventory) ? [...inventory] : [];
  const type = normalise(intent.property_type);
  const area = normalise(intent.area);
  if (type) matching = matching.filter((l) => matchesType(l, type));
  if (area) matching = matching.filter((l) => normalise(l.normalized_area || l.area) === area);

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