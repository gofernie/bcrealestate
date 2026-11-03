// Review queue for draft intent pages.
//   node scripts/drafts.mjs                      -> list all drafts with preview + edit links
//   node scripts/drafts.mjs publish slug1,slug2  -> publish those drafts
import { createClient } from '@supabase/supabase-js'; import fs from 'fs';
const env = {}; for (const f of ['.env', '.env.local']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
const sb = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sites } = await sb.from('sites').select('id,domain');
const dom = Object.fromEntries((sites || []).map(s => [s.id, s.domain]));
if (process.argv[2] === 'publish') {
  const slugs = (process.argv[3] || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!slugs.length) { console.log('Usage: node scripts/drafts.mjs publish slug1,slug2'); process.exit(); }
  const { data, error } = await sb.from('intent_pages').update({ is_published: true, status: 'published' }).in('slug', slugs).or('is_published.eq.false,status.eq.draft').select('city,slug,site_id');
  if (error) console.log(error.message); else if (!data.length) console.log('No matching drafts.'); else data.forEach(r => console.log('LIVE   https://' + (dom[r.site_id] || 'bc.realestate') + '/' + r.city + '/' + r.slug));
} else {
  const { data, error } = await sb.from('intent_pages').select('id,city,slug,hero_heading,site_id,created_at').or('is_published.eq.false,status.eq.draft').order('created_at');
  if (error) { console.log(error.message); process.exit(); }
  if (!data.length) { console.log('No drafts waiting.'); process.exit(); }
  console.log(data.length + ' draft(s) waiting for review:\n');
  for (const r of data) console.log('* ' + r.hero_heading + '   [' + (dom[r.site_id] || '?') + ']\n    slug:    ' + r.slug + '\n    preview: http://localhost:4321/' + r.city + '/' + r.slug + '\n    edit:    http://localhost:4321/admin/intent-pages/' + r.id + '/edit\n');
  console.log('Publish with:  node scripts/drafts.mjs publish slug1,slug2');
}