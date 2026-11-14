// Nightly: local housing headlines per market from Google News RSS -> market_news
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const tag = (xml, t) => decode((xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]);
const { data: comps, error } = await db.from("market_indexes").select("city").is("prop_type", null).is("area_slug", null).is("parent_ticker", null);
if (error) { console.error(error.message); process.exit(1); }
const cities = [...new Set((comps || []).map((c) => String(c.city || "").trim()).filter(Boolean))];
const BC_PLACES = ["nanaimo", "victoria", "saanich", "oak bay", "esquimalt", "langford", "colwood", "sooke", "goldstream", "peninsula", "sidney", "cowichan", "duncan", "ladysmith", "parksville", "qualicum", "comox", "courtenay", "campbell river", "port alberni", "alberni", "tofino", "ucluelet", "westerly", "vancouver island", "island", "kootenay", "fernie", "elk valley", "cranbrook", "kimberley", "nelson", "rossland", "trail", "castlegar", "revelstoke", "golden", "invermere", "columbia valley", "whistler", "squamish", "sea to sky", "kamloops", "sun peaks", "okanagan", "kelowna", "b.c.", "bc "];
const BC_SOURCES = ["times colonist", "nanaimo news", "nanaimonewsnow", "chek", "castanet", "my comox valley now", "my cowichan valley now", "my east kootenay now", "my nanaimo now", "mypowellrivernow", "victoria news", "saanich news", "sooke news mirror", "peninsula news review", "goldstream gazette", "oak bay news", "cowichan valley citizen", "ladysmith chronicle", "parksville qualicum beach news", "pqb news", "comox valley record", "campbell river mirror", "alberni valley news", "westerly news", "nelson star", "revelstoke review", "revelstoke mountaineer", "golden star", "kimberley bulletin", "cranbrook townsman", "the free press", "e-know", "columbia valley pioneer", "rossland news", "trail times", "pique", "whistler question", "kamloops this week", "cfjc", "victoria buzz", "capital daily", "vancouver island free daily", "black press", "cbc", "ctv news", "global news", "vancouver sun", "the province", "business in vancouver", "biv", "western investor", "daily hive", "the tyee", "vancouver is awesome", "bc gov news", "news.gov.bc.ca"];
const HOUSING = /\b(real estate|realtor|housing|home|homes|house|houses|condo|townhouse|rental|rentals|rent|renters|tenant|landlord|property|properties|development|developer|zoning|rezoning|subdivision|lot|lots|land|market|prices?|sales?|sold|listing|listings|mortgage|affordab|density|apartment|units?|build|construction|assessment|strata)\b/i;
const SPAM = /livestrea|live free|\bvs\.?\b|stream|game on tv|kill|murder|homicide|parole|sentenc|charged|arrest|rcmp|police|court|trial|stab|shoot|assault|fatal|dies|died|death|obituar|crash|overdose|missing/i;const AMBIGUOUS = new Set(["victoria", "greater victoria", "duncan", "cumberland", "nelson", "golden", "kimberley", "sidney", "ladysmith", "black creek", "columbia valley", "oak bay", "victoria west"]);
let total = 0;
for (const city of cities) {
  const label = city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const q = `"${label}" (real estate OR housing OR homes OR rent OR rental OR property OR development OR rezoning) when:90d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-CA&gl=CA&ceid=CA:en`;
  try {
    const xml = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
    const raw = [...xml.matchAll(/<item>/g)].length;
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const it = m[1]; const source = tag(it, "source");
      let title = tag(it, "title"); if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
      return { city, title, url: tag(it, "link"), source, published_at: new Date(tag(it, "pubDate")).toISOString() };
    }).filter((n) => n.title && n.url && (!AMBIGUOUS.has(city.toLowerCase()) || n.title.toLowerCase().includes(label.toLowerCase().split(" ")[0])) && (!AMBIGUOUS.has(city.toLowerCase()) || BC_SOURCES.some((s) => n.source.toLowerCase().includes(s)) || BC_PLACES.some((s) => n.source.toLowerCase().includes(s))) && HOUSING.test(n.title) && !SPAM.test(n.title))
      .sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 8);
    if (items.length) {
      const { error: e } = await db.from("market_news").upsert(items, { onConflict: "url" });
      if (e) console.warn(`${label}: ${e.message}`); else total += items.length;
    }
    console.log(`${label.padEnd(20)} ${String(raw).padStart(3)} found -> ${items.length} kept`);
  } catch (e) { console.warn(`${label}: ${e.message}`); }
  await sleep(700);
}
await db.from("market_news").delete().lt("published_at", new Date(Date.now() - 90 * 864e5).toISOString());
console.log(`News stored: ${total}`);