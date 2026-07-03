import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const args = process.argv.slice(2);
const city = args[args.indexOf("--city") + 1] || "fernie";
const targetArea = args.includes("--area")
  ? args[args.indexOf("--area") + 1]
  : null;
const overwrite = args.includes("--overwrite");

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const titleCase = (s = "") =>
  s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const moneyK = (n: any) => {
  const v = Number(n || 0);
  return v > 0 ? `$${Math.round(v / 1000)}k` : "n/a";
};

function median(values: number[]) {
  const nums = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!nums.length) return 0;
  return nums[Math.floor(nums.length / 2)];
}

function haversineKm(a: number, b: number, c: number, d: number) {
  const R = 6371;
  const dL = ((c - a) * Math.PI) / 180;
  const dl = ((d - b) * Math.PI) / 180;
  const x =
    Math.sin(dL / 2) ** 2 +
    Math.cos((a * Math.PI) / 180) *
      Math.cos((c * Math.PI) / 180) *
      Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getPolygonRing(g: any) {
  if (g?.type === "Feature") return g.geometry?.coordinates?.[0];
  if (g?.type === "FeatureCollection") return g.features?.[0]?.geometry?.coordinates?.[0];
  if (g?.type === "Polygon") return g.coordinates?.[0];
  return g?.coordinates?.[0];
}

function getCentroid(g: any) {
  const c = getPolygonRing(g);
  if (!Array.isArray(c) || !c.length) return null;

  return {
    lat: c.map((x: any) => x[1]).reduce((a: number, b: number) => a + b, 0) / c.length,
    lng: c.map((x: any) => x[0]).reduce((a: number, b: number) => a + b, 0) / c.length,
  };
}

function pip(point: [number, number], g: any) {
  const c = getPolygonRing(g);
  if (!c) return false;

  const [x, y] = point;
  let inside = false;

  for (let a = 0, b = c.length - 1; a < c.length; b = a++) {
    const [xi, yi] = c[a];
    const [xj, yj] = c[b];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

async function fetchOSM(lat: number, lng: number) {
  const r = 3000;

  const q = `[out:json][timeout:25];(
node["amenity"="school"](around:${r},${lat},${lng});
node["leisure"="park"](around:${r},${lat},${lng});
node["amenity"="bus_stop"](around:${r},${lat},${lng});
node["shop"="supermarket"](around:${r},${lat},${lng});
node["amenity"="restaurant"](around:${r},${lat},${lng});
node["amenity"="cafe"](around:${r},${lat},${lng});
node["amenity"="hospital"](around:${r},${lat},${lng});
node["amenity"="clinic"](around:${r},${lat},${lng});
node["leisure"="ski_resort"](around:${r},${lat},${lng});
);out body;`;

  for (const u of [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ]) {
    try {
      const res = await fetch(u, {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "bc-realestate/2.0",
        },
      });

      const t = await res.text();
      if (!t.trim().startsWith("{")) continue;

      const els = JSON.parse(t).elements || [];

      const out: Record<string, any[]> = {
        school: [],
        park: [],
        transit: [],
        grocery: [],
        restaurant: [],
        medical: [],
        ski: [],
      };

      const cat = (el: any) => {
        const a = el.tags?.amenity || "";
        const l = el.tags?.leisure || "";
        const s = el.tags?.shop || "";

        if (["school", "college"].includes(a)) return "school";
        if (l === "park") return "park";
        if (a === "bus_stop") return "transit";
        if (s === "supermarket") return "grocery";
        if (["restaurant", "cafe"].includes(a)) return "restaurant";
        if (["hospital", "clinic"].includes(a)) return "medical";
        if (l === "ski_resort") return "ski";

        return null;
      };

      els.forEach((el: any) => {
        const c = cat(el);
        if (!c || !el.lat || !el.lon) return;

        const d = haversineKm(lat, lng, el.lat, el.lon);
        if (d > 5) return;

        out[c].push({
          name: el.tags?.name || "",
          dist: Math.round(d * 10) / 10,
        });
      });

      return out;
    } catch (e: any) {
      console.warn("OSM failed:", e.message);
    }
  }

  return {};
}

function buildCensusSummary(census: any) {
  if (!census) return "No census data available.";

  return [
    census.population_2021 ? `Population 2021: ${census.population_2021}` : "",
    census.population_2016 ? `Population 2016: ${census.population_2016}` : "",
    census.pop_change_pct ? `Population growth 2016-2021: ${census.pop_change_pct}%` : "",
    census.median_age ? `Median age: ${census.median_age}` : "",
    census.pct_owned ? `Owner-occupied households: ${census.pct_owned}%` : "",
    census.pct_rented ? `Renter-occupied households: ${census.pct_rented}%` : "",
    census.median_household_income
      ? `Median household income: ${moneyK(census.median_household_income)}`
      : "",
    census.median_dwelling_value
      ? `Median dwelling value: ${moneyK(census.median_dwelling_value)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n") || "No census data available.";
}

function buildAmenitySummary(osm: any) {
  const lines = Object.entries(osm || {})
    .filter(([, v]: any) => Array.isArray(v) && v.length)
    .map(([k, v]: any) => {
      const examples = v
        .slice(0, 3)
        .map((i: any) => i.name)
        .filter(Boolean)
        .join(", ");

      return examples
        ? `${k}: ${v.length} nearby, including ${examples}`
        : `${k}: ${v.length} nearby`;
    });

  return lines.length ? lines.join("\n") : "No nearby amenities found from OSM.";
}

function buildMarketSummary(listings: any[]) {
  const active = listings.filter((l) => String(l.status || "").toUpperCase() === "A");
  const pending = listings.filter((l) => String(l.status || "").toUpperCase().includes("P"));
  const sold = listings.filter((l) => String(l.status || "").toUpperCase().includes("S"));

  const activePrices = active.map((l) => Number(l.price || 0));
  const soldPrices = sold.map((l) => Number(l.sold_price || l.close_price || l.price || 0));

  const types: Record<string, number> = {};
  active.forEach((l) => {
    const t = String(l.normalized_type || "unknown").toLowerCase();
    types[t] = (types[t] || 0) + 1;
  });

  const activeCount = active.length;
  const pendingCount = pending.length;
  const soldCount = sold.length;
  const activityIndex =
    activeCount > 0 ? Math.round(((pendingCount + soldCount) / activeCount) * 100) : null;

  return {
    activeCount,
    pendingCount,
    soldCount,
    medianListPrice: median(activePrices),
    medianSoldPrice: median(soldPrices),
    propertyTypes: types,
    activityIndex,
    text: [
      `Active listings: ${activeCount}`,
      `Pending listings: ${pendingCount}`,
      `Recent sold listings: ${soldCount}`,
      `Median active list price: ${moneyK(median(activePrices))}`,
      soldCount ? `Median sold price: ${moneyK(median(soldPrices))}` : "",
      activityIndex !== null ? `Activity index: ${activityIndex}` : "",
      `Active property type mix: ${JSON.stringify(types)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

const CITY_CONTEXT: Record<string, string> = {
  fernie: `Fernie is a mountain town in the Elk Valley of southeastern BC. It is influenced by Fernie Alpine Resort, mountain biking, the Elk River, tourism, remote workers, second-home buyers, and families looking for a smaller-town lifestyle.`,

  nanaimo: `Nanaimo is a central Vancouver Island city with ferry access, employment nodes, VIU, waterfront areas, established suburbs, newer north-end growth, and a broad range of detached homes, condos, townhomes, mobile homes, and acreages.`,

  parksville: `Parksville is a Vancouver Island seaside market known for beaches, retirees, downsizers, resort properties, golf, and access to Qualicum Beach, French Creek, Nanoose Bay, and surrounding rural communities.`,

  tofino: `Tofino is a west coast Vancouver Island resort and lifestyle market shaped by tourism, surfing, beaches, limited land supply, short-term rental rules, second-home demand, and permanent-resident housing constraints.`,
};

function buildPrompt({
  area,
  city,
  market,
  censusText,
  amenitiesText,
}: {
  area: string;
  city: string;
  market: any;
  censusText: string;
  amenitiesText: string;
}) {
  const cityKey = city.toLowerCase();

  return `
You are writing neighbourhood intelligence copy for a BC real estate platform.

Write for: ${titleCase(area)}, ${titleCase(city)}, BC.

VOICE:
Write like a knowledgeable local REALTOR.
Specific, practical, confident.
No fluff.
No hype.
No generic tourism language.

BANNED PHRASES:
- nestled
- vibrant community
- something for everyone
- hidden gem
- perfect blend
- dream home
- must-see
- sought-after unless the data supports it

CORE JOB:
Do not simply describe the neighbourhood.
Interpret the data for buyers.

Explain:
- who the area likely suits
- what the housing stock suggests
- what the market data suggests
- what the census data suggests
- what the amenity pattern suggests
- what the trade-offs are
- whether the area feels more established, transitional, family-oriented, value-oriented, lifestyle-oriented, or investor-relevant

STRICT DATA RULES:
Never invent numbers.
Never invent sales history.
Never invent schools, parks, transit, beaches, trails, or views.
Only mention a statistic if it helps explain buyer demand, affordability, lifestyle, ownership stability, growth, or long-term value.
Do not mention every statistic.
Do not say "data suggests" unless you explain which data supports the point.
Do not claim ocean views, waterfront, ski access, walkability, or investment upside unless the supplied data/context supports it.

STYLE TARGET:
The copy should feel like local market intelligence, not SEO filler.

QUALITY EXAMPLE:
"North Nanaimo is where Nanaimo growth has concentrated for the past two decades — newer subdivisions, national retailers, good schools, and the kind of infrastructure that draws families who want to plant roots rather than renovate. The homes here are newer and larger than the city average, with more garages, more square footage, and more uniform streetscapes. The trade-off is character — you are buying function and reliability over history or surprise."

CITY CONTEXT:
${CITY_CONTEXT[cityKey] || `Use only the supplied data and general BC real estate context for ${titleCase(city)}.`}

MARKET DATA:
${market.text}

CENSUS DATA:
${censusText}

AMENITIES WITHIN ROUGHLY 3KM:
${amenitiesText}

OUTPUT REQUIREMENTS:
Return ONLY valid JSON.
No markdown.
No commentary.

JSON SHAPE:
{
  "market_snapshot_ai": "1-2 sentences. What is happening now in this neighbourhood market.",
  "buyer_insight_ai": "1-2 sentences. Who this area likely suits and why.",
  "long_term_outlook_ai": "1-2 sentences. Long-term buyer demand factors without predicting prices.",
  "hero_summary": "1 sentence, 25-35 words. Data-informed, buyer-facing.",
  "neighbourhood_copy": "About 200 words, 2-3 paragraphs.",
  "seo_long": "About 280 words, 3-4 paragraphs."
}
`;
}

async function fetchListingsForCity(city: string) {
  const { data, error } = await supabase
    .from("listing_rows")
    .select("*")
    .eq("normalized_city", city.toLowerCase());

  if (error) throw error;
  return data || [];
}

async function generateCopyForArea(areaRow: any) {
  const areaName = areaRow.area_name || areaRow.area_slug;

  console.log(`\n→ ${titleCase(areaName)}`);

  if (!overwrite && areaRow.neighbourhood_copy && areaRow.neighbourhood_copy.trim().length > 100) {
    console.log("  ✓ Has copy, skipping");
    return;
  }

  const centroid = getCentroid(areaRow.polygon_geojson);

  if (!centroid) {
    console.log("  ✗ No polygon");
    return;
  }

  console.log(`  centroid: ${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`);

  const allListings = await fetchListingsForCity(city);

  const polygonListings = allListings.filter((l: any) => {
    const lat = Number(l.lat);
    const lng = Number(l.lng);
    return lat && lng && pip([lng, lat], areaRow.polygon_geojson);
  });

  console.log(`  polygon listings/sales: ${polygonListings.length}`);

  const { data: census } = await supabase
    .from("neighbourhood_census_data")
    .select("*")
    .eq("city", titleCase(city))
    .eq("neighbourhood", titleCase(areaName))
    .maybeSingle();

  const { data: cityCensus } = await supabase
    .from("city_census_data")
    .select("*")
    .eq("city", titleCase(city))
    .maybeSingle();

  console.log(`  census: ${census ? "neighbourhood" : cityCensus ? "city fallback" : "none"}`);

  console.log("  fetching OSM...");
  const osm = await fetchOSM(centroid.lat, centroid.lng);

  console.log(
    `  OSM: ${
      Object.entries(osm)
        .filter(([, v]: any) => v.length)
        .map(([k, v]: any) => `${k}:${v.length}`)
        .join(" ") || "none"
    }`
  );

  const market = buildMarketSummary(polygonListings);
  const censusText = buildCensusSummary(census || cityCensus);
  const amenitiesText = buildAmenitySummary(osm);

  console.log("  calling Claude...");

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [
      {
        role: "user",
        content: buildPrompt({
          area: areaName,
          city,
          market,
          censusText,
          amenitiesText,
        }),
      },
    ],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";

  let parsed: any;

  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    console.log("  ✗ Parse failed:", raw.slice(0, 300));
    return;
  }

  console.log(`  hero_summary: ${parsed.hero_summary?.length || 0} chars`);
  console.log(`  buyer_insight: ${parsed.buyer_insight?.length || 0} chars`);
  console.log(`  market_summary: ${parsed.market_summary?.length || 0} chars`);
  console.log(`  demographic_summary: ${parsed.demographic_summary?.length || 0} chars`);
  console.log(`  neighbourhood_copy: ${parsed.neighbourhood_copy?.length || 0} chars`);
  console.log(`  seo_long: ${parsed.seo_long?.length || 0} chars`);

  const updatePayload: any = {
  neighbourhood_copy: parsed.neighbourhood_copy || null,
  seo_long: parsed.seo_long || null,
  market_snapshot_ai: parsed.market_snapshot_ai || null,
  buyer_insight_ai: parsed.buyer_insight_ai || null,
  long_term_outlook_ai: parsed.long_term_outlook_ai || null,
  ai_insights_generated_at: new Date().toISOString(),
};

  // These columns are optional. Add them later if they do not exist yet.
  if ("hero_summary" in areaRow) updatePayload.hero_summary = parsed.hero_summary || null;
  if ("buyer_insight" in areaRow) updatePayload.buyer_insight = parsed.buyer_insight || null;
  if ("market_summary" in areaRow) updatePayload.market_summary = parsed.market_summary || null;
  if ("demographic_summary" in areaRow)
    updatePayload.demographic_summary = parsed.demographic_summary || null;

  const { error } = await supabase
    .from("area_boundaries")
    .update(updatePayload)
    .eq("id", areaRow.id);

  if (error) console.log("  ✗ Save failed:", error.message);
  else console.log("  ✓ Saved");

  await new Promise((r) => setTimeout(r, 1200));
}

async function main() {
  console.log(
    `\nGenerating V2: ${titleCase(city)}${targetArea ? ` / ${targetArea}` : ""}, overwrite:${overwrite}`
  );

  let q = supabase.from("area_boundaries").select("*").eq("city", city.toLowerCase());

  if (targetArea) q = q.eq("area_slug", targetArea);

  const { data: areas, error } = await q;

  if (error || !areas?.length) {
    console.error("No areas:", error?.message);
    process.exit(1);
  }

  console.log(`Found ${areas.length} area(s)`);

  for (const area of areas) {
    await generateCopyForArea(area);
  }

  console.log("\n✓ Done\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});