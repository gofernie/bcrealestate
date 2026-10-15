import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const city = "oak bay";
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data: existing, error: readError } = await supabase
  .from("listing_markets")
  .select("id,city")
  .ilike("city", city)
  .limit(1)
  .maybeSingle();
if (readError) throw readError;

const settings = {
  enabled: true,
  refresh_priority: 10,
  updated_at: new Date().toISOString(),
};

const { error: writeError } = existing
  ? await supabase.from("listing_markets").update(settings).eq("id", existing.id)
  : await supabase.from("listing_markets").insert({ city, ...settings });
if (writeError) throw writeError;

console.log(existing
  ? "Oak Bay scheduler entry enabled."
  : "Oak Bay scheduler entry created and enabled.");

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.warn("CRON_SECRET is missing, so the historical-market backfill was not started.");
} else {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://bc.realestate").replace(/\/$/, "");
  const response = await fetch(
    `${siteUrl}/.netlify/functions/market-history-background?city=${encodeURIComponent(city)}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ city }),
    }
  );
  console.log("Market-history backfill request:", response.status, await response.text());
}
