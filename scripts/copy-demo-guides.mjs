// copy-demo-guides: copy guide pages from one site to a demo site.
// Dry run (lists what would copy):  node scripts/copy-demo-guides.mjs --to waynewoyciehouski.bc.realestate
// Pick a source site:              node scripts/copy-demo-guides.mjs --to waynewoyciehouski.bc.realestate --from chriscrump.com
// Only some guides (slugs):        ... --only first-time-buyers,property-transfer-tax
// Write them:                      add --go
// Skips any slug the demo site already has, so it's safe to run again.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : ""; };
const to = arg("to"), from = arg("from"), only = arg("only") ? arg("only").split(",").map((s) => s.trim()) : null, go = process.argv.includes("--go");
if (!to) { console.log("Usage: node scripts/copy-demo-guides.mjs --to <demo domain> [--from <source domain>] [--only slug1,slug2] [--go]"); process.exit(1); }

const sb = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: dest } = await sb.from("sites").select("id, domain, city, site_name").eq("domain", to).maybeSingle();
if (!dest) { console.log("No site with domain " + to); process.exit(1); }
const city = String(dest.city || "").toLowerCase();
console.log(`Demo site: ${dest.site_name} (${dest.domain}), city ${city}`);

// Source: one site if --from is given, otherwise every other site's guides for the same city
let srcIds = null;
if (from) {
  const { data: src } = await sb.from("sites").select("id, domain").eq("domain", from).maybeSingle();
  if (!src) { console.log("No site with domain " + from); process.exit(1); }
  srcIds = [src.id];
}
let q = sb.from("guide_pages").select("*").eq("city", city).in("status", ["live"]).neq("site_id", dest.id).order("updated_at", { ascending: false });
if (srcIds) q = q.in("site_id", srcIds);
const { data: guides, error } = await q;
if (error) { console.log(error.message); process.exit(1); }
const { data: sites } = await sb.from("sites").select("id, domain");
const dom = Object.fromEntries((sites || []).map((s) => [s.id, s.domain]));
const { data: have } = await sb.from("guide_pages").select("slug").eq("site_id", dest.id).eq("city", city);
const taken = new Set((have || []).map((g) => g.slug));

const seen = new Set(), picks = [];
for (const g of guides || []) {
  if (only && !only.includes(g.slug)) continue;
  if (seen.has(g.slug)) continue; // same slug on several sites: take the newest
  seen.add(g.slug);
  picks.push(g);
}
console.log(`\n${picks.length} live ${city} guide(s) found:`);
for (const g of picks) console.log(`  ${taken.has(g.slug) ? "SKIP (already there)" : "copy"}  ${g.slug}  ·  "${g.title}"  ·  from ${dom[g.site_id] || g.site_id}`);
const todo = picks.filter((g) => !taken.has(g.slug));
if (!go) { console.log(`\nDry run. Add --go to copy ${todo.length} guide(s) to ${dest.domain}.`); process.exit(0); }

const DROP = ["id", "created_at", "updated_at", "site_id", "ai_status", "ai_draft", "ai_error", "ai_started_at", "ai_notes"];
let ok = 0;
for (const g of todo) {
  const row = { ...g };
  for (const k of DROP) delete row[k];
  row.site_id = dest.id; row.status = "live";
  const { error: e } = await sb.from("guide_pages").insert(row);
  if (e) console.log(`  FAILED ${g.slug}: ${e.message}`); else { ok++; console.log(`  copied ${g.slug}`); }
}
console.log(`\nDone: ${ok} of ${todo.length} copied to ${dest.domain}. See them at https://${dest.domain}/${city}/guides/<slug>`);
