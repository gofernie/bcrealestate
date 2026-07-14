import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { rebuildListingRows } from "../../../scripts/rebuild-listing-rows";
export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const REPLIERS_API_KEY = import.meta.env.REPLIERS_API_KEY;
const REPLIERS_BASE_URL =
  import.meta.env.REPLIERS_BASE_URL || "https://api.repliers.io";

const CRON_SECRET = import.meta.env.CRON_SECRET;

const PAGE_SIZE = 50;
const RUN_LOCK_MINUTES = 45;

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanKey(value: unknown) {
  return clean(value).toLowerCase();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function getListingId(listing: any) {
  return clean(
    listing?.id ||
      listing?.mlsNumber ||
      listing?.ml_num ||
      listing?.listingId ||
      listing?.mls_number
  );
}

/**
 * A listing market can include multiple Repliers city values.
 *
 * Important:
 * The key must match listing_markets.city.
 */
const CITY_FETCH_GROUPS: Record<string, string[]> = {
  parksville: ["Parksville", "Nanoose Bay"],

  "qualicum beach": [
    "Qualicum Beach",
    "Qualicum North",
    "French Creek",
    "Fairwinds",
    "Little Qualicum River Village",
    "Bowser/Deep Bay"
  ],

  duncan: [
    "Duncan",
    "Chemainus",
    "Cowichan Bay",
    "Cowichan Station/Glenora",
    "Crofton",
    "Honeymoon Bay",
    "Ladysmith",
    "Lake Cowichan",
    "Saltair",
    "Youbou"
  ],

  colwood: ["Colwood"]
};

type RefreshInput = {
  city?: string;
  boardId?: string;
  trigger?: string;
};

type RefreshStats = {
  pagesFetched: number;
  recordsReceived: number;
  uniqueRecords: number;
};

async function fetchRepliers(params: URLSearchParams) {
  if (!REPLIERS_API_KEY) {
    throw new Error("Missing REPLIERS_API_KEY");
  }

  const apiUrl = `${REPLIERS_BASE_URL}/listings?${params.toString()}`;

  console.log("REPLIERS QUERY:", params.toString());

  const response = await fetch(apiUrl, {
    headers: {
      "REPLIERS-API-KEY": REPLIERS_API_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Repliers error ${response.status}: ${text.slice(0, 1000)}`
    );
  }

  return response.json();
}

async function getRequestInput(request: Request, url: URL) {
  if (request.method === "POST") {
    let body: RefreshInput = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    return {
      city: clean(body.city || url.searchParams.get("city")),
      boardId: clean(body.boardId || url.searchParams.get("boardId")),
      trigger: clean(body.trigger || "cron")
    };
  }

  return {
    city: clean(url.searchParams.get("city")),
    boardId: clean(url.searchParams.get("boardId")),
    trigger: clean(url.searchParams.get("trigger") || "manual")
  };
}

function isAuthorized(request: Request) {
  /**
   * GET remains available for convenient manual testing.
   *
   * POST is intended for cron and requires CRON_SECRET.
   */
  if (request.method === "GET") {
    return true;
  }

  if (!CRON_SECRET) {
    console.error("CRON_SECRET is not configured");
    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${CRON_SECRET}`;
}

async function findActiveRun(city: string) {
  const cutoff = new Date(
    Date.now() - RUN_LOCK_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("listing_refresh_runs")
    .select("id, city, status, started_at")
    .ilike("city", city)
    .eq("status", "running")
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not check active refresh runs: ${error.message}`);
  }

  return data;
}

async function createRefreshRun(city: string, triggerSource: string) {
  const { data, error } = await supabase
    .from("listing_refresh_runs")
    .insert({
      city,
      status: "running",
      trigger_source: triggerSource || "manual",
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create refresh run: ${error?.message || "Unknown error"}`
    );
  }

  return data.id as string;
}

async function completeRefreshRun(
  runId: string,
  stats: RefreshStats,
  metadata: Record<string, unknown>
) {
  const { error } = await supabase
    .from("listing_refresh_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      pages_fetched: stats.pagesFetched,
      records_received: stats.recordsReceived,
      records_upserted: stats.uniqueRecords,
      metadata
    })
    .eq("id", runId);

  if (error) {
    console.error("Could not complete refresh run:", error);
  }
}

async function failRefreshRun(
  runId: string,
  message: string,
  stats: RefreshStats,
  metadata: Record<string, unknown>
) {
  const { error } = await supabase
    .from("listing_refresh_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      pages_fetched: stats.pagesFetched,
      records_received: stats.recordsReceived,
      records_upserted: stats.uniqueRecords,
      error_message: message.slice(0, 4000),
      metadata
    })
    .eq("id", runId);

  if (error) {
    console.error("Could not mark refresh run failed:", error);
  }
}

async function updateMarketStatus(
  city: string,
  values: {
    last_refresh_status: string;
    last_error?: string | null;
    success?: boolean;
  }
) {
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    last_refresh_at: now,
    last_refresh_status: values.last_refresh_status,
    last_error: values.last_error || null,
    updated_at: now
  };

  if (values.success) {
    update.last_success_at = now;
  }

  const { error } = await supabase
    .from("listing_markets")
    .update(update)
    .ilike("city", city);

  if (error) {
    console.error("Could not update listing market status:", error);
  }
}

async function refreshCity(request: Request, url: URL) {
  if (!isAuthorized(request)) {
    return json(
      {
        ok: false,
        error: "Unauthorized"
      },
      401
    );
  }

  const input = await getRequestInput(request, url);
  const rawCity = clean(input.city);

  if (!rawCity) {
    return json(
      {
        ok: false,
        error: "Missing city"
      },
      400
    );
  }

  const searchKey = cleanKey(rawCity);
  const triggerSource =
    request.method === "POST" ? input.trigger || "cron" : "manual";

  const activeRun = await findActiveRun(searchKey);

  if (activeRun) {
    return json(
      {
        ok: false,
        skipped: true,
        city: rawCity,
        error: "A refresh for this city is already running",
        activeRunStartedAt: activeRun.started_at
      },
      409
    );
  }

  const runId = await createRefreshRun(searchKey, triggerSource);

  const stats: RefreshStats = {
    pagesFetched: 0,
    recordsReceived: 0,
    uniqueRecords: 0
  };

  const citiesToFetch = CITY_FETCH_GROUPS[searchKey] || [rawCity];

  try {
    await updateMarketStatus(searchKey, {
      last_refresh_status: "running"
    });

    const allListings: any[] = [];
    const seen = new Set<string>();

    for (const fetchCity of citiesToFetch) {
      let page = 1;

      while (true) {
        const params = new URLSearchParams();

        params.set("city", fetchCity);
        params.set("pageNum", String(page));
        params.set("resultsPerPage", String(PAGE_SIZE));
        params.set("include", "details,address,images");
        params.set("status", "A");

        if (input.boardId) {
          params.set("boardId", input.boardId);
        }

        const data = await fetchRepliers(params);

        const listings = data?.listings || data?.results || data || [];

        if (!Array.isArray(listings)) {
          throw new Error(
            `Unexpected Repliers response for ${fetchCity}, page ${page}`
          );
        }

        if (listings.length === 0) {
          break;
        }

        stats.pagesFetched += 1;
        stats.recordsReceived += listings.length;

        for (const listing of listings) {
          const id = getListingId(listing);

          if (!id || seen.has(id)) {
            continue;
          }

          seen.add(id);

          allListings.push({
            ...listing,
            source_city: fetchCity
          });
        }

        if (listings.length < PAGE_SIZE) {
          break;
        }

        page += 1;

        /**
         * Safety guard against an unexpected pagination loop.
         * At 50 records per page this still allows 25,000 records.
         */
        if (page > 500) {
          throw new Error(
            `Pagination safety limit reached while fetching ${fetchCity}`
          );
        }
      }
    }

    stats.uniqueRecords = allListings.length;

    if (allListings.length === 0) {
      throw new Error(
        `Repliers returned zero active listings for ${rawCity}. Existing snapshot was not replaced.`
      );
    }

    const snapshot = {
      search_key: searchKey,
      city: rawCity,
      listings: allListings
    };

    const { error: snapshotError } = await supabase
      .from("listing_snapshots")
      .upsert(snapshot, {
        onConflict: "search_key"
      });

    if (snapshotError) {
      throw new Error(
        `Could not save listing snapshot: ${snapshotError.message}`
      );
    }

    console.log(`Starting listing_rows rebuild for ${searchKey}...`);

const rebuildResult = await rebuildListingRows(searchKey);

console.log(`Completed listing_rows rebuild for ${searchKey}.`);

const metadata = {
  mode: "snapshot_and_rebuild",
  searchKey,
  citiesFetched: citiesToFetch,
  boardId: input.boardId || null,
  rebuild: rebuildResult
};

    await completeRefreshRun(runId, stats, metadata);

    await updateMarketStatus(searchKey, {
      last_refresh_status: "completed",
      last_error: null,
      success: true
    });

  return json({
  ok: true,
  mode: "snapshot_and_rebuild",
  runId,
  city: rawCity,
  searchKey,
  citiesFetched: citiesToFetch,
  pagesFetched: stats.pagesFetched,
  recordsReceived: stats.recordsReceived,
  totalFetched: stats.uniqueRecords,
  rowsRebuilt: rebuildResult.rowsUpserted,
  rebuild: rebuildResult,
  message:
    "Fresh raw listings were saved and listing_rows was rebuilt successfully."
});
  } catch (error: any) {
    const message = error?.message || "Unknown refresh error";

    console.error(`Listing refresh failed for ${rawCity}:`, error);

    const metadata = {
      mode: "snapshot_only",
      searchKey,
      citiesFetched: citiesToFetch,
      boardId: input.boardId || null
    };

    await failRefreshRun(runId, message, stats, metadata);

    await updateMarketStatus(searchKey, {
      last_refresh_status: "failed",
      last_error: message
    });

    return json(
      {
        ok: false,
        runId,
        city: rawCity,
        pagesFetched: stats.pagesFetched,
        recordsReceived: stats.recordsReceived,
        uniqueRecords: stats.uniqueRecords,
        error: message
      },
      500
    );
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  return refreshCity(request, url);
};

export const POST: APIRoute = async ({ request, url }) => {
  return refreshCity(request, url);
};