import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

/* intent-pages-by-site-v1: each site only gets its own intent pages; demo subdomains fall back to bc.realestate's */
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const FIELDS = `
  id, slug, city, area, property_type, lifestyle_angle, price_min, price_max,
  hero_heading, intro_copy, cta_style, status, is_indexed, created_at, updated_at,
  featured_rank, site_id
`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const GET: APIRoute = async ({ url, request }) => {
  const city = String(url.searchParams.get("city") || "").trim().toLowerCase();
  const host = String(request.headers.get("x-forwarded-host") || request.headers.get("host") || url.hostname)
    .split(",")[0].trim().split(":")[0].toLowerCase()
    .replace(/^www\./, "").replace(/\.localhost$/, ".bc.realestate");
  const isMain = !host || host === "bc.realestate" || host === "localhost" || host === "127.0.0.1" || host.endsWith(".netlify.app");
  const isDemo = !isMain && host.endsWith(".bc.realestate");

  const siteIdsFor = async (domain: string) => {
    const { data } = await supabase.from("sites").select("id").eq("domain", domain);
    return (data || []).map((r: any) => String(r.id));
  };

  const run = async (ids: string[], includeUnowned: boolean) => {
    let q = supabase.from("intent_pages").select(FIELDS).eq("status", "published").order("created_at", { ascending: false });
    if (city) q = q.eq("city", city);
    if (includeUnowned) q = ids.length ? q.or(`site_id.is.null,site_id.in.(${ids.join(",")})`) : q.is("site_id", null);
    else q = ids.length ? q.in("site_id", ids) : q.eq("site_id", "00000000-0000-0000-0000-000000000000");
    return q;
  };

  try {
    const mainIds = await siteIdsFor("bc.realestate");
    let res: any;
    if (isMain) {
      res = await run(mainIds, true);
    } else {
      res = await run(await siteIdsFor(host), false);
      /* no fallback: agent sites without their own pages get the plain chip strip */
    }
    if (res.error) return json({ ok: false, error: res.error.message, pages: [] }, 500);
    return json({ ok: true, pages: res.data || [] });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Lookup failed", pages: [] }, 500);
  }
};