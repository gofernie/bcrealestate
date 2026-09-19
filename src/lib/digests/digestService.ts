import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type DigestConfig = {
  id: string;
  site_id: string;
  name: string;
  city_slug: string;
  market_name?: string | null;
  market_cities?: string[] | null;
  send_mode: "manual" | "approval" | "automatic";
  subject_template: string;
  intro_text?: string | null;
  max_listings: number;
  site?: Record<string, any> | null;
};

type DigestSubscriber = {
  id: string;
  name?: string | null;
  email: string;
  unsubscribe_token: string;
};

type DigestEnvironment = {
  RESEND_API_KEY: string;
  PUBLIC_SITE_URL?: string;
  DIGEST_FROM_EMAIL?: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const titleCase = (value: unknown) =>
  String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const isoDate = (date: Date) =>
  date.toISOString().slice(0, 10);

const money = (value: unknown) => {
  const amount = Number(value);

  return Number.isFinite(amount) && amount > 0
    ? `$${Math.round(amount).toLocaleString("en-CA")}`
    : "Price unavailable";
};

function getWeeklyPeriod(referenceDate = new Date()) {
  const periodEnd = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );

  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 6);

  return {
    periodStart: isoDate(periodStart),
    periodEnd: isoDate(periodEnd),
  };
}

function siteBaseUrl(
  site: Record<string, any> | null | undefined,
  fallback?: string
) {
  const domain = String(site?.domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  if (domain) return `https://${domain}`;

  return String(fallback || "")
    .trim()
    .replace(/\/$/, "");
}

function replaceSubjectTokens(
  template: string,
  values: {
    market: string;
    start: string;
    end: string;
    newListings: number;
  }
) {
  return template
    .replaceAll("{{market}}", values.market)
    .replaceAll("{{start}}", values.start)
    .replaceAll("{{end}}", values.end)
    .replaceAll("{{new_listings}}", String(values.newListings));
}

function normalizeImageUrl(value: unknown) {
  const image = String(value || "").trim();

  if (!image) return "";

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  if (image.startsWith("/vreb/")) {
    return `https://cdn.repliers.io${image}?class=medium`;
  }

  return image;
}

async function loadAgent(
  supabase: SupabaseClient,
  site: Record<string, any> | null | undefined
) {
  const agentId = String(site?.agent_id || "").trim();

  if (!agentId) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    console.warn("Could not load digest agent:", error.message);
  }

  return data || null;
}

async function loadNewListings(
  supabase: SupabaseClient,
  config: DigestConfig,
  periodStart: string
) {
  const cities = (
    Array.isArray(config.market_cities) &&
    config.market_cities.length
      ? config.market_cities
      : [config.city_slug]
  )
    .map((city) => String(city).trim().toLowerCase())
    .filter(Boolean);

  const selectFields = `
    mls_number,
    price,
    beds,
    baths,
    address,
    image_url,
    normalized_city,
    normalized_type,
    listed_at,
    created_at
  `;

  let listedQuery = supabase
    .from("listing_rows")
    .select(selectFields)
    .eq("status", "A")
    .in("normalized_city", cities)
    .gte("listed_at", `${periodStart}T00:00:00.000Z`)
    .order("listed_at", { ascending: false })
    .limit(config.max_listings);

  const {
    data: listedRows,
    error: listedError,
  } = await listedQuery;

  if (!listedError && listedRows?.length) {
    return listedRows;
  }

  if (listedError) {
    console.warn(
      "Digest listed_at query failed; trying created_at:",
      listedError.message
    );
  }

  const {
    data: createdRows,
    error: createdError,
  } = await supabase
    .from("listing_rows")
    .select(selectFields)
    .eq("status", "A")
    .in("normalized_city", cities)
    .gte("created_at", `${periodStart}T00:00:00.000Z`)
    .order("created_at", { ascending: false })
    .limit(config.max_listings);

  if (createdError) throw createdError;

  return createdRows || [];
}

async function loadMarketMetrics(
  supabase: SupabaseClient,
  config: DigestConfig
) {
  const marketName =
    String(config.market_name || "").trim() ||
    titleCase(config.city_slug);

  const { data, error } = await supabase
    .from("market_metrics_public")
    .select("*")
    .eq("market_name", marketName)
    .order("snapshot_date", { ascending: false })
    .limit(2);

  if (error) {
    console.warn("Digest market metrics query failed:", error.message);
    return [];
  }

  return data || [];
}

type DigestGenerationEnvironment = {
  REPLIERS_API_KEY?: string;
  REPLIERS_BASE_URL?: string;
};

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

function digestCities(config: DigestConfig) {
  return (
    Array.isArray(config.market_cities) &&
    config.market_cities.length
      ? config.market_cities
      : [config.city_slug]
  )
    .map((city) =>
      String(city).trim().toLowerCase()
    )
    .filter(Boolean);
}

async function loadCurrentActiveCount(
  supabase: SupabaseClient,
  config: DigestConfig
) {
  const { count, error } = await supabase
    .from("listing_rows")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("status", "A")
    .in(
      "normalized_city",
      digestCities(config)
    );

  if (error) {
    console.warn(
      "Could not count active digest listings:",
      error.message
    );

    return null;
  }

  return Number(count || 0);
}

async function loadWeeklyNewListingCount(
  supabase: SupabaseClient,
  config: DigestConfig,
  periodStart: string
) {
  const cities = digestCities(config);

  const { count, error } = await supabase
    .from("listing_rows")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("status", "A")
    .in("normalized_city", cities)
    .gte(
      "listed_at",
      `${periodStart}T00:00:00.000Z`
    );

  if (!error) {
    return Number(count || 0);
  }

  const {
    count: createdCount,
    error: createdError,
  } = await supabase
    .from("listing_rows")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("status", "A")
    .in("normalized_city", cities)
    .gte(
      "created_at",
      `${periodStart}T00:00:00.000Z`
    );

  if (createdError) {
    console.warn(
      "Could not count weekly digest listings:",
      createdError.message
    );

    return null;
  }

  return Number(createdCount || 0);
}

async function loadMonthlyTrend(
  supabase: SupabaseClient,
  config: DigestConfig
) {
  const { data, error } = await supabase
    .from("market_monthly_stats")
    .select(`
      month_start,
      new_listings,
      sales,
      median_sold_price,
      median_days_on_market,
      average_sale_to_list_ratio
    `)
    .eq(
      "city",
      String(config.city_slug)
        .trim()
        .toLowerCase()
    )
    .order("month_start", {
      ascending: false,
    })
    .limit(12);

  if (error) {
    console.warn(
      "Could not load digest monthly trend:",
      error.message
    );

    return [];
  }

  return [...(data || [])].reverse();
}

async function loadWeeklySales(
  config: DigestConfig,
  periodStart: string,
  periodEnd: string,
  env: DigestGenerationEnvironment
) {
  const apiKey =
    String(env.REPLIERS_API_KEY || "").trim();

  if (!apiKey) {
    return {
      count: null,
      medianSoldPrice: null,
      medianDaysOnMarket: null,
      averageSaleToListRatio: null,
      periodStart: null,
      periodEnd: null,
      reportingDelayed: false,
    };
  }

  const baseUrl =
    String(
      env.REPLIERS_BASE_URL ||
      "https://api.repliers.io"
    )
      .replace(/\/$/, "")
      .replace(/\/listings$/, "");

  const requestedEnd =
    new Date(`${periodEnd}T00:00:00.000Z`);

  const lookbackStart =
    new Date(requestedEnd);

  // Fetch enough history for current, previous and year-ago rolling windows.
  lookbackStart.setUTCDate(
    lookbackStart.getUTCDate() - 459
  );

  const lookbackStartDate =
    lookbackStart
      .toISOString()
      .slice(0, 10);

  const allSales: any[] = [];

  for (const city of digestCities(config)) {
    const apiCity = titleCase(city);
    let page = 1;
    let pages = 1;

    do {
      const params = new URLSearchParams();

      params.set("city", apiCity);
      params.set("type", "sale");
      params.append("class", "Residential");
      params.append("class", "Condo");
      params.set("status", "U");
      params.set("lastStatus", "Sld");
      params.set(
        "minSoldDate",
        lookbackStartDate
      );
      params.set("maxSoldDate", periodEnd);
      params.set("resultsPerPage", "100");
      params.set("pageNum", String(page));
      params.set(
        "fields",
        [
          "mlsNumber",
          "listDate",
          "soldDate",
          "soldPrice",
          "listPrice",
          "class",
          "details.style",
        ].join(",")
      );

      const response = await fetch(
        `${baseUrl}/listings?${params.toString()}`,
        {
          headers: {
            "REPLIERS-API-KEY": apiKey,
          },
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          `Repliers weekly sales request failed: ${response.status}`
        );
      }

      allSales.push(...(body.listings || []));

      pages = Math.max(
        1,
        Number(body.numPages || 1)
      );

      page += 1;
    } while (page <= pages);
  }

  const uniqueSales = Array.from(
    new Map(
      allSales.map((listing) => [
        String(
          listing.mlsNumber ||
          `${listing.soldDate}-${listing.soldPrice}-${listing.listPrice}`
        ),
        listing,
      ])
    ).values()
  );

  const soldTimestamps = uniqueSales
    .map((listing: any) =>
      Date.parse(String(listing.soldDate || ""))
    )
    .filter((value) =>
      Number.isFinite(value)
    );

  if (!soldTimestamps.length) {
    return {
      count: 0,
      medianSoldPrice: null,
      medianDaysOnMarket: null,
      averageSaleToListRatio: null,
      periodStart: null,
      periodEnd: null,
      reportingDelayed: true,
    };
  }

  const latestSoldTimestamp =
    Math.max(...soldTimestamps);

  const salesPeriodEnd =
    new Date(latestSoldTimestamp);

  const salesPeriodStart =
    new Date(latestSoldTimestamp);

  salesPeriodStart.setUTCDate(
    salesPeriodStart.getUTCDate() - 6
  );

  const salesPeriodStartText =
    salesPeriodStart
      .toISOString()
      .slice(0, 10);

  const salesPeriodEndText =
    salesPeriodEnd
      .toISOString()
      .slice(0, 10);

  const salesBetween = (
    start: Date,
    end: Date
  ) => uniqueSales.filter((listing: any) => {
    const soldAt = Date.parse(
      String(listing.soldDate || "")
    );

    return (
      Number.isFinite(soldAt) &&
      soldAt >= start.getTime() &&
      soldAt <= end.getTime()
    );
  });

  const shiftDays = (date: Date, days: number) => {
    const shifted = new Date(date);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted;
  };

  const shiftYears = (date: Date, years: number) => {
    const shifted = new Date(date);
    shifted.setUTCFullYear(
      shifted.getUTCFullYear() + years
    );
    return shifted;
  };

  const summarizeSales = (sales: any[]) => {
    const prices = sales
      .map((listing: any) =>
        Number(listing.soldPrice || 0)
      )
      .filter((value: number) => value > 0);

    const days = sales
      .map((listing: any) => {
        const listedAt = Date.parse(
          String(listing.listDate || "")
        );
        const soldAt = Date.parse(
          String(listing.soldDate || "")
        );

        if (
          !Number.isFinite(listedAt) ||
          !Number.isFinite(soldAt) ||
          soldAt < listedAt
        ) return null;

        return Math.round(
          (soldAt - listedAt) / 86400000
        );
      })
      .filter(
        (value: number | null): value is number =>
          value != null && value >= 0 && value <= 3650
      );

    const ratios = sales
      .map((listing: any) => {
        const soldPrice = Number(
          listing.soldPrice || 0
        );
        const listPrice = Number(
          listing.listPrice || 0
        );

        return soldPrice > 0 && listPrice > 0
          ? (soldPrice / listPrice) * 100
          : 0;
      })
      .filter((value: number) => value > 0);

    const averageRatio = ratios.length
      ? ratios.reduce(
          (total: number, value: number) =>
            total + value,
          0
        ) / ratios.length
      : null;

    return {
      count: sales.length,
      medianSoldPrice: median(prices),
      medianDaysOnMarket: median(days),
      averageSaleToListRatio:
        averageRatio == null
          ? null
          : Number(averageRatio.toFixed(1)),
    };
  };

  const weeklySales = salesBetween(
    salesPeriodStart,
    salesPeriodEnd
  );

  const current30Start = shiftDays(
    salesPeriodEnd,
    -29
  );
  const previous30End = shiftDays(
    current30Start,
    -1
  );
  const previous30Start = shiftDays(
    previous30End,
    -29
  );
  const yearAgo30End = shiftYears(
    salesPeriodEnd,
    -1
  );
  const yearAgo30Start = shiftDays(
    yearAgo30End,
    -29
  );

  const current90Start = shiftDays(
    salesPeriodEnd,
    -89
  );
  const previous90End = shiftDays(
    current90Start,
    -1
  );
  const previous90Start = shiftDays(
    previous90End,
    -89
  );
  const yearAgo90End = shiftYears(
    salesPeriodEnd,
    -1
  );
  const yearAgo90Start = shiftDays(
    yearAgo90End,
    -89
  );

  const weeklySummary = summarizeSales(weeklySales);
  const current30 = summarizeSales(
    salesBetween(current30Start, salesPeriodEnd)
  );
  const previous30 = summarizeSales(
    salesBetween(previous30Start, previous30End)
  );
  const yearAgo30 = summarizeSales(
    salesBetween(yearAgo30Start, yearAgo30End)
  );
  const current90 = summarizeSales(
    salesBetween(current90Start, salesPeriodEnd)
  );
  const previous90 = summarizeSales(
    salesBetween(previous90Start, previous90End)
  );
  const yearAgo90 = summarizeSales(
    salesBetween(yearAgo90Start, yearAgo90End)
  );

  const priceTrend = Array.from(
    {
      length: 6,
    },
    (_, index) => {
      const daysBack =
        (5 - index) * 30;

      const trendEnd =
        shiftDays(
          salesPeriodEnd,
          -daysBack
        );

      const trendStart =
        shiftDays(
          trendEnd,
          -89
        );

      return {
        periodEnd:
          trendEnd
            .toISOString()
            .slice(0, 10),
        ...summarizeSales(
          salesBetween(
            trendStart,
            trendEnd
          )
        ),
      };
    }
  );

  return {
    ...weeklySummary,
    periodStart: salesPeriodStartText,
    periodEnd: salesPeriodEndText,
    reportingDelayed:
      salesPeriodEndText !== periodEnd,
    rolling: {
      latestReportedDate: salesPeriodEndText,
      current30,
      previous30,
      yearAgo30,
      current90,
      previous90,
      yearAgo90,
      priceTrend,
      current30Start: current30Start
        .toISOString().slice(0, 10),
      current30End: salesPeriodEndText,
      current90Start: current90Start
        .toISOString().slice(0, 10),
      current90End: salesPeriodEndText,
    },
  };
}
function buildMarketCommentary({
  market,
  weeklyNewListings,
  weeklySales,
  activeCount,
  monthlyTrend,
}: {
  market: string;
  weeklyNewListings: number | null;
  weeklySales: {
    count: number | null;
    medianSoldPrice: number | null;
    medianDaysOnMarket: number | null;
    averageSaleToListRatio: number | null;
  };
  activeCount: number | null;
  monthlyTrend: any[];
}) {
  const sentences: string[] = [];

  if (
    weeklyNewListings != null &&
    weeklySales.count != null
  ) {
    const salesPeriod =
      weeklySales.periodStart &&
      weeklySales.periodEnd
        ? ` from ${weeklySales.periodStart} through ${weeklySales.periodEnd}`
        : "";

    sentences.push(
      `${market} added ${weeklyNewListings} new active listings during the current seven-day period. The latest available seven-day sales period recorded ${weeklySales.count} reported sales${salesPeriod}.`
    );
  } else if (weeklyNewListings != null) {
    sentences.push(
      `${market} added ${weeklyNewListings} new active listings during this seven-day period.`
    );
  }

  if (activeCount != null) {
    sentences.push(
      `There are currently ${activeCount} active listings across the selected market area.`
    );
  }

  if (weeklySales.medianSoldPrice != null) {
    sentences.push(
      `The median reported sale price for the week was ${money(
        weeklySales.medianSoldPrice
      )}.`
    );
  }

  if (weeklySales.medianDaysOnMarket != null) {
    sentences.push(
      `Homes reported sold this week spent a median of ${Math.round(
        weeklySales.medianDaysOnMarket
      )} days on market.`
    );
  }

  if (
    monthlyTrend.length >= 2
  ) {
    const latest =
      monthlyTrend[monthlyTrend.length - 1];

    const previous =
      monthlyTrend[monthlyTrend.length - 2];

    const latestSales =
      Number(latest?.sales || 0);

    const previousSales =
      Number(previous?.sales || 0);

    if (
      latestSales > 0 &&
      previousSales > 0
    ) {
      const direction =
        latestSales > previousSales
          ? "higher"
          : latestSales < previousSales
            ? "lower"
            : "unchanged";

      sentences.push(
        `The latest complete month recorded ${latestSales} sales, ${direction} than the previous month's ${previousSales}.`
      );
    }
  }

  return sentences.join(" ");
}
export async function generateDigestRun(
  supabase: SupabaseClient,
  configId: string,
  referenceDate = new Date(),
  env: DigestGenerationEnvironment = {}
) {
  const { data: configRow, error: configError } = await supabase
    .from("digest_configs")
    .select("*, site:sites(*)")
    .eq("id", configId)
    .single();

  if (configError || !configRow) {
    throw new Error(
      configError?.message || "Digest configuration not found."
    );
  }

  const config = configRow as DigestConfig;
  const { periodStart, periodEnd } =
    getWeeklyPeriod(referenceDate);

  const { data: existingRuns, error: existingRunError } =
    await supabase
      .from("digest_runs")
      .select("*")
      .eq("config_id", config.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .neq("status", "sent")
      .order("generated_at", {
        ascending: false,
      })
      .limit(1);

  if (existingRunError) {
    throw existingRunError;
  }

  const existingRun =
    existingRuns?.[0] || null;

  const [
    listings,
    metrics,
    agent,
    weeklyNewListings,
    weeklySales,
    activeCount,
    monthlyTrend,
  ] = await Promise.all([
    loadNewListings(
      supabase,
      config,
      periodStart
    ),
    loadMarketMetrics(
      supabase,
      config
    ),
    loadAgent(
      supabase,
      config.site
    ),
    loadWeeklyNewListingCount(
      supabase,
      config,
      periodStart
    ),
    loadWeeklySales(
      config,
      periodStart,
      periodEnd,
      env
    ),
    loadCurrentActiveCount(
      supabase,
      config
    ),
    loadMonthlyTrend(
      supabase,
      config
    ),
  ]);

  const market =
    String(config.market_name || "").trim() ||
    titleCase(config.city_slug);

  const subject = replaceSubjectTokens(
    config.subject_template ||
      "{{market}} weekly real estate update",
    {
      market,
      start: periodStart,
      end: periodEnd,
      newListings: listings.length,
    }
  );

  const commentary = buildMarketCommentary({
    market,
    weeklyNewListings,
    weeklySales,
    activeCount,
    monthlyTrend,
  });

  const payload = {
    market,
    citySlug: config.city_slug,
    periodStart,
    periodEnd,
    listings,
    weeklyNewListings,
    weeklySales,
    activeCount,
    monthlyTrend,
    commentary,
    currentMetrics: metrics[0] || null,
    previousMetrics: metrics[1] || null,
    site: config.site || null,
    agent,
    generatedAt: new Date().toISOString(),
  };

  const previewHtml = renderDigestHtml({
    subject,
    introText: config.intro_text || "",
    payload,
  });

  const initialStatus =
    config.send_mode === "manual"
      ? "draft"
      : "ready";

  const runValues = {
    config_id: config.id,
    site_id: config.site_id,
    period_start: periodStart,
    period_end: periodEnd,
    status: initialStatus,
    subject,
    intro_text: config.intro_text || null,
    payload,
    preview_html: previewHtml,
    generated_at: new Date().toISOString(),
    error_message: null,
    updated_at: new Date().toISOString(),
  };

  const saveRunQuery = existingRun
    ? supabase
        .from("digest_runs")
        .update(runValues)
        .eq("id", existingRun.id)
    : supabase
        .from("digest_runs")
        .insert(runValues);

  const { data: run, error: runError } =
    await saveRunQuery
      .select("*")
      .single();

  if (runError) throw runError;

  const { error: configUpdateError } = await supabase
    .from("digest_configs")
    .update({
      last_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", config.id);

  if (configUpdateError) {
    console.warn(
      "Could not update digest generation timestamp:",
      configUpdateError.message
    );
  }

  return run;
}

export function renderDigestHtml({
  subject,
  introText,
  payload,
  subscriber,
  publicSiteUrl,
}: {
  subject: string;
  introText?: string | null;
  payload: Record<string, any>;
  subscriber?: DigestSubscriber | null;
  publicSiteUrl?: string;
}) {
  const market = String(payload.market || "Local market");
  const listings = Array.isArray(payload.listings)
    ? payload.listings
    : [];

  const current = payload.currentMetrics || {};
  const previous = payload.previousMetrics || {};

  const baseUrl = siteBaseUrl(payload.site, publicSiteUrl);
  const citySlug = String(payload.citySlug || "").trim();

  const agentName =
    String(
      payload.agent?.name ||
      payload.site?.agent_name ||
      payload.site?.site_name ||
      "Your local real estate advisor"
    ).trim();

  const brokerage =
    String(
      payload.agent?.brokerage ||
      payload.site?.brokerage ||
      ""
    ).trim();

  const metricChange = (
    currentValue: unknown,
    previousValue: unknown
  ) => {
    const currentNumber = Number(currentValue);
    const previousNumber = Number(previousValue);

    if (
      !Number.isFinite(currentNumber) ||
      !Number.isFinite(previousNumber)
    ) {
      return "";
    }

    const difference = currentNumber - previousNumber;

    if (!difference) return "No change";
    return difference > 0
      ? `Up ${difference}`
      : `Down ${Math.abs(difference)}`;
  };

  const weeklyNewListings =
    payload.weeklyNewListings == null
      ? listings.length
      : Number(payload.weeklyNewListings);

  const weeklySales =
    payload.weeklySales || {};

  const activeCount =
    payload.activeCount == null
      ? current.active
      : Number(payload.activeCount);

  const commentary =
    String(payload.commentary || "").trim();

  const monthlyTrend =
    Array.isArray(payload.monthlyTrend)
      ? payload.monthlyTrend
      : [];

  const rolling = weeklySales.rolling || null;

  const changePercent = (
    currentValue: unknown,
    comparisonValue: unknown
  ) => {
    const currentNumber = Number(currentValue);
    const comparisonNumber = Number(comparisonValue);

    if (
      !Number.isFinite(currentNumber) ||
      !Number.isFinite(comparisonNumber) ||
      comparisonNumber === 0
    ) return null;

    return (
      ((currentNumber - comparisonNumber) /
        comparisonNumber) * 100
    );
  };

  const changeLabel = (
    value: number | null,
    comparison: string
  ) => {
    if (value == null) return `No ${comparison} comparison`;
    if (Math.abs(value) < 0.1) return `Unchanged ${comparison}`;

    return `${value > 0 ? "Up" : "Down"} ${Math.abs(value).toFixed(
      1
    )}% ${comparison}`;
  };

  const salesPreviousChange = rolling
    ? changePercent(
        rolling.current30?.count,
        rolling.previous30?.count
      )
    : null;

  const salesYearChange = rolling
    ? changePercent(
        rolling.current30?.count,
        rolling.yearAgo30?.count
      )
    : null;

  const pricePreviousChange = rolling
    ? changePercent(
        rolling.current90?.medianSoldPrice,
        rolling.previous90?.medianSoldPrice
      )
    : null;

  const priceYearChange = rolling
    ? changePercent(
        rolling.current90?.medianSoldPrice,
        rolling.yearAgo90?.medianSoldPrice
      )
    : null;

  const buyerNarrative: string[] = [];
  const sellerNarrative: string[] = [];

  if (salesPreviousChange != null) {
    if (salesPreviousChange <= -10) {
      buyerNarrative.push(
        "Sales activity has slowed, reducing some of the urgency buyers may have felt in the previous period."
      );
      sellerNarrative.push(
        "Fewer completed sales mean sellers should expect buyers to be more selective."
      );
    } else if (salesPreviousChange >= 10) {
      buyerNarrative.push(
        "Sales activity has strengthened, which can increase competition for well-priced homes."
      );
      sellerNarrative.push(
        "Improving sales activity is supportive, particularly for homes positioned close to recent comparable sales."
      );
    } else {
      buyerNarrative.push(
        "Sales activity is broadly steady compared with the preceding 30 days."
      );
      sellerNarrative.push(
        "The pace of sales is broadly stable, so pricing remains the main differentiator."
      );
    }
  }

  if (priceYearChange != null) {
    if (priceYearChange <= -3) {
      buyerNarrative.push(
        "The 90-day median price is below the comparable period last year."
      );
      sellerNarrative.push(
        "The year-over-year price comparison favours realistic, evidence-based pricing."
      );
    } else if (priceYearChange >= 3) {
      buyerNarrative.push(
        "The 90-day median remains above the comparable period last year."
      );
      sellerNarrative.push(
        "The year-over-year price trend remains supportive for sellers."
      );
    } else {
      buyerNarrative.push(
        "The 90-day median price is close to the same period last year."
      );
      sellerNarrative.push(
        "Prices are broadly stable year over year rather than moving sharply in either direction."
      );
    }
  }

  const rollingSampleReliable =
    Number(rolling?.current90?.count || 0) >= 20;

  if (rolling && !rollingSampleReliable) {
    buyerNarrative.length = 0;
    sellerNarrative.length = 0;
    buyerNarrative.push(
      "The available sales sample is small, so current pricing signals should be treated cautiously."
    );
    sellerNarrative.push(
      "With a limited sample, property-specific comparable sales are more useful than the market-wide median."
    );
  }

  const rollingPriceTrend =
    Array.isArray(rolling?.priceTrend)
      ? rolling.priceTrend.filter(
          (row: any) => {
            return (
              Number(
                row?.medianSoldPrice || 0
              ) > 0
            );
          }
        )
      : [];

  const rollingPriceValues =
    rollingPriceTrend.map(
      (row: any) => {
        return Number(
          row.medianSoldPrice || 0
        );
      }
    );

  const rollingPriceMinimum =
    rollingPriceValues.length > 0
      ? Math.min(...rollingPriceValues)
      : 0;

  const rollingPriceMaximum =
    rollingPriceValues.length > 0
      ? Math.max(...rollingPriceValues)
      : 0;

  const rollingPriceRange =
    Math.max(
      1,
      rollingPriceMaximum -
        rollingPriceMinimum
    );

  const rollingPriceColumns =
    rollingPriceTrend
      .map((row: any) => {
        const price =
          Number(
            row.medianSoldPrice || 0
          );

        const barHeight =
          34 +
          Math.round(
            (
              (
                price -
                rollingPriceMinimum
              ) /
              rollingPriceRange
            ) *
            48
          );

        const spacerHeight =
          88 - barHeight;

        const month =
          row.periodEnd
            ? new Date(
                `${row.periodEnd}T00:00:00.000Z`
              ).toLocaleDateString(
                "en-CA",
                {
                  month: "short",
                  timeZone: "UTC",
                }
              )
            : "";

        return `
          <td style="
            width:${Math.floor(
              100 /
              Math.max(
                1,
                rollingPriceTrend.length
              )
            )}%;
            padding:0 3px;
            text-align:center;
            vertical-align:bottom;
          ">
            <div style="
              height:88px;
              vertical-align:bottom;
            ">
              <div style="
                height:${spacerHeight}px;
                line-height:${spacerHeight}px;
              ">&nbsp;</div>

              <div style="
                height:${barHeight}px;
                border-radius:5px 5px 2px 2px;
                background:#2f777b;
              "></div>
            </div>

            <div style="
              margin-top:7px;
              color:#706b64;
              font-size:10px;
            ">
              ${escapeHtml(month)}
            </div>

            <div style="
              margin-top:2px;
              color:#181614;
              font-size:10px;
              font-weight:700;
              white-space:nowrap;
            ">
              ${escapeHtml(money(price))}
            </div>

            <div style="
              margin-top:1px;
              color:#706b64;
              font-size:9px;
              white-space:nowrap;
            ">
              ${escapeHtml(
                row.count ?? 0
              )} sales
            </div>
          </td>
        `;
      })
      .join("");

  const priceTrendHtml =
    rollingPriceColumns
      ? `
        <div style="
          margin:20px 0 19px;
          padding-top:17px;
          border-top:1px solid #e3ded5;
        ">
          <div style="
            margin-bottom:3px;
            color:#181614;
            font-size:12px;
            font-weight:700;
          ">
            Rolling 90-day median sold price
          </div>

          <div style="
            margin-bottom:13px;
            color:#706b64;
            font-size:10px;
            line-height:1.45;
          ">
            Each point uses the 90 days ending
            in the month shown. All residential
            property types.
          </div>

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              width:100%;
              table-layout:fixed;
              border-collapse:collapse;
            "
          >
            <tr>
              ${rollingPriceColumns}
            </tr>
          </table>
        </div>
      `
      : "";

  const marketDirectionHtml = rolling
    ? `
      <div style="margin:27px 0 28px;padding:20px;border:1px solid #ddd8cf;border-radius:14px;background:#ffffff;">
        <div style="color:#181614;font-size:19px;font-weight:800;">
          ${escapeHtml(market)} market pulse
        </div>
        <div style="margin:4px 0 17px;color:#706b64;font-size:12px;line-height:1.5;">
          Reporting through ${escapeHtml(rolling.latestReportedDate)}.
          Rolling periods end on the latest available sold date.
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:6px 0;margin:0 -6px 18px;">
          <tr>
            <td style="width:33.33%;padding:12px 10px;border-radius:9px;background:#f7f5f1;vertical-align:top;">
              <div style="color:#706b64;font-size:10px;">30-day sales</div>
              <div style="margin-top:3px;color:#181614;font-size:20px;font-weight:800;">${escapeHtml(rolling.current30?.count ?? "")}</div>
              <div style="margin-top:3px;color:#9a5b2b;font-size:10px;">${escapeHtml(changeLabel(salesPreviousChange, "vs previous 30 days"))}</div>
              <div style="margin-top:2px;color:#706b64;font-size:10px;">${escapeHtml(changeLabel(salesYearChange, "vs last year"))}</div>
            </td>
            <td style="width:33.33%;padding:12px 10px;border-radius:9px;background:#f7f5f1;vertical-align:top;">
              <div style="color:#706b64;font-size:10px;">90-day median price</div>
              <div style="margin-top:3px;color:#181614;font-size:20px;font-weight:800;">${rolling.current90?.medianSoldPrice ? escapeHtml(money(rolling.current90.medianSoldPrice)) : "&mdash;"}</div>
              <div style="margin-top:3px;color:#9a5b2b;font-size:10px;">${escapeHtml(changeLabel(pricePreviousChange, "vs previous 90 days"))}</div>
              <div style="margin-top:2px;color:#706b64;font-size:10px;">${escapeHtml(changeLabel(priceYearChange, "vs last year"))}</div>
            </td>
            <td style="width:33.33%;padding:12px 10px;border-radius:9px;background:#f7f5f1;vertical-align:top;">
              <div style="color:#706b64;font-size:10px;">90-day sample</div>
              <div style="margin-top:3px;color:#181614;font-size:20px;font-weight:800;">${escapeHtml(rolling.current90?.count ?? "")}</div>
              <div style="margin-top:3px;color:#706b64;font-size:10px;">reported sales</div>
              <div style="margin-top:2px;color:#706b64;font-size:10px;">${rollingSampleReliable ? "Useful market signal" : "Small sample  use caution"}</div>
            </td>
          </tr>
        </table>

        ${priceTrendHtml}

        <div style="padding:13px 15px;border-left:3px solid #2f777b;background:#f7f5f1;color:#34312d;font-size:13px;line-height:1.55;">
          <strong style="display:block;margin-bottom:3px;color:#2f777b;font-size:10px;letter-spacing:.08em;text-transform:uppercase;">For buyers</strong>
          ${escapeHtml(buyerNarrative.join(" "))}
          <strong style="display:block;margin:11px 0 3px;color:#2f777b;font-size:10px;letter-spacing:.08em;text-transform:uppercase;">For sellers</strong>
          ${escapeHtml(sellerNarrative.join(" "))}
        </div>
      </div>
    `
    : "";
  const listingCards = listings
    .map((listing: any) => {
      const mlsNumber =
        String(listing.mls_number || "").trim();

      const listingUrl =
        baseUrl && citySlug && mlsNumber
          ? `${baseUrl}/${citySlug}?listing_id=${encodeURIComponent(
              mlsNumber
            )}`
          : baseUrl || "#";

      const imageUrl = normalizeImageUrl(listing.image_url);

      return `
        <div style="
          margin:0 0 18px;
          overflow:hidden;
          border:1px solid #ddd8cf;
          border-radius:14px;
          background:#ffffff;
        ">
          ${
            imageUrl
              ? `
                <a href="${escapeHtml(listingUrl)}"
                   style="display:block;text-decoration:none;">
                  <img
                    src="${escapeHtml(imageUrl)}"
                    alt="${escapeHtml(listing.address || "New listing")}"
                    width="620"
                    style="
                      display:block;
                      width:100%;
                      height:auto;
                      max-height:340px;
                      object-fit:cover;
                      border:0;
                    "
                  />
                </a>
              `
              : ""
          }

          <div style="padding:17px 18px 19px;">
            <strong style="
              display:block;
              color:#181614;
              font-size:20px;
              line-height:1.2;
            ">
              ${escapeHtml(money(listing.price))}
            </strong>

            <div style="
              margin-top:5px;
              color:#181614;
              font-size:15px;
              font-weight:700;
            ">
              ${escapeHtml(listing.address || "Address available")}
            </div>

            <div style="
              margin-top:5px;
              color:#706b64;
              font-size:13px;
            ">
              ${escapeHtml(listing.beds ?? "-")} beds
              &nbsp;&middot;&nbsp;
              ${escapeHtml(listing.baths ?? "-")} baths
              ${
                listing.normalized_type
                  ? `&nbsp;&middot;&nbsp;${escapeHtml(
                      titleCase(listing.normalized_type)
                    )}`
                  : ""
              }
            </div>

            ${
              listingUrl !== "#"
                ? `
                  <a
                    href="${escapeHtml(listingUrl)}"
                    style="
                      display:inline-block;
                      margin-top:14px;
                      padding:10px 15px;
                      border-radius:7px;
                      background:#2f6f73;
                      color:#ffffff;
                      font-size:13px;
                      font-weight:700;
                      text-decoration:none;
                    "
                  >
                    View listing
                  </a>
                `
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");

  const unsubscribeUrl =
    subscriber?.unsubscribe_token && publicSiteUrl
      ? `${String(publicSiteUrl).replace(
          /\/$/,
          ""
        )}/api/digests/unsubscribe?token=${encodeURIComponent(
          subscriber.unsubscribe_token
        )}`
      : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <title>${escapeHtml(subject)}</title>
      </head>

      <body style="
        margin:0;
        padding:0;
        background:#f4f1eb;
        color:#181614;
      ">
        <div style="
          display:none;
          max-height:0;
          overflow:hidden;
          opacity:0;
        ">
          ${escapeHtml(
            `${weeklyNewListings} new ${market} listings and the latest market activity.`
          )}
        </div>

        <div style="
          max-width:620px;
          margin:0 auto;
          padding:30px 18px 44px;
          font-family:Arial,Helvetica,sans-serif;
          line-height:1.55;
        ">
          <div style="
            padding:26px 24px;
            border-radius:18px;
            background:#181614;
            color:#ffffff;
          ">
            <div style="
              color:#9dc1bf;
              font-size:12px;
              font-weight:800;
              letter-spacing:.12em;
              text-transform:uppercase;
            ">
              Weekly market digest
            </div>

            <h1 style="
              margin:8px 0 8px;
              font-size:30px;
              line-height:1.12;
            ">
              ${escapeHtml(market)}
            </h1>

            <div style="color:#cbc7c0;font-size:14px;">
              ${escapeHtml(payload.periodStart)}
              through
              ${escapeHtml(payload.periodEnd)}
            </div>
          </div>

          ${
            introText
              ? `
                <div style="
                  padding:22px 5px 4px;
                  font-size:16px;
                ">
                  ${escapeHtml(introText).replace(/\n/g, "<br />")}
                </div>
              `
              : ""
          }

          ${
            commentary
              ? `
                <div style="
                  margin:22px 0 0;
                  padding:20px 21px;
                  border-left:4px solid #2f6f73;
                  border-radius:0 12px 12px 0;
                  background:#ffffff;
                  color:#282522;
                  font-size:15px;
                  line-height:1.7;
                ">
                  <div style="
                    margin-bottom:7px;
                    color:#2f6f73;
                    font-size:11px;
                    font-weight:800;
                    letter-spacing:.11em;
                    text-transform:uppercase;
                  ">
                    What changed
                  </div>

                  ${escapeHtml(commentary)}
                </div>
              `
              : ""
          }
          <div style="
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:10px;
            margin:22px 0;
          ">
            <div style="
              padding:16px 10px;
              border:1px solid #ddd8cf;
              border-radius:12px;
              background:#ffffff;
              text-align:center;
            ">
              <strong style="display:block;font-size:25px;">
                ${escapeHtml(activeCount ?? "\u2014")}
              </strong>
              <span style="color:#706b64;font-size:12px;">
                Active
              </span>
            </div>

            <div style="
              padding:16px 10px;
              border:1px solid #ddd8cf;
              border-radius:12px;
              background:#ffffff;
              text-align:center;
            ">
              <strong style="display:block;font-size:25px;">
                ${escapeHtml(weeklySales.count ?? "\u2014")}
              </strong>
              <span style="color:#706b64;font-size:12px;">
                Reported sales
                ${
                  weeklySales.periodStart &&
                  weeklySales.periodEnd
                    ? `<br /><span style="font-size:10px;">${escapeHtml(
                        weeklySales.periodStart
                      )} to ${escapeHtml(
                        weeklySales.periodEnd
                      )}</span>`
                    : ""
                }
              </span>
            </div>

            <div style="
              padding:16px 10px;
              border:1px solid #ddd8cf;
              border-radius:12px;
              background:#ffffff;
              text-align:center;
            ">
              <strong style="display:block;font-size:25px;">
                ${weeklyNewListings}
              </strong>
              <span style="color:#706b64;font-size:12px;">
                New listings
              </span>
            </div>
          </div>

          ${marketDirectionHtml}

          <h2 style="
            margin:28px 0 14px;
            font-size:23px;
            line-height:1.2;
          ">
            New listings worth seeing
          </h2>

          ${
            listingCards ||
            `
              <div style="
                padding:20px;
                border:1px solid #ddd8cf;
                border-radius:14px;
                background:#ffffff;
                color:#706b64;
              ">
                No new listings matched this market during the
                current digest period.
              </div>
            `
          }

          ${
            baseUrl
              ? `
                <div style="margin:26px 0;text-align:center;">
                  <a
                    href="${escapeHtml(
                      `${baseUrl}/${citySlug}`
                    )}"
                    style="
                      display:inline-block;
                      padding:13px 20px;
                      border-radius:8px;
                      background:#181614;
                      color:#ffffff;
                      font-weight:700;
                      text-decoration:none;
                    "
                  >
                    Explore all ${escapeHtml(market)} listings
                  </a>
                </div>
              `
              : ""
          }

          <div style="
            margin-top:34px;
            padding-top:20px;
            border-top:1px solid #d9d4cb;
            color:#706b64;
            font-size:12px;
          ">
            <strong style="color:#181614;">
              ${escapeHtml(agentName)}
            </strong>

            ${
              brokerage
                ? `<div>${escapeHtml(brokerage)}</div>`
                : ""
            }

            ${
              unsubscribeUrl
                ? `
                  <div style="margin-top:12px;">
                    You are receiving this market update because
                    you subscribed or asked the agent to keep you
                    informed.
                    <a href="${escapeHtml(unsubscribeUrl)}"
                       style="color:#706b64;">
                      Unsubscribe
                    </a>
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendDigestRun(
  supabase: SupabaseClient,
  runId: string,
  env: DigestEnvironment
) {
  if (!env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const { data: run, error: runError } = await supabase
    .from("digest_runs")
    .select(`
      *,
      config:digest_configs(*),
      site:sites(*)
    `)
    .eq("id", runId)
    .single();

  if (runError || !run) {
    throw new Error(runError?.message || "Digest run not found.");
  }

  if (run.status === "sent") {
    return {
      runId,
      sent: 0,
      failed: 0,
      skipped: true,
    };
  }

  const { data: subscribers, error: subscriberError } =
    await supabase
      .from("digest_subscribers")
      .select("*")
      .eq("config_id", run.config_id)
      .eq("status", "subscribed")
      .order("created_at", { ascending: true });

  if (subscriberError) throw subscriberError;

  if (!subscribers?.length) {
    throw new Error("This digest has no subscribed recipients.");
  }

  await supabase
    .from("digest_runs")
    .update({
      status: "sending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  const resend = new Resend(env.RESEND_API_KEY);

  const agent = await loadAgent(supabase, run.site);

  const senderName =
    String(
      agent?.name ||
      run.site?.site_name ||
      "Locus"
    ).trim();

  const fromEmail =
    String(
      env.DIGEST_FROM_EMAIL ||
      "onboarding@resend.dev"
    ).trim();

  const payload = {
    ...(run.payload || {}),
    site: run.site || run.payload?.site || null,
    agent: agent || run.payload?.agent || null,
  };

  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers as DigestSubscriber[]) {
    const html = renderDigestHtml({
      subject: run.subject,
      introText: run.intro_text,
      payload,
      subscriber,
      publicSiteUrl: env.PUBLIC_SITE_URL,
    });

    const { data: delivery } = await supabase
      .from("digest_deliveries")
      .upsert(
        {
          run_id: run.id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          status: "pending",
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "run_id,email",
        }
      )
      .select("id")
      .single();

    try {
      const result = await resend.emails.send({
        from: `${senderName} <${fromEmail}>`,
        to: [subscriber.email],
        subject: run.subject,
        html,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      sent += 1;

      if (delivery?.id) {
        await supabase
          .from("digest_deliveries")
          .update({
            status: "sent",
            resend_email_id: result.data?.id || null,
            sent_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", delivery.id);
      }
    } catch (error) {
      failed += 1;

      if (delivery?.id) {
        await supabase
          .from("digest_deliveries")
          .update({
            status: "failed",
            error_message:
              error instanceof Error
                ? error.message
                : "Unknown delivery error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", delivery.id);
      }
    }
  }

  const completedAt = new Date().toISOString();
  const finalStatus = sent > 0 ? "sent" : "failed";

  await supabase
    .from("digest_runs")
    .update({
      status: finalStatus,
      sent_at: sent > 0 ? completedAt : null,
      error_message:
        sent > 0
          ? failed > 0
            ? `${failed} recipient delivery failed.`
            : null
          : "No digest emails were delivered.",
      updated_at: completedAt,
    })
    .eq("id", run.id);

  if (sent > 0) {
    await supabase
      .from("digest_configs")
      .update({
        last_sent_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", run.config_id);
  }

  return {
    runId,
    sent,
    failed,
    skipped: false,
  };
}
