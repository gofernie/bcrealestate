import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler() {
  if (!PUBLIC_SITE_URL) {
    throw new Error("Missing PUBLIC_SITE_URL");
  }

  if (!CRON_SECRET) {
    throw new Error("Missing CRON_SECRET");
  }

  const { data: markets, error } = await supabase
    .from("listing_markets")
    .select("city, refresh_priority")
    .eq("enabled", true)
    .order("refresh_priority", {
      ascending: true
    });

  if (error) {
    throw new Error(
      `Could not load listing markets: ${error.message}`
    );
  }

  if (!markets?.length) {
    console.log("No enabled listing markets found.");
    return;
  }

  const baseUrl = PUBLIC_SITE_URL.replace(/\/$/, "");

  const results: Array<{
    city: string;
    dispatched: boolean;
    status?: number;
    error?: string;
  }> = [];

  for (const market of markets) {
    const city = String(market.city || "").trim();

    if (!city) continue;

    try {
      const response = await fetch(
        `${baseUrl}/.netlify/functions/refresh-listing-market`,
        {
          method: "POST",
         headers: {
  Authorization: `Bearer ${CRON_SECRET}`,
  "Content-Type": "application/json"
},
          body: JSON.stringify({ city })
        }
      );

      results.push({
        city,
        dispatched: response.ok,
        status: response.status
      });
    } catch (error) {
      results.push({
        city,
        dispatched: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown dispatch error"
      });
    }
  }

  console.log("Listing refresh dispatch results:", results);
}

export const config: Config = {
  schedule: "15 1,7,13,19 * * *"
};