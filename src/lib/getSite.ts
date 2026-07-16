import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const normalizeValue = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/-/g, " ")
    .trim();

const normalizeHost = (hostname: unknown) =>
  String(hostname || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .split(":")[0]
    .trim();

/**
 * Adds predictable, camelCase identity fields to a site record.
 *
 * The original Supabase columns remain available, so existing pages using
 * site.primary_city or site.site_type will continue to work.
 */
function enrichSite(site: any) {
  if (!site) return null;

  const siteType = normalizeValue(
    site.site_type || "general"
  );

  const homepageStyle = normalizeValue(
    site.homepage_style || "city"
  );

  const primaryCity = normalizeValue(
    site.primary_city ||
      site.city ||
      ""
  );

  const primaryType = normalizeValue(
    site.primary_type ||
      site.property_type_filter ||
      ""
  );

  const useRootHomepage =
    site.use_root_homepage === true;

  return {
    ...site,

    // Normalized identity
    siteType,
    homepageStyle,
    primaryCity,
    primaryType,
    useRootHomepage,

    // Convenient booleans
    isGeneralSite:
      siteType === "general",

    isPropertyTypeSite:
      siteType === "property_type" &&
      Boolean(primaryType),

    isFeatureSite:
      siteType === "feature",

    isAreaSite:
      siteType === "area",

    isLifestyleSite:
      siteType === "lifestyle",

    isLuxurySite:
      siteType === "luxury",

    isWaterfrontSite:
      siteType === "waterfront",

    // Homepage modes
    usesPropertyTypeHomepage:
      homepageStyle === "property_type",

    usesCityHomepage:
      homepageStyle === "city",

    usesFeatureHomepage:
      homepageStyle === "feature",

    usesAreaHomepage:
      homepageStyle === "area",

    usesNetworkHomepage:
      homepageStyle === "network",
  };
}

export async function getSite(
  hostname: string,
  city?: string
) {
  const host = normalizeHost(hostname);
  const cleanCity = normalizeValue(city);

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1";

  /*
   * 1. Exact custom-domain and city match.
   */
  if (cleanCity && !isLocal) {
    const {
      data: exactSite,
      error: exactError,
    } = await supabase
      .from("sites")
      .select("*")
      .or(
        `domain.eq.${host},domain.eq.www.${host}`
      )
      .eq("city", cleanCity)
      .limit(1)
      .maybeSingle();

    if (exactError) {
      console.error(
        "Exact site lookup failed:",
        exactError
      );
    }

    if (exactSite) {
      return enrichSite(exactSite);
    }
  }

  /*
   * 2. Use the saved city record.
   *
   * This allows routes such as bc.realestate/fernie
   * to inherit Fernie's saved branding.
   */
  if (cleanCity) {
    const {
      data: citySite,
      error: cityError,
    } = await supabase
      .from("sites")
      .select("*")
      .eq("city", cleanCity)
      .not("accent_color", "is", null)
      .limit(1)
      .maybeSingle();

    if (cityError) {
      console.error(
        "City site lookup failed:",
        cityError
      );
    }

    if (citySite) {
      return enrichSite(citySite);
    }
  }

  /*
   * 3. Custom-domain-only match.
   */
  if (!isLocal) {
    const {
      data: domainSite,
      error: domainError,
    } = await supabase
      .from("sites")
      .select("*")
      .or(
        `domain.eq.${host},domain.eq.www.${host}`
      )
      .limit(1)
      .maybeSingle();

    if (domainError) {
      console.error(
        "Domain site lookup failed:",
        domainError
      );
    }

    if (domainSite) {
      return enrichSite(domainSite);
    }
  }

  /*
   * 4. Final fallback to the requested city,
   * or Nanaimo.
   */
  const {
    data: fallback,
    error: fallbackError,
  } = await supabase
    .from("sites")
    .select("*")
    .eq(
      "city",
      cleanCity || "nanaimo"
    )
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    console.error(
      "Fallback site lookup failed:",
      fallbackError
    );
  }

  return enrichSite(fallback);
}

export async function getSiteMarkets(
  siteId: string
) {
  if (!siteId) return [];

  const { data, error } = await supabase
    .from("site_markets")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Market lookup failed:",
      error
    );

    return [];
  }

  return data ?? [];
}