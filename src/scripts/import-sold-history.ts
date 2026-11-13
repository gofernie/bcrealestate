import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeType, getSqft, getLat, getLng, getDescription } from "./rebuild-listing-rows";

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const keyEntry = Object.entries(process.env).find(([k, v]) => /^REPLIERS\w*KEY$/i.test(k) && v);
if (!keyEntry) throw new Error("No REPLIERS*KEY found in env");
const API_KEY = String(keyEntry[1]);
const BOARD_ID = 25;
const START = process.argv[2] || "2024-09-01";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (v: any) => String(v ?? "").toLowerCase().trim();
const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const day = (v: any) => (v ? String(v).slice(0, 10) : null);
const safe = <T>(fn: () => T): T | null => { try { return fn(); } catch { return null; } };

async function fetchPage(from: string, to: string, page: number) {
  const url = new URL("https://api.repliers.io/listings");
  url.searchParams.set("boardId", String(BOARD_ID));
  url.searchParams.set("status", "U");
  url.searchParams.set("lastStatus", "Sld");
  url.searchParams.set("type", "sale");
  url.searchParams.set("minSoldDate", from);
  url.searchParams.set("maxSoldDate", to);
  url.searchParams.set("resultsPerPage", "100");
  url.searchParams.set("pageNum", String(page));
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { "REPLIERS-API-KEY": API_KEY } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * attempt); continue; }
    throw new Error(`Repliers ${res.status}: ${await res.text()}`);
  }
  throw new Error("Repliers: too many retries");
}

function toRow(l: any) {
  const sold = num(l?.soldPrice);
  const city = clean(l?.address?.city);
  if (!sold || !city || !l?.mlsNumber) return null;
  const type = clean(safe(() => normalizeType(l)) ?? "");
  const sqft = num(safe(() => getSqft(l))) ?? num(l?.details?.sqft);
  const lat = Number(safe(() => getLat(l)) ?? l?.map?.latitude);
  const lng = Number(safe(() => getLng(l)) ?? l?.map?.longitude);
  const desc = String(safe(() => getDescription(l)) ?? l?.details?.description ?? "").slice(0, 400);
  return {
    mls_number: String(l.mlsNumber),
    board_id: BOARD_ID,
    city,
    normalized_type: type || null,
    raw_area: l?.address?.neighborhood ?? null,
    sqft,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    list_price: num(l?.listPrice),
    sold_price: sold,
    sold_date: day(l?.soldDate),
    list_date: day(l?.listDate),
    dom: Number.isFinite(Number(l?.daysOnMarket)) ? Number(l.daysOnMarket) : null,
    description: desc,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const now = new Date();
  const cursor = new Date(START.slice(0, 7) + "-01T00:00:00Z");
  let total = 0;

  while (cursor <= now) {
    const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth();
    const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    let page = 1, pages = 1, monthRows = 0;

    while (page <= pages) {
      const data: any = await fetchPage(from, to, page);
      pages = Number(data?.numPages || 1);
      const rows = (data?.listings || []).map(toRow).filter(Boolean);
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("sold_listings").upsert(rows.slice(i, i + 500), { onConflict: "mls_number" });
        if (error) throw error;
      }
      monthRows += rows.length;
      page++;
      await sleep(250);
    }
    total += monthRows;
    console.log(`${from.slice(0, 7)}  ${monthRows} sales  (${pages} pages)`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  console.log(`Imported/updated ${total} sold listings`);

  let assigned = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("assign_sold_areas", { p_limit: 2000 });
    if (error) throw error;
    assigned += Number(data || 0);
    if (!data) break;
  }
  console.log(`Areas assigned: ${assigned}`);

  const { data: built, error: buildError } = await supabase.rpc("build_market_months", { p_from: "2024-10-01" });
  if (buildError) throw buildError;
  console.log(`market_months rows built: ${built}`);
}

main().catch((e) => { console.error(e); process.exit(1); });