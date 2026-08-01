import type {
  Config,
} from "@netlify/functions";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  refreshListingMarket,
} from "../../src/lib/listings/refreshListingMarket";

import {
  processSavedSearches,
} from "../../src/lib/savedSearches/processSavedSearches";

const CRON_SECRET =
  process.env.CRON_SECRET;

const supabase =
  createClient(
    process.env
      .PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

type RefreshRequest = {
  city?: string;
  boardId?: string;

  runId?: string;
  queueItemId?: string;
};

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


async function dispatchNextMarket(
  request: Request,
  runId: string
): Promise<void> {
  const baseUrl =
    new URL(request.url).origin;

  const response =
    await fetch(
      `${baseUrl}/.netlify/functions/dispatch-next-listing-market`,
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
            runId,
          }),
      }
    );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Next-market dispatcher returned ${response.status}: ${responseText}`
    );
  }

  console.log(
    "Next-market dispatcher accepted",
    {
      runId,
      status:
        response.status,
    }
  );
}
export default async function handler(
  request: Request
) {
  if (!CRON_SECRET) {
    console.error(
      "Missing CRON_SECRET"
    );

    return json(
      {
        ok: false,
        error:
          "Missing CRON_SECRET",
      },
      500
    );
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    authorization !==
    `Bearer ${CRON_SECRET}`
  ) {
    return json(
      {
        ok: false,
        error:
          "Unauthorized",
      },
      401
    );
  }

  const requestUrl =
    new URL(
      request.url
    );

  let body:
    RefreshRequest = {};

  try {
    const rawBody =
      await request.text();

    if (rawBody) {
      body =
        JSON.parse(
          rawBody
        );
    }
  } catch (error) {
    console.warn(
      "Could not parse worker request body:",
      error
    );
  }

  const city =
    String(
      requestUrl.searchParams.get(
        "city"
      ) ||
        body.city ||
        ""
    )
      .trim()
      .toLowerCase();

  const boardId =
    String(
      requestUrl.searchParams.get(
        "boardId"
      ) ||
        body.boardId ||
        ""
    ).trim();

  const runId =
    String(
      requestUrl.searchParams.get(
        "runId"
      ) ||
        body.runId ||
        ""
    ).trim();

  const queueItemId =
    String(
      requestUrl.searchParams.get(
        "queueItemId"
      ) ||
        body.queueItemId ||
        ""
    ).trim();

  if (!city) {
    return json(
      {
        ok: false,
        error:
          "Missing city",
      },
      400
    );
  }

  /*
   * Queue-based requests must atomically transition from
   * dispatched to running.
   *
   * A duplicate Netlify invocation will not rerun the market.
   */
  if (
    runId &&
    queueItemId
  ) {
    const {
      data: claimedQueueItem,
      error: queueClaimError,
    } = await supabase
      .from(
        "listing_refresh_run_markets"
      )
      .update({
        status:
          "running",

        started_at:
          new Date()
            .toISOString(),

        error:
          null,
      })
      .eq(
        "id",
        queueItemId
      )
      .eq(
        "run_id",
        runId
      )
      .eq(
        "city",
        city
      )
      .eq(
        "status",
        "dispatched"
      )
      .select(
        "id, status"
      )
      .maybeSingle();

    if (queueClaimError) {
      return json(
        {
          ok: false,
          error:
            queueClaimError.message,
        },
        500
      );
    }

    if (!claimedQueueItem) {
      console.log(
        "Duplicate or previously claimed refresh ignored",
        {
          runId,
          queueItemId,
          city,
        }
      );

      return json(
        {
          ok: true,
          ignored: true,
          reason:
            "Queue item was already claimed or completed.",
          runId,
          queueItemId,
          city,
        },
        202
      );
    }
  }

  console.log(
    "Starting background listing refresh",
    {
      city,

      boardId:
        boardId || null,

      runId:
        runId || null,

      queueItemId:
        queueItemId || null,
    }
  );

  try {
    const result =
      await refreshListingMarket({
        city,
        boardId,

        trigger:
          "scheduled-background",

        env: {
          PUBLIC_SUPABASE_URL:
            process.env
              .PUBLIC_SUPABASE_URL,

          SUPABASE_SERVICE_ROLE_KEY:
            process.env
              .SUPABASE_SERVICE_ROLE_KEY,

          REPLIERS_API_KEY:
            process.env
              .REPLIERS_API_KEY,

          REPLIERS_BASE_URL:
            process.env
              .REPLIERS_BASE_URL,
        },
      });

    console.log(
      "Completed background listing refresh",
      {
        city,

        boardId:
          boardId || null,

        runId:
          runId || null,

        result,
      }
    );

    try {
      const savedSearchResult =
        await processSavedSearches(
          supabase,
          {
            RESEND_API_KEY:
              process.env
                .RESEND_API_KEY!,

            TWILIO_ACCOUNT_SID:
              process.env
                .TWILIO_ACCOUNT_SID!,

            TWILIO_AUTH_TOKEN:
              process.env
                .TWILIO_AUTH_TOKEN!,

            TWILIO_FROM_NUMBER:
              process.env
                .TWILIO_FROM_NUMBER!,

            PUBLIC_SITE_URL:
              process.env
                .PUBLIC_SITE_URL,
          },
          city
        );

      console.log(
        "Saved searches processed after listing refresh",
        {
          city,

          processed:
            savedSearchResult.processed,

          results:
            savedSearchResult.results,
        }
      );
    } catch (
      savedSearchError
    ) {
      console.error(
        "Saved search processing failed after listing refresh",
        {
          city,

          error:
            savedSearchError instanceof
            Error
              ? savedSearchError.message
              : savedSearchError,
        }
      );
    }

    if (
      city ===
      "nanaimo"
    ) {
      try {
        const baseUrl =
          new URL(
            request.url
          ).origin;

        const scanResponse =
          await fetch(
            `${baseUrl}/.netlify/functions/scan-floorplans-background?city=nanaimo&limit=50`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${CRON_SECRET}`,

                "Content-Type":
                  "application/json",
              },
            }
          );

        console.log(
          "Floorplan scan dispatched",
          {
            city,

            status:
              scanResponse.status,

            accepted:
              scanResponse.ok,
          }
        );
      } catch (
        scanError
      ) {
        console.error(
          "Could not dispatch floorplan scan:",
          scanError instanceof
          Error
            ? scanError.message
            : scanError
        );
      }
    }

    /*
     * Mark this market complete before starting the next.
     */
    if (
      runId &&
      queueItemId
    ) {
      const {
        error: queueCompleteError,
      } = await supabase
        .from(
          "listing_refresh_run_markets"
        )
        .update({
          status:
            "completed",

          completed_at:
            new Date()
              .toISOString(),

          error:
            null,
        })
        .eq(
          "id",
          queueItemId
        )
        .eq(
          "run_id",
          runId
        );

      if (queueCompleteError) {
        throw new Error(
          `Could not complete queue item: ${queueCompleteError.message}`
        );
      }

      await dispatchNextMarket(
        request,
        runId
      );
    }

    return json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown listing refresh error";

    const status =
      typeof (
        error as {
          status?: unknown;
        }
      )?.status ===
      "number"
        ? (
            error as {
              status: number;
            }
          ).status
        : 500;

    const details =
      (
        error as {
          details?: unknown;
        }
      )?.details ||
      null;

    console.error(
      "Background listing refresh failed",
      {
        city,

        boardId:
          boardId || null,

        runId:
          runId || null,

        queueItemId:
          queueItemId || null,

        message,

        status,

        details,

        stack:
          error instanceof Error
            ? error.stack
            : null,
      }
    );

    /*
     * A failed market does not stop later markets.
     */
    if (
      runId &&
      queueItemId
    ) {
      try {
        await supabase
          .from(
            "listing_refresh_run_markets"
          )
          .update({
            status:
              "failed",

            completed_at:
              new Date()
                .toISOString(),

            error:
              message,
          })
          .eq(
            "id",
            queueItemId
          )
          .eq(
            "run_id",
            runId
          );

        await dispatchNextMarket(
          request,
          runId
        );
      } catch (
        continuationError
      ) {
        const continuationMessage =
          continuationError instanceof
          Error
            ? continuationError.message
            : "Unknown continuation error";

        console.error(
          "Could not continue listing refresh chain",
          {
            runId,
            city,
            error:
              continuationMessage,
          }
        );

        await supabase
          .from(
            "listing_refresh_runs"
          )
          .update({
            status:
              "failed",

            completed_at:
              new Date()
                .toISOString(),

            error:
              `Chain continuation failed after ${city}: ${continuationMessage}`,
          })
          .eq(
            "id",
            runId
          );
      }
    }

    return json(
      {
        ok: false,
        city,

        boardId:
          boardId || null,

        runId:
          runId || null,

        error:
          message,

        details,
      },
      status
    );
  }
}

export const config: Config = {
  background: true,
};