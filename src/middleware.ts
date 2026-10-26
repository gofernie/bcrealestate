import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import { purgeCache } from "@netlify/functions";
import { createSupabaseServerClient } from "./lib/supabaseServer";

const tagSafe = (v: unknown) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const SHARED_HOSTS = new Set(["bc.realestate"]);

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

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
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
    // cdn-cache-v1: public HTML is the same for every visitor, so let Netlify's CDN serve it
    try {
      const perVisitor = /^\/(api|login|logout|shortlists|listings|reset-password|buyers|account|unsubscribe)(\/|$)/.test(pathname);
      const type = response.headers.get("content-type") || "";
      if (context.request.method === "GET" && !perVisitor && response.status === 200 && type.includes("text/html") && !response.headers.has("set-cookie") && !response.headers.has("cache-control")) {
        response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
        response.headers.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=300, stale-while-revalidate=86400");
        const hostTag = "host-" + tagSafe(context.url.hostname.replace(/^www\./, ""));
        const seg = segs[0] ? `${hostTag}-${tagSafe(segs[0])}` : "";
        response.headers.set("Netlify-Cache-Tag", ["all-pages", hostTag, seg].filter(Boolean).join(","));
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