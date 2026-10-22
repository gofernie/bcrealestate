// Second pass: re-check listings tagged "Other" using their 2nd and 3rd photos.
// Usage:  node --env-file=.env scripts/retag-other.mjs [limit] [city]
// Marks each row with home_style_meta.recheck so it's never re-checked twice.
import { createClient } from '@supabase/supabase-js';

const STYLES = [
  'West Coast contemporary', 'Modern', 'Craftsman', 'Traditional', 'Rancher', 'Split level',
  'Modern farmhouse', 'Log / timber frame', 'Cottage / cabin', 'Mid-century', 'Heritage / character',
  'Mediterranean', 'Townhouse', 'Condo / apartment', 'Manufactured / mobile', 'Duplex / multi-family', 'Other',
];

const LIMIT = Number(process.argv[2] || 1000);
const CITY = process.argv[3] || '%';
const CONCURRENCY = 4;
const MODEL = process.env.LOOK_SEARCH_MODEL || 'claude-haiku-5-5';
const SB_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const CDN = process.env.REPLIERS_CDN || 'https://cdn.repliers.io/';
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

if (!SB_URL || !SB_KEY || !AI_KEY) {
  console.error('Missing env: need SUPABASE_URL (or PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function photoUrl(u) {
  let url = /^https?:\/\//i.test(u) ? u : CDN + String(u).replace(/^\/+/, '');
  if (/cdn\.repliers\.io/i.test(url) && !/[?&]class=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'class=medium';
  return url;
}

// images may be an array of strings or of objects ({url}, {src}, ...).
function imageList(images) {
  let arr = images;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === 'string' ? x : x?.url || x?.src || x?.href || x?.large || x?.medium || ''))
    .filter(Boolean);
}

function normalizeStyle(s) {
  if (!s) return null;
  const v = String(s).trim().toLowerCase();
  const exact = STYLES.find((x) => x.toLowerCase() === v);
  if (exact) return exact;
  const rules = [
    [/west ?coast|contemporary/, 'West Coast contemporary'], [/farm/, 'Modern farmhouse'],
    [/mid.?century/, 'Mid-century'], [/modern|minimal/, 'Modern'], [/craftsman|arts/, 'Craftsman'],
    [/ranch|bungalow|one.?stor/, 'Rancher'], [/split/, 'Split level'], [/log|timber|chalet/, 'Log / timber frame'],
    [/cottage|cabin/, 'Cottage / cabin'], [/heritage|character|victorian|tudor/, 'Heritage / character'],
    [/mediterr|spanish/, 'Mediterranean'], [/town/, 'Townhouse'], [/condo|apartment/, 'Condo / apartment'],
    [/manufact|mobile|modular/, 'Manufactured / mobile'], [/duplex|triplex|multi/, 'Duplex / multi-family'],
    [/traditional|colonial|two.?stor/, 'Traditional'],
  ];
  for (const [re, style] of rules) if (re.test(v)) return style;
  return 'Other';
}

async function loadImage(raw) {
  const url = photoUrl(raw);
  const r = await fetch(url);
  if (!r.ok) throw new Error('photo ' + r.status);
  const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!OK_TYPES.includes(type)) throw new Error('photo type ' + type);
  return { type: 'image', source: { type: 'base64', media_type: type, data: Buffer.from(await r.arrayBuffer()).toString('base64') } };
}

const tool = {
  name: 'tag',
  description: 'Tag the home',
  input_schema: {
    type: 'object',
    properties: {
      shows_exterior: { type: 'boolean', description: 'true if either photo shows the outside of the home' },
      style: { type: 'string', enum: STYLES, description: 'closest architectural style' },
    },
    required: ['shows_exterior', 'style'],
  },
};

const PROMPT =
  'These are photos 2 and 3 of a British Columbia home listing; photo 1 did not show the house. ' +
  'Pick the single closest architectural style from the list. For townhouses, condos and duplexes use that building type. ' +
  'If neither photo shows the building, judge from interior clues (finishes, ceilings, layout) and still pick the closest style; ' +
  'only answer Other if there is genuinely nothing to go on (bare land, aerial of a lot, a view).';

async function tag(photos) {
  const content = [...(await Promise.all(photos.map(loadImage))), { type: 'text', text: PROMPT }];
  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 300, tools: [tool], tool_choice: { type: 'tool', name: 'tag' },
        messages: [{ role: 'user', content }],
      }),
    });
    if (r.ok) { const o = await r.json(); return (o.content || []).find((c) => c.type === 'tool_use')?.input; }
    if (![429, 500, 502, 503, 529].includes(r.status)) throw new Error('ai ' + r.status + ' ' + (await r.text()).slice(0, 200));
    await sleep(1500 * (i + 1));
  }
  throw new Error('ai busy after retries');
}

const { data: rows, error } = await db
  .from('listing_rows')
  .select('id, image_url, images, home_style_meta')
  .eq('status', 'A')
  .eq('home_style', 'Other')
  .ilike('normalized_city', CITY)
  .is('home_style_meta->recheck', null)
  .limit(LIMIT);
if (error) { console.error(error); process.exit(1); }

console.log(`Re-checking ${rows.length} "Other" listings with photos 2-3 (model ${MODEL})...`);
let fixed = 0, still = 0, failed = 0, noPhotos = 0, n = 0;
const counts = {};
const queue = [...rows];

async function mark(row, recheck, style) {
  const meta = { ...(row.home_style_meta || {}), recheck: { ...recheck, at: new Date().toISOString(), model: MODEL } };
  const patch = { home_style_meta: meta };
  if (style && style !== 'Other') patch.home_style = style;
  const { error: e } = await db.from('listing_rows').update(patch).eq('id', row.id);
  if (e) throw e;
}

async function worker() {
  while (queue.length) {
    const row = queue.shift();
    n++;
    try {
      const first = String(row.image_url || '').split('?')[0];
      const photos = imageList(row.images).filter((u) => u.split('?')[0] !== first).slice(0, 2);
      if (!photos.length) {
        noPhotos++;
        await mark(row, { result: 'no-more-photos' });
        console.log(`${n}/${rows.length}  ${row.id}  (no extra photos)`);
        continue;
      }
      const t = await tag(photos);
      const style = normalizeStyle(t?.style) || 'Other';
      await mark(row, { result: style, photos: photos.length, exterior: !!t?.shows_exterior }, style);
      if (style === 'Other') { still++; console.log(`${n}/${rows.length}  ${row.id}  still Other`); }
      else { fixed++; counts[style] = (counts[style] || 0) + 1; console.log(`${n}/${rows.length}  ${row.id}  Other -> ${style}`); }
    } catch (e) {
      failed++;
      console.error(`${n}/${rows.length}  skip ${row.id}: ${e.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nDone. Re-tagged ${fixed}, still Other ${still}, no extra photos ${noPhotos}, failed ${failed} (failed rows retry next run).`);
if (fixed) console.table(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([style, k]) => ({ style, n: k })));
