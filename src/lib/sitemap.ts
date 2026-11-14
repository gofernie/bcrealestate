import { createClient } from "@supabase/supabase-js";

export const BASE_URL = "https://bc.realestate";
const PRIMARY = "bc.realestate";

const slugify = (value: unknown) =>
  String(value || "").trim().toLowerCase()
    .replace(/^pq[\s-]+/i, "").replace(/&/g, "and").replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

type Entry = { loc: string; lastmod?: string };

const db = () => createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const cleanHost = (h: unknown) => String(h || "").trim().toLowerCase().replace(/^www\./, "");

/* sitemap-host-v1: each domain's sitemap lists only its own sites' pages. On localhost, ?host= picks a domain to preview. */
export function hostFrom(url: URL): string {
  const h = cleanHost(url.hostname);
  if (h === "localhost" || h === "127.0.0.1") return cleanHost(url.searchParams.get("host") || PRIMARY);
  return h;
}

async function sitesFor(supabase: any, host: string) {
  const { data, error } = await supabase.from("sites").select("id, domain, city").not("city", "is", null);
  if (error) console.error("Sitemap sites query failed:", error);
  const all = (data || []) as any[];
  const mine = all.filter((s) => cleanHost(s.domain) === host);
  const primaryCities = new Set(all.filter((s) => cleanHost(s.domain) === PRIMARY).map((s) => slugify(s.city)));
  const cities = Array.from(new Set(mine.map((s) => slugify(s.city)).filter(Boolean))) as string[];
  return { mine, cities, primaryCities, siteIds: mine.map((s) => s.id) };
}

/** City, type, area and intent pages for this domain: the evergreen pages that should rank. */
export async function pageEntries(host: string = PRIMARY): Promise<Entry[]> {
  const supabase = db();
  const base = `https://${host}`;
  const { cities, siteIds } = await sitesFor(supabase, host);
  const out = new Map<string, Entry>();
  const add = (loc: string, lastmod?: string) => { if (!out.has(loc)) out.set(loc, { loc, lastmod }); };
  add(`${base}/`);
  if (!siteIds.length) return Array.from(out.values());
  let pagesQuery = supabase.from("intent_pages").select("city,slug,updated_at,site_id").eq("is_published", true);
  pagesQuery = host === PRIMARY ? pagesQuery.or(`site_id.in.(${siteIds.join(",")}),site_id.is.null`) : pagesQuery.in("site_id", siteIds);
  const [pagesResult, areasResult] = await Promise.all([pagesQuery, supabase.from("area_boundaries").select("city,area_slug,area_name")]);
  if (pagesResult.error) console.error("Sitemap intent pages query failed:", pagesResult.error);
  if (areasResult.error) console.error("Sitemap areas query failed:", areasResult.error);
  const corePages = ["", "areas", "searches", "homes", "condos", "townhomes", "mobile-homes", "land"];
  for (const city of cities) for (const page of corePages) add(page ? `${base}/${city}/${page}` : `${base}/${city}/`);
  /* market-intel-sitemap-v1 */ const today = new Date().toISOString().slice(0, 10);
  for (const city of cities) add(`${base}/${city}/market-intelligence`, today);
  if (host === PRIMARY) add(`${base}/greater-victoria/market-intelligence`, today);
  for (const page of pagesResult.data || []) {
    const city = slugify(page.city), slug = slugify(page.slug);
    if (city && slug && cities.includes(city)) add(`${base}/${city}/${slug}`, page.updated_at ? String(page.updated_at).slice(0, 10) : undefined);
  }
  for (const area of areasResult.data || []) {
    const city = slugify(area.city), slug = slugify(area.area_slug || area.area_name);
    if (city && slug && cities.includes(city)) add(`${base}/${city}/${slug}`);
  }
  return Array.from(out.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

/** Active listings only. Other domains list listings only for cities bc.realestate doesn't cover, so each listing appears once. */
export async function listingEntries(host: string = PRIMARY): Promise<Entry[]> {
  const supabase = db();
  const base = `https://${host}`;
  const { cities: own, primaryCities } = await sitesFor(supabase, host);
  const cities = host === PRIMARY ? own : own.filter((c) => !primaryCities.has(c));
  if (!cities.length) return [];
  const batchSize = 1000;
  const { count, error } = await supabase.from("listing_rows").select("id", { count: "exact", head: true }).eq("status", "A");
  if (error) { console.error("Sitemap listing count failed:", error); return []; }
  const pages = Math.ceil(Number(count || 0) / batchSize);
  const results = await Promise.all(Array.from({ length: pages }, (_, i) =>
    supabase.from("listing_rows")
      .select("id, mls_number, normalized_city, updated_at, address, image_url")
      .eq("status", "A").order("id", { ascending: true }).range(i * batchSize, i * batchSize + batchSize - 1)));
  const out = new Map<string, Entry>();
  for (const r of results) {
    if (r.error) { console.error("Sitemap listing page failed:", r.error); continue; }
    for (const l of r.data || []) {
      const city = slugify(l.normalized_city);
      const id = String(l.mls_number || l.id || "").trim();
      const complete = city && id && String(l.address || "").trim().length >= 5 && Boolean(l.image_url);
      if (complete && cities.includes(city)) {
        const loc = `${base}/${city}/listing/${encodeURIComponent(id)}`;
        if (!out.has(loc)) out.set(loc, { loc, lastmod: l.updated_at ? String(l.updated_at).slice(0, 10) : undefined });
      }
    }
  }
  return Array.from(out.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

export function urlsetXml(entries: Entry[]) {
  const body = entries.map((e) => `  <url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(names: string[], base: string = BASE_URL) {
  const today = new Date().toISOString().slice(0, 10);
  const body = names.map((n) => `  <sitemap><loc>${base}/${n}</loc><lastmod>${today}</lastmod></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export const xmlResponse = (xml: string) =>
  new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });