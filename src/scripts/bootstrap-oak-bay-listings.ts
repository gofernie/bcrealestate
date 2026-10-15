import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { refreshListingMarket } from "../lib/listings/refreshListingMarket";

const city = "oak bay";
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const result = await refreshListingMarket({
  city,
  trigger: "oak_bay_bootstrap",
  env: process.env,
});

console.log("\nActive Oak Bay inventory refresh complete:", result);

const { error: marketError } = await supabase
  .from("listing_markets")
  .upsert(
    { city, enabled: true, refresh_priority: 10 },
    { onConflict: "city" }
  );

if (marketError) {
  console.warn(`\nListings are live, but Oak Bay was not added to the automatic scheduler: ${marketError.message}`);
  console.warn("Send this output before proceeding with market-history backfill.");
  process.exitCode = 1;
} else {
  console.log("Oak Bay is enabled for the regular listing and market-history schedulers.");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("CRON_SECRET is missing, so the one-time market-history backfill was not started.");
  } else {
    const siteUrl = String(process.env.PUBLIC_SITE_URL || "https://bc.realestate").replace(/\/$/, "");
    const response = await fetch(`${siteUrl}/.netlify/functions/market-history-background?city=${encodeURIComponent(city)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ city }),
    });
    console.log("Market-history backfill request:", response.status, await response.text());
  }
}
