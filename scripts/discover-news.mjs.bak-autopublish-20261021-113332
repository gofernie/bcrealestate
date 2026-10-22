// Run: node --env-file=.env scripts/discover-news.mjs   (add --approve to publish immediately)
import { createClient } from '@supabase/supabase-js';

const UA = 'Mozilla/5.0 (compatible; LocalNewsBot/1.0; +https://chriscrump.com)';
const AUTO = process.argv.includes('--approve');
const sb = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REGIONS = {
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
};

// prefilter:false = government sources, every item goes to the AI (low volume, high value)
const SOURCES = [
  { region: 'elk-valley', name: 'City of Fernie', type: 'rss', url: 'https://www.fernie.ca/EN/meta/whats-new/rss/latest-news.rss', base: 'https://www.fernie.ca', prefilter: false },
  { region: 'elk-valley', name: 'RDEK', type: 'html', url: 'https://www.rdek.bc.ca/news', base: 'https://www.rdek.bc.ca', match: /\/news\/entry\//, prefilter: false },
  { region: 'elk-valley', name: 'District of Sparwood', type: 'html', url: 'https://www.sparwood.ca/municipal-hall/news-updates', base: 'https://www.sparwood.ca', match: /\/news-updates\/post\//, prefilter: false },
  // { region: 'elk-valley', name: 'Fernie.com', type: 'rss', url: 'https://fernie.com/feed/', base: 'https://fernie.com', prefilter: true },
  { region: 'elk-valley', name: 'e-KNOW', type: 'wp', url: 'https://www.e-know.ca/wp-json/wp/v2/posts?categories=61&per_page=30&_fields=date_gmt,link,title,content', prefilter: true },

  { region: 'nanaimo', name: 'City of Nanaimo', type: 'html', url: 'https://www.nanaimo.ca/your-government/news-events/news', base: 'https://www.nanaimo.ca', match: /\/NewsReleases\/NR\d+/i, prefilter: false },
  { region: 'nanaimo', name: 'RDN', type: 'html', url: 'https://www.rdn.bc.ca/news-releases', base: 'https://www.rdn.bc.ca', match: /\/notice-\d{4}-\d{2}-\d{2}/, prefilter: false },
  { region: 'nanaimo', name: 'NanaimoNewsNOW', type: 'wp', url: 'https://nanaimonewsnow.com/wp-json/wp/v2/posts?categories=5&per_page=30&_fields=date_gmt,link,title,content', prefilter: true },
];

const KEYWORDS = /\b(housing|homes?|rezon\w*|zoning|develop\w*|subdivi\w*|land|ocp|infrastructure|water|sewer|roads?|street|highway|bridge|crossing|closure|recreation|arena|pool|school|council|budget|tax\w*|construction|rental|short[- ]term|strata|park|trail|hospital|transit|airport|resort|annex\w*|bylaw|grant)\b/i;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
  .map(m => strip(m[1])).filter(t => t.length > 40).join('\n');

const LIST = {
  async wp(src) {
    const posts = JSON.parse(await get(src.url));
    return posts.map(p => ({ url: p.link, title: strip(p.title.rendered), date: p.date_gmt + 'Z', body: strip(p.content.rendered) }));
  },
  async rss(src) {
    const xml = await get(src.url);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, it]) => {
      const tag = (n) => (it.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, 'i'))?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '');
      return { url: abs(src.base, tag('link').trim()), title: strip(tag('title')), date: new Date(tag('pubDate')).toISOString(), excerpt: strip(tag('description')) };
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

async function summarize(src, title, body) {
  const R = REGIONS[src.region];
  const prompt = `You write short local-news notes for a real estate website covering ${R.place}. Readers are home buyers and owners.

Source: ${src.name}
Title: ${title}
Text: ${body.slice(0, 5000)}

1. Decide if this matters to people buying or owning property in ${R.who}: housing, development, land, zoning, rentals/short-term rentals, infrastructure, roads, utilities, amenities, taxes, major local projects. Elections, sports, events, job postings, holiday closures, crime and court stories, and opinion columns are NOT relevant unless they directly change housing or land use. Routine notices are also NOT relevant: seasonal parking rules, water main flushing, small donations, minor park amenities, fire bans.
2. Decide where it applies: ${R.rules}

Reply with JSON only:
{"relevant": true|false, "area": "${[...R.areas, 'none'].join('|')}", "title": "new headline in your own words, max 70 chars", "blurb": "2 sentences in your own words: what happened, and why it matters for buyers/owners. Do not quote the source.", "tag": "Housing|Development|Infrastructure|Amenities|Community"}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.status);
  const text = j.content?.find(b => b.type === 'text')?.text;
  if (!text) throw new Error(`no text in reply (stop: ${j.stop_reason}, blocks: ${j.content?.map(b => b.type).join(',')})`);
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

const newPending = [];

for (const src of SOURCES) {
  let items;
  try { items = await LIST[src.type](src); }
  catch (e) { console.warn(`SKIP SOURCE ${src.name}: ${e.message}`); continue; }

  const { data: seen } = await sb.from('local_news').select('url').in('url', items.map(i => i.url));
  const seenSet = new Set((seen ?? []).map(r => r.url));
  console.log(`\n${src.name}: ${items.length} found, ${items.filter(i => !seenSet.has(i.url)).length} new`);

  for (const it of items) {
    if (seenSet.has(it.url)) continue;

    if (!it.body) {
      try {
        const html = await get(it.url);
        it.body = pageText(html) || it.excerpt || '';
        it.date ||= findDate(html);
      } catch (e) { console.warn(`  page failed, retry next run: ${it.title} (${e.message})`); continue; }
      await sleep(600); // be polite to small municipal servers
    }

    let row = { city: 'none', source: src.name, url: it.url, source_title: it.title, published_at: it.date, status: 'skipped' };

    if (!src.prefilter || KEYWORDS.test(it.title + ' ' + it.body.slice(0, 1500))) {
      try {
        const ai = await summarize(src, it.title, it.body);
        if (ai.relevant && REGIONS[src.region].areas.includes(ai.area)) {
          row = { ...row, city: ai.area, title: ai.title, blurb: ai.blurb, tag: ai.tag, status: AUTO ? 'approved' : 'pending' };
        }
      } catch (e) { console.warn(`  AI failed, retry next run: ${it.title} (${e.message})`); continue; }
    }

    const { error } = await sb.from('local_news').insert(row);
    if (!error && row.status === 'pending') newPending.push(row.title);
    console.log(error ? `  ERR      ${it.title}: ${error.message}` : `  ${row.status.padEnd(8)} [${row.city}] ${row.title || it.title}`);
  }
}




// Text a heads-up when new stories are waiting for review
if (newPending.length && process.env.TWILIO_ACCOUNT_SID && process.env.NEWS_SMS_FROM && process.env.NEWS_ADMIN_PHONE) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const list = newPending.slice(0, 3).map(t => `- ${t}`).join('\n');
  const more = newPending.length > 3 ? `\n...and ${newPending.length - 3} more` : '';
  const body = `News: ${newPending.length} new local ${newPending.length === 1 ? 'story' : 'stories'} to review:\n${list}${more}\n\nbc.realestate/admin/news`;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: process.env.NEWS_ADMIN_PHONE, From: process.env.NEWS_SMS_FROM, Body: body }),
  });
  console.log(r.ok ? `\nTexted heads-up (${newPending.length} pending)` : `\nText failed: ${r.status} ${await r.text()}`);
}
