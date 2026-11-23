import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
export const prerender = false;
/* match-count-v2 */
const colCache = new Map<string, boolean>();
async function hasCol(c: string) {
  if (!colCache.has(c)) { const { error } = await supabase.from("listing_rows").select(c).limit(1); colCache.set(c, !error); }
  return colCache.get(c)!;
}
async function pick(cands: string[]) { for (const c of cands) if (await hasCol(c)) return c; return null; }

export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const { data: page } = await supabase.from("intent_pages").select("*").eq("id", p.get("id") || "").maybeSingle();
  const city = String(p.get("city") || page?.city_slug || page?.city || "");
  const cityCol = await pick(["city_slug", "city", "market_slug", "market"]);
  const base = () => {
    let q: any = supabase.from("listing_rows").select("id", { count: "exact", head: true }).eq("status", "A");
    if (cityCol && city) q = cityCol.includes("slug") ? q.eq(cityCol, city) : q.ilike(cityCol, city.replace(/-/g, " "));
    return q;
  };
  const steps: Array<[string, string[], (q: any, c: string) => any]> = [];
  const on = (k: string) => p.get(k) === "true" || p.get(k) === "on";
  const num = (k: string) => { const n = Number(String(p.get(k) || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };
  const flag = (name: string, label: string, cands: string[]) => { if (on(name)) steps.push([label, cands, (q, c) => q.eq(c, true)]); };
  const min = (name: string, label: string, col: string) => { if (num(name) > 0) steps.push([label, [col], (q, c) => q.gte(c, num(name))]); };

  const types = p.getAll("property_type").filter(Boolean);
  if (types.length) steps.push(["Type", ["normalized_type"], (q, c) => types.length === 1 ? q.eq(c, types[0]) : q.in(c, types)]);
  const area = String(p.get("area") || "").trim();
  if (area) { const slug = area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); steps.push(["Area", ["normalized_area"], (q, c) => q.or(`${c}.eq.${area},${c}.eq.${slug}`)]); }
  if (num("price_min") > 0) steps.push(["Min price", ["price"], (q, c) => q.gte(c, num("price_min"))]);
  if (num("price_max") > 0) steps.push(["Max price", ["price"], (q, c) => q.lte(c, num("price_max"))]);
  min("beds_min", "Beds", "beds"); min("baths_min", "Baths", "baths"); min("min_sqft", "Sqft", "sqft");
  min("min_lot_sqft", "Lot size", "lot_size_sqft"); min("min_year", "Year built", "year_built");
  flag("primary_on_main", "Primary on main", ["primary_on_main"]);
  flag("three_plus_beds_same_floor", "3+ beds same floor", ["three_plus_beds_same_floor"]);
  flag("four_plus_beds_same_floor", "4+ beds same floor", ["four_plus_beds_same_floor"]);
  const view = String(p.get("view_type") || "").trim(); if (view) steps.push(["View", ["view_type"], (q, c) => q.ilike(c, `%${view}%`)]);
  flag("requires_suite", "Suite", ["has_suite"]);
  flag("requires_single_level", "No stairs", ["single_level"]);
  flag("requires_detached_suite", "Detached suite", ["has_detached_suite"]);
  if (on("requires_inhome_suite")) steps.push(["In-home suite", ["has_suite"], (q, c) => q.eq(c, true).not("has_detached_suite", "is", true)]);
  flag("requires_updated_kitchen", "Updated kitchen", ["has_updated_kitchen"]);
  if (num("min_kitchens") > 1) steps.push([`${num("min_kitchens")}+ kitchens`, ["kitchen_count"], (q, c) => q.gte(c, num("min_kitchens"))]);
  flag("requires_heat_pump", "Heat pump", ["has_heat_pump"]);
  flag("requires_ac", "AC", ["has_ac"]);
  flag("requires_fireplace", "Fireplace", ["has_fireplace"]);
  min("min_parking", "Parking", "parking_spaces");
  flag("requires_shop", "Shop", ["has_shop", "has_workshop", "shop"]);
  flag("requires_ocean_view", "Ocean view", ["ocean_view"]);
  flag("requires_waterfront", "Waterfront", ["waterfront"]);
  const wt = String(p.get("waterfront_type") || "").trim(); if (wt) steps.push(["Waterfront type", ["waterfront_type"], (q, c) => q.eq(c, wt)]);
  const styles = p.getAll("home_styles").filter(Boolean); if (styles.length) steps.push(["Home style", ["home_style"], (q, c) => q.in(c, styles)]);

  let q = base(); const applied: string[] = [], skipped: string[] = [];
  for (const [label, cands, fn] of steps) { const c = await pick(cands); if (!c) { skipped.push(label); continue; } q = fn(q, c); applied.push(label); }
  const [res, tot] = await Promise.all([q, base()]);
  return new Response(JSON.stringify({ count: res.count ?? 0, cityTotal: tot.count ?? 0, city, applied, skipped, error: res.error?.message || null }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } });
};