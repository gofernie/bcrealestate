import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeType, getSqft, getLat, getLng, getDescription } from "./rebuild-listing-rows";

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const keyEntry = Object.entries(process.env).find(([k, v]) => /^REPLIERS\w*KEY$/i.test(k) && v);
if (!keyEntry) throw new Error("No REPLIERS*KEY found in env");
const API_KEY = String(keyEntry[1]);
const BOARD_ID = 25;
const START = "2024-09-01";
const BACKFILL_FROM = "2024-10-06";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (v: any) => String(v ?? "").toLowerCase().trim();
const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const day = (v: any) => (v ? String(v).slice(0, 10) : null);
const safe = <T>(fn: () => T): T | null => { try { return fn(); } catch { return null; } };

async function fetchPage(params: Record<string, string>, page: number) {
  const url = new URL("https://api.repliers.io/listings");
  url.searchParams.set("boardId", String(BOARD_ID));
  url.searchParams.set("type", "sale");
  url.searchParams.set("resultsPerPage", "100");
  url.searchParams.set("pageNum", String(page));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res: Response; try { res = await fetch(url, { headers: { "REPLIERS-API-KEY": API_KEY } }); } catch (e) { console.warn("Repliers network error, retry " + attempt + "/5"); await sleep(2000 * attempt); continue; }
    if (res.ok) {
      const json: any = await res.json();
      if (json?.unrecognizedParams?.length) throw new Error("Repliers ignored params: " + json.unrecognizedParams.join(", "));
      return json;
    }
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * attempt); continue; }
    throw new Error(`Repliers ${res.status}: ${await res.text()}`);
  }
  throw new Error("Repliers: too many retries");
}

function toRow(l: any, status: string) {
  const city = clean(l?.address?.city);
  const listPrice = num(l?.listPrice);
  if (!city || !listPrice || !l?.mlsNumber) return null;
  const type = clean(safe(() => normalizeType(l)) ?? "");
  const sqft = num(safe(() => getSqft(l))) ?? num(l?.details?.sqft);
  const lat = Number(safe(() => getLat(l)) ?? l?.map?.latitude);
  const lng = Number(safe(() => getLng(l)) ?? l?.map?.longitude);
  const ts = l?.timestamps ?? {};
  const off = status === "A" ? null
    : day(ts.unavailableDate) ?? day(l?.soldDate) ?? day(ts.terminatedDate) ?? day(ts.expiryDate);
  return {
    mls_number: String(l.mlsNumber),
    board_id: BOARD_ID,
    last_status: status,
    city,
    normalized_type: type || null,
    sqft,
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    list_price: listPrice,
    original_price: num(l?.originalPrice),
    list_date: day(l?.listDate),
    off_date: off,
    last_price_change: day(ts.lastPriceChanged),
    description: String(safe(() => getDescription(l)) ?? l?.details?.description ?? "").slice(0, 400),
    updated_at: new Date().toISOString(),
  };
}

async function pull(params: Record<string, string>, status: string, label: string) {
  let page = 1, pages = 1, n = 0;
  while (page <= pages) {
    const data: any = await fetchPage(params, page);
    pages = Number(data?.numPages || 1);
    const rows = (data?.listings || []).map((l: any) => toRow(l, status)).filter(Boolean);
    for (let i = 0; i < rows.length; i += 500) {
      let error: any = null; for (let t = 1; t <= 5; t++) { ({ error } = await supabase.from("board_listings").upsert(rows.slice(i, i + 500), { onConflict: "mls_number" })); if (!error) break; console.warn("Supabase save failed, retry " + t + "/5"); await sleep(3000 * t); }
      if (error) throw error;
    }
    n += rows.length;
    page++;
    await sleep(200);
  }
  console.log(`${label.padEnd(16)} ${n} listings (${pages} pages)`);
  return n;
}

async function main() {
  let total = await pull({ status: "A" }, "A", "Active");

  const now = new Date();
  for (const st of ["Sld", "Exp", "Ter"]) {
    const cursor = new Date(START + "T00:00:00Z");
    while (cursor <= now) {
      const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth();
      const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
      total += await pull(
        { status: "U", lastStatus: st, minUnavailableDate: from, maxUnavailableDate: to },
        st, `${st} ${from.slice(0, 7)}`
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  console.log(`Board listings imported/updated: ${total}`);

  let assigned = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("assign_board_areas", { p_limit: 2000 });
    if (error) throw error;
    assigned += Number(data || 0);
    if (!data) break;
  }
  console.log(`Areas assigned: ${assigned}`);

  const { error: delError } = await supabase.from("market_ticks").delete().eq("backfilled", true);
  if (delError) throw delError;

  const days: string[] = [];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(BACKFILL_FROM + "T00:00:00Z"); d < today; d.setUTCDate(d.getUTCDate() + 7)) {
    days.push(d.toISOString().slice(0, 10));
  }
  for (let i = 0; i < days.length; i++) {
    let error: any = null; for (let t = 1; t <= 5; t++) { ({ error } = await supabase.rpc("compute_board_asking", { p_day: days[i] })); if (!error) break; console.warn("Backfill step failed, retry " + t + "/5"); await sleep(3000 * t); }
    if (error) throw error;
    if (i % 10 === 0 || i === days.length - 1) console.log(`Asking backfill ${days[i]}  (${i + 1}/${days.length})`);
  }
  console.log("Done");
}

main().catch((e) => { console.error(e); process.exit(1); });