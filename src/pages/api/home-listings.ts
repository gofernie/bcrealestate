import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const normalizeImageUrl = (value: any) => {
  if (!value) return "";
  const raw =
    typeof value === "string"
      ? value
      : value.highRes || value.mediumRes || value.lowRes || value.url || value.src || value.href || value.path || "";
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleaned = raw.startsWith("/") ? raw : `/${raw}`;
  if (cleaned.startsWith("/vreb/") || cleaned.startsWith("/crea2/")) {
    return `https://cdn.repliers.io${cleaned}`;
  }
  return cleaned;
};

const formatAddress = (value: any): string => {
  if (!value) return "";
  let address = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) return trimmed;
    try {
      address = JSON.parse(trimmed);
    } catch {
      return "";
    }
  }
  if (!address || typeof address !== "object" || Array.isArray(address)) return "";
  return [
    address.streetNumber,
    address.streetName || address.streetAddress,
    address.streetSuffix,
    address.unitNumber ? `#${address.unitNumber}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
};

const listingImages = (listing: any) => {
  const rawImages = listing.images || listing.photo_urls || listing.photos || listing.raw?.images || [];
  const normalized = Array.isArray(rawImages)
    ? rawImages
        .map((image: any) =>
          normalizeImageUrl(
            typeof image === "string"
              ? image
              : image.highRes || image.mediumRes || image.lowRes || image.url || image.src || image.href || image.path
          )
        )
        .filter(Boolean)
    : [];
  const first = normalizeImageUrl(
    listing.image_url || listing.image || listing.photo || listing.images?.[0] || listing.raw?.images?.[0]
  );
  return Array.from(new Set([first, ...normalized].filter(Boolean)));
};

const normalizeListing = (listing: any) => {
  const rawPrice = Number(listing.price ?? listing.listPrice ?? listing.priceNumber ?? 0);
  const images = listingImages(listing);
  const address =
    formatAddress(listing.address) ||
    formatAddress(listing.full_address) ||
    listing.addressText ||
    listing.addressObj?.streetAddress ||
    "Address available";
  const beds = listing.beds || listing.bedrooms || listing.details?.numBedrooms || listing.raw?.details?.numBedrooms || 0;
  const baths = listing.baths || listing.bathrooms || listing.details?.numBathrooms || listing.raw?.details?.numBathrooms || 0;
  const type = String(
    listing.normalized_type || listing.property_type || listing.propertyType || listing.type || "Home"
  ).toLowerCase();

  return {
    id: String(listing.id || listing.mls_number || listing.mlsNumber || listing.repliers_listing_id || ""),
    mls: String(listing.mls_number || listing.mlsNumber || listing.id || "").replace(/[^0-9]/g, ""),
    price: rawPrice > 1000 ? `$${Math.round(rawPrice).toLocaleString()}` : listing.price_text || "Price on request",
    rawPrice,
    listedAt: String(listing.listed_at || listing.created_at || ""),
    address,
    image: images[0] || "",
    images,
    beds,
    primaryOnMain: listing.primary_on_main === true,
    threeBedsSameFloor: listing.three_plus_beds_same_floor === true,
    fourBedsSameFloor: listing.four_plus_beds_same_floor === true,
    baths,
    sqft: listing.sqft || listing.square_feet || listing.squareFeet || listing.details?.sqft || "",
    description:
      listing.description || listing.publicRemarks || listing.remarks || listing.details?.publicRemarks || listing.raw?.publicRemarks || "",
    propertyType: type.replace(/[_-]+/g, " ").replace(/\b\w/g, (character: string) => character.toUpperCase()),
    type,
    year: listing.year_built || listing.yearBuilt || listing.details?.yearBuilt || "",
    lotSize: listing.lot_size || listing.lotSize || listing.details?.lotSize || "",
    area:
      listing.normalized_area || listing.area || listing.neighborhood || listing.addressObj?.neighborhood || listing.details?.area || "",
    oceanView: String(listing.ocean_view || ""),
    viewType: String(listing.view_type || ""),
    waterfront: String(listing.waterfront || ""),
    waterfrontType: String(listing.waterfront_type || ""),
    lat: listing.lat || "",
    lng: listing.lng || "",
    city: String(listing.normalized_city || listing.city || ""),
  };
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const city = String(url.searchParams.get("city") || "nanaimo").trim().toLowerCase();
  const id = String(url.searchParams.get("id") || "").trim();
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit") || 24)));
  const area = String(url.searchParams.get("area") || "").trim().toLowerCase();
  const areas = String(url.searchParams.get("areas") || "")
    .split("|")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
  const minPrice = Number(url.searchParams.get("minPrice") || 0);
  const maxPrice = Number(url.searchParams.get("maxPrice") || 0);
  const beds = Number(url.searchParams.get("beds") || 0);
  const baths = Number(url.searchParams.get("baths") || 0);
  const minSqft = Number(url.searchParams.get("minSqft") || 0);
  const minYear = Number(url.searchParams.get("minYear") || 0);
  const primaryOnMain =
    url.searchParams.get("primaryOnMain") === "true";
  const threeSameFloor =
    url.searchParams.get("threeSameFloor") === "true";
  const fourSameFloor =
    url.searchParams.get("fourSameFloor") === "true";
  // view-type-api-filter-v1
  const viewType = String(
    url.searchParams.get("viewType") || ""
  )
    .trim()
    .toLowerCase();

  const waterfrontType = String(
    url.searchParams.get("waterfrontType") ||
    (url.searchParams.get("waterfront") === "true" ? "any" : "")
  )
    .trim()
    .toLowerCase();  const planMode = String(url.searchParams.get("planMode") || "").trim().toLowerCase();
  const sort = String(url.searchParams.get("sort") || "newest");
  const oceanViews = url.searchParams.get("oceanViews") === "true";

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let query = supabase
    .from("listing_rows")
    .select("*")
    .eq("status", "A")
    .eq("normalized_city", city)
    .limit(1000);

  const { data, error } = await query;
  if (error) {
    console.error("home-listings query failed:", error);
    return new Response(JSON.stringify({ error: error.message, listings: [], markers: [], total: 0 }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let listings = (data || []).map(normalizeListing).filter((listing) => {
    const searchable = `${listing.type} ${listing.propertyType} ${listing.description}`.toLowerCase();
    const commercial = /\b(lease|commercial|business|industrial|retail|office)\b/i.test(searchable);
    if (commercial || (listing.rawPrice > 0 && listing.rawPrice < 50000)) return false;
    if (id && listing.id !== id && listing.mls !== id) return false;
    if (areas.length && !areas.some((value) => String(listing.area).toLowerCase().includes(value))) return false;
    if (!areas.length && area && !String(listing.area).toLowerCase().includes(area)) return false;
    if (type) {
      const listingType = listing.type;

      const landSignalText =
        `${listing.address} ${listing.propertyType} ${listing.description}`
          .trim()
          .toLowerCase();

      const looksLikeLand =
        listingType === "land" ||
        /^\s*(lot|lt)\b/i.test(listing.address) ||
        /\b(vacant land|bare land|building lot|residential lot|development lot|land only|lot for sale)\b/i.test(landSignalText) ||
        /\b(vacant|bare|building|residential|serviced)\s+lot\b/i.test(landSignalText);

      const matches =
        (
          type === "house" &&
          listingType === "house" &&
          !looksLikeLand
        ) ||
        (type === "condo" && listingType === "condo") ||
        (
          type === "townhouse" &&
          ["townhouse", "townhome"].includes(listingType)
        ) ||
        (type === "mobile" && listingType === "mobile") ||
        (type === "land" && looksLikeLand) ||
        (
          type === "multi-family" &&
          ["multi-family", "multifamily"].includes(listingType)
        );

      if (!matches) return false;
    }
    if (minPrice && listing.rawPrice < minPrice) return false;
    if (maxPrice && listing.rawPrice > maxPrice) return false;
    if (beds && Number(listing.beds || 0) < beds) return false;
    if (baths && Number(listing.baths || 0) < baths) return false;
    if (minSqft && Number(listing.sqft || 0) < minSqft) return false;
    if (minYear && Number(listing.year || 0) < minYear) return false;
    if (primaryOnMain && !listing.primaryOnMain) return false;
    if (threeSameFloor && !listing.threeBedsSameFloor) return false;
    if (fourSameFloor && !listing.fourBedsSameFloor) return false;
    if (planMode === "primary-on-main" && !listing.primaryOnMain) return false;
    if (planMode === "three-same-floor" && !listing.threeBedsSameFloor) return false;
    if (planMode === "four-same-floor" && !listing.fourBedsSameFloor) return false;
    if (oceanViews) {
      const viewText = `${listing.description} ${listing.oceanView} ${listing.viewType} ${listing.waterfront}`.toLowerCase();
      if (!/(ocean view|ocean views|sea view|water view|ocean)/i.test(viewText)) return false;
    }
    if (viewType) {
      const viewAliases: Record<string, string> = {
        mountain: "mountain",
        "mountain view": "mountain",
        "mountain views": "mountain",
        "mountain(s)": "mountain",
        ocean: "ocean",
        "ocean view": "ocean",
        "ocean views": "ocean",
        sea: "ocean",
        "sea view": "ocean",
        valley: "valley",
        "valley view": "valley",
        lake: "lake",
        "lake view": "lake",
        river: "river",
        "river view": "river",
        city: "city",
        "city view": "city",
        panoramic: "panoramic",
        "panoramic view": "panoramic",
        "view (panoramic)": "panoramic",
      };

      const listingViewTypes = String(
        listing.viewType || ""
      )
        .split(/[,;/|]+/)
        .map((value) =>
          value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ")
        )
        .map((value) => viewAliases[value] || value)
        .filter(Boolean);

      if (!listingViewTypes.includes(viewType)) {
        return false;
      }
    }

    if (waterfrontType) {
      const hasWaterfront =
        ["true", "yes", "y", "1"].includes(
          String(listing.waterfront || "")
            .trim()
            .toLowerCase()
        );

      if (!hasWaterfront) return false;

      if (
        waterfrontType !== "any" &&
        String(listing.waterfrontType || "")
          .trim()
          .toLowerCase() !== waterfrontType
      ) {
        return false;
      }
    }
    return true;
  });

  if (sort === "price-low") listings.sort((a, b) => a.rawPrice - b.rawPrice);
  else if (sort === "price-high") listings.sort((a, b) => b.rawPrice - a.rawPrice);
  else listings.sort((a, b) => new Date(b.listedAt || 0).getTime() - new Date(a.listedAt || 0).getTime());

  const total = listings.length;
  const markers = listings
    .filter((listing) => listing.lat && listing.lng)
    .map(({ id, image, beds, baths, price, address, lat, lng }) => ({ id, image, beds, baths, price, address, lat, lng }));
  const page = listings.slice(offset, offset + limit);

  return new Response(JSON.stringify({ listings: page, markers, total, offset, limit }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
    },
  });
};
