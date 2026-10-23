// Turn "Save my search" leads (saved before alerts were fixed) into real saved-search alerts.
//
//   node scripts/convert-saved-search-leads.mjs                  Greater Victoria only, dry run
//   node scripts/convert-saved-search-leads.mjs --save           Greater Victoria only, create the alerts
//   node scripts/convert-saved-search-leads.mjs --all --save     every city since Aug 7
//
// Each alert first records what's already for sale (on the next listing refresh), so
// nobody gets a flood of old listings. Leads that already have an alert are skipped.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const SAVE = args.includes("--save");
const ALL = args.includes("--all");
const db = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const phoneOf = (raw) => {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length === 10 ? "+1" + d : d.length === 11 && d.startsWith("1") ? "+" + d : null;
};

let q = db.from("intent_leads").select("id, created_at, city, email, phone, message")
  .eq("source", "saved_search").gte("created_at", "2026-08-07").order("created_at");
if (!ALL) q = q.eq("city", "greater-victoria");
const { data: leads, error } = await q;
if (error) { console.error(error.message); process.exit(1); }

const { data: existing, error: exErr } = await db.from("saved_searches").select("filters");
if (exErr) { console.error(exErr.message); process.exit(1); }
const done = new Set((existing || []).map((r) => r.filters?.lead_id).filter(Boolean));

console.log(`${leads.length} saved-search leads${ALL ? "" : " in Greater Victoria"}${SAVE ? "" : " (dry run - add --save to create alerts)"}\n`);
let made = 0;
for (const lead of leads) {
  const msg = String(lead.message || "");
  const name = msg.split("\n")[0];
  let criteria = null;
  const line = msg.match(/(?:^|\n)Criteria:\s*(\{.*\})\s*$/m);
  if (line) { try { criteria = JSON.parse(line[1]); } catch {} }
  const url = criteria?.url || msg.match(/Search URL:\s*(\S+)/)?.[1] || "";
  const email = String(lead.email || "").trim() || null;
  const phone = phoneOf(lead.phone);
  const tag = `${lead.created_at.slice(0, 10)}  ${lead.city.padEnd(16)} ${name}`;
  if (done.has(lead.id)) { console.log(`  skip  ${tag}  (already an alert)`); continue; }
  if (!url && !criteria) { console.log(`  skip  ${tag}  (no search details)`); continue; }
  if (!email && !phone) { console.log(`  skip  ${tag}  (no email or phone)`); continue; }
  const to = email ? `email ${email}` : `text ${phone}`;
  if (!SAVE) { console.log(`  would ${tag}  -> ${to}`); continue; }
  const { error: insErr } = await db.from("saved_searches").insert({
    city: String(lead.city).toLowerCase().trim(),
    channel: email ? "email" : "sms",
    frequency: "update",
    email, phone, active: true,
    filters: { url, criteria: criteria || {}, name, lead_id: lead.id, pending_baseline: true },
  });
  if (insErr) { console.log(`  FAIL  ${tag}  ${insErr.message}`); continue; }
  made++;
  console.log(`  ok    ${tag}  -> ${to}`);
}
if (SAVE) console.log(`\n${made} alert${made === 1 ? "" : "s"} created. They start after the next listing refresh for that city.`);
