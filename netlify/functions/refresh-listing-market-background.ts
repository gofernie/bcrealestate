import { purgeCache } from "@netlify/functions";
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

import {
  tagUntaggedListings,
} from "../../src/lib/listings/tagHomeStyles";

import {
  assignVictoriaWest,
  mergeVictoriaWestIntoVictoria,
} from "../../src/lib/listings/victoriaWest";

const CRON_SECRET =
  process.env.CRON_SECRET;

const supabase =
  createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

type RefreshRequest = {
  city?: string;
  boardId?: string;
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

// listing-cache-purge-v1: clear this city's cached pages and listing APIs once fresh listings are in
async function purgeListingCache(city: string) {
  const c = String(city || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!c) return;
  try {
    const tags = [`city-${c}`];
    const slug = (v: unknown) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const { data: siteRows } = await supabase.from("sites").select("domain, city, primary_city, secondary_markets");
    for (const s of siteRows || []) {
      const d = String(s.domain || "").trim().toLowerCase().replace(/^www\./, "");
      if (!d || d === "bc.realestate") continue;
      const markets = [s.primary_city, s.city, ...(Array.isArray(s.secondary_markets) ? s.secondary_markets : [])].map((m: any) => slug(typeof m === "object" && m ? (m.city || m.slug || m.name) : m));
      if (markets.includes(c)) tags.push("host-" + slug(d));
    }
    await purgeCache({ tags });
    console.log("listing cache purged", c);
  } catch (e) {
    console.error("listing cache purge failed", c, e);
  }
}
// Runs after every city's listing refresh. Each step is isolated so one failure
// never blocks the others or fails the refresh itself.
async function afterRefresh(
  city: string,
  origin: string
) {
  await purgeListingCache(city);

  // 1. Saved-search alerts (unchanged behaviour).
  try {
    const savedSearchResult =
      await processSavedSearches(
        supabase,
        {
          RESEND_API_KEY:
            process.env.RESEND_API_KEY!,
          TWILIO_ACCOUNT_SID:
            process.env.TWILIO_ACCOUNT_SID!,
          TWILIO_AUTH_TOKEN:
            process.env.TWILIO_AUTH_TOKEN!,
          TWILIO_FROM_NUMBER:
            process.env.TWILIO_FROM_NUMBER!,
          PUBLIC_SITE_URL:
            process.env.PUBLIC_SITE_URL,
        },
        city
      );

    console.log(
      "Saved searches processed after listing refresh",
      {
        city,
        processed: savedSearchResult.processed,
        results: savedSearchResult.results,
      }
    );
  } catch (savedSearchError) {
    console.error(
      "Saved search processing failed after listing refresh",
      {
        city,
        error:
          savedSearchError instanceof Error
            ? savedSearchError.message
            : savedSearchError,
      }
    );
  }

  // 2. Floorplan scan for every city (was Nanaimo only).
  try {
    const scanResponse =
      await fetch(
        `${origin}/.netlify/functions/scan-floorplans-background?city=${encodeURIComponent(city)}&limit=50`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CRON_SECRET}`,
            "Content-Type": "application/json",
          },
        }
      );

    console.log(
      "Floorplan scan dispatched",
      {
        city,
        status: scanResponse.status,
        accepted: scanResponse.ok,
      }
    );
  } catch (scanError) {
    console.error(
      "Could not dispatch floorplan scan:",
      scanError instanceof Error
        ? scanError.message
        : scanError
    );
  }

  // 3. Home-style tagging: newest untagged listings across all cities (Calgary skipped).
  try {
    const tagResult =
      await tagUntaggedListings(
        supabase,
        {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          LOOK_SEARCH_MODEL: process.env.LOOK_SEARCH_MODEL,
          REPLIERS_CDN: process.env.REPLIERS_CDN,
        },
        { limit: 60 }
      );

    console.log(
      "Home styles tagged after listing refresh",
      { city, ...tagResult }
    );
  } catch (tagError) {
    console.error(
      "Home style tagging failed after listing refresh",
      {
        city,
        error:
          tagError instanceof Error
            ? tagError.message
            : tagError,
      }
    );
  }
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
        error: "Missing CRON_SECRET",
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
        error: "Unauthorized",
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
      requestUrl.searchParams.get("city") ||
        body.city ||
        ""
    )
      .trim()
      .toLowerCase();

  const boardId =
    String(
      requestUrl.searchParams.get("boardId") ||
        body.boardId ||
        ""
    ).trim();

  if (!city) {
    return json(
      {
        ok: false,
        error: "Missing city",
      },
      400
    );
  }

  console.log(
    "Starting background listing refresh",
    {
      city,
      boardId: boardId || null,
    }
  );

  const isVictoria =
    city === "victoria";

  // Victoria: fold Vic West back in first so the refresh can deactivate sold Vic West listings.
  if (isVictoria) {
    try {
      const merged =
        await mergeVictoriaWestIntoVictoria(supabase);
      console.log("Victoria West merged into Victoria before refresh", { merged });
    } catch (mergeError) {
      console.error(
        "Could not merge Victoria West before refresh:",
        mergeError instanceof Error ? mergeError.message : mergeError
      );
    }
  }

  try {
    const result =
      await refreshListingMarket({
        city,
        boardId,

        trigger:
          "scheduled-background",

        env: {
          PUBLIC_SUPABASE_URL:
            process.env.PUBLIC_SUPABASE_URL,

          SUPABASE_SERVICE_ROLE_KEY:
            process.env.SUPABASE_SERVICE_ROLE_KEY,

          REPLIERS_API_KEY:
            process.env.REPLIERS_API_KEY,

          REPLIERS_BASE_URL:
            process.env.REPLIERS_BASE_URL,
        },
      });

    console.log(
      "Completed background listing refresh",
      {
        city,
        boardId: boardId || null,
        result,
      }
    );

    await afterRefresh(
      city,
      requestUrl.origin
    );

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
      )?.status === "number"
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
      )?.details || null;

    console.error(
      "Background listing refresh failed",
      {
        city,
        boardId: boardId || null,
        message,
        status,
        details,
        stack:
          error instanceof Error
            ? error.stack
            : null,
      }
    );

    return json(
      {
        ok: false,
        city,
        boardId: boardId || null,
        error: message,
        details,
      },
      status
    );
  } finally {
    // Victoria: always re-split Vic West, even if the refresh failed after the merge.
    if (isVictoria) {
      try {
        const split =
          await assignVictoriaWest(supabase);
        console.log("Victoria West re-assigned after refresh", split);
      } catch (splitError) {
        console.error(
          "Victoria West re-assignment failed:",
          splitError instanceof Error ? splitError.message : splitError
        );
      }
    }
  }
}

export const config: Config = {
  background: true,
};
