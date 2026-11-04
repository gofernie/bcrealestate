// Monthly copy refresh: keeps the "Most current listings ... are in A, B and C." sentence on generated pages in line with live inventory.
//   node scripts/refresh-page-copy.mjs          -> preview changes
//   node scripts/refresh-page-copy.mjs --write  -> apply them
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { pathToFileURL } from 'url';

const lc = (s) => String(s || '').toLowerCase().trim();
const tc = (s) => String(s || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const join = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');
const acres = (r) => Math.max(Number(r.lot_size_acres) || 0, (Number(r.lot_size_sqft) || 0) / 43560);
const PATTERNS = [
  /(Most current [^.]*? in [^.]+? are in )([^.]+?)(\. )/,
  /(At this price in [^,]+, most current [^.]*?listings are in )([^.]+?)(\. )/,
  /(In [^,]+, most current listings with a shop are in )([^.]+?)(\. )/,
];

function matches(p, r) {
  const types = String(p.property_type || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (types.length && !types.includes(lc(r.normalized_type))) return false;
  const price = Number(r.price) || 0;
  if (p.price_min && price < p.price_min) return false;
  if (p.price_max && price > p.price_max) return false;
  if (p.min_lot_sqft && acres(r) * 43560 < p.min_lot_sqft) return false;
  const wt = lc(p.waterfront_type);
  if (wt && wt !== 'any' && wt !== 'waterfront') { if (!(r.waterfront === true && lc(r.waterfront_type) === wt)) return false; }
  else if (p.requires_waterfront || wt) { if (r.waterfront !== true) return false; }
  if (p.view_type && !lc(r.view_type).includes(lc(p.view_type))) return false;
  if (p.requires_suite && r.has_suite !== true) return false;
  if (p.requires_shop && r.has_detached_shop !== true) return false;
  if (p.primary_on_main && r.primary_on_main !== true) return false;
  if (p.three_plus_beds_same_floor && r.three_plus_beds_same_floor !== true) return false;
  if (p.four_plus_beds_same_floor && r.four_plus_beds_same_floor !== true) return false;
  if (p.min_year && Number(r.year_built || 0) < p.min_year) return false;
  if (p.beds_min && Number(r.beds || 0) < p.beds_min) return false;
  if (p.area && lc(r.normalized_area).replace(/-/g, ' ') !== lc(p.area).replace(/-/g, ' ')) return false;
  return true;
}

export async function refreshPageCopy({ sb, write = false }) {
  const { data: pages, error } = await sb.from('intent_pages')
    .select('id,city,slug,neighbourhood_copy,property_type,price_min,price_max,min_lot_sqft,requires_waterfront,waterfront_type,view_type,requires_suite,requires_shop,primary_on_main,three_plus_beds_same_floor,four_plus_beds_same_floor,min_year,beds_min,area')
    .eq('is_published', true).not('neighbourhood_copy', 'is', null).limit(5000);
  if (error) throw error;
  const rows = [];
  for (let i = 0; ; i += 1000) {
    const { data, error: e } = await sb.from('listing_rows')
      .select('id,normalized_city,normalized_type,normalized_area,price,beds,view_type,year_built,waterfront,waterfront_type,lot_size_sqft,lot_size_acres,has_suite,has_detached_shop,primary_on_main,three_plus_beds_same_floor,four_plus_beds_same_floor')
      .eq('status', 'A').is('off_market_at', null).order('id').range(i, i + 999);
    if (e) throw e; rows.push(...data); if (data.length < 1000) break;
  }
  const byCity = {}; for (const r of rows) (byCity[lc(r.normalized_city)] ??= []).push(r);
  const out = { checked: pages.length, matched: 0, changed: 0, unchanged: 0, skipped: 0, changes: [] };
  for (const p of pages) {
    const copy = String(p.neighbourhood_copy || '');
    let m = null, pat = null; for (const re of PATTERNS) { m = copy.match(re); if (m) { pat = re; break; } }
    if (!m) continue;
    out.matched++;
    const list = byCity[lc(p.city).replace(/-/g, ' ')] || [];
    const hits = list.filter((r) => matches(p, r));
    if (hits.length < 2) { out.skipped++; continue; }
    const n = {}; hits.forEach((r) => { const a = String(r.normalized_area || '').trim(); if (a && !/^unknown$/i.test(a) && !/rural$/i.test(a)) n[a] = (n[a] || 0) + 1; });
    const areas = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => tc(a));
    if (!areas.length) { out.skipped++; continue; }
    const names = join(areas);
    if (names === m[2]) { out.unchanged++; continue; }
    const next = copy.replace(pat, `$1${names}$3`);
    out.changed++; out.changes.push({ page: `${p.city}/${p.slug}`, from: m[2], to: names });
    if (write) { const { error: ue } = await sb.from('intent_pages').update({ neighbourhood_copy: next }).eq('id', p.id); if (ue) throw ue; }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = {}; for (const f of ['.env', '.env.local']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const mm = l.match(/^([A-Z0-9_]+)=(.*)$/); if (mm) env[mm[1]] = mm[2].trim().replace(/^"|"$/g, ''); }
  const sb = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const write = process.argv.includes('--write');
  const r = await refreshPageCopy({ sb, write });
  r.changes.forEach((c) => console.log(`${write ? 'UPDATED' : 'WOULD UPDATE'}  ${c.page}\n    was: ${c.from}\n    now: ${c.to}`));
  console.log(`\nPages checked: ${r.checked}, with the sentence: ${r.matched}, ${write ? 'updated' : 'would update'}: ${r.changed}, already current: ${r.unchanged}, skipped (too few listings): ${r.skipped}`);
}