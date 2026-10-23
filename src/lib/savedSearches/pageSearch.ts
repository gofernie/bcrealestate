/**
 * Saved searches made from the site's search pages store the page URL and the
 * criteria the buyer saw. To match them we ask the site's own listing API with
 * the same parameters, so an alert always agrees with what the page showed.
 *
 * Plain process.env only: this file runs inside Netlify background functions.
 */

// Greater Victoria district keys, as used in listing_rows.normalized_city / listing_markets.city.
const REGION_DISTRICTS = [
  "victoria", "victoria-west", "saanich-east", "saanich-west", "oak-bay", "esquimalt",
  "view-royal", "colwood", "langford", "highlands", "metchosin", "sooke",
  "central-saanich", "north-saanich", "sidney",
];
const slug = (value: unknown) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const REGION_CITY = "greater-victoria";

/** True when a refreshed market city is part of Greater Victoria. */
export function isRegionDistrict(city: unknown) {
  const s = slug(city);
  return s === "saanich" || REGION_DISTRICTS.includes(s);
}

export function isPageSearch(filters: any) {
  return Boolean(filters && (filters.url || filters.criteria));
}

const PASS_THROUGH = [
  "type", "area", "areas", "areaBufferKm", "minPrice", "maxPrice", "beds", "baths", "minSqft",
  "minLotSqft", "minYear", "primaryOnMain", "threeSameFloor", "fourSameFloor", "oceanViews",
  "viewType", "waterfrontType", "age55", "otherPark", "petsAllowed", "planMode", "district",
];

/** Turn a saved page search into /api/home-listings parameters. */
export function apiParamsFor(savedSearch: { city: string; filters: any }) {
  const filters = savedSearch.filters || {};
  const criteria = filters.criteria || {};
  const out = new URLSearchParams();
  let page: URL | null = null;
  try { page = new URL(String(filters.url || criteria.url || "")); } catch { page = null; }

  if (page) {
    for (const key of PASS_THROUGH) for (const v of page.searchParams.getAll(key)) if (v) out.append(key, v);
    // The homepage uses ?price=<band>; translate it like the page does.
    const band = page.searchParams.get("price");
    if (band && !out.has("minPrice") && !out.has("maxPrice")) applyBand(out, band);
  }

  // Fill anything the URL didn't carry from what the buyer saw (search pages keep filters in page config).
  const fill = (key: string, value: unknown) => {
    const v = String(value ?? "").trim();
    if (v && v !== "all" && v !== "false" && !out.has(key)) out.set(key, v);
  };
  fill("type", criteria.propertyType);
  if (!out.has("area") && !out.has("areas")) {
    const areas = Array.isArray(criteria.area) ? criteria.area.filter(Boolean) : String(criteria.area || "").split("|").filter(Boolean);
    if (areas.length > 1) out.set("areas", areas.join("|"));
    else if (areas.length === 1) out.set("area", areas[0]);
  }
  if (!out.has("minPrice") && !out.has("maxPrice") && criteria.price) applyBand(out, String(criteria.price));
  fill("beds", criteria.beds);
  fill("baths", criteria.baths);
  fill("minSqft", criteria.minSqft);
  fill("minLotSqft", criteria.minLotSqft);
  fill("minYear", criteria.minYear);
  fill("viewType", criteria.viewType);
  fill("waterfrontType", criteria.waterfrontType);
  if (criteria.primaryOnMain === true) fill("primaryOnMain", "true");
  if (criteria.threeSameFloor === true) fill("threeSameFloor", "true");
  if (criteria.fourSameFloor === true) fill("fourSameFloor", "true");

  // Multiple ?area= values go to the API as areas=a|b (same as the page).
  const areaList = out.getAll("area");
  if (areaList.length > 1) { out.delete("area"); out.set("areas", areaList.join("|")); }

  // Shared URLs express budgets in thousands; the listing API uses dollars.
  for (const key of ["minPrice", "maxPrice"]) {
    const amount = Number(out.get(key) || 0);
    if (amount > 0 && amount < 20000) out.set(key, String(amount * 1000));
  }

  out.set("city", slug(savedSearch.city));
  out.set("sort", "newest");
  out.set("markers", "0");
  return out;
}

// Price bands from the homepage ("700", "over-900") and type/area pages ("under-700", "450-650", "650-plus"), in thousands.
function applyBand(out: URLSearchParams, band: string) {
  const b = String(band || "").trim().toLowerCase();
  let m;
  if ((m = b.match(/^under-(\d+)$/))) out.set("maxPrice", m[1]);
  else if ((m = b.match(/^over-(\d+)$/)) || (m = b.match(/^(\d+)-plus$/))) out.set("minPrice", m[1]);
  else if ((m = b.match(/^(\d+)-(\d+)$/))) { out.set("minPrice", m[1]); out.set("maxPrice", m[2]); }
  else if (/^\d+$/.test(b) && b !== "0") out.set("maxPrice", b);
}

/**
 * Listings the saved search matches right now, newest first.
 * `pages` limits how far down we read: discovery only needs the newest listings,
 * the baseline reads everything.
 */
export async function pageSearchMatches(
  savedSearch: { city: string; filters: any },
  origin: string,
  pages = Infinity
) {
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_SITE_URL is not set, so saved page searches can't be matched");
  const params = apiParamsFor(savedSearch);
  const found: { mls_number: string }[] = [];
  const seen = new Set<string>();
  for (let page = 0, offset = 0; page < pages; page++, offset += 48) {
    params.set("limit", "48");
    params.set("offset", String(offset));
    const res = await fetch(`${base}/api/home-listings?${params}`, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Listing API ${res.status} for ${params}`);
    const body: any = await res.json();
    for (const l of body.listings || []) {
      const mls = String(l.mls || "").trim();
      if (mls && !seen.has(mls)) { seen.add(mls); found.push({ mls_number: mls }); }
    }
    const total = Number(body.total || 0);
    if (!(body.listings || []).length || offset + 48 >= total) break;
  }
  return found;
}
