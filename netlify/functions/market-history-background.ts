import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const apiKey = process.env.REPLIERS_API_KEY;
const cronSecret = process.env.CRON_SECRET;

const wait = (milliseconds: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

const isoDate = (date: Date) =>
  date.toISOString().slice(0, 10);

const monthEnd = (monthStart: Date) =>
  new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0
  ));

const titleCase = (value: string) =>
  value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );

function median(values: number[]) {
  const sorted = values
    .filter((value) =>
      Number.isFinite(value) && value > 0
    )
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: number[]) {
  const valid = values.filter((value) =>
    Number.isFinite(value) && value > 0
  );

  if (!valid.length) return null;

  return (
    valid.reduce(
      (total, value) => total + value,
      0
    ) / valid.length
  );
}

function applyCommonFilters(
  params: URLSearchParams,
  apiCity: string
) {
  params.set("city", apiCity);
  params.set("type", "sale");
  params.append("class", "Residential");
  params.append("class", "Condo");
}

async function requestListings(
  params: URLSearchParams,
  apiCity: string
) {
  applyCommonFilters(params, apiCity);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(
      `https://api.repliers.io/listings?${params}`,
      {
        headers: {
          "REPLIERS-API-KEY": apiKey!,
        },
      }
    );

    const body = await response.json();

    if (response.ok) return body;

    if (
      attempt < 3 &&
      (response.status === 429 ||
        response.status >= 500)
    ) {
      await wait(attempt * 1000);
      continue;
    }

    throw new Error(
      `Repliers ${response.status}: ${JSON.stringify(body)}`
    );
  }

  throw new Error("Repliers request failed.");
}

async function getNewListingCount(
  apiCity: string,
  startDate: string,
  endDate: string
) {
  const params = new URLSearchParams();

  params.append("status", "A");
  params.append("status", "U");
  params.set("minListDate", startDate);
  params.set("maxListDate", endDate);
  params.set("resultsPerPage", "1");
  params.set("listings", "false");

  const body = await requestListings(
    params,
    apiCity
  );

  return Number(body.count || 0);
}

async function getMonthlySales(
  apiCity: string,
  startDate: string,
  endDate: string
) {
  const baseParams = new URLSearchParams();

  baseParams.set("status", "U");
  baseParams.set("lastStatus", "Sld");
  baseParams.set("minSoldDate", startDate);
  baseParams.set("maxSoldDate", endDate);
  baseParams.set("resultsPerPage", "100");
  baseParams.set(
    "fields",
    "mlsNumber,soldDate,soldPrice,listPrice,class"
  );

  const listings: any[] = [];
  let pageNumber = 1;
  let numberOfPages = 1;

  do {
    const pageParams =
      new URLSearchParams(baseParams);

    pageParams.set(
      "pageNum",
      String(pageNumber)
    );

    const body = await requestListings(
      pageParams,
      apiCity
    );

    listings.push(...(body.listings || []));

    numberOfPages = Number(
      body.numPages || 1
    );

    pageNumber += 1;

    if (pageNumber <= numberOfPages) {
      await wait(175);
    }
  } while (pageNumber <= numberOfPages);

  const uniqueSales = Array.from(
    new Map(
      listings.map((listing) => [
        String(
          listing.mlsNumber ||
          `${listing.soldDate}-${listing.soldPrice}-${listing.listPrice}`
        ),
        listing,
      ])
    ).values()
  );

  const singleFamilySales = uniqueSales.filter(
    (listing: any) =>
      String(listing.class || "")
        .trim()
        .toLowerCase() === "residential"
  );

  const singleFamilySoldPrices =
    singleFamilySales
      .map((listing: any) =>
        Number(listing.soldPrice || 0)
      )
      .filter((price) => price > 0);

  const soldPrices = uniqueSales
    .map((listing: any) =>
      Number(listing.soldPrice || 0)
    )
    .filter((price) => price > 0);

  const ratios = uniqueSales
    .map((listing: any) => {
      const soldPrice =
        Number(listing.soldPrice || 0);

      const listPrice =
        Number(listing.listPrice || 0);

      return soldPrice > 0 && listPrice > 0
        ? (soldPrice / listPrice) * 100
        : 0;
    })
    .filter((ratio) => ratio > 0);

  return {
    sales: uniqueSales.length,
    medianSoldPrice: median(soldPrices),
    medianSingleFamilySoldPrice:
      median(singleFamilySoldPrices),
    averageSoldPrice: average(soldPrices),
    saleToList: average(ratios),
  };
}

async function refreshMarket(city: string) {
  const marketKey = city
    .trim()
    .toLowerCase();

  const apiCity = titleCase(marketKey);

  const {
    count: existingCount,
    error: countError,
  } = await supabase
    .from("market_monthly_stats")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("city", marketKey)
    .not(
      "median_single_family_sold_price",
      "is",
      null
    );

  if (countError) {
    throw new Error(
      `Could not count ${marketKey} history: ${countError.message}`
    );
  }

  const monthsToRefresh =
    Number(existingCount || 0) >= 20
      ? 4
      : 24;

  const now = new Date();

  const lastSettledMonth =
    new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 2,
      1
    ));

  const firstMonth =
    new Date(Date.UTC(
      lastSettledMonth.getUTCFullYear(),
      lastSettledMonth.getUTCMonth() -
        (monthsToRefresh - 1),
      1
    ));

  console.log("Refreshing market history", {
    marketKey,
    apiCity,
    monthsToRefresh,
  });

  let monthsSaved = 0;

  for (
    let offset = 0;
    offset < monthsToRefresh;
    offset += 1
  ) {
    const monthStart =
      new Date(Date.UTC(
        firstMonth.getUTCFullYear(),
        firstMonth.getUTCMonth() + offset,
        1
      ));

    const startDate = isoDate(monthStart);
    const endDate = isoDate(
      monthEnd(monthStart)
    );

    const [newListings, sales] =
      await Promise.all([
        getNewListingCount(
          apiCity,
          startDate,
          endDate
        ),
        getMonthlySales(
          apiCity,
          startDate,
          endDate
        ),
      ]);

    const row = {
      city: marketKey,
      month_start: startDate,
      new_listings: newListings,
      sales: sales.sales,
      median_sold_price:
        sales.medianSoldPrice == null
          ? null
          : Math.round(
              sales.medianSoldPrice
            ),
      median_single_family_sold_price:
        sales.medianSingleFamilySoldPrice == null
          ? null
          : Math.round(
              sales.medianSingleFamilySoldPrice
            ),
      average_sold_price:
        sales.averageSoldPrice == null
          ? null
          : Math.round(
              sales.averageSoldPrice
            ),
      average_sale_to_list_ratio:
        sales.saleToList == null
          ? null
          : Number(
              sales.saleToList.toFixed(2)
            ),
      source: "repliers",
      refreshed_at:
        new Date().toISOString(),
    };

    const { error } = await supabase
      .from("market_monthly_stats")
      .upsert(row, {
        onConflict: "city,month_start",
      });

    if (error) {
      throw new Error(
        `Could not save ${marketKey} ${startDate}: ${error.message}`
      );
    }

    monthsSaved += 1;

    console.log("Saved market month", {
      city: marketKey,
      month: startDate.slice(0, 7),
      newListings,
      sales: sales.sales,
    });

    await wait(200);
  }

  return {
    city: marketKey,
    monthsSaved,
  };
}

export default async function handler(
  request: Request
) {
  if (!apiKey) {
    throw new Error(
      "Missing REPLIERS_API_KEY"
    );
  }

  if (!cronSecret) {
    throw new Error(
      "Missing CRON_SECRET"
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unauthorized",
      }),
      {
        status: 401,
        headers: {
          "content-type":
            "application/json",
        },
      }
    );
  }

  const url = new URL(request.url);

  let city = String(
    url.searchParams.get("city") || ""
  )
    .trim()
    .toLowerCase();

  if (!city) {
    try {
      const body = await request.json();
      city = String(body?.city || "")
        .trim()
        .toLowerCase();
    } catch {}
  }

  if (!city) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing city",
      }),
      {
        status: 400,
        headers: {
          "content-type":
            "application/json",
        },
      }
    );
  }

  try {
    const result =
      await refreshMarket(city);

    console.log(
      "Market history refresh complete",
      result
    );
  } catch (error: any) {
    console.error(
      "Market history refresh failed",
      {
        city,
        error:
          error?.message ||
          String(error),
      }
    );

    throw error;
  }
}