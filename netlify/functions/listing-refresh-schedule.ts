import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

const DISPATCH_DELAY_MS = 250;
const MARKETS_PER_RUN = 4;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export default async function handler() {
  if (!PUBLIC_SITE_URL) {
    throw new Error("Missing PUBLIC_SITE_URL");
  }

  if (!CRON_SECRET) {
    throw new Error("Missing CRON_SECRET");
  }

  const { data: markets, error } = await supabase
  .from("listing_markets")
  .select(
    "city, refresh_priority, last_success_at"
  )
  .eq("enabled", true)
  .neq("last_refresh_status", "running")
  .order("last_success_at", {
    ascending: true,
    nullsFirst: true
  })
  .order("refresh_priority", {
    ascending: true
  })
  .limit(MARKETS_PER_RUN);

  if (error) {
    throw new Error(
      `Could not load listing markets: ${error.message}`
    );
  }

  if (!markets?.length) {
    console.log("No enabled listing markets found.");

    return new Response(
      JSON.stringify({
        ok: true,
        dispatched: 0,
        failed: 0,
        results: []
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  const baseUrl = PUBLIC_SITE_URL.replace(/\/$/, "");

  const results: Array<{
    city: string;
    dispatched: boolean;
    status?: number;
    error?: string;
  }> = [];

  console.log(
    `Preparing to dispatch ${markets.length} listing markets`
  );

  for (
    let index = 0;
    index < markets.length;
    index += 1
  ) {
    const market = markets[index];

    const city = String(
      market.city || ""
    ).trim();

    if (!city) {
      continue;
    }

    try {
      console.log(
        `Dispatching listing refresh ${index + 1}/${markets.length}: ${city}`
      );

      const response = await fetch(
        `${baseUrl}/.netlify/functions/refresh-listing-market-background?city=${encodeURIComponent(
          city
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CRON_SECRET}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            city
          })
        }
      );

      results.push({
        city,
        dispatched: response.ok,
        status: response.status
      });

      console.log("Listing refresh dispatched", {
        city,
        status: response.status,
        accepted: response.ok
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown dispatch error";

      console.error(
        `Could not dispatch listing refresh for ${city}:`,
        message
      );

      results.push({
        city,
        dispatched: false,
        error: message
      });
    }

    const hasAnotherMarket =
      index < markets.length - 1;

    if (hasAnotherMarket) {
      console.log(
        `Waiting ${DISPATCH_DELAY_MS}ms before next market...`
      );

      await sleep(DISPATCH_DELAY_MS);
    }
  }

  console.log(
    "Listing refresh dispatch results:",
    results
  );

  return new Response(
    JSON.stringify({
      ok: true,
      dispatched: results.filter(
        (result) => result.dispatched
      ).length,
      failed: results.filter(
        (result) => !result.dispatched
      ).length,
      results
    }),
    {
      status: 200,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}

export const config: Config = {
  schedule: "15 1,7,13,19 * * *"
};