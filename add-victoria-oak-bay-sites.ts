import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sites = [
  { city: "victoria", site_name: "Victoria Homes" },
  { city: "oak bay", site_name: "Oak Bay Homes" },
];

for (const site of sites) {
  const { data: existing, error: lookupError } = await supabase
    .from("sites")
    .select("id,site_name")
    .eq("domain", "bc.realestate")
    .eq("city", site.city)
    .eq("admin_scope", "platform")
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    console.log(`Already present: ${existing.site_name}`);
    continue;
  }

  const { data, error } = await supabase
    .from("sites")
    .insert({
      domain: "bc.realestate",
      city: site.city,
      site_name: site.site_name,
      accent_color: "#2f6f73",
      admin_scope: "platform",
    })
    .select("id,site_name,city")
    .single();

  if (error) throw error;

  console.log(`Added: ${data.site_name} (${data.city})`);
}
