import { createClient } from "@supabase/supabase-js";
import { sendSavedSearchNotifications } from "../src/lib/savedSearches/sendSavedSearchNotifications";

const email = (process.argv[2] || "").trim().toLowerCase();
const SEND = process.argv.includes("--send");
const RESEND_COUNT = 4;

const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!email || !url || !key || !process.env.RESEND_API_KEY) {
  console.error("Missing something:", { email: !!email, supabaseUrl: !!url, serviceKey: !!key, resendKey: !!process.env.RESEND_API_KEY });
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: searches, error } = await supabase
  .from("saved_searches")
  .select("id, city, channel, frequency, phone, email, filters")
  .eq("channel", "email")
  .ilike("email", email);
if (error) throw error;
if (!searches?.length) { console.log(`No email saved searches for ${email}`); process.exit(0); }

const idArg = process.argv.find((a) => a.startsWith("--id="))?.slice(5);
const search = idArg ? searches.find((s) => s.id === idArg) : searches[0];
console.log("Saved searches for " + email + ":");
for (const s of searches) console.log(`  ${s.id === search?.id ? ">" : " "} ${s.id}  ${s.city}  ${s.frequency}  ${JSON.stringify(s.filters || {})}`);
if (!search) { console.log("No search with that --id"); process.exit(1); }

const { data: recent, error: nErr } = await supabase
  .from("saved_search_notifications")
  .select("id, mls_number, sent_at")
  .eq("saved_search_id", search.id)
  .order("discovered_at", { ascending: false })
  .limit(RESEND_COUNT);
if (nErr) throw nErr;
console.log(`\nWill re-send ${recent?.length || 0} matches: ${(recent || []).map((r) => r.mls_number).join(", ")}`);
if (!recent?.length) process.exit(0);

if (!SEND) { console.log("\nDry run. Add --send to send this one alert."); process.exit(0); }

await supabase.from("saved_search_notifications").update({ sent_at: null }).in("id", recent.map((r) => r.id));

const t = Date.now();
const result = await sendSavedSearchNotifications(supabase, search as any, {
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  TWILIO_FROM_NUMBER: "",
  PUBLIC_SITE_URL: "https://bc.realestate",
});
console.log(`\nSent in ${((Date.now() - t) / 1000).toFixed(1)}s:`, result);
