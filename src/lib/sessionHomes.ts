export const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
};

export function normalizeImageUrl(value: unknown) {
  const image = String(value || "").trim();
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/vreb/")) return `https://cdn.repliers.io${image}?class=medium`;
  return image;
}

export function mapListing(r: any) {
  const imgRaw = r.image_url ?? r.photo_url ?? r.primary_photo ?? (Array.isArray(r.images) ? r.images[0] : null) ?? (Array.isArray(r.photos) ? r.photos[0] : null);
  return {
    id: String(r.id ?? ""),
    mls: String(r.mls_number ?? r.mls ?? r.mls_id ?? r.listing_id ?? r.id ?? "").trim(),
    address: String(r.address ?? r.street_address ?? r.full_address ?? r.unparsed_address ?? "").trim(),
    price: num(r.price ?? r.list_price),
    beds: num(r.beds ?? r.bedrooms),
    baths: num(r.baths ?? r.bathrooms),
    sqft: num(r.sqft ?? r.square_feet ?? r.living_area),
    type: String(r.normalized_type ?? r.property_type ?? "").trim(),
    area: String(r.area ?? r.normalized_area ?? r.neighbourhood ?? r.subdivision ?? "").trim(),
    city: String(r.normalized_city ?? r.city ?? "").trim(),
    image: normalizeImageUrl(imgRaw),
    listedAt: r.listed_at ?? r.created_at ?? null,
  };
}

export const fmtPrice = (p: number | null) => (p ? "$" + Math.round(p).toLocaleString("en-CA") : "");

export function listingUrl(base: string, city: string, mls: string, sid: string) {
  const c = String(city || "").toLowerCase().trim().replace(/\s+/g, "-");
  return `${base}/${c}/homes?mls=${encodeURIComponent(mls)}&lsid=${encodeURIComponent(sid)}`;
}

export async function siteBase(supabase: any, siteId?: string | null) {
  if (!siteId) return "https://bc.realestate";
  const { data } = await supabase.from("sites").select("domain").eq("id", siteId).maybeSingle();
  const d = String(data?.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return d ? `https://${d}` : "https://bc.realestate";
}