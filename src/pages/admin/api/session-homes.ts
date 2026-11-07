import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { mapListing, listingUrl, siteBase, num } from "../../../lib/sessionHomes";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const pretty = (c: string) => c.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const POSITIVE = new Set(["love", "loved", "like", "liked", "maybe"]);

export const GET: APIRoute = async ({ url }) => {
  try {
    const sid = String(url.searchParams.get("session_id") || "").trim();
    if (!sid) return json({ homes: [] });

    const { data: sess } = await supabase.from("intent_sessions").select("site_id, city").eq("session_id", sid).maybeSingle();
    const city = String(sess?.city || "").trim();

    const { data: reacts } = await supabase
      .from("intent_listing_reactions")
      .select("listing_id, mls_number, price, beds, area, normalized_type, decision")
      .eq("session_id", sid);
    const all: any[] = reacts || [];
    const seen = new Set<string>();
    all.forEach((r) => { if (r.listing_id) seen.add(String(r.listing_id)); if (r.mls_number) seen.add(String(r.mls_number)); });

    const pos = all.filter((r) => POSITIVE.has(String(r.decision || "").toLowerCase()));
    const basis = pos.length ? pos : all;
    const prices = basis.map((r) => num(r.price)).filter((n): n is number => !!n).sort((a, b) => a - b);
    const med = prices.length ? prices[Math.floor(prices.length / 2)] : null;
    const bedsList = basis.map((r) => num(r.beds)).filter((n): n is number => !!n);
    const minBeds = bedsList.length ? Math.min(...bedsList) : null;
    const types = new Set(basis.map((r) => String(r.normalized_type || "").toLowerCase()).filter(Boolean));
    const areas = new Set(basis.map((r) => String(r.area || "").toLowerCase()).filter(Boolean));

    const variants = [...new Set([city, city.toLowerCase(), city.replace(/-/g, " "), pretty(city)].filter(Boolean))];
    let rows: any[] = [];
    if (variants.length) {
      const { data } = await supabase.from("listing_rows").select("*").eq("status", "A").in("normalized_city", variants).order("listed_at", { ascending: false }).limit(400);
      rows = data || [];
    }
    if (!rows.length && city) {
      const { data } = await supabase.from("listing_rows").select("*").eq("status", "A").ilike("area", `%${pretty(city)}%`).order("listed_at", { ascending: false }).limit(400);
      rows = data || [];
    }

    const base = await siteBase(supabase, sess?.site_id);
    const scored = rows
      .map(mapListing)
      .filter((h) => h.mls && !seen.has(h.id) && !seen.has(h.mls))
      .map((h) => {
        let s = 0;
        const why: string[] = [];
        if (med && h.price) {
          const d = Math.abs(h.price - med) / med;
          if (d > 0.35) return null;
          s += (1 - d) * 3;
          if (d <= 0.15) why.push("price");
        }
        if (types.size && types.has(h.type.toLowerCase())) { s += 2; why.push("type"); }
        if (areas.size && areas.has(h.area.toLowerCase())) { s += 2; why.push("area"); }
        if (minBeds && h.beds && h.beds >= minBeds) { s += 1; why.push("beds"); }
        if (h.image) s += 0.5;
        return { ...h, score: s, why: why.length ? "Matches " + why.join(", ") : "", url: listingUrl(base, city || h.city, h.mls, sid) };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 12)
      .map(({ score, listedAt, ...h }: any) => h);

    return json({ homes: scored });
  } catch (e: any) {
    return json({ error: e?.message || "Couldn't load homes" }, 500);
  }
};