import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DispatchRequest = {
  runId?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default async function handler(request: Request) {
  if (!CRON_SECRET) {
    return json(
      {
        ok: false,
        error: "Missing CRON_SECRET",
      },
      500
    );
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${CRON_SECRET}`
  ) {
    return json(
      {
        ok: false,
        error: "Unauthorized",
      },
      401
    );
  }

  let body: DispatchRequest = {};

  try {
    const rawBody = await request.text();

    if (rawBody) {
      body = JSON.parse(rawBody);
    }
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid request body",
      },
      400
    );
  }

  const runId = String(body.runId || "").trim();

  if (!runId) {
    return json(
      {
        ok: false,
        error: "Missing runId",
      },
      400
    );
  }

  const { data: nextPending, error: pendingError } =
    await supabase
      .from("listing_refresh_run_markets")
      .select("id, city, position")
      .eq("run_id", runId)
      .eq("status", "pending")
      .order("position", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  if (pendingError) {
    return json(
      {
        ok: false,
        error: pendingError.message,
      },
      500
    );
  }

  if (!nextPending) {
    const {
      count: failedCount,
      error: countError,
    } = await supabase
      .from("listing_refresh_run_markets")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("run_id", runId)
      .eq("status", "failed");

    if (countError) {
      return json(
        {
          ok: false,
          error: countError.message,
        },
        500
      );
    }

    const failures = failedCount || 0;

    const { error: completionError } =
      await supabase
        .from("listing_refresh_runs")
        .update({
          status:
            failures > 0
              ? "failed"
              : "completed",
          completed_at: new Date().toISOString(),
          error:
            failures > 0
              ? `${failures} market refreshes failed.`
              : null,
        })
        .eq("id", runId)
        .eq("status", "running");

    if (completionError) {
      return json(
        {
          ok: false,
          error: completionError.message,
        },
        500
      );
    }

    console.log("Listing refresh run finished", {
      runId,
      failures,
    });

    return json({
      ok: true,
      completed: true,
      runId,
      failures,
    });
  }

  const {
    data: claimedMarket,
    error: claimError,
  } = await supabase
    .from("listing_refresh_run_markets")
    .update({
      status: "dispatched",
    })
    .eq("id", nextPending.id)
    .eq("run_id", runId)
    .eq("status", "pending")
    .select("id, city, position")
    .maybeSingle();

  if (claimError) {
    return json(
      {
        ok: false,
        error: claimError.message,
      },
      500
    );
  }

  if (!claimedMarket) {
    return json({
      ok: true,
      ignored: true,
      reason: "Market was already claimed.",
    });
  }

  const baseUrl = new URL(request.url).origin;

  const response = await fetch(
    `${baseUrl}/.netlify/functions/refresh-listing-market-background`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        city: claimedMarket.city,
        runId,
        queueItemId: claimedMarket.id,
      }),
    }
  );

  if (!response.ok) {
    const responseText = await response.text();

    await supabase
      .from("listing_refresh_run_markets")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error:
          `Background dispatch returned ${response.status}: ${responseText}`,
      })
      .eq("id", claimedMarket.id);

    return json(
      {
        ok: false,
        city: claimedMarket.city,
        error:
          `Background dispatch returned ${response.status}`,
      },
      500
    );
  }

  console.log("Next listing market dispatched", {
    runId,
    city: claimedMarket.city,
    position: claimedMarket.position,
  });

  return json({
    ok: true,
    dispatched: true,
    runId,
    city: claimedMarket.city,
    position: claimedMarket.position,
  });
}

export const config: Config = {
  background: true,
};