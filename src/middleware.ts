import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import { purgeCache } from "@netlify/functions";
import { createSupabaseServerClient } from "./lib/supabaseServer";

const tagSafe = (v: unknown) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const SHARED_HOSTS = new Set(["bc.realestate"]);

// agent-city-guard-v1: map each domain to its primary city + secondary markets (cached 10 min)
type SiteCities = { primary: string; cities: Set<string> };
let siteCityCache: { at: number; byDomain: Map<string, SiteCities>; allCities: Set<string> } | null = null;
async function getSiteCityMap() {
  if (siteCityCache && Date.now() - siteCityCache.at < 10 * 60 * 1000) return siteCityCache;
  const byDomain = new Map<string, SiteCities>();
  const allCities = new Set<string>();
  try {
    const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb.from("sites").select("domain, city, secondary_markets");
    for (const row of (data || []) as any[]) {
      const domain = String(row?.domain || "").replace(/^www\./, "").toLowerCase();
      const city = tagSafe(row?.city);
      if (city) allCities.add(city);
      const markets = Array.isArray(row?.secondary_markets) ? row.secondary_markets : [];
      for (const m of markets) { const mc = tagSafe(m?.city); if (mc) allCities.add(mc); }
      if (!domain) continue;
      const entry = byDomain.get(domain) || { primary: city, cities: new Set<string>() };
      if (!entry.primary && city) entry.primary = city;
      if (city) entry.cities.add(city);
      for (const m of markets) { const mc = tagSafe(m?.city); if (mc) entry.cities.add(mc); }
      byDomain.set(domain, entry);
    }
  } catch (e) {
    console.error("site city map failed", e);
  }
  siteCityCache = { at: Date.now(), byDomain, allCities };
  return siteCityCache;
}

// cache-purge-v1: when an admin saves, drop that site's cached pages so changes show immediately
async function purgeAfterAdminSave(pathname: string, referer: string) {
  if (import.meta.env.DEV) return;
  try {
    const m = `${pathname} ${referer}`.match(/\/admin\/sites\/([0-9a-f-]{36})/i);
    const tags: string[] = [];
    if (m) {
      const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await sb.from("sites").select("domain, city").eq("id", m[1]).maybeSingle();
      const domain = String(data?.domain || "").replace(/^www\./, "").toLowerCase();
      const host = tagSafe(domain);
      if (host) {
        if (data?.city) tags.push(`host-${host}-${tagSafe(data.city)}`);
        if (!SHARED_HOSTS.has(domain) || !data?.city) tags.push(`host-${host}`);
      }
    }
    if (!tags.length) tags.push("all-pages");
    await purgeCache({ tags });
    console.log("cache purged", tags);
  } catch (e) {
    console.error("cache purge failed", e);
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  // nanaimomobiles-guard-v1: nanaimomobiles.com only serves its own pages; everything else 301s to the same path on bc.realestate
  {
    const reqHost = context.url.hostname.replace(/^www\./, "").toLowerCase();
    const isLocalReq = reqHost === "localhost" || reqHost === "127.0.0.1";
    const onNanaimoMobiles =
      reqHost === "nanaimomobiles.com" ||
      (isLocalReq && context.url.searchParams.get("siteDomain") === "nanaimomobiles.com");
    if (onNanaimoMobiles) {
      const p = pathname.replace(/\/+$/, "") || "/";
      const isMobileHome = p === "/nanaimo" && context.url.searchParams.get("type") === "mobile"; // "/" rewrites here
      const keep =
        p === "/" ||
        isMobileHome ||
        p === "/nanaimo/mobile-homes" || p.startsWith("/nanaimo/mobile-homes/") ||
        p === "/nanaimo/areas" ||
        p === "/nanaimo/park-directory" || p.startsWith("/nanaimo/park-directory/") ||
        p === "/mobile-home-parks-in-nanaimo" || p.startsWith("/mobile-home-parks-in-nanaimo/") ||
        /^\/(api|admin|_astro|_image|js|css|images|img|fonts|login|logout|shortlists|listings|account|unsubscribe|reset-password)(\/|$)/.test(p) ||
        /\.[a-z0-9]{2,5}$/i.test(p);
      if (!keep) {
        if (p === "/nanaimo") return context.redirect("/", 301);
        const q = new URLSearchParams(search);
        q.delete("siteDomain");
        const qs = q.toString();
        return new Response(null, {
          status: 301,
          headers: { Location: `https://bc.realestate${pathname}${qs ? `?${qs}` : ""}`, "Cache-Control": "public, max-age=3600" },
        });
      }
    }
  }

  // junk-url-guard-v1: old link bug left endless "-real-estate-market" URLs; collapse or 404 them
  const JUNK_BASES = new Set(["404", "contact", "explore", "search", "searches", "login", "about", "privacy", "terms", "admin", "api"]);
  const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (pathname === "/404" || pathname === "/404/") return notFound();
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length && /(?:-real-estate-market)+$/i.test(segs[0])) {
    const base = segs[0].replace(/(?:-real-estate-market)+$/i, "").toLowerCase();
    if (!base || JUNK_BASES.has(base)) return notFound();
    const rest = segs.slice(1).join("/");
    return context.redirect(rest ? `/${base}/${rest}` : `/${base}/`, 301);
  }
  if (pathname.replace(/\/+$/, "") === "/explore") {
    const c = context.url.searchParams.get("city") || "";
    if (/-real-estate-market/i.test(c)) {
      const base = c.replace(/(?:-real-estate-market)+$/i, "").toLowerCase();
      const q = new URLSearchParams(context.url.searchParams);
      if (!base || JUNK_BASES.has(base)) q.delete("city"); else q.set("city", base);
      const qs = q.toString();
      return context.redirect(`/explore${qs ? `?${qs}` : ""}`, 301);
    }
  }

  // agent-city-guard-v1: agent sites only serve their own markets; other city paths go to the primary city
  {
    const reqHost = context.url.hostname.replace(/^www\./, "").toLowerCase();
    const isLocalReq = reqHost === "localhost" || reqHost === "127.0.0.1";
    const siteHost = isLocalReq
      ? (context.url.searchParams.get("siteDomain") || "").replace(/^www\./, "").toLowerCase()
      : reqHost;
    if (siteHost && !SHARED_HOSTS.has(siteHost) && siteHost !== "nanaimomobiles.com" && segs[0]) {
      const map = await getSiteCityMap();
      const site = map.byDomain.get(siteHost);
      const seg = tagSafe(segs[0]);
      if (site && site.primary && map.allCities.has(seg) && !site.cities.has(seg)) {
        const q = isLocalReq ? `?siteDomain=${encodeURIComponent(siteHost)}` : "";
        return new Response(null, {
          status: 302,
          headers: { Location: `/${site.primary}/${q}`, "Cache-Control": "no-store" },
        });
      }
    }
  }

  // agent-city-guard-v2: /explore?city=X on agent sites stays inside the agent's markets
  {
    const reqHost = context.url.hostname.replace(/^www\./, "").toLowerCase();
    const isLocalReq = reqHost === "localhost" || reqHost === "127.0.0.1";
    const siteHost = isLocalReq
      ? (context.url.searchParams.get("siteDomain") || "").replace(/^www\./, "").toLowerCase()
      : reqHost;
    const c = tagSafe(context.url.searchParams.get("city") || "");
    if (siteHost && !SHARED_HOSTS.has(siteHost) && siteHost !== "nanaimomobiles.com" && c && pathname.replace(/\/+$/, "") === "/explore") {
      const map = await getSiteCityMap();
      const site = map.byDomain.get(siteHost);
      if (site && site.primary && !site.cities.has(c)) {
        const q = new URLSearchParams(context.url.searchParams);
        q.set("city", site.primary);
        return new Response(null, {
          status: 302,
          headers: { Location: `/explore?${q.toString()}`, "Cache-Control": "no-store" },
        });
      }
    }
  }

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/buyers" || pathname.startsWith("/api/buyers/") || pathname === "/api/buyer-detail";
  const isWrite = context.request.method !== "GET" && context.request.method !== "HEAD";
  const referer = context.request.headers.get("referer") || "";

  if (!isAdminRoute) {
    const response = await next();
    // admin screens that save through /api/... endpoints
    if (isWrite && pathname.startsWith("/api/") && /\/admin\//.test(referer) && response.status < 400) {
      try {
        const sb = createSupabaseServerClient(context.cookies);
        const { data: { user } } = await sb.auth.getUser();
        if (user) await purgeAfterAdminSave(pathname, referer);
      } catch {}
    }
    // cdn-cache-api-v1: read-only public data APIs are the same for every visitor, so cache them at the CDN too
    try {
      const cacheableApi = /^\/api\/(home-listings|listing-detail|listing-filters|listing-style|osm-amenities|photo-kind|greater-victoria-listings)\/?$/.test(pathname);
      const apiType = response.headers.get("content-type") || "";
      if (context.request.method === "GET" && cacheableApi && response.status === 200 && apiType.includes("json") && !response.headers.has("set-cookie")) { /* cdn-cache-api-v2: apply even when the API sets its own short Cache-Control */
        if (!response.headers.has("cache-control")) response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
        response.headers.set("Netlify-CDN-Cache-Control", pathname.startsWith("/api/listing-detail") ? "public, durable, s-maxage=3600, stale-while-revalidate=86400" : "public, durable, s-maxage=43200, stale-while-revalidate=604800");
        const apiHostTag = "host-" + tagSafe(context.url.hostname.replace(/^www\./, ""));
        const apiCity = tagSafe(context.url.searchParams.get("city") || context.url.searchParams.get("market") || ""); response.headers.set("Netlify-Cache-Tag", ["all-pages", apiHostTag, "api", apiCity ? "city-" + apiCity : ""].filter(Boolean).join(","));
      }
    } catch {}
    // cdn-cache-v1: public HTML is the same for every visitor, so let Netlify's CDN serve it
    try {
      const perVisitor = /^\/(api|login|logout|shortlists|listings|reset-password|buyers|account|unsubscribe)(\/|$)/.test(pathname);
      const type = response.headers.get("content-type") || "";
      if (context.request.method === "GET" && !perVisitor && response.status === 200 && type.includes("text/html") && !response.headers.has("set-cookie")) { /* cdn-cache-v2: tag pages that set their own cache headers too, so admin purges reach them */
        if (!response.headers.has("cache-control")) response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
        if (!response.headers.has("netlify-cdn-cache-control")) response.headers.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=43200, stale-while-revalidate=604800");
        const hostTag = "host-" + tagSafe(context.url.hostname.replace(/^www\./, ""));
        const seg = segs[0] ? `${hostTag}-${tagSafe(segs[0])}` : "";
        response.headers.set("Netlify-Cache-Tag", ["all-pages", hostTag, seg, segs[0] ? "city-" + tagSafe(segs[0]) : ""].filter(Boolean).join(","));
      }
    } catch {}
    return response;
  }

  const supabase = createSupabaseServerClient(context.cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `${pathname}${search}`;

    return context.redirect(
      `/login?returnTo=${encodeURIComponent(returnTo)}`
    );
  }

  const response = await next();
  if (isWrite && response.status < 400) await purgeAfterAdminSave(pathname, referer);
  return response;
});
