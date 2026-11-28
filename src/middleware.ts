import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import { purgeCache } from "@netlify/functions";
import { createSupabaseServerClient } from "./lib/supabaseServer";
import { resolveAdminAccess, checkApiAccess, forbiddenPage, isUuid, VIEW_AS_COOKIE, LAST_SITE_COOKIE } from "./lib/adminAccess";
import { PLATFORM_ADMIN_IDS } from "./lib/guideAccess";

const tagSafe = (v: unknown) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const SHARED_HOSTS = new Set(["bc.realestate"]);

// agent-city-guard-v1: map each domain to its primary city + secondary markets (cached 10 min)
type SiteCities = { primary: string; cities: Set<string> };
let siteCityCache: { at: number; byDomain: Map<string, SiteCities>; allCities: Set<string> } | null = null;
async function getSiteCityMap(fresh = false) {
  if (!fresh && siteCityCache && Date.now() - siteCityCache.at < 10 * 60 * 1000) return siteCityCache;
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
    // cache-purge-v2: CRM, CMA, email and session work never changes public pages, so it never purges (it used to fall through to all-pages)
    if (/^\/(admin\/(api\/(people|person-email|cma|session-[a-z-]+)|people|person|intent-sessions|leads|watches|buyers)|api\/(buyers|buyer-detail|shortlists))(\/|$)/.test(pathname) || /\/admin\/(person|people|intent-sessions|leads|watches|buyers)(\/|\?|$)/.test(referer)) return;
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

const mainHandler = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  // streetindex-host-v1: streetindex.io serves /streetindex pages (same MarketTicker as bc.realestate)
  {
    const reqHost = context.url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, "").toLowerCase();
    const isLocalReq = reqHost === "localhost" || reqHost === "127.0.0.1";
    const onSI = reqHost === "streetindex.io" || (isLocalReq && context.url.searchParams.get("siteDomain") === "streetindex.io");
    const p = pathname.replace(/\/+$/, "") || "/";
    if (!onSI && (p === "/streetindex" || p.startsWith("/streetindex/"))) return new Response("Not found", { status: 404 });
    if (onSI && !p.startsWith("/streetindex") && !/^\/(api|_astro|_image|js|css|images|img|fonts)(\/|$)/.test(p) && !/\.[a-z0-9]{2,5}$/i.test(p)) {
      const parts = p.split("/").filter(Boolean);
      if (parts.length > 1) return new Response(null, { status: 301, headers: { Location: `/${parts[0]}/${isLocalReq ? "?siteDomain=streetindex.io" : ""}` } });
      const res = await next((parts.length ? `/streetindex/${parts[0]}` : "/streetindex") + search);
      res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      res.headers.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=43200, stale-while-revalidate=604800");
      res.headers.set("Netlify-Vary", "query=siteDomain");
      res.headers.set("Netlify-Cache-Tag", "all-pages,host-streetindex-io" + (parts[0] ? ",city-" + parts[0] : ""));
      return res;
    }
  }
  // nanaimomobiles-guard-v1: nanaimomobiles.com only serves its own pages; everything else 301s to the same path on bc.realestate
  {
    const reqHost = context.url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, "").toLowerCase();
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
        p === "/nanaimo/areas" || /^\/nanaimo\/[a-z0-9-]*mobile-homes[a-z0-9-]*$/.test(p) /* nm-area-pages-v1 */ ||
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
    const reqHost = context.url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, "").toLowerCase();
    const isLocalReq = reqHost === "localhost" || reqHost === "127.0.0.1";
    const siteHost = isLocalReq
      ? (context.url.searchParams.get("siteDomain") || "").replace(/^www\./, "").toLowerCase()
      : reqHost;
    if (siteHost && !SHARED_HOSTS.has(siteHost) && siteHost !== "nanaimomobiles.com" && segs[0]) {
      let map = await getSiteCityMap();
      let site = map.byDomain.get(siteHost);
      const seg = tagSafe(segs[0]);
      // agent-city-guard-v1b: a market added in the last 10 min isn't in the cache yet; reload once before redirecting away
      if (site && site.primary && map.allCities.has(seg) && !site.cities.has(seg) && Date.now() - map.at > 5000) { map = await getSiteCityMap(true); site = map.byDomain.get(siteHost); }
      /* agent-root-home-v1: the main city lives at "/" on agent sites; /{primary}/ 301s home (index.astro rewrites "/" back with root_rewrite=1) */
      if (site && site.primary && segs.length === 1 && seg === site.primary && context.request.method === "GET" && context.url.searchParams.get("root_rewrite") !== "1") {
        const qs = context.url.searchParams.toString();
        return new Response(null, { status: 301, headers: { Location: "/" + (qs ? "?" + qs : ""), "Cache-Control": "no-store" } });
      }
      if (site && site.primary && map.allCities.has(seg) && !site.cities.has(seg)) {
        const q = isLocalReq ? `?siteDomain=${encodeURIComponent(siteHost)}` : "";
        return new Response(null, {
          status: 302,
          headers: { Location: isLocalReq ? `/${site.primary}/${q}` : "/", "Cache-Control": "no-store" },
        });
      }
    }
  }

  // agent-city-guard-v2: /explore?city=X on agent sites stays inside the agent's markets
  {
    const reqHost = context.url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, "").toLowerCase();
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

  const isGuardedWrite = context.request.method !== "GET" && context.request.method !== "HEAD" && /^\/api\/(site-settings|shortlists\/(create|delete|add-item)|create-agent|prospect-pages\/)/.test(pathname);
  const isAdminRoute = isGuardedWrite || pathname === "/admin" || pathname.startsWith("/admin/") || /^\/(shortlists|listings)\/?$/.test(pathname) || pathname.startsWith("/api/admin/") || pathname === "/api/buyers" || pathname.startsWith("/api/buyers/") || pathname === "/api/buyer-detail";
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
        const apiHostTag = "host-" + tagSafe(context.url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, ""));
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
        const hostTag = "host-" + tagSafe(context.url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, ""));
        const seg = segs[0] ? `${hostTag}-${tagSafe(segs[0])}` : "";
        /* cache-key-v1: only query params the server reads change the cached page (gone/action/utm/junk ignored; listing_id ignored on city roots, handled in the browser) */ if (!response.headers.has("netlify-vary")) { const VARY_KEYS = ["age55","agent","agent_id","area","area_slug","areaBufferKm","areas","baths","beds","bedsMode","city","countOnly","days","district","domain","error","exclude","expanded","facets","fourSameFloor","fresh","from","gv_rewrite","gv_slug","id","kind","lat","limit","listing_id","listing_mls","lng","lsid","markers","market","maxDistKm","maxPrice","metric","minLotSqft","minPrice","minSqft","minYear","mls","msg","name","new","oceanViews","offset","otherPark","page","pageCity","petsAllowed","planMode","price","primaryOnMain","published","q","radius","return","returnTo","root_rewrite","s","sent","session","session_id","shortlist","shortlistSlug","show","site","site_id","siteDomain","siteId","slug","sort","status","style","threeSameFloor","token","type","url","viewType","waterfeature","waterfront","waterfrontType","weeks"]; const isCityRoot = pathname === "/" || /^\/[^/]+\/?$/.test(pathname); const varyKeys = isCityRoot ? VARY_KEYS.filter((k) => k !== "listing_id" && k !== "mls" && k !== "listing_mls") : VARY_KEYS; response.headers.set("Netlify-Vary", "query=" + varyKeys.join("|")); } response.headers.set("Netlify-Cache-Tag", ["all-pages", hostTag, seg, segs[0] ? "city-" + tagSafe(segs[0]) : ""].filter(Boolean).join(","));
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

  // admin-access-v1: agents only reach their own site(s); platform screens are admin-only
  if (pathname === "/admin/view-as" || pathname === "/admin/view-as/") {
    const target = context.url.searchParams.get("site_id") || "";
    const secure = !import.meta.env.DEV;
    if (PLATFORM_ADMIN_IDS.has(user.id) && isUuid(target)) {
      context.cookies.set(VIEW_AS_COOKIE, target, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 60 * 60 * 8 });
      return context.redirect(`/admin/sites/${target}/pages`);
    }
    const back = context.cookies.get(VIEW_AS_COOKIE)?.value || "";
    context.cookies.delete(VIEW_AS_COOKIE, { path: "/" });
    return context.redirect(isUuid(back) ? `/admin/sites/${back}/pages` : "/admin/sites");
  }
  const gate = await resolveAdminAccess(user, context.url, context.cookies);
  if (gate.forbidden) return forbiddenPage(gate.forbidden);
  if (gate.redirect && gate.redirect !== `${pathname}${search}`) return context.redirect(gate.redirect);
  (context.locals as any).adminAccess = gate.access;
  // admin-api-guard-v1
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin/api/")) {
    const check = await checkApiAccess(context.request.clone(), context.url, gate.access);
    if (!check.allowed) return new Response(JSON.stringify({ ok: false, error: check.reason || "Not allowed" }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  if (gate.access.isPlatformAdmin && gate.access.currentSiteId && context.cookies.get(LAST_SITE_COOKIE)?.value !== gate.access.currentSiteId) {
    context.cookies.set(LAST_SITE_COOKIE, gate.access.currentSiteId, { path: "/", httpOnly: true, sameSite: "lax", secure: !import.meta.env.DEV, maxAge: 60 * 60 * 24 * 90 });
  }

  const response = await next();
  if (isWrite && response.status < 400) await purgeAfterAdminSave(pathname, referer);
  return response;
});

// demo-gate-v1: agent demo subdomains (name.bc.realestate) need an access code and are never indexed
const DEMO_COOKIE = "demo_access";
function demoHostOf(hostname: string) {
  const h = hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, "").toLowerCase();
  return /^[a-z0-9-]+\.bc\.realestate$/.test(h) ? h : "";
}
const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function demoGatePage(back: string, bad: boolean) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private demo</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f5f1e8;color:#2b2b2b}form{background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:min(340px,90vw)}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;color:#666;margin:0 0 16px}input{width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #ccc;border-radius:8px;margin-bottom:12px}button{width:100%;padding:10px;font-size:16px;border:0;border-radius:8px;background:#1f4d3a;color:#fff;cursor:pointer}.err{color:#b00020}</style></head>
<body><form method="post" action="/__demo-access"><h1>Private demo</h1><p>This site is a private preview. Enter the access code to continue.</p>${bad ? '<p class="err">That code didn\'t work. Try again.</p>' : ""}<input type="hidden" name="back" value="${escHtml(back)}"><input name="code" type="password" placeholder="Access code" autofocus required><button type="submit">Continue</button></form></body></html>`;
  return new Response(html, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const demoHost = demoHostOf(context.url.hostname);
  const code = String(import.meta.env.DEMO_ACCESS_CODE || "");
  if (!demoHost || !code) return mainHandler(context, next);
  const { pathname, search } = context.url;
  if (pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain", "X-Robots-Tag": "noindex" } });
  if (pathname === "/__demo-access" && context.request.method === "POST") {
    const form = await context.request.formData().catch(() => null);
    const entered = String(form?.get("code") || "").trim();
    const back = String(form?.get("back") || "/");
    const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
    if (entered && entered === code) {
      const secure = import.meta.env.DEV ? "" : "; Secure";
      return new Response(null, { status: 303, headers: { Location: safeBack, "Cache-Control": "no-store", "Set-Cookie": `${DEMO_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}` } });
    }
    return demoGatePage(safeBack, true);
  }
  const isAsset = /^\/(_astro|_image|fonts|images|img|js|css)(\/|$)/.test(pathname) || /\.(css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|map)$/i.test(pathname);
  const hasAccess = context.cookies.get(DEMO_COOKIE)?.value === code;
  if (!hasAccess && !isAsset) return demoGatePage(pathname + search, false);
  const res = await mainHandler(context, next);
  try {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    const v = res.headers.get("netlify-vary");
    res.headers.set("Netlify-Vary", v ? `${v},cookie=${DEMO_COOKIE}` : `cookie=${DEMO_COOKIE}`);
  } catch {}
  return res;
});