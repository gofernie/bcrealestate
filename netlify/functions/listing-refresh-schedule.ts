import type {
  Config,
} from "@netlify/functions";

import {
  createClient,
} from "@supabase/supabase-js";

const supabase =
  createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL;

const CRON_SECRET =
  process.env.CRON_SECRET;

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "no-store",
      },
    }
  );
}

export default async function handler() {
  if (!PUBLIC_SITE_URL) {
    throw new Error(
      "Missing PUBLIC_SITE_URL"
    );
  }

  if (!CRON_SECRET) {
    throw new Error(
      "Missing CRON_SECRET"
    );
  }

  const staleRunningCutoff =
    new Date(
      Date.now() -
        60 * 60 * 1000
    ).toISOString();

  const {
    data: market,
    error,
  } = await supabase
    .from("listing_markets")
    .select(
      `
        city,
        refresh_priority,
        last_success_at,
        last_refresh_status,
        last_refresh_at
      `
    )
    .eq("enabled", true)
    .or(
      [
        "last_refresh_status.neq.running",
        "last_refresh_status.is.null",
        `last_refresh_at.lt.${staleRunningCutoff}`,
      ].join(",")
    )
    .order(
      "last_success_at",
      {
        ascending: true,
        nullsFirst: true,
      }
    )
    .order(
      "refresh_priority",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load next listing market: ${error.message}`
    );
  }

  if (!market) {
    console.log(
      "No eligible listing market found."
    );

    return json({
      ok: true,
      dispatched: 0,
      reason:
        "No eligible market found.",
    });
  }

  const city =
    String(
      market.city || ""
    )
      .trim()
      .toLowerCase();

  if (!city) {
    throw new Error(
      "Selected listing market has no city."
    );
  }

  const baseUrl =
    PUBLIC_SITE_URL.replace(
      /\/$/,
      ""
    );

  console.log(
    "Dispatching next listing market",
    {
      city,
      lastSuccessAt:
        market.last_success_at,
    }
  );

  const response =
    await fetch(
      `${baseUrl}/.netlify/functions/refresh-listing-market-background?city=${encodeURIComponent(
        city
      )}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${CRON_SECRET}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            city,
          }),
      }
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Background refresh returned ${response.status}: ${responseText}`
    );
  }

  console.log(
    "Listing market refresh accepted",
    {
      city,
      status:
        response.status,
    }
  );

  return json({
    ok: true,
    dispatched: 1,
    city,
    status:
      response.status,
  });
}

export const config: Config = {
  schedule:
    "*/20 * * * *",
};