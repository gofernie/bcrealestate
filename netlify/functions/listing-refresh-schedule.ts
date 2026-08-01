import type {
  Config,
} from "@netlify/functions";

import {
  createClient,
} from "@supabase/supabase-js";

const supabase =
  createClient(
    process.env
      .PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL;

const CRON_SECRET =
  process.env.CRON_SECRET;

/**
 * A refresh run should normally finish well before
 * the next six-hour cron invocation.
 *
 * This prevents a permanently stuck run from blocking
 * all future refreshes.
 */
const STALE_RUN_MS =
  5 * 60 * 60 * 1000;

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

  const now =
    new Date();

  const staleRunCutoff =
    new Date(
      now.getTime() -
        STALE_RUN_MS
    ).toISOString();

  /*
   * Release any refresh run that became permanently
   * stuck more than five hours ago.
   */
  const {
    error: staleRunError,
  } = await supabase
    .from(
      "listing_refresh_runs"
    )
    .update({
      status: "failed",
      completed_at:
        now.toISOString(),

      error:
        "Refresh run exceeded the stale-run cutoff.",
    })
    .eq(
      "status",
      "running"
    )
    .lt(
      "started_at",
      staleRunCutoff
    );

  if (staleRunError) {
    throw new Error(
      `Could not release stale refresh runs: ${staleRunError.message}`
    );
  }

  /*
   * Do not start another chain while a healthy chain
   * is already running.
   */
  const {
    data: existingRun,
    error: existingRunError,
  } = await supabase
    .from(
      "listing_refresh_runs"
    )
    .select(
      "id, started_at"
    )
    .eq(
      "status",
      "running"
    )
    .gte(
      "started_at",
      staleRunCutoff
    )
    .order(
      "started_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (existingRunError) {
    throw new Error(
      `Could not check active refresh runs: ${existingRunError.message}`
    );
  }

  if (existingRun) {
    console.log(
      "A listing refresh run is already active.",
      existingRun
    );

    return json({
      ok: true,
      skipped: true,
      reason:
        "A listing refresh run is already active.",
      runId:
        existingRun.id,
      startedAt:
        existingRun.started_at,
    });
  }

  /*
   * Oldest markets go first.
   */
  const {
    data: markets,
    error: marketsError,
  } = await supabase
    .from(
      "listing_markets"
    )
    .select(
      `
        city,
        refresh_priority,
        last_success_at
      `
    )
    .eq(
      "enabled",
      true
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
    );

  if (marketsError) {
    throw new Error(
      `Could not load listing markets: ${marketsError.message}`
    );
  }

  const validMarkets =
    (markets || [])
      .map((market) => ({
        city:
          String(
            market.city || ""
          )
            .trim()
            .toLowerCase(),
      }))
      .filter(
        (market) =>
          Boolean(market.city)
      );

  if (
    validMarkets.length === 0
  ) {
    console.log(
      "No enabled listing markets found."
    );

    return json({
      ok: true,
      dispatched: 0,
      markets: 0,
    });
  }

  /*
   * Create one parent run.
   */
  const {
    data: run,
    error: runError,
  } = await supabase
    .from(
      "listing_refresh_runs"
    )
    .insert({
      status: "running",
      started_at:
        now.toISOString(),
    })
    .select("id")
    .single();

  if (
    runError ||
    !run
  ) {
    throw new Error(
      `Could not create listing refresh run: ${
        runError?.message ||
        "No run returned"
      }`
    );
  }

  const queueRows =
    validMarkets.map(
      (market, index) => ({
        run_id:
          run.id,

        city:
          market.city,

        position:
          index + 1,

        status:
          "pending",
      })
    );

  const {
    data: insertedQueue,
    error: queueError,
  } = await supabase
    .from(
      "listing_refresh_run_markets"
    )
    .insert(queueRows)
    .select(
      `
        id,
        city,
        position,
        status
      `
    )
    .order(
      "position",
      {
        ascending: true,
      }
    );

  if (
    queueError ||
    !insertedQueue?.length
  ) {
    await supabase
      .from(
        "listing_refresh_runs"
      )
      .update({
        status: "failed",
        completed_at:
          new Date()
            .toISOString(),

        error:
          queueError?.message ||
          "Could not create market queue.",
      })
      .eq(
        "id",
        run.id
      );

    throw new Error(
      `Could not create listing refresh queue: ${
        queueError?.message ||
        "No queue rows returned"
      }`
    );
  }

  const firstMarket =
    insertedQueue[0];

  /*
   * Claim the first queue row before dispatching it.
   */
  const {
    data: claimedMarket,
    error: claimError,
  } = await supabase
    .from(
      "listing_refresh_run_markets"
    )
    .update({
      status:
        "dispatched",
    })
    .eq(
      "id",
      firstMarket.id
    )
    .eq(
      "status",
      "pending"
    )
    .select(
      `
        id,
        city,
        position
      `
    )
    .maybeSingle();

  if (
    claimError ||
    !claimedMarket
  ) {
    await supabase
      .from(
        "listing_refresh_runs"
      )
      .update({
        status: "failed",
        completed_at:
          new Date()
            .toISOString(),

        error:
          claimError?.message ||
          "Could not claim first market.",
      })
      .eq(
        "id",
        run.id
      );

    throw new Error(
      `Could not claim first listing market: ${
        claimError?.message ||
        "Market was not pending"
      }`
    );
  }

  const baseUrl =
    PUBLIC_SITE_URL.replace(
      /\/$/,
      ""
    );

  try {
    const response =
      await fetch(
        `${baseUrl}/.netlify/functions/refresh-listing-market-background`,
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
              city:
                claimedMarket.city,

              runId:
                run.id,

              queueItemId:
                claimedMarket.id,
            }),
        }
      );

    if (!response.ok) {
      const responseText =
        await response.text();

      throw new Error(
        `Background function returned ${response.status}: ${responseText}`
      );
    }

    console.log(
      "Listing refresh chain started",
      {
        runId:
          run.id,

        totalMarkets:
          insertedQueue.length,

        firstMarket:
          claimedMarket.city,
      }
    );

    return json({
      ok: true,
      runId:
        run.id,

      markets:
        insertedQueue.length,

      firstMarket:
        claimedMarket.city,

      dispatched: 1,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown dispatch error";

    await supabase
      .from(
        "listing_refresh_run_markets"
      )
      .update({
        status: "failed",

        completed_at:
          new Date()
            .toISOString(),

        error:
          message,
      })
      .eq(
        "id",
        claimedMarket.id
      );

    await supabase
      .from(
        "listing_refresh_runs"
      )
      .update({
        status: "failed",

        completed_at:
          new Date()
            .toISOString(),

        error:
          message,
      })
      .eq(
        "id",
        run.id
      );

    throw error;
  }
}

export const config: Config = {
  schedule:
    "15 1,7,13,19 * * *",
};