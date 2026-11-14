import { createClient } from "@supabase/supabase-js";

const apiKey = process.env.REPLIERS_API_KEY;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!apiKey || !supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing REPLIERS_API_KEY, PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

const city = String(
  process.argv[2] || "Nanaimo"
).trim();

const monthsToBackfill = Number(
  process.argv[3] || 24
);

let boardFilter = process.env.BOARD_ID || null;
const delay = (milliseconds) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthEnd(monthStart) {
  return new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0
  ));
}

function median(values) {
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

function average(values) {
  const valid = values.filter((value) =>
    Number.isFinite(value) && value > 0
  );

  if (!valid.length) return null;

  return valid.reduce(
    (total, value) => total + value,
    0
  ) / valid.length;
}

function applyCommonFilters(params) {
  params.set("city", city);
  if (boardFilter) params.set("boardId", boardFilter);
  params.set("type", "sale");
  params.append("class", "Residential");
  params.append("class", "Condo");
}

async function requestListings(params) {
  let last;
  for (let a = 0; a < 6; a++) {
    try { return await requestListingsOnce(new URLSearchParams(params)); }
    catch (e) { last = e; const wait = 2000 * (a + 1); console.warn(`  retry ${a + 1} in ${wait / 1000}s: ${String(e.message).slice(0, 120)}`); await delay(wait); }
  }
  throw last;
}

async function requestListingsOnce(params) {
  applyCommonFilters(params);

  const response = await fetch(
    `https://api.repliers.io/listings?${params}`,
    {
      headers: {
        "REPLIERS-API-KEY": apiKey
      }
    }
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `Repliers ${response.status}: ${JSON.stringify(body)}`
    );
  }

  return body;
}

async function getNewListingCount(startDate, endDate) {
  const params = new URLSearchParams();

  params.append("status", "A");
  params.append("status", "U");
  params.set("minListDate", startDate);
  params.set("maxListDate", endDate);
  params.set("resultsPerPage", "1");
  params.set("listings", "false");

  const body = await requestListings(params);

  return Number(body.count || 0);
}

/* extraStats-v1 */
function extraStats(list) {
  const DAY = 86400000;
  const doms = list.map((l) => {
    const d = Number(l.daysOnMarket);
    if (l.daysOnMarket != null && Number.isFinite(d) && d >= 0) return d;
    const a = Date.parse(l.listDate), b = Date.parse(l.soldDate);
    return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / DAY) : NaN;
  }).filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  const n = doms.length;
  const medDom = !n ? null : n % 2 ? doms[(n - 1) / 2] : (doms[n / 2 - 1] + doms[n / 2]) / 2;
  const sfh = list.filter((l) => {
    const t = String(l.details?.style || "");
    return /single|detached|house/i.test(t) && !/semi|duplex|row|town|condo|apartment|mobile|manufactured|strata/i.test(t);
  }).map((l) => Number(l.soldPrice || 0)).filter((p) => p > 0);
  return { medianDaysOnMarket: medDom, medianSfhSoldPrice: median(sfh) };
}

async function getActiveAtEnd(endDate) {
  try {
    const next = new Date(Date.parse(endDate + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
    const a = new URLSearchParams();
    a.set("status", "A"); a.set("maxListDate", endDate); a.set("resultsPerPage", "1"); a.set("listings", "false");
    const u = new URLSearchParams();
    u.set("status", "U"); u.set("maxListDate", endDate); u.set("minUnavailableDate", next); u.set("resultsPerPage", "1"); u.set("listings", "false");
    const ra = await requestListings(a);
    const ru = await requestListings(u);
    return Number(ra.count || 0) + Number(ru.count || 0);
  } catch (e) {
    console.warn("active count failed:", e.message);
    return null;
  }
}

async function getMonthlySales(startDate, endDate) {
  const firstParams = new URLSearchParams();

  firstParams.set("status", "U");
  firstParams.set("lastStatus", "Sld");
  firstParams.set("minSoldDate", startDate);
  firstParams.set("maxSoldDate", endDate);
  firstParams.set("resultsPerPage", "100");
  firstParams.set("pageNum", "1");
  firstParams.set(
    "fields",
    "mlsNumber,soldDate,soldPrice,listPrice,listDate,daysOnMarket,details.propertyType,details.style,class"
  );

  const firstBody = await requestListings(firstParams);
  const allListings = [
    ...(firstBody.listings || [])
  ];

  const numberOfPages = Number(
    firstBody.numPages || 1
  );

  for (
    let pageNumber = 2;
    pageNumber <= numberOfPages;
    pageNumber += 1
  ) {
    await delay(125);

    const pageParams =
      new URLSearchParams(firstParams);

    pageParams.set(
      "pageNum",
      String(pageNumber)
    );

    const pageBody =
      await requestListings(pageParams);

    allListings.push(
      ...(pageBody.listings || [])
    );
  }

  const uniqueSales = Array.from(
    new Map(
      allListings.map((listing) => [
        String(
          listing.mlsNumber ||
          `${listing.soldDate}-${listing.soldPrice}-${listing.listPrice}`
        ),
        listing
      ])
    ).values()
  );

  const soldPrices = uniqueSales
    .map((listing) =>
      Number(listing.soldPrice || 0)
    )
    .filter((price) => price > 0);

  const saleToListRatios = uniqueSales
    .map((listing) => {
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
    sales: uniqueSales.length, ...extraStats(uniqueSales),
    medianSoldPrice: median(soldPrices),
    averageSoldPrice: average(soldPrices),
    averageSaleToListRatio:
      average(saleToListRatios)
  };
}

const now = new Date();

if (!boardFilter) {
  for (const b of ["25", "86"]) {
    boardFilter = b;
    const pp = new URLSearchParams(); pp.set("status", "A"); pp.set("resultsPerPage", "1"); pp.set("listings", "false");
    const jj = await requestListings(pp).catch(() => ({}));
    if (Number(jj.count || 0) > 0) break;
    boardFilter = null;
  }
}
console.log(`Board for ${city}: ${boardFilter || "all"}`);

const lastSettledMonth = new Date(Date.UTC(

  now.getUTCFullYear(),
  now.getUTCMonth() - Number(process.env.SETTLE_LAG ?? 1),
  1
));

const firstMonth = new Date(Date.UTC(
  lastSettledMonth.getUTCFullYear(),
  lastSettledMonth.getUTCMonth() -
    (monthsToBackfill - 1),
  1
));

console.log(
  `Backfilling ${monthsToBackfill} settled months for ${city}.`
);

for (
  let monthOffset = 0;
  monthOffset < monthsToBackfill;
  monthOffset += 1
) {
  const monthStart = new Date(Date.UTC(
    firstMonth.getUTCFullYear(),
    firstMonth.getUTCMonth() + monthOffset,
    1
  ));

  const monthFinish = monthEnd(monthStart);
  const startDate = isoDate(monthStart);
  const endDate = isoDate(monthFinish);

  console.log(`Fetching ${startDate}...`);

  const [newListings, salesData, activeAtEnd] =
    await Promise.all([
      getNewListingCount(startDate, endDate),
      getMonthlySales(startDate, endDate), getActiveAtEnd(endDate)
    ]);

  const row = {
    city: city.toLowerCase(),
    month_start: startDate,
    new_listings: newListings,
    sales: salesData.sales,
    median_sold_price:
      salesData.medianSoldPrice == null
        ? null
        : Math.round(salesData.medianSoldPrice),
    average_sold_price:
      salesData.averageSoldPrice == null
        ? null
        : Math.round(salesData.averageSoldPrice),
    average_sale_to_list_ratio:
      salesData.averageSaleToListRatio == null
        ? null
        : Number(
            salesData.averageSaleToListRatio.toFixed(2)
          ),
    ...(salesData.medianDaysOnMarket != null ? { median_days_on_market: Math.round(salesData.medianDaysOnMarket) } : {}), ...(salesData.medianSfhSoldPrice != null ? { median_single_family_sold_price: Math.round(salesData.medianSfhSoldPrice) } : {}),
    refreshed_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("market_monthly_stats")
    .upsert(row, {
      onConflict: "city,month_start"
    });

  if (error) {
    throw new Error(
      `Supabase upsert failed for ${startDate}: ${error.message}`
    );
  }

  console.log({
    month: startDate.slice(0, 7),
    newListings: row.new_listings,
    sales: row.sales, dom: row.median_days_on_market, sfhMedian: row.median_single_family_sold_price, active: row.active_listings,
    medianSoldPrice: row.median_sold_price,
    saleToList:
      row.average_sale_to_list_ratio
  });

  await delay(150);
}

console.log("Market history backfill complete.");