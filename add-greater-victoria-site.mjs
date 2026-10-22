import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: existing, error: e1 } = await supabase.from("sites").select("id,site_name,city").eq("domain", "bc.realestate").in("city", ["greater-victoria", "greater victoria"]);
if (e1) throw e1;
if (existing?.length) { console.log("Already present:", existing.map((s) => `${s.site_name} (${s.id})`).join(", ")); process.exit(0); }
const { data: vic, error: e2 } = await supabase.from("sites").select("*").eq("domain", "bc.realestate").eq("city", "victoria").limit(1).maybeSingle();
if (e2) throw e2;
const row = vic ? { ...vic } : { domain: "bc.realestate", accent_color: "#2f6f73", admin_scope: "platform" };
delete row.id; delete row.created_at; delete row.updated_at;
row.city = "greater-victoria"; row.site_name = "Greater Victoria Homes";
const { data, error } = await supabase.from("sites").insert(row).select("id,site_name,city").single();
if (error) throw error;
console.log(`Added: ${data.site_name} (${data.city}) id=${data.id}` + (vic ? " - cloned from Victoria" : " - minimal, no Victoria row found"));
