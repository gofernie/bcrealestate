import { createClient } from "@supabase/supabase-js";
import { rebuildListingRows } from "../../scripts/rebuild-listing-rows";

const PAGE_SIZE = 50;
const RUN_LOCK_MINUTES = 45;
const REPLIER_RETRY_DELAYS = [0, 5000, 15000];

const sleep = (milliseconds: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

async function fetchRepliersWithRetry(
  url: string,
  apiKey: string,
  context: {
    city: string;
    page: number;
  }
) {
  let lastError: Error | null = null;

  for (
    let attempt = 0;
    attempt < REPLIER_RETRY_DELAYS.length;
    attempt += 1
  ) {
    const delay = REPLIER_RETRY_DELAYS[attempt];

    if (delay > 0) {
      console.warn(
        `Retrying Repliers request for ${context.city}, page ${context.page}, attempt ${attempt + 1} after ${delay}ms`
      );

      await sleep(delay);
    }

    try {
      const response = await fetch(url, {
        headers: {
          "REPLIERS-API-KEY": apiKey,
          "Content-Type": "application/json"
        }
      });

      console.log("REPLIERS RESPONSE:", {
        city: context.city,
        page: context.page,
        attempt: attempt + 1,
        status: response.status
      });

      if (response.ok) {
        return response;
      }

      const responseText = await response.text();

      const error = new Error(
        `Repliers error ${response.status} for ${context.city}, page ${context.page}: ${responseText.slice(
          0,
          1000
        )}`
      );

      lastError = error;

      const retryable =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (!retryable) {
        throw error;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown Repliers request error");

      if (
        attempt ===
        REPLIER_RETRY_DELAYS.length - 1
      ) {
        throw lastError;
      }
    }
  }

  throw (
    lastError ||
    new Error("Repliers request failed")
  );
}
export type RefreshListingMarketOptions = {
  city: string;
  boardId?: string;
  trigger?: string;

  env: {
    PUBLIC_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    REPLIERS_API_KEY?: string;
    REPLIERS_BASE_URL?: string;
  };
};

export type RefreshListingMarketResult = {
  ok: true;
  mode: "direct_rebuild";
  runId: string;
  city: string;
  searchKey: string;
  citiesFetched: string[];
  pagesFetched: number;
  recordsReceived: number;
  totalFetched: number;
  rowsRebuilt: number;
  rebuild: any;
  message: string;
};

type RefreshStats = {
  pagesFetched: number;
  recordsReceived: number;
  uniqueRecords: number;
};

const clean = (value: unknown) =>
  String(value || "").trim();

const cleanKey = (value: unknown) =>
  clean(value).toLowerCase();

function getListingId(listing: any) {
  return clean(
    listing?.id ||
      listing?.mlsNumber ||
      listing?.ml_num ||
      listing?.listingId ||
      listing?.mls_number
  );
}

const CITY_FETCH_GROUPS: Record<string, string[]> = {
  parksville: [
    "Parksville",
    "Nanoose Bay"
  ],

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

  colwood: [
    "Colwood"
  ]
};

export async function refreshListingMarket(
  options: RefreshListingMarketOptions
): Promise<RefreshListingMarketResult> {
  const rawCity = clean(options.city);
  const boardId = clean(options.boardId);
  const triggerSource = clean(
    options.trigger || "manual"
  );

  if (!rawCity) {
    throw new Error("Missing city");
  }

  const {
    PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    REPLIERS_API_KEY,
    REPLIERS_BASE_URL = "https://api.repliers.io"
  } = options.env;

  if (!PUBLIC_SUPABASE_URL) {
    throw new Error("Missing PUBLIC_SUPABASE_URL");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  if (!REPLIERS_API_KEY) {
    throw new Error("Missing REPLIERS_API_KEY");
  }

  const supabase = createClient(
    PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

  const searchKey = cleanKey(rawCity);

  const citiesToFetch =
    CITY_FETCH_GROUPS[searchKey] || [rawCity];

  const cutoff = new Date(
    Date.now() - RUN_LOCK_MINUTES * 60 * 1000
  ).toISOString();

  const {
    data: activeRun,
    error: activeRunError
  } = await supabase
    .from("listing_refresh_runs")
    .select("id, city, status, started_at")
    .ilike("city", searchKey)
    .eq("status", "running")
    .gte("started_at", cutoff)
    .order("started_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (activeRunError) {
    throw new Error(
      `Could not check active refresh runs: ${activeRunError.message}`
    );
  }

  if (activeRun) {
    const error = new Error(
      `A refresh for ${rawCity} is already running`
    ) as Error & {
      status?: number;
      details?: unknown;
    };

    error.status = 409;

    error.details = {
      skipped: true,
      activeRunStartedAt: activeRun.started_at
    };

    throw error;
  }

  const {
    data: runRow,
    error: createRunError
  } = await supabase
    .from("listing_refresh_runs")
    .insert({
      city: searchKey,
      status: "running",
      trigger_source:
        triggerSource || "manual",
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (createRunError || !runRow) {
    throw new Error(
      `Could not create refresh run: ${
        createRunError?.message ||
        "Unknown error"
      }`
    );
  }

  const runId = String(runRow.id);

  const stats: RefreshStats = {
    pagesFetched: 0,
    recordsReceived: 0,
    uniqueRecords: 0
  };

  const updateMarketStatus = async (
    values: {
      last_refresh_status: string;
      last_error?: string | null;
      success?: boolean;
    }
  ) => {
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      last_refresh_at: now,
      last_refresh_status:
        values.last_refresh_status,
      last_error:
        values.last_error || null,
      updated_at: now
    };

    if (values.success) {
      update.last_success_at = now;
    }

    const { error } = await supabase
      .from("listing_markets")
      .update(update)
      .ilike("city", searchKey);

    if (error) {
      console.error(
        "Could not update listing market status:",
        error
      );
    }
  };

  try {
    await updateMarketStatus({
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
        params.set(
          "resultsPerPage",
          String(PAGE_SIZE)
        );
        params.set(
          "include",
          "details,address,images"
        );
        params.set("status", "A");

        if (boardId) {
          params.set("boardId", boardId);
        }

        console.log(
          "REPLIERS QUERY:",
          params.toString()
        );

     const response = await fetchRepliersWithRetry(
  `${REPLIERS_BASE_URL}/listings?${params.toString()}`,
  REPLIERS_API_KEY,
  {
    city: fetchCity,
    page
  }
);

        const data = await response.json();

        const listings =
          data?.listings ||
          data?.results ||
          data ||
          [];

        if (!Array.isArray(listings)) {
          throw new Error(
            `Unexpected Repliers response for ${fetchCity}, page ${page}`
          );
        }

        if (listings.length === 0) {
          break;
        }

        stats.pagesFetched += 1;
        stats.recordsReceived +=
          listings.length;

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

        if (page > 500) {
          throw new Error(
            `Pagination safety limit reached while fetching ${fetchCity}`
          );
        }
      }
    }

    stats.uniqueRecords =
      allListings.length;

    if (allListings.length === 0) {
      throw new Error(
        `Repliers returned zero active listings for ${rawCity}. Existing listing_rows were not changed.`
      );
    }

    console.log(
      `Starting direct listing_rows rebuild for ${searchKey} with ${allListings.length} listings...`
    );

    const rebuildResult =
      await rebuildListingRows({
        city: searchKey,
        listings: allListings
      });

    if (!rebuildResult?.ok) {
      throw new Error(
        `listing_rows rebuild did not return a successful result for ${searchKey}`
      );
    }

    console.log(
      `Completed listing_rows rebuild for ${searchKey}.`
    );

    const metadata = {
      mode: "direct_rebuild",
      searchKey,
      citiesFetched: citiesToFetch,
      boardId: boardId || null,
      rebuild: rebuildResult
    };

    const {
      error: completeRunError
    } = await supabase
      .from("listing_refresh_runs")
      .update({
        status: "completed",
        completed_at:
          new Date().toISOString(),
        pages_fetched:
          stats.pagesFetched,
        records_received:
          stats.recordsReceived,
        records_upserted:
          stats.uniqueRecords,
        metadata
      })
      .eq("id", runId);

    if (completeRunError) {
      console.error(
        "Could not complete refresh run:",
        completeRunError
      );
    }

    await updateMarketStatus({
      last_refresh_status: "completed",
      last_error: null,
      success: true
    });

    return {
      ok: true,
      mode: "direct_rebuild",
      runId,
      city: rawCity,
      searchKey,
      citiesFetched: citiesToFetch,
      pagesFetched:
        stats.pagesFetched,
      recordsReceived:
        stats.recordsReceived,
      totalFetched:
        stats.uniqueRecords,
      rowsRebuilt:
        rebuildResult.rowsUpserted,
      rebuild: rebuildResult,
      message:
        "Fresh listings were normalized and written directly to listing_rows successfully."
    };
  } catch (error: any) {
    const message =
      error?.message ||
      "Unknown refresh error";

    console.error(
      `Listing refresh failed for ${rawCity}:`,
      error
    );

    const metadata = {
      mode: "direct_rebuild",
      searchKey,
      citiesFetched: citiesToFetch,
      boardId: boardId || null
    };

    const {
      error: failRunError
    } = await supabase
      .from("listing_refresh_runs")
      .update({
        status: "failed",
        completed_at:
          new Date().toISOString(),
        pages_fetched:
          stats.pagesFetched,
        records_received:
          stats.recordsReceived,
        records_upserted:
          stats.uniqueRecords,
        error_message:
          message.slice(0, 4000),
        metadata
      })
      .eq("id", runId);

    if (failRunError) {
      console.error(
        "Could not mark refresh run failed:",
        failRunError
      );
    }

    await updateMarketStatus({
      last_refresh_status: "failed",
      last_error: message
    });

    throw error;
  }
}