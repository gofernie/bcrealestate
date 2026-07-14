import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getSite(hostname: string, city?: string) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .split(":")[0];

  const cleanCity = String(city || "")
    .toLowerCase()
    .replace(/-/g, " ")
    .trim();

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1";

  // 1. Try an exact domain + city match first.
  if (cleanCity && !isLocal) {
    const { data: exactSite, error: exactError } = await supabase
      .from("sites")
      .select("*")
      .or(`domain.eq.${host},domain.eq.www.${host}`)
      .eq("city", cleanCity)
      .limit(1)
      .maybeSingle();

    if (exactError) {
      console.error("Exact site lookup failed:", exactError);
    }

    if (exactSite) {
      return exactSite;
    }
  }

  // 2. Fall back to the saved site record for the requested city.
  // This lets bc.realestate/fernie use Fernie's saved accent colour,
  // even if Fernie's site record uses another domain.
  if (cleanCity) {
    const { data: citySite, error: cityError } = await supabase
      .from("sites")
      .select("*")
      .eq("city", cleanCity)
      .not("accent_color", "is", null)
      .limit(1)
      .maybeSingle();

    if (cityError) {
      console.error("City site lookup failed:", cityError);
    }

    if (citySite) {
      return citySite;
    }
  }

  // 3. For a custom domain, fall back to a domain-only match.
  if (!isLocal) {
    const { data: domainSite, error: domainError } = await supabase
      .from("sites")
      .select("*")
      .or(`domain.eq.${host},domain.eq.www.${host}`)
      .limit(1)
      .maybeSingle();

    if (domainError) {
      console.error("Domain site lookup failed:", domainError);
    }

    if (domainSite) {
      return domainSite;
    }
  }

  // 4. Final fallback to the requested city, or Nanaimo.
  const { data: fallback, error: fallbackError } = await supabase
    .from("sites")
    .select("*")
    .eq("city", cleanCity || "nanaimo")
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    console.error("Fallback site lookup failed:", fallbackError);
  }

  return fallback ?? null;
}

export async function getSiteMarkets(siteId: string) {
  const { data, error } = await supabase
    .from("site_markets")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Market lookup failed:", error);
    return [];
  }

  return data ?? [];
}