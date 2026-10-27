import { createClient } from "@supabase/supabase-js";

// Property-type pages only. Weekly refresh: netlify/functions/type-copy-schedule.ts
export const TYPE_PAGES: Record<string, { type: string; label: string }> = {
  homes: { type: "house", label: "detached homes" },
  condos: { type: "condo", label: "condos" },
  townhomes: { type: "townhouse", label: "townhomes" },
  "mobile-homes": { type: "mobile", label: "mobile and manufactured homes" },
  land: { type: "land", label: "lots and land" },
};

const FRACTIONAL = /fraction|quarter[- ]?(share|ownership|interest)|\b1\/\d+\s*(share|ownership|interest|title)|shared ownership|co-?ownership|time ?share|interval ownership|deeded weeks?|weeks? (per|a|each) year/i;
const title = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const median = (v: number[]) => {
  const s = v.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
};
const GV_CITIES = ["victoria", "victoria west", "saanich", "oak bay", "esquimalt", "view royal", "colwood", "langford", "highlands", "metchosin", "sooke", "central saanich", "north saanich", "sidney"];
const SOURCES: Record<string, { cities: string[]; areaPrefix?: string }> = { "saanich-east": { cities: ["saanich"], areaPrefix: "se " }, "saanich-west": { cities: ["saanich"], areaPrefix: "sw " }, "greater-victoria": { cities: GV_CITIES } };
const db = () => createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function listTypePageCities(): Promise<string[]> {
  const { data, error } = await db().from("intent_pages").select("city, slug").eq("is_published", true).range(0, 9999);
  if (error) throw error;
  return [...new Set((data || []).filter((r: any) => Object.keys(TYPE_PAGES).some((k) => r.slug === k || r.slug === `${r.city}-${k}`)).map((r: any) => String(r.city || "").trim()).filter(Boolean))];
}

async function writeCopy(facts: any) {
  const prompt = `Write website copy for a real estate search page listing ${facts.propertyType} for sale in ${facts.city}, BC. The reader is a buyer browsing listings.
Rules:
- Use only the facts in DATA. You may refer to widely known geography of ${facts.city} in general terms only.
- Do not name schools, businesses, builders or brokerages. Do not invent statistics, trends or forecasts.
- Do not describe who should live there or use demographic language.
- Plain, local, practical tone. Canadian spelling. No hype words (stunning, nestled, dream, gem, paradise).
- This copy is refreshed weekly while listings change daily: do not quote exact listing counts. Describe the mix in proportions (most, about half, a few) and give rounded price ranges and medians, e.g. $1.05M, $540K.
- Use each number at most once across all fields. seo_long must add new detail, not restate seo_body.
- Write for a person deciding where to look, not as a list of statistics.
- If a fact is missing or null, leave it out silently; never mention missing data or what the data can't show.
- fractionalShares (if present) are fractional or quarter-share ownership listings, kept out of the main figures. Mention them briefly as a separate, lower-cost, part-year option; never mix them into the main price ranges.
Return only JSON with these keys:
hero: 2-3 sentences, 45-70 words, shown at the top of the page above the listings; a quick, specific picture of what is for sale now (rounded price range, where most listings are, what a typical one offers), plus a short clause on fractional shares if fractionalShares is present; must not repeat seo_intro
seo_heading: under 60 characters
seo_intro: 2 sentences
seo_body: one paragraph, 60-90 words, what current listings look like by price band and area
seo_long: three short paragraphs separated by a blank line, 180-260 words in total, covering price ranges, where listings are concentrated, and what buyers typically get for the money
market_commentary: 2 sentences on recent market conditions using only the latest month and one comparison from the market figures given, or an empty string if none are given
DATA:
${JSON.stringify(facts, null, 2)}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.COPY_MODEL || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(body)}`);
  const text = (body.content || []).map((c: any) => c.text || "").join("");
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e < s) throw new Error(`No JSON in reply. stop_reason=${body.stop_reason}, text: ${text.slice(0, 600)}`);
  return JSON.parse(text.slice(s, e + 1));
}

export async function generateTypeCopy(city: string, opts: { dry?: boolean; force?: boolean; verbose?: boolean } = {}) {
  const supabase = db();
  const { data: rawRows, error } = await supabase
    .from("listing_rows")
    .select("normalized_type, normalized_area, price, beds, sqft, year_built, lot_size_acres, description")
    .in("normalized_city", SOURCES[city]?.cities || [city.replace(/-/g, " ")]).eq("status", "A").neq("property_type", "Lease").range(0, 9999);
  if (error) throw error;
  const rows = (rawRows || []).filter((r: any) => !SOURCES[city]?.areaPrefix || String(r.normalized_area || "").startsWith(SOURCES[city]!.areaPrefix!));
  const { data: months } = await supabase
    .from("market_monthly_stats")
    .select("month_start, sales, active_listings, median_single_family_sold_price, median_days_on_market")
    .eq("city", city).order("month_start", { ascending: false }).limit(3);
  const { data: pages, error: pErr } = await supabase.from("intent_pages").select("id, slug, seo_intro").eq("city", city).in("slug", Object.keys(TYPE_PAGES).flatMap((k) => [k, `${city}-${k}`]));
  if (pErr) throw pErr;

  let saved = 0;
  for (const [slug, t] of Object.entries(TYPE_PAGES)) {
    try {
      const targets = (pages || []).filter((p: any) => (p.slug === slug || p.slug === `${city}-${slug}`) && (opts.force || !p.seo_intro));
      if (!targets.length) continue;
      const typed = (rows || []).filter((r: any) => r.normalized_type === t.type);
      const list = typed.filter((r: any) => !FRACTIONAL.test(String(r.description || "")));
      if (typed.length !== list.length) console.log(`${city}/${slug}: left out ${typed.length - list.length} fractional listing(s)`);
      const fracPrices = typed.filter((r: any) => FRACTIONAL.test(String(r.description || ""))).map((r: any) => Number(r.price || 0)).filter(Boolean).sort((a: number, b: number) => a - b);
      if (!list.length) continue;
      const prices = list.map((r: any) => Number(r.price || 0)).filter(Boolean).sort((a: number, b: number) => a - b);
      const areas: Record<string, number[]> = {};
      for (const r of list as any[]) {
        const a = String(r.normalized_area || "").trim();
        if (a && a !== "unknown") (areas[a] ||= []).push(Number(r.price || 0));
      }
      const facts: any = {
        city: title(city), propertyType: t.label, activeListings: list.length,
        medianAsk: median(prices), lowestAsk: prices[0] || null, highestAsk: prices.at(-1) || null,
        under500k: prices.filter((p: number) => p < 500000).length,
        from500kTo1m: prices.filter((p: number) => p >= 500000 && p < 1000000).length,
        over1m: prices.filter((p: number) => p >= 1000000).length,
        topAreas: Object.entries(areas).sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([a, p]) => ({ area: title(a.replace(/^(se|sw|pq) /i, "")), listings: p.length, medianAsk: median(p) })),
        medianBeds: t.type === "land" ? null : median(list.map((r: any) => Number(r.beds || 0))),
        medianSqft: t.type === "land" ? null : median(list.map((r: any) => Number(r.sqft || 0))),
        medianYearBuilt: t.type === "land" ? null : median(list.map((r: any) => Number(r.year_built || 0))),
        medianLotAcres: t.type === "land" || t.type === "house" ? median(list.map((r: any) => Number(r.lot_size_acres || 0))) : null,
      };
      if (fracPrices.length) facts.fractionalShares = { listings: fracPrices.length, lowestAsk: fracPrices[0], highestAsk: fracPrices.at(-1), medianAsk: median(fracPrices) };
      const recent = (months || []).filter((m: any) => Number(m.sales || 0) > 0);
      if (recent.length) facts.wholeMarketLast3Months = recent.map((m: any) => ({
        month: String(m.month_start).slice(0, 7), sales: m.sales, activeListings: m.active_listings, medianDaysOnMarket: m.median_days_on_market,
        ...(t.type === "house" ? { medianSingleFamilySoldPrice: m.median_single_family_sold_price } : {}),
      }));
      const copy = await writeCopy(facts).catch(() => writeCopy(facts));
      const update: any = { ...(copy.hero ? { intro_copy: copy.hero } : {}), seo_heading: copy.seo_heading, seo_intro: copy.seo_intro, seo_body: copy.seo_body, seo_long: copy.seo_long, market_commentary: copy.market_commentary || null };
      if (opts.dry || opts.verbose) console.log(`\n===== ${city}/${slug} =====\n${update.seo_heading}\n\n${update.seo_intro}\n\n${update.seo_body}\n\n${update.seo_long}\n\n${update.market_commentary || ""}`);
      if (opts.dry) continue;
      const { error: uErr } = await supabase.from("intent_pages").update(update).in("id", targets.map((p: any) => p.id));
      if (uErr) throw uErr;
      saved += targets.length;
    } catch (err: any) {
      console.error(`${city}/${slug}: copy failed - ${err?.message || err}`);
    }
  }
  console.log(`${city}: type copy ${opts.dry ? "dry run, nothing written" : `saved to ${saved} page row(s)`}`);
  return { city, saved };
}
