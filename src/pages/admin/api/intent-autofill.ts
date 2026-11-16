import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const title = (s: string) => String(s || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const median = (v: number[]) => {
  const s = v.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const key = env("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY is not set" }, 500);
    const f = await request.json();
    const city = String(f.city || "").trim().toLowerCase();
    if (!city) return json({ error: "Set the city first." }, 400);
    const types: string[] = (Array.isArray(f.property_type) ? f.property_type : []).map((t: string) => String(t).toLowerCase()).filter(Boolean);
    const minLotSqft = Number(f.min_lot_sqft) || 0;
    const priceMin = Number(f.price_min) || 0;
    const priceMax = Number(f.price_max) || 0;
    const bedsMin = Number(f.beds_min) || 0;
    const area = String(f.area || "").trim().toLowerCase();

    // light listing facts so the copy can mention real price ranges and areas
    let facts: any = null;
    try {
      const sb = createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
      let q = sb.from("listing_rows")
        .select("normalized_type, normalized_area, price, beds, lot_size_acres")
        .eq("normalized_city", city.replace(/-/g, " ")).eq("status", "A").neq("property_type", "Lease").range(0, 9999);
      if (types.length) q = q.in("normalized_type", types);
      const { data } = await q;
      const rows = (data || []).filter((r: any) => {
        const price = Number(r.price || 0);
        if (priceMin && price < priceMin) return false;
        if (priceMax && price > priceMax) return false;
        if (bedsMin && Number(r.beds || 0) < bedsMin) return false;
        if (minLotSqft && Number(r.lot_size_acres || 0) * 43560 < minLotSqft) return false;
        if (area && String(r.normalized_area || "").toLowerCase() !== area) return false;
        return true;
      });
      if (rows.length) {
        const prices = rows.map((r: any) => Number(r.price || 0)).filter(Boolean).sort((a: number, b: number) => a - b);
        const areas: Record<string, number> = {};
        for (const r of rows as any[]) { const a = String(r.normalized_area || "").trim(); if (a && a !== "unknown") areas[a] = (areas[a] || 0) + 1; }
        facts = {
          lowestAsk: prices[0] || null,
          highestAsk: prices.at(-1) || null,
          medianAsk: median(prices),
          medianLotAcres: (() => { const m = median(rows.map((r: any) => Number(r.lot_size_acres || 0) * 100)); return m ? m / 100 : null; })(),
          areasWithMostListings: Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a]) => title(a)),
        };
      }
    } catch { facts = null; }

    const page = {
      city: title(city),
      area: area ? title(area) : null,
      currentHeroHeading: String(f.hero_heading || "").trim() || null,
      slug: String(f.slug || "").trim() || null,
      propertyTypes: types,
      priceMin: priceMin || null,
      priceMax: priceMax || null,
      bedsMin: bedsMin || null,
      minLotSqft: minLotSqft || null,
      minLotAcres: minLotSqft ? Math.round((minLotSqft / 43560) * 100) / 100 : null,
      viewType: String(f.view_type || "").trim() || null,
      features: Array.isArray(f.features) ? f.features : [],
      lifestyleAngle: String(f.lifestyle_angle || "").trim() || null,
    };
    const wantGuide = !!f.include_buyer_guide;

    const prompt = `Write the copy for one search page on a BC real estate website. The page lists homes for sale that match the search described in PAGE. The reader is a buyer browsing listings.
Rules:
- Work out what the search is from PAGE (slug, current hero heading, property types, filters). Write for that exact search.
- Use LISTING_FACTS only for rounded price ranges (e.g. $850K, $1.2M) and area names. Never quote listing counts; they change daily. If LISTING_FACTS is null, don't mention prices.
- You may use widely known local geography and general, well-established BC buying practice. Do not invent statistics, trends, forecasts, schools, businesses or brokerages.
- No demographic language about who should live there.
- Plain, local, practical tone. Canadian spelling. No hype words (stunning, nestled, dream, gem, paradise, boasts).
Examples below are for an acreage page; adapt them to this search.
Return ONLY JSON with these keys:
eyebrow: 2-4 words shown small above the H1, e.g. "${page.city} Real Estate"
hero_heading: the H1, 2-4 words in title case, no trailing punctuation, e.g. "${page.city} Acreages"
intro_copy: 90-120 words under the H1, 3-4 sentences; a specific picture of what this search covers (where, what kinds of properties, the range of options) and one practical thing a buyer should compare or check
neighbourhood_copy: the "What buyers should know" section, 110-160 words. One opening paragraph, then 3-5 short paragraphs that each start with a bold lead-in like **Water and septic.** Paragraphs separated by a blank line. Practical due diligence specific to this kind of property in this area.
seo_heading: the H2 for that section, under 60 characters, e.g. "Buying acreage around ${page.city}"
${wantGuide ? `buyer_guide_heading: under 60 characters, different from seo_heading
buyer_guide_copy: a longer buyer's guide, 280-380 words. One opening paragraph, then 5-7 paragraphs each starting with a bold lead-in like **Septic.** and a short closing paragraph. Paragraphs separated by a blank line. Must add detail beyond neighbourhood_copy, not repeat it.
` : ""}seo_title: browser tab title, 45-60 characters, main keyword first, e.g. "${page.city} Acreages for Sale | Homes on 1+ Acre"
meta_description: 140-158 characters, includes the main keyword and "for sale", ends with a reason to click
PAGE:
${JSON.stringify(page, null, 2)}
LISTING_FACTS:
${JSON.stringify(facts, null, 2)}`;

    const keys = ["eyebrow", "hero_heading", "intro_copy", "neighbourhood_copy", "seo_heading", ...(wantGuide ? ["buyer_guide_heading", "buyer_guide_copy"] : []), "seo_title", "meta_description"];
    const tool = {
      name: "save_page_copy",
      description: "Save the finished copy for the page.",
      input_schema: { type: "object", properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])), required: keys },
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env("COPY_MODEL") || "claude-sonnet-5-5",
        max_tokens: 16000,
        tools: [tool],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: prompt + "\n\nSave the copy with the save_page_copy tool." }],
      }),
    });
    const body = await r.json();
    if (!r.ok) return json({ error: `Anthropic ${r.status}: ${body?.error?.message || "request failed"}` }, 502);
    let copy: any = (body.content || []).find((c: any) => c.type === "tool_use")?.input;
    if (!copy) {
      const text = (body.content || []).map((c: any) => c.text || "").join("");
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s < 0 || e < s) return json({ error: `No copy in the reply (stop_reason: ${body.stop_reason}). ${text.slice(0, 200)}` }, 502);
      copy = JSON.parse(text.slice(s, e + 1));
    }
    return json({ ok: true, copy, facts });
  } catch (err: any) {
    return json({ error: err?.message || "Auto-fill failed" }, 500);
  }
};