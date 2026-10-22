// Tags each listing's front photo with a home style (one fixed vocabulary, so filters match).
// Usage:  node --env-file=.env scripts/tag-home-styles.mjs [limit]
// Only touches rows where home_style is null, so it's safe to re-run; failures retry next run.
import { createClient } from '@supabase/supabase-js';

export const STYLES = [
  'West Coast contemporary',
  'Modern',
  'Craftsman',
  'Traditional',
  'Rancher',
  'Split level',
  'Modern farmhouse',
  'Log / timber frame',
  'Cottage / cabin',
  'Mid-century',
  'Heritage / character',
  'Mediterranean',
  'Townhouse',
  'Condo / apartment',
  'Manufactured / mobile',
  'Duplex / multi-family',
  'Other',
];

const LIMIT = Number(process.argv[2] || 200);
const CONCURRENCY = 4;
const MODEL = process.env.LOOK_SEARCH_MODEL || 'claude-haiku-5-5';
const SB_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

if (!SB_URL || !SB_KEY || !AI_KEY) {
  console.error('Missing env: need SUPABASE_URL (or PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const tool = {
  name: 'tag',
  description: 'Tag the home in the photo',
  input_schema: {
    type: 'object',
    properties: {
      is_exterior: { type: 'boolean', description: 'true if the photo shows the outside of the building' },
      style: { type: 'string', enum: STYLES, description: 'closest architectural style' },
      storeys: { type: 'integer', description: 'visible storeys above ground, 0 if unknown' },
      exterior: { type: 'string', description: 'main exterior materials, e.g. "cedar siding, stone"' },
    },
    required: ['is_exterior', 'style'],
  },
};

const PROMPT =
  'This is the main listing photo for a British Columbia home for sale. Pick the closest architectural style from the list. ' +
  'Use Townhouse / Condo / apartment / Duplex for those building types regardless of look. ' +
  'If the photo is not the building exterior, set is_exterior false and give your best style guess from what you can see.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Repliers stores some photos as relative paths like "vreb/IMG-123_1.jpg".
const CDN = process.env.REPLIERS_CDN || 'https://cdn.repliers.io/';
function photoUrl(u) {
  let url = /^https?:\/\//i.test(u) ? u : CDN + String(u).replace(/^\/+/, '');
  if (/cdn\.repliers\.io/i.test(url) && !/[?&]class=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'class=medium';
  return url;
}

// Map whatever the model said onto the fixed list.
function normalizeStyle(s) {
  if (!s) return null;
  const v = String(s).trim().toLowerCase();
  const exact = STYLES.find((x) => x.toLowerCase() === v);
  if (exact) return exact;
  const rules = [
    [/west ?coast|contemporary/, 'West Coast contemporary'],
    [/farm/, 'Modern farmhouse'],
    [/mid.?century/, 'Mid-century'],
    [/modern|minimal/, 'Modern'],
    [/craftsman|arts/, 'Craftsman'],
    [/ranch|bungalow|one.?stor/, 'Rancher'],
    [/split/, 'Split level'],
    [/log|timber|chalet/, 'Log / timber frame'],
    [/cottage|cabin/, 'Cottage / cabin'],
    [/heritage|character|victorian|tudor/, 'Heritage / character'],
    [/mediterr|spanish/, 'Mediterranean'],
    [/town/, 'Townhouse'],
    [/condo|apartment/, 'Condo / apartment'],
    [/manufact|mobile|modular/, 'Manufactured / mobile'],
    [/duplex|triplex|multi/, 'Duplex / multi-family'],
    [/traditional|colonial|two.?stor/, 'Traditional'],
  ];
  for (const [re, style] of rules) if (re.test(v)) return style;
  return 'Other';
}

async function tag(rawUrl) {
  const url = photoUrl(rawUrl);
  const img = await fetch(url);
  if (!img.ok) throw new Error('photo ' + img.status);
  const type = (img.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!OK_TYPES.includes(type)) throw new Error('photo type ' + type);
  const data = Buffer.from(await img.arrayBuffer()).toString('base64');

  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'tag' },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: type, data } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    if (r.ok) {
      const o = await r.json();
      return (o.content || []).find((c) => c.type === 'tool_use')?.input;
    }
    if (![429, 500, 502, 503, 529].includes(r.status)) throw new Error('ai ' + r.status + ' ' + (await r.text()).slice(0, 200));
    await sleep(1500 * (i + 1));
  }
  throw new Error('ai busy after retries');
}

const { data: rows, error } = await db
  .from('listing_rows')
  .select('id, image_url')
  .is('home_style', null)
  .not('image_url', 'is', null)
  .eq('status', 'A')
  .ilike('normalized_city', process.argv[3] || '%')
  .limit(LIMIT);
if (error) { console.error(error); process.exit(1); }

console.log(`Tagging ${rows.length} listings (model ${MODEL})...`);
let done = 0, failed = 0;
const queue = [...rows];
const counts = {};

async function worker() {
  while (queue.length) {
    const row = queue.shift();
    try {
      const t = await tag(row.image_url);
      if (!t) throw new Error('no answer returned');
      const style = normalizeStyle(t.style);
      if (!style) throw new Error('no style returned');
      if (style !== t.style) console.log(`   (mapped "${t.style}" -> ${style})`);
      t.style = style;
      const { error: upErr } = await db.from('listing_rows').update({
        home_style: t.style,
        home_style_meta: {
          storeys: Number.isInteger(t.storeys) ? t.storeys : null,
          exterior: t.exterior || null,
          is_exterior: !!t.is_exterior,
          model: MODEL,
          tagged_at: new Date().toISOString(),
        },
      }).eq('id', row.id);
      if (upErr) throw upErr;
      done++;
      counts[t.style] = (counts[t.style] || 0) + 1;
      console.log(`${done + failed}/${rows.length}  ${row.id}  ${t.style}`);
    } catch (e) {
      failed++;
      console.error(`${done + failed}/${rows.length}  skip ${row.id}: ${e.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nDone. Tagged ${done}, failed ${failed}.`);
console.table(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([style, n]) => ({ style, n })));
