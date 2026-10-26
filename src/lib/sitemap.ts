import { createClient } from "@supabase/supabase-js";

export const BASE_URL = "https://bc.realestate";

const slugify = (value: unknown) =>
  String(value || "").trim().toLowerCase()
    .replace(/^pq[\s-]+/i, "").replace(/&/g, "and").replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

type Entry = { loc: string; lastmod?: string };

const db = () => createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);

async function getCities(supabase: any): Promise<string[]> {
  const { data, error } = await supabase.from("sites").select("city").not("city", "is", null);
  if (error) console.error("Sitemap sites query failed:", error);
  return Array.from(new Set((data || []).map((r: any) => slugify(r.city)).filter(Boolean))) as string[];
}

/** City, type, area and intent pages: the evergreen pages that should rank. */
export async function pageEntries(): Promise<Entry[]> {
  const supabase = db();
  const [cities, pagesResult, areasResult] = await Promise.all([
    getCities(supabase),
    supabase.from("intent_pages").select("city,slug,updated_at").eq("is_published", true),
    supabase.from("area_boundaries").select("city,area_slug,area_name"),
  ]);
  if (pagesResult.error) console.error("Sitemap intent pages query failed:", pagesResult.error);
  if (areasResult.error) console.error("Sitemap areas query failed:", areasResult.error);

  const out = new Map<string, Entry>();
  const add = (loc: string, lastmod?: string) => { if (!out.has(loc)) out.set(loc, { loc, lastmod }); };
  add(`${BASE_URL}/`);
  const corePages = ["", "areas", "searches", "homes", "condos", "townhomes", "mobile-homes", "land"];
  for (const city of cities) for (const page of corePages) add(page ? `${BASE_URL}/${city}/${page}` : `${BASE_URL}/${city}/`);
  for (const page of pagesResult.data || []) {
    const city = slugify(page.city), slug = slugify(page.slug);
    if (city && slug && cities.includes(city)) add(`${BASE_URL}/${city}/${slug}`, page.updated_at ? String(page.updated_at).slice(0, 10) : undefined);
  }
  for (const area of areasResult.data || []) {
    const city = slugify(area.city), slug = slugify(area.area_slug || area.area_name);
    if (city && slug && cities.includes(city)) add(`${BASE_URL}/${city}/${slug}`);
  }
  return Array.from(out.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

/** Active listings only, with lastmod. Off-market listings are left out so Google isn't sent to dead pages. */
export async function listingEntries(): Promise<Entry[]> {
  const supabase = db();
  const cities = await getCities(supabase);
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
        const loc = `${BASE_URL}/${city}/listing/${encodeURIComponent(id)}`;
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

export function sitemapIndexXml(names: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const body = names.map((n) => `  <sitemap><loc>${BASE_URL}/${n}</loc><lastmod>${today}</lastmod></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export const xmlResponse = (xml: string) =>
  new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });