/* Shared market-pulse math. Single source of truth for the "Market read" on Market Intel and the homepage. */
const RANK_ALIAS: Record<string, string> = { courtenay: "Comox Valley", comox: "Comox Valley", cumberland: "Comox Valley", "comox-valley": "Comox Valley", parksville: "Parksville / Qualicum", "qualicum-beach": "Parksville / Qualicum", "nanoose-bay": "Parksville / Qualicum", "french-creek": "Parksville / Qualicum", "saanich-east": "Saanich", "saanich-west": "Saanich", "mill-bay": "Malahat / Mill Bay", "shawnigan-lake": "Malahat / Mill Bay", "cobble-hill": "Malahat / Mill Bay", "port-hardy": "North Island", "port-mcneill": "North Island", "salt-spring-island": "Gulf Islands", "gabriola-island": "Gulf Islands" };

export async function getMarketPulse(supabase: any, cityInput: string) {
  const city = String(cityInput || "nanaimo").toLowerCase().trim();
  const cityLabel = city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cityDatabaseKeys = Array.from(new Set([city, city.replace(/-/g, " ")]));
  const saanichDistrict = city === "saanich-east" ? "saanich east" : city === "saanich-west" ? "saanich west" : null;
  const listingCityKeys = saanichDistrict ? ["saanich"] : cityDatabaseKeys;
  const districtMatch: any = saanichDistrict ? { district: saanichDistrict } : {};

  const { data: monthlyRows, error: monthlyError } = await supabase
    .from("market_monthly_stats")
    .select("month_start, new_listings, active_listings, sales, median_sold_price, median_single_family_sold_price, average_sale_to_list_ratio, median_days_on_market")
    .in("city", cityDatabaseKeys)
    .order("month_start", { ascending: false })
    .limit(24);
  if (monthlyError) console.error("Market pulse monthly query failed:", monthlyError);

  const allMonthlyHistory = [...(monthlyRows || [])].reverse().map((row: any) => ({
    month: String(row.month_start),
    label: new Intl.DateTimeFormat("en-CA", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${row.month_start}T00:00:00Z`)),
    newListings: Number(row.new_listings || 0),
    activeListings: Number(row.active_listings || 0),
    sales: Number(row.sales || 0),
    medianSoldPrice: Number(row.median_single_family_sold_price || 0),
    saleToList: ((v: number) => (v > 0 && v <= 2 ? v * 100 : v))(Number(row.average_sale_to_list_ratio || 0)),
    medianDaysOnMarket: Number(row.median_days_on_market || 0),
  }));
  const listingOnlyMarket = ["sparwood", "whistler"].includes(city);
  const monthlyHistory = listingOnlyMarket ? allMonthlyHistory.slice(-12) : allMonthlyHistory;

  const percentChange = (a: number, b: number) => (a > 0 && b > 0 ? ((a - b) / b) * 100 : null);
  const latestMonth: any = monthlyHistory.at(-1);
  const rollingWindowMonths = 3;
  const recentRollingMonths = monthlyHistory.slice(-rollingWindowMonths);
  const priorYearRollingMonths = monthlyHistory.slice(-(rollingWindowMonths + 12), -12);
  const marketPulseAverage = (values: number[]) => {
    const usable = values.filter((v) => Number.isFinite(v) && v > 0);
    return usable.length === rollingWindowMonths ? usable.reduce((t, v) => t + v, 0) / rollingWindowMonths : null;
  };

  const activeListingsRollingAverage = marketPulseAverage(recentRollingMonths.map((r) => r.newListings));
  const salesRollingAverage = marketPulseAverage(recentRollingMonths.map((r) => r.sales));
  const daysOnMarketRollingAverage = marketPulseAverage(recentRollingMonths.map((r) => r.medianDaysOnMarket));
  const saleToListRollingAverage = marketPulseAverage(recentRollingMonths.map((r) => r.saleToList));
  const priorActiveListingsRollingAverage = marketPulseAverage(priorYearRollingMonths.map((r) => r.newListings));
  const priorSalesRollingAverage = marketPulseAverage(priorYearRollingMonths.map((r) => r.sales));
  const priorDaysOnMarketRollingAverage = marketPulseAverage(priorYearRollingMonths.map((r) => r.medianDaysOnMarket));
  const priorSaleToListRollingAverage = marketPulseAverage(priorYearRollingMonths.map((r) => r.saleToList));

  const activeListingsYoY = activeListingsRollingAverage != null && priorActiveListingsRollingAverage != null ? percentChange(activeListingsRollingAverage, priorActiveListingsRollingAverage) : null;
  const salesYoY = salesRollingAverage != null && priorSalesRollingAverage != null ? percentChange(salesRollingAverage, priorSalesRollingAverage) : null;
  const daysOnMarketYoYChange = daysOnMarketRollingAverage != null && priorDaysOnMarketRollingAverage != null ? daysOnMarketRollingAverage - priorDaysOnMarketRollingAverage : null;
  const saleToListYoYChange = saleToListRollingAverage != null && priorSaleToListRollingAverage != null ? saleToListRollingAverage - priorSaleToListRollingAverage : null;

  const daysOnMarketContext = daysOnMarketYoYChange == null ? ""
    : Math.abs(daysOnMarketYoYChange) < 0.5 ? "about the same as the same period last year"
    : `${Math.abs(daysOnMarketYoYChange).toFixed(0)} ${Number(Math.abs(daysOnMarketYoYChange).toFixed(0)) === 1 ? "day" : "days"} ${daysOnMarketYoYChange > 0 ? "slower" : "faster"} than the same period last year`;
  const saleToListContext = saleToListYoYChange == null ? ""
    : Math.abs(saleToListYoYChange) < 0.05 ? "about the same as the same period last year"
    : `${Math.abs(saleToListYoYChange).toFixed(1)} percentage points ${saleToListYoYChange > 0 ? "higher" : "lower"} than the same period last year`;

  const marketPulseReadLegacy = activeListingsYoY != null && salesYoY != null
    ? activeListingsYoY >= 10 && salesYoY <= -10
      ? { headline: "Buyers have more leverage.", detail: "There is more supply to compare and fewer sales closing. Well-priced homes can still move, but sellers need to compete on price, condition, and presentation.", evidence: `${Math.abs(activeListingsYoY).toFixed(0)}% more new listings \u00b7 ${Math.abs(salesYoY).toFixed(0)}% fewer sales` }
      : activeListingsYoY <= -10 && salesYoY >= 10
        ? { headline: "Demand is gaining the upper hand.", detail: "Choice has tightened while sales have strengthened. Buyers may need to move decisively when the right home appears.", evidence: `${Math.abs(activeListingsYoY).toFixed(0)}% fewer new listings \u00b7 ${Math.abs(salesYoY).toFixed(0)}% more sales` }
        : { headline: "The market is finding its balance.", detail: "Supply and sales are moving without one clear advantage for either side. Property-specific pricing still matters most.", evidence: `${activeListingsYoY >= 0 ? "+" : ""}${activeListingsYoY.toFixed(0)}% new listings \u00b7 ${salesYoY >= 0 ? "+" : ""}${salesYoY.toFixed(0)}% sales` }
    : { headline: "The market is taking shape.", detail: "There is not yet enough comparable history for a firm year-over-year call. Use the recent trend as context, not a verdict.", evidence: "Comparable year-over-year data is still building." };

  const activeInventoryAverage = marketPulseAverage(recentRollingMonths.map((r) => r.activeListings));
  const priorActiveInventoryAverage = marketPulseAverage(priorYearRollingMonths.map((r) => r.activeListings));
  const hasInventoryPulse = activeInventoryAverage != null && salesRollingAverage != null;
  const liveActiveCount = await (async () => {
    if (hasInventoryPulse) return null;
    const { count } = await supabase.from("listing_rows").select("id", { count: "exact", head: true }).eq("status", "A").in("normalized_city", listingCityKeys).match(districtMatch).neq("property_type", "Lease");
    return count && count > 0 ? count : null;
  })();
  const ratioInventory = hasInventoryPulse ? (activeInventoryAverage as number) : liveActiveCount;
  const latestSalesCount = Number(latestMonth?.sales || 0);
  const latestIsPrelim = (() => { const m = String(latestMonth?.month || "").slice(0, 10); const d = new Date(); return m === new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10); })();
  const useLatestMonth = latestSalesCount >= 40 && !latestIsPrelim;
  const ratioSales = useLatestMonth ? latestSalesCount : salesRollingAverage;
  const ratioActive = useLatestMonth && hasInventoryPulse && Number(latestMonth?.activeListings || 0) > 0 ? Number(latestMonth.activeListings) : ratioInventory;
  const salesToActive = ratioActive != null && ratioActive > 0 && ratioSales != null && ratioSales > 0 ? (ratioSales / ratioActive) * 100 : null;
  const monthsOfSupply = salesToActive != null ? (ratioActive as number) / (ratioSales as number) : null;
  const priorSalesToActive = priorActiveInventoryAverage != null && priorSalesRollingAverage != null ? (priorSalesRollingAverage / priorActiveInventoryAverage) * 100 : null;
  const inventoryYoY = activeInventoryAverage != null && priorActiveInventoryAverage != null ? percentChange(activeInventoryAverage, priorActiveInventoryAverage) : null;
  const pulseSupply = hasInventoryPulse ? activeInventoryAverage : activeListingsRollingAverage;
  const pulseSupplyYoY = hasInventoryPulse ? inventoryYoY : activeListingsYoY;
  const pulseSupplyLabel = hasInventoryPulse ? "Active listings" : "New listings / month";
  const pulseSupplyNoun = hasInventoryPulse ? "active listings" : "new listings";
  const ratioTrend = salesToActive != null && priorSalesToActive != null ? ` A year ago it was ${priorSalesToActive.toFixed(0)}%.` : "";
  const balancedTilt = salesToActive == null ? null
    : (salesToActive < 14 || (pulseSupplyYoY != null && pulseSupplyYoY >= 10 && salesYoY != null && salesYoY <= -10)) ? "buyers"
    : (salesToActive > 18 || (pulseSupplyYoY != null && pulseSupplyYoY <= -10 && salesYoY != null && salesYoY >= 10)) ? "sellers" : null;
  const inventoryRead = salesToActive == null ? null
    : salesToActive < 12
      ? { headline: "Buyers have more leverage.", detail: `Sales are running at ${salesToActive.toFixed(0)}% of active inventory, below the 12% line that typically marks a buyer\u2019s market. Buyers have time to compare, and sellers need to compete on price and presentation.${ratioTrend}` }
      : salesToActive > 20
        ? { headline: "Sellers have the upper hand.", detail: `Sales are running at ${salesToActive.toFixed(0)}% of active inventory, above the 20% line that typically marks a seller\u2019s market. Well-priced homes are moving; buyers should be ready to act.${ratioTrend}` }
        : { headline: balancedTilt === "buyers" ? "Balanced, but tilting toward buyers." : balancedTilt === "sellers" ? "Balanced, but tilting toward sellers." : "The market is balanced.", detail: `Sales are running at ${salesToActive.toFixed(0)}% of active inventory, inside the 12\u201320% range that typically marks a balanced market. Neither side has a clear edge, so pricing and condition decide outcomes.${ratioTrend}` };
  const marketPulseRead = inventoryRead
    ? { ...inventoryRead, evidence: `${(salesToActive as number).toFixed(0)}% sales-to-active \u00b7 ${monthsOfSupply != null ? monthsOfSupply.toFixed(1) : "\u2014"} months of supply` }
    : marketPulseReadLegacy;

  let islandRank: { rank: number; total: number; deals: number; name: string } | null = null;
  let islandList: any[] = [];
  try {
    const { data: snap } = await supabase.from("market_metrics_public").select("snapshot_date").order("snapshot_date", { ascending: false }).limit(1);
    const sd = snap?.[0]?.snapshot_date;
    if (sd && sd !== "2026-07-01") {
      const { data: mm } = await supabase.from("market_metrics_public").select("market_name, activity_index, sold").eq("snapshot_date", sd).order("activity_index", { ascending: false });
      const list = (mm || []).filter((r: any) => r.activity_index != null);
      const want = String(RANK_ALIAS[city] || cityLabel).toLowerCase();
      const i = list.findIndex((r: any) => String(r.market_name).toLowerCase() === want);
      islandList = list as any[];
      if (i >= 0) islandRank = { rank: i + 1, total: list.length, deals: Number(list[i].sold || 0), name: String(list[i].market_name) };
    }
  } catch {}

  return {
    city, cityLabel, monthlyHistory, marketPulseRead, salesToActive, monthsOfSupply, priorSalesToActive,
    pulseSupply, pulseSupplyYoY, pulseSupplyLabel, pulseSupplyNoun, salesRollingAverage, salesYoY,
    hasInventoryPulse, activeInventoryAverage, liveActiveCount, activeListingsRollingAverage, daysOnMarketRollingAverage,
    daysOnMarketContext, saleToListRollingAverage, saleToListContext, islandRank, islandList,
  };
}