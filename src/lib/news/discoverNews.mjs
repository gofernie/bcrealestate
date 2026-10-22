// Local news discovery: reads municipal / regional / local-outlet sources, has Claude decide what
// matters to buyers and which town it belongs to, and saves it to local_news.
// Used by scripts/discover-news.mjs (manual) and the daily Netlify job (news-discover-background).
import { createClient } from '@supabase/supabase-js';

const UA = 'Mozilla/5.0 (compatible; LocalNewsBot/1.0; +https://chriscrump.com)';

// Town keys must match the city slugs the pages use (LocalNews.astro REGIONS).
export const REGIONS = {
  'elk-valley': {
    place: 'Fernie and Sparwood, BC (Elk Valley)',
    who: 'Fernie or Sparwood',
    areas: ['fernie', 'sparwood', 'elk-valley'],
    rules: '"fernie", "sparwood", "elk-valley" (affects both or the whole valley), or "none" (elsewhere, e.g. Cranbrook, Kimberley, Columbia Valley, Invermere). RDEK electoral areas: Area A is the rural Elk Valley around Fernie, Sparwood and Elkford (use "elk-valley"); Areas B, C, E, F and G are outside the Elk Valley (use "none"). Area F is the Columbia Valley, NOT Fernie.',
  },
  nanaimo: {
    place: 'Nanaimo, BC and the surrounding Regional District of Nanaimo (RDN) on Vancouver Island',
    who: 'Nanaimo or the surrounding RDN',
    areas: ['nanaimo', 'rdn'],
    rules: '"nanaimo" (the City of Nanaimo itself), "rdn" (region-wide, or affects nearby RDN communities: Lantzville, Parksville, Qualicum Beach, Nanoose Bay, Cedar, Gabriola or RDN electoral areas), or "none" (elsewhere, e.g. Ladysmith, Duncan, Port Alberni, Comox Valley, Victoria, or provincial/national stories with no specific Nanaimo-area impact).',
  },
  crd: {
    place: 'Greater Victoria (the Capital Regional District) on southern Vancouver Island, BC',
    who: 'Greater Victoria',
    areas: ['victoria', 'victoria-west', 'saanich', 'langford', 'colwood', 'oak-bay', 'esquimalt', 'view-royal', 'sidney', 'north-saanich', 'central-saanich', 'highlands', 'metchosin', 'sooke', 'crd'],
    rules: 'the single municipality it affects: "victoria", "victoria-west" (only the Vic West neighbourhood of Victoria), "saanich", "langford", "colwood", "oak-bay", "esquimalt", "view-royal", "sidney", "north-saanich", "central-saanich", "highlands", "metchosin", "sooke"; or "crd" (region-wide, or several Greater Victoria communities); or "none" (outside Greater Victoria, or provincial/national stories with no specific local impact).',
  },
  cowichan: {
    place: 'the Cowichan Valley on Vancouver Island, BC (Duncan, North Cowichan, Ladysmith, Chemainus, Crofton, Mill Bay, Lake Cowichan)',
    who: 'the Cowichan Valley',
    areas: ['duncan', 'ladysmith', 'chemainus', 'crofton', 'mill-bay', 'cvrd'],
    rules: '"duncan" (City of Duncan, or North Cowichan areas right around Duncan), "ladysmith", "chemainus", "crofton", "mill-bay", or "cvrd" (Cowichan region-wide, North Cowichan municipality-wide, Lake Cowichan, Cowichan Bay, Shawnigan or other electoral areas), or "none" (outside the Cowichan Valley).',
  },
  'comox-valley': {
    place: 'the Comox Valley on Vancouver Island, BC (Courtenay, Comox, Cumberland and rural areas)',
    who: 'the Comox Valley',
    areas: ['courtenay', 'comox', 'cumberland', 'comox-valley'],
    rules: '"courtenay", "comox", "cumberland", or "comox-valley" (region-wide, or rural areas such as Royston, Union Bay, Fanny Bay, Black Creek, Merville, Denman or Hornby Island), or "none" (outside the Comox Valley).',
  },
  'campbell-river': {
    place: 'Campbell River and the Strathcona Regional District on Vancouver Island, BC',
    who: 'Campbell River',
    areas: ['campbell-river', 'srd'],
    rules: '"campbell-river" (the City of Campbell River), "srd" (region-wide or Strathcona electoral areas near Campbell River), or "none" (elsewhere, e.g. Cortes or Quadra-only issues with no Campbell River impact, Gold River, Sayward, Tahsis, or provincial stories).',
  },
  alberni: {
    place: 'the Alberni Valley and west coast of Vancouver Island, BC (Port Alberni, Tofino, Ucluelet)',
    who: 'Port Alberni or Tofino',
    areas: ['port-alberni', 'tofino', 'alberni'],
    rules: '"port-alberni", "tofino", or "alberni" (region-wide, Ucluelet, Beaver Creek, Sproat Lake or other ACRD areas), or "none" (elsewhere).',
  },
  whistler: {
    place: 'Whistler, BC',
    who: 'Whistler',
    areas: ['whistler'],
    rules: '"whistler", or "none" (elsewhere, e.g. Squamish, Pemberton, Vancouver, or provincial stories with no specific Whistler impact).',
  },
};

// prefilter:false = government sources, every item goes to the AI (low volume, high value)
export const SOURCES = [
  // Elk Valley
  { region: 'elk-valley', name: 'City of Fernie', type: 'rss', url: 'https://www.fernie.ca/EN/meta/whats-new/rss/latest-news.rss', base: 'https://www.fernie.ca', prefilter: false },
  { region: 'elk-valley', name: 'RDEK', type: 'html', url: 'https://www.rdek.bc.ca/news', base: 'https://www.rdek.bc.ca', match: /\/news\/entry\//, prefilter: false },
  { region: 'elk-valley', name: 'District of Sparwood', type: 'html', url: 'https://www.sparwood.ca/municipal-hall/news-updates', base: 'https://www.sparwood.ca', match: /\/news-updates\/post\//, prefilter: false },
  { region: 'elk-valley', name: 'e-KNOW', type: 'wp', url: 'https://www.e-know.ca/wp-json/wp/v2/posts?categories=61&per_page=30&_fields=date_gmt,link,title,content', prefilter: true },

  // Nanaimo / RDN
  { region: 'nanaimo', name: 'City of Nanaimo', type: 'html', url: 'https://www.nanaimo.ca/your-government/news-events/news', base: 'https://www.nanaimo.ca', match: /\/NewsReleases\/NR\d+/i, prefilter: false },
  { region: 'nanaimo', name: 'RDN', type: 'html', url: 'https://www.rdn.bc.ca/news-releases', base: 'https://www.rdn.bc.ca', match: /\/notice-\d{4}-\d{2}-\d{2}/, prefilter: false },
  { region: 'nanaimo', name: 'NanaimoNewsNOW', type: 'wp', url: 'https://nanaimonewsnow.com/wp-json/wp/v2/posts?categories=5&per_page=30&_fields=date_gmt,link,title,content', prefilter: true },

  // Greater Victoria (View Royal and North Saanich block automated reads; CRD covers them)
  { region: 'crd', name: 'CRD', type: 'html', url: 'https://www.crd.ca/about/news', base: 'https://www.crd.ca', match: /\/news\/[a-z0-9-]{12,}\/?$/, prefilter: false },
  { region: 'crd', name: 'City of Victoria', type: 'html', url: 'https://www.victoria.ca/city-government/news', base: 'https://www.victoria.ca', match: /\/city-government\/news\/[a-z0-9-]{12,}\/?$/, prefilter: false },
  { region: 'crd', name: 'District of Saanich', type: 'html', url: 'https://www.saanich.ca/EN/main/news-events/latest-news.html', base: 'https://www.saanich.ca', match: /\/news-archives\/\d{4}-news\/[a-z0-9-]+\.html/, prefilter: false },
  { region: 'crd', name: 'City of Langford', type: 'wp', url: 'https://langford.ca/wp-json/wp/v2/posts?per_page=20&_fields=date_gmt,link,title,content', prefilter: false },
  { region: 'crd', name: 'City of Colwood', type: 'html', url: 'https://www.colwood.ca/news', base: 'https://www.colwood.ca', match: /\/news\/[a-z0-9][a-z0-9-]{8,}/, prefilter: false },
  { region: 'crd', name: 'District of Oak Bay', type: 'html', url: 'https://www.oakbay.ca/news', base: 'https://www.oakbay.ca', match: /\/news\/[a-z0-9][\w-]{2,}\/?$/, prefilter: false },
  { region: 'crd', name: 'Township of Esquimalt', type: 'html', url: 'https://www.esquimalt.ca/news', base: 'https://www.esquimalt.ca', match: /\/community-events\/news\/[a-z0-9-]{8,}/, prefilter: false },
  { region: 'crd', name: 'Town of Sidney', type: 'html', url: 'https://www.sidney.ca/news', base: 'https://www.sidney.ca', match: /\/news\/[a-z0-9-]{8,}\/?$/, prefilter: false },
  { region: 'crd', name: 'District of Central Saanich', type: 'html', url: 'https://www.centralsaanich.ca/news', base: 'https://www.centralsaanich.ca', match: /\/our-community\/news\/[a-z0-9-]{8,}/, prefilter: false },
  { region: 'crd', name: 'District of Sooke', type: 'html', url: 'https://www.sooke.ca/news-and-public-notices/', base: 'https://www.sooke.ca', match: /\/news-and-public-notices\/posts\/[a-z0-9-]+/, prefilter: false },

  // Cowichan Valley (Ladysmith blocks automated reads; CVRD covers it)
  { region: 'cowichan', name: 'City of Duncan', type: 'rss', url: 'https://duncan.ca/feed/', base: 'https://duncan.ca', prefilter: false },
  { region: 'cowichan', name: 'North Cowichan', type: 'html', url: 'https://www.northcowichan.ca/news', base: 'https://www.northcowichan.ca', match: /^(?:https?:\/\/[^/]+)?\/news\/[a-z0-9-]{8,}\/?$/, prefilter: false },
  { region: 'cowichan', name: 'Cowichan Valley RD', type: 'wp', url: 'https://cvrd.ca/wp-json/wp/v2/posts?per_page=20&_fields=date_gmt,link,title,content', prefilter: false },

  // Comox Valley (Courtenay blocks automated reads; Comox Valley RD covers it)
  { region: 'comox-valley', name: 'Town of Comox', type: 'html', url: 'https://www.comox.ca/news', base: 'https://www.comox.ca', match: /\/news-alerts\/[a-z0-9-]{8,}/, prefilter: false },
  { region: 'comox-valley', name: 'Village of Cumberland', type: 'rss', url: 'https://cumberland.ca/feed/', base: 'https://cumberland.ca', prefilter: false },
  { region: 'comox-valley', name: 'Comox Valley RD', type: 'rss', url: 'https://www.comoxvalleyrd.ca/rss/news.xml', base: 'https://www.comoxvalleyrd.ca', prefilter: false },

  // Campbell River
  { region: 'campbell-river', name: 'City of Campbell River', type: 'html', url: 'https://www.campbellriver.ca/news', base: 'https://www.campbellriver.ca', match: /\/government\/news\/\d{4}-\d{2}-\d{2}-/, prefilter: false },
  { region: 'campbell-river', name: 'Strathcona RD', type: 'html', url: 'https://www.srd.ca/government/news', base: 'https://www.srd.ca', match: /\/government\/news\/[a-z0-9-]{10,}/, prefilter: false },

  // Alberni / west coast
  { region: 'alberni', name: 'City of Port Alberni', type: 'html', url: 'https://www.portalberni.ca/news', base: 'https://www.portalberni.ca', match: /\/news\/[a-z]{3}-\d{8}-\d{4}\//, prefilter: false },
  { region: 'alberni', name: 'District of Tofino', type: 'wp', url: 'https://tofino.ca/wp-json/wp/v2/posts?per_page=20&_fields=date_gmt,link,title,content', prefilter: false },

  // Whistler
  { region: 'whistler', name: 'Resort Municipality of Whistler', type: 'html', url: 'https://www.whistler.ca/news/', base: 'https://www.whistler.ca', match: /\/news\/[a-z0-9-]{8,}\/?$/, prefilter: false },
];

const KEYWORDS = /\b(housing|homes?|rezon\w*|zoning|develop\w*|subdivi\w*|land|ocp|infrastructure|water|sewer|roads?|street|highway|bridge|crossing|closure|recreation|arena|pool|school|council|budget|tax\w*|construction|rental|short[- ]term|strata|park|trail|hospital|transit|airport|resort|annex\w*|bylaw|grant)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s = '') => s.replace(/&#8217;|&#8216;|&#039;|&#39;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&#8211;|&#8212;/g, '-').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&#\d+;/g, '');
const strip = (h = '') => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const abs = (base, u) => new URL(decode(u), base).href;
const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const findDate = (html) => {
  const meta = html.match(/article:published_time"\s+content="([^"]+)"/i)?.[1];
  if (meta) return new Date(meta).toISOString();
  const m = strip(html).match(new RegExp(`(${MONTHS}) \\d{1,2}, \\d{4}`));
  return m ? new Date(m[0]).toISOString() : new Date().toISOString();
};
// Article body = paragraph text only (skips the big nav menus on municipal sites)
const pageText = (html) => [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((m) => strip(m[1])).filter((t) => t.length > 40).join('\n');

const LIST = {
  async wp(src) {
    const posts = JSON.parse(await get(src.url));
    return posts.map((p) => ({ url: p.link, title: strip(p.title.rendered), date: p.date_gmt + 'Z', body: strip(p.content?.rendered || '') }));
  },
  async rss(src) {
    const xml = await get(src.url);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, it]) => {
      const tag = (n) => (it.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, 'i'))?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '');
      const d = new Date(tag('pubDate'));
      return { url: abs(src.base, tag('link').trim()), title: strip(tag('title')), date: isNaN(d) ? undefined : d.toISOString(), excerpt: strip(tag('description')) };
    });
  },
  async html(src) {
    const html = await get(src.url);
    const found = new Map();
    for (const [, attrs, inner] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = attrs.match(/href="([^"]+)"/i)?.[1];
      if (!href || !src.match.test(href)) continue;
      const url = abs(src.base, href);
      const t = strip(inner) || decode(attrs.match(/title="([^"]+)"/i)?.[1] || '');
      if (!found.has(url) || t.length > found.get(url).length) found.set(url, t);
    }
    return [...found].slice(0, 15).map(([url, title]) => ({ url, title }));
  },
};

async function summarize(env, src, title, body) {
  const R = REGIONS[src.region];
  const prompt = `You write short local-news notes for a real estate website covering ${R.place}. Readers are home buyers and owners.

Source: ${src.name}
Title: ${title}
Text: ${body.slice(0, 5000)}

1. Decide if this matters to people buying or owning property in ${R.who}: housing, development, land, zoning, rentals/short-term rentals, infrastructure, roads, utilities, amenities, taxes, major local projects. Elections, sports, events, job postings, holiday closures, crime and court stories, and opinion columns are NOT relevant unless they directly change housing or land use. Routine notices are also NOT relevant: seasonal parking rules, water main flushing, small donations, minor park amenities, fire bans, single-day road or lane closures, garbage/recycling schedule changes, flag half-masting.
2. Decide where it applies: ${R.rules}

Reply with JSON only:
{"relevant": true|false, "area": "${[...R.areas, 'none'].join('|')}", "title": "new headline in your own words, max 70 chars", "blurb": "2 sentences in your own words: what happened, and why it matters for buyers/owners. Do not quote the source.", "tag": "Housing|Development|Infrastructure|Amenities|Community"}`;

  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.NEWS_MODEL || 'claude-haiku-5-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = j.content?.find((b) => b.type === 'text')?.text;
      if (!text) throw new Error(`no text in reply (stop: ${j.stop_reason})`);
      return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    }
    if (![429, 500, 502, 503, 529].includes(r.status)) throw new Error(j.error?.message || r.status);
    await sleep(1500 * (i + 1));
  }
  throw new Error('AI busy after retries');
}

// Skip stories that repeat one already published/pending for the same town in the last 30 days
const words = (s = '') => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const similar = (a, b) => {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size) >= 0.6;
};

/**
 * Run discovery across all sources (or only some regions).
 * @param {object} o
 * @param {object} [o.env] env vars (defaults to process.env)
 * @param {boolean} [o.approve] publish immediately (default: approved unless a source sets review:true)
 * @param {number} [o.budgetMs] stop starting new work after this long (unprocessed items retry next run)
 * @param {string[]} [o.regions] only these region keys
 * @param {(msg:string)=>void} [o.log]
 */
export async function runNewsDiscovery(o = {}) {
  const env = o.env || process.env;
  const log = o.log || console.log;
  const started = Date.now();
  const budget = o.budgetMs ?? Infinity;
  const outOfTime = () => Date.now() - started > budget;
  const sb = createClient(env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: recentRows } = await sb.from('local_news').select('city,title')
    .in('status', ['approved', 'pending']).gte('published_at', new Date(Date.now() - 30 * 864e5).toISOString());
  const recent = (recentRows ?? []).filter((r) => r.title);

  const newPending = [];
  const stats = { sources: 0, sourceErrors: 0, saved: 0, published: 0, skipped: 0, stoppedForTime: false };
  const sources = SOURCES.filter((s) => !o.regions || o.regions.includes(s.region));

  for (const src of sources) {
    if (outOfTime()) { stats.stoppedForTime = true; break; }
    stats.sources++;
    let items;
    try { items = await LIST[src.type](src); }
    catch (e) { stats.sourceErrors++; log(`SKIP SOURCE ${src.name}: ${e.message}`); continue; }
    if (!items.length) { log(`\n${src.name}: 0 found`); continue; }

    const { data: seen } = await sb.from('local_news').select('url').in('url', items.map((i) => i.url));
    const seenSet = new Set((seen ?? []).map((r) => r.url));
    log(`\n${src.name}: ${items.length} found, ${items.filter((i) => !seenSet.has(i.url)).length} new`);

    for (const it of items) {
      if (seenSet.has(it.url)) continue;
      if (outOfTime()) { stats.stoppedForTime = true; break; }

      if (!it.body) {
        try {
          const html = await get(it.url);
          it.body = pageText(html) || it.excerpt || '';
          it.date ||= findDate(html);
        } catch (e) { log(`  page failed, retry next run: ${it.title} (${e.message})`); continue; }
        await sleep(600); // be polite to small municipal servers
      }
      it.date ||= new Date().toISOString();

      let row = { city: 'none', source: src.name, url: it.url, source_title: it.title, published_at: it.date, status: 'skipped' };

      if (!src.prefilter || KEYWORDS.test(it.title + ' ' + it.body.slice(0, 1500))) {
        try {
          const ai = await summarize(env, src, it.title, it.body);
          if (ai.relevant && REGIONS[src.region].areas.includes(ai.area)) {
            row = { ...row, city: ai.area, title: ai.title, blurb: ai.blurb, tag: ai.tag, status: (o.approve || !src.review) ? 'approved' : 'pending' };
            if (recent.some((r) => r.city === ai.area && similar(r.title, ai.title))) row = { ...row, status: 'skipped' };
            else recent.push({ city: ai.area, title: ai.title });
          }
        } catch (e) { log(`  AI failed, retry next run: ${it.title} (${e.message})`); continue; }
      }

      const { error } = await sb.from('local_news').insert(row);
      if (!error) {
        stats.saved++;
        if (row.status === 'skipped') stats.skipped++; else { stats.published++; newPending.push(row.title); }
      }
      log(error ? `  ERR      ${it.title}: ${error.message}` : `  ${row.status.padEnd(8)} [${row.city}] ${row.title || it.title}`);
    }
  }

  // Text a heads-up when new stories went live
  if (newPending.length && env.TWILIO_ACCOUNT_SID && env.NEWS_SMS_FROM && env.NEWS_ADMIN_PHONE) {
    const sid = env.TWILIO_ACCOUNT_SID, token = env.TWILIO_AUTH_TOKEN;
    const list = newPending.slice(0, 3).map((t) => `- ${t}`).join('\n');
    const more = newPending.length > 3 ? `\n...and ${newPending.length - 3} more` : '';
    const body = `News: ${newPending.length} new local ${newPending.length === 1 ? 'story' : 'stories'} published:\n${list}${more}\n\nUnpublish any: bc.realestate/admin/news`;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: env.NEWS_ADMIN_PHONE, From: env.NEWS_SMS_FROM, Body: body }),
    });
    log(r.ok ? `\nTexted heads-up (${newPending.length} new)` : `\nText failed: ${r.status} ${await r.text()}`);
  }

  stats.ms = Date.now() - started;
  log(`\nDone: ${stats.published} published, ${stats.skipped} skipped, ${stats.sourceErrors} source errors${stats.stoppedForTime ? ', stopped at time budget (rest next run)' : ''}, ${Math.round(stats.ms / 1000)}s`);
  return stats;
}
