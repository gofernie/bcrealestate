import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { TYPE_PAGES } from "../lib/copy/generateTypeCopy";

// Creates missing property-type intent_pages rows (homes, condos, townhomes, mobile-homes, land)
// for every bc.realestate town, cloned from Fernie's rows. Usage: npx tsx src/scripts/create-type-rows.ts [--dry]
const dry = process.argv.includes("--dry");
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const title = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

(async () => {
  const types = Object.keys(TYPE_PAGES);
  const { data: sites, error: sErr } = await supabase.from("sites").select("id, city, domain").ilike("domain", "%" + (process.argv.find((a) => a.startsWith("--domain="))?.slice(9) || "bc.realestate") + "%");
  if (sErr) throw sErr;
  const { data: templates, error: tErr } = await supabase.from("intent_pages").select("*").eq("city", "fernie").in("slug", types);
  if (tErr) throw tErr;
  const { data: existing, error: eErr } = await supabase.from("intent_pages").select("site_id, slug").range(0, 19999);
  if (eErr) throw eErr;
  const have = new Set((existing || []).map((r: any) => `${r.site_id}|${r.slug}`));
  const skipCities = new Set(["calgary"]);
  const toInsert: any[] = [];

  for (const site of sites || []) {
    const cityKey = String(site.city || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!cityKey || skipCities.has(cityKey)) continue;
    for (const type of types) {
      if (have.has(`${site.id}|${type}`)) continue;
      const tpl: any = (templates || []).find((t: any) => t.slug === type);
      if (!tpl) continue;
      const row: any = { ...tpl };
      for (const k of ["id", "created_at", "updated_at"]) delete row[k];
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string") row[k] = v.replace(/Fernie/g, title(cityKey)).replace(/fernie/g, cityKey);
      }
      Object.assign(row, {
        city: cityKey, site_id: site.id, slug: type,
        seo_heading: null, seo_intro: null, seo_body: null, seo_long: null, market_commentary: null, neighbourhood_copy: null,
      });
      toInsert.push(row);
    }
  }

  console.log(`Would create ${toInsert.length} row(s):`);
  const byCity: Record<string, string[]> = {};
  for (const r of toInsert) (byCity[r.city] ||= []).push(r.slug);
  for (const [c, s] of Object.entries(byCity).sort()) console.log(`  ${c}: ${s.join(", ")}`);
  if (dry) { console.log("--dry: nothing written."); return; }
  for (let i = 0; i < toInsert.length; i += 50) {
    const { error } = await supabase.from("intent_pages").insert(toInsert.slice(i, i + 50));
    if (error) throw error;
  }
  console.log(`Created ${toInsert.length} row(s).`);
})().catch((e) => { console.error(e); process.exit(1); });
