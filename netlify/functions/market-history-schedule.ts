import type {
  Config,
} from "@netlify/functions";

import {
  createClient,
} from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const publicSiteUrl =
  process.env.PUBLIC_SITE_URL;

const cronSecret =
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
  if (!publicSiteUrl) {
    throw new Error(
      "Missing PUBLIC_SITE_URL"
    );
  }

  if (!cronSecret) {
    throw new Error(
      "Missing CRON_SECRET"
    );
  }

  const {
    data: markets,
    error: marketsError,
  } = await supabase
    .from("listing_markets")
    .select(
      "city,refresh_priority"
    )
    .eq("enabled", true)
    .order("refresh_priority", {
      ascending: true,
    });

  if (marketsError) {
    throw new Error(
      `Could not load enabled markets: ${marketsError.message}`
    );
  }

  if (!markets?.length) {
    return json({
      ok: true,
      dispatched: 0,
      reason:
        "No enabled markets found.",
    });
  }

  const {
    data: historyRows,
    error: historyError,
  } = await supabase
    .from("market_monthly_stats")
    .select("city,refreshed_at");

  if (historyError) {
    throw new Error(
      `Could not load market history status: ${historyError.message}`
    );
  }

  const latestRefreshByCity =
    new Map<string, number>();

  for (const row of historyRows || []) {
    const city = String(
      row.city || ""
    )
      .trim()
      .toLowerCase();

    const refreshedAt =
      new Date(
        row.refreshed_at || 0
      ).getTime();

    if (
      !city ||
      !Number.isFinite(refreshedAt)
    ) {
      continue;
    }

    const existing =
      latestRefreshByCity.get(city) || 0;

    if (refreshedAt > existing) {
      latestRefreshByCity.set(
        city,
        refreshedAt
      );
    }
  }

  const candidates = markets
    .map((market) => {
      const city = String(
        market.city || ""
      )
        .trim()
        .toLowerCase();

      return {
        city,
        priority: Number(
          market.refresh_priority || 9999
        ),
        latestRefresh:
          latestRefreshByCity.get(city) || 0,
      };
    })
    .filter((market) => market.city)
    .sort(
      (a, b) =>
        a.latestRefresh -
          b.latestRefresh ||
        a.priority -
          b.priority
    );

  const selected = candidates[0];

  if (!selected) {
    return json({
      ok: true,
      dispatched: 0,
      reason:
        "No valid market selected.",
    });
  }

  const baseUrl =
    publicSiteUrl.replace(/\/$/, "");

  console.log(
    "Dispatching market-history refresh",
    {
      city: selected.city,
      previousRefresh:
        selected.latestRefresh
          ? new Date(
              selected.latestRefresh
            ).toISOString()
          : null,
    }
  );

  const response = await fetch(
    `${baseUrl}/.netlify/functions/market-history-background?city=${encodeURIComponent(
      selected.city
    )}`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${cronSecret}`,
        "content-type":
          "application/json",
      },
      body: JSON.stringify({
        city: selected.city,
      }),
    }
  );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Background dispatch returned ${response.status}: ${responseText}`
    );
  }

  return json({
    ok: true,
    dispatched: 1,
    city: selected.city,
    previousRefresh:
      selected.latestRefresh
        ? new Date(
            selected.latestRefresh
          ).toISOString()
        : null,
    backgroundStatus:
      response.status,
  });
}

export const config: Config = {
  schedule: "17 * * * *",
};