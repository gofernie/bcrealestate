import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { normalizeType, getSqft, getLat, getLng, getDescription } from "./rebuild-listing-rows";

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const keyEntry = Object.entries(process.env).find(([k, v]) => /^REPLIERS\w*KEY$/i.test(k) && v);
if (!keyEntry) throw new Error("No REPLIERS*KEY found in env");
const API_KEY = String(keyEntry[1]);
const BOARD_ID = 25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (v: any) => String(v ?? "").toLowerCase().trim();
const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
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
    let res: Response;
    try { res = await fetch(url, { headers: { "REPLIERS-API-KEY": API_KEY } }); }
    catch { console.warn("Repliers network error, retry " + attempt + "/5"); await sleep(2000 * attempt); continue; }
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
  const lat = Number(safe(() => getLat(l)) ?? l?.map?.latitude);
  const lng = Number(safe(() => getLng(l)) ?? l?.map?.longitude);
  const ts = l?.timestamps ?? {};
  return {
    mls_number: String(l.mlsNumber),
    board_id: BOARD_ID,
    last_status: status,
    city,
    normalized_type: clean(safe(() => normalizeType(l)) ?? "") || null,
    sqft: num(safe(() => getSqft(l))) ?? num(l?.details?.sqft),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    list_price: listPrice,
    original_price: num(l?.originalPrice),
    list_date: day(l?.listDate),
    off_date: status === "A" ? null : day(ts.unavailableDate) ?? day(l?.soldDate) ?? day(ts.terminatedDate) ?? day(ts.expiryDate),
    last_price_change: day(ts.lastPriceChanged),
    description: String(safe(() => getDescription(l)) ?? l?.details?.description ?? "").slice(0, 400),
    updated_at: new Date().toISOString(),
  };
}

async function save(rows: any[]) {
  for (let i = 0; i < rows.length; i += 500) {
    let error: any = null;
    for (let t = 1; t <= 5; t++) {
      ({ error } = await supabase.from("board_listings").upsert(rows.slice(i, i + 500), { onConflict: "mls_number" }));
      if (!error) break;
      console.warn("Supabase save failed, retry " + t + "/5"); await sleep(3000 * t);
    }
    if (error) throw error;
  }
}

async function pull(params: Record<string, string>, status: string) {
  let page = 1, pages = 1, n = 0;
  while (page <= pages) {
    const data: any = await fetchPage(params, page);
    pages = Number(data?.numPages || 1);
    const rows = (data?.listings || []).map((l: any) => toRow(l, status)).filter(Boolean);
    await save(rows);
    n += rows.length; page++;
    await sleep(150);
  }
  return n;
}

async function main() {
  const runStart = new Date().toISOString();
  const today = runStart.slice(0, 10);
  const since = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

  const actives = await pull({ status: "A" }, "A");
  console.log(`Active: ${actives}`);
  if (actives < 1000) throw new Error(`Only ${actives} actives pulled - looks incomplete, stopping before marking anything gone`);

  for (const st of ["Sld", "Exp", "Ter"]) {
    console.log(`${st} since ${since}: ${await pull({ status: "U", lastStatus: st, minUnavailableDate: since }, st)}`);
  }

  const { error: goneError, count } = await supabase
    .from("board_listings")
    .update({ last_status: "gone", off_date: today }, { count: "exact" })
    .eq("last_status", "A")
    .lt("updated_at", runStart);
  if (goneError) throw goneError;
  console.log(`Dropped off board (marked gone): ${count ?? 0}`);

  for (;;) {
    const { data, error } = await supabase.rpc("assign_board_areas", { p_limit: 2000 });
    if (error) throw error;
    if (!data) break;
  }

  await supabase.rpc("assign_saanich_districts");
  const { data: n, error } = await supabase.rpc("compute_board_asking", { p_day: today, p_backfill: false });
  if (error) throw error;
  console.log(`Today's ticks from board (${today}): ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });