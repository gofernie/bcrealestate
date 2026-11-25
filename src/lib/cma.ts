// cma-v1: agent-only comparative market analysis from the cached sold data.
// Comps come from sold_listings (sold price/date/sqft/location), enriched from listing_rows
// (beds, year built, lot, waterfront) by MLS number. Older sales are moved to today with the
// city's market_months sold index. Nothing here is public: it is only called from /admin/api/cma.
import { createClient } from "@supabase/supabase-js";

const db = () => createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const str = (v: any) => String(v ?? "").trim();
const lc = (v: any) => str(v).toLowerCase();
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const median = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const truthy = (v: any) => v === true || /^(true|yes|y|1)$/i.test(str(v));

export type Family = "house" | "condo" | "townhouse" | "mobile" | "land" | "other";
export function familyOf(t: any): Family {
  const s = lc(t);
  if (/mobile|manufact/.test(s)) return "mobile";
  if (/land|lot|acreage/.test(s)) return "land";
  if (/town|row/.test(s)) return "townhouse";
  if (/condo|apart/.test(s)) return "condo";
  if (/house|single|detached|cabin|recreation|half duplex/.test(s)) return "house";
  return "other";
}
const SUFFIX: Record<Family, string> = { house: "SFH", condo: "CON", townhouse: "TWN", mobile: "MOB", land: "LND", other: "" };
const JUNK_TYPE = /fraction|timeshare|time share|commercial|business|parking|storage|locker|moorage|boat slip/i;
const JUNK_DESC = /\b(fractional|timeshare|time share|1\/\d+ (share|interest)|moorage|boat slip|parking stall|storage locker)\b/i;
const areaKey = (v: any) => lc(v).replace(/[-_]+/g, " ").replace(/\s+/g, " ");

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
// cma-img-v1: VIREB photos are stored as relative paths on the Repliers CDN
export const imgUrl = (v: any, size = "medium") => { const s = str(v); if (!s) return null; if (/^https?:\/\//i.test(s)) return s; return `https://cdn.repliers.io/${s.replace(/^\/+/, "")}?class=${size}`; };
const lotOf = (r: any) => num(r?.lot_size_sqft) ?? (num(r?.lot_size_acres) ? Number(r.lot_size_acres) * 43560 : null);

async function pageAll(build: (a: number, b: number) => any) {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export type Subject = {
  mls?: string | null; address?: string | null; type?: string | null; family: Family; area?: string | null;
  sqft?: number | null; beds?: number | null; baths?: number | null; year?: number | null; lot?: number | null;
  lat?: number | null; lng?: number | null; waterfront?: boolean | null; listPrice?: number | null; status?: string | null;
};

const ROW_COLS = "mls_number, address, image_url, normalized_type, normalized_area, area, normalized_city, city, beds, baths, sqft, year_built, lot_size_sqft, lot_size_acres, waterfront, ocean_view, lat, lng, price, status, listed_at";

function subjectFromRow(r: any): Subject {
  return {
    mls: str(r.mls_number) || null, address: str(r.address) || null, type: r.normalized_type, family: familyOf(r.normalized_type),
    area: str(r.normalized_area || r.area) || null, sqft: num(r.sqft), beds: num(r.beds), baths: num(r.baths), year: num(r.year_built),
    lot: lotOf(r), lat: num(r.lat) ? Number(r.lat) : null, lng: Number.isFinite(Number(r.lng)) && Number(r.lng) !== 0 ? Number(r.lng) : null,
    waterfront: r.waterfront == null ? null : truthy(r.waterfront), listPrice: num(r.price), status: str(r.status) || null,
  };
}

/** Find the subject home by MLS number or address. Returns matches to pick from when the address is ambiguous. */
export async function findSubject(city: string, q: { mls?: string; address?: string }) {
  const sb = db();
  const mls = str(q.mls).replace(/[^A-Za-z0-9]/g, "");
  if (mls) {
    const { data } = await sb.from("listing_rows").select(ROW_COLS).eq("mls_number", mls).limit(5);
    const r = (data || []).sort((a: any, b: any) => (b.sqft ? 1 : 0) - (a.sqft ? 1 : 0))[0];
    if (r) return { subject: subjectFromRow(r), matches: [] as any[] };
    const { data: s } = await sb.from("sold_listings").select("mls_number, normalized_type, normalized_area, raw_area, sqft, lat, lng, sold_price").eq("mls_number", mls).limit(1);
    if (s?.[0]) { const x = s[0]; return { subject: { mls, type: x.normalized_type, family: familyOf(x.normalized_type), area: x.normalized_area || x.raw_area, sqft: num(x.sqft), lat: num(x.lat), lng: Number.isFinite(Number(x.lng)) && Number(x.lng) !== 0 ? Number(x.lng) : null } as Subject, matches: [] }; }
    return { subject: null, matches: [], error: `MLS ${mls} isn't in the cache. Enter the details by hand instead.` };
  }
  const addr = str(q.address).replace(/[%,]/g, " ").replace(/\s+/g, " ").trim();
  if (addr.length < 4) return { subject: null, matches: [], error: "Enter an MLS number or more of the address." };
  const { data } = await sb.from("listing_rows").select(ROW_COLS)
    .ilike("address", `%${addr}%`).or(`normalized_city.ilike.${city},city.ilike.${city}`)
    .order("listed_at", { ascending: false }).limit(12);
  const seen = new Set<string>();
  const rows = (data || []).filter((r: any) => { const k = lc(r.address); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  if (rows.length === 1) return { subject: subjectFromRow(rows[0]), matches: [] };
  if (!rows.length) return { subject: null, matches: [], error: "No home at that address has been listed since the cache started. Enter the details by hand instead." };
  return { subject: null, matches: rows.map((r: any) => ({ mls: r.mls_number, address: r.address, area: r.normalized_area || r.area, type: r.normalized_type, status: r.status })) };
}

/** Monthly sold index for the city + property type, falling back to the city composite. */
async function loadIndex(city: string, family: Family) {
  const sb = db();
  const keys = [...new Set([city, city.replace(/-/g, " ")])];
  const { data: comps } = await sb.from("market_indexes").select("ticker, city").is("prop_type", null).is("area_slug", null).is("parent_ticker", null).in("city", keys);
  const comp = comps?.[0]?.ticker;
  if (!comp) return null;
  const { data: kids } = await sb.from("market_indexes").select("ticker").eq("parent_ticker", comp);
  const want = SUFFIX[family];
  const typeTicker = want ? (kids || []).map((k: any) => k.ticker).find((t: string) => (t.split(".")[1] || "").replace(/\d+$/, "") === want) : null;
  for (const ticker of [typeTicker, comp].filter(Boolean) as string[]) {
    const rows = await pageAll((a, b) => sb.from("market_months").select("month, sold_index").eq("ticker", ticker).not("sold_index", "is", null).order("month").range(a, b));
    const thisMonth = iso(new Date()).slice(0, 7);
    const pts = rows.map((r: any) => ({ m: String(r.month).slice(0, 7), v: Number(r.sold_index) })).filter((p) => p.v > 0 && p.m < thisMonth);
    if (pts.length < 6) continue;
    // 3-month centred average so one odd month doesn't swing an adjustment
    const sm = new Map<string, number>();
    pts.forEach((p, i) => { const w = pts.slice(Math.max(0, i - 1), i + 2); sm.set(p.m, w.reduce((s, x) => s + x.v, 0) / w.length); });
    const last = pts.slice(-3).reduce((s, x) => s + x.v, 0) / Math.min(3, pts.length);
    const first = pts[0].m;
    return {
      ticker, now: sm.get(pts[pts.length - 1].m) || last, asOf: pts[pts.length - 1].m, first,
      at(month: string) { if (sm.has(month)) return sm.get(month)!; if (month < first) return sm.get(first)!; let best = last; for (const [m, v] of sm) if (m <= month) best = v; return best; },
    };
  }
  return null;
}

/** Least squares with intercept; returns null if the system is singular. */
function ols(X: number[][], y: number[]) {
  const k = X[0].length + 1, A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) { const r = [1, ...X[i]]; for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += r[a] * r[b]; A[a][k] += r[a] * y[i]; } }
  for (let c = 0; c < k; c++) {
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map((row, i) => row[k] / A[i][i]);
}

const STEPS = [
  { days: 180, km: 2, sq: 0.2, beds: 1, lot: 3, label: "Last 180 days, same area or within 2 km, ±20% size" },
  { days: 270, km: 3.5, sq: 0.25, beds: 1, lot: 3, label: "Widened: last 9 months, within 3.5 km, ±25% size" },
  { days: 365, km: 6, sq: 0.3, beds: 2, lot: 0, label: "Widened: last 12 months, within 6 km, ±30% size" },
  { days: 730, km: 0, sq: 0.35, beds: 2, lot: 0, label: "Widened: last 2 years, anywhere in the city, ±35% size" },
];

// cma-backtest-v1: steps 1-4 are the same for every home of a type, so cache them briefly.
const CTX = new Map<string, { at: number; v: Promise<any> }>();
function getContext(city: string, fam: Family, cutoff = "") {
  const k = `${city}|${fam}|${cutoff}`, hit = CTX.get(k);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.v;
  const v = buildContext(city, fam, cutoff); CTX.set(k, { at: Date.now(), v }); v.catch(() => CTX.delete(k));
  return v;
}

async function buildContext(city: string, fam: Family, cutoff = "") {
  const sb = db();
  const today = new Date();
  const since = iso(new Date(today.getTime() - 730 * DAY));
  const cityOr = `city.ilike.${city},market_city.ilike.${city},city.ilike."${city.replace(/-/g, " ")}"`;

  // 1. Pool: two years of this city's sales of the same kind of property
  const BASE = "mls_number, normalized_type, normalized_area, raw_area, sqft, lat, lng, list_price, sold_price, sold_date, dom, description";
  const soldQuery = (cols: string) => pageAll((a, b) => sb.from("sold_listings").select(cols)
    .or(cityOr).gte("sold_date", since).order("sold_date", { ascending: false }).range(a, b));
  // beds/year/lot columns arrive with the 20261125 migration; fall back if they aren't there yet
  const raw = await soldQuery(BASE + ", beds, baths, year_built, lot_size_sqft, address").catch(() => soldQuery(BASE + ", beds, baths, year_built, lot_size_sqft")).catch(() => soldQuery(BASE));
  const famMatch = (t: any) => { const f = familyOf(t); return f === fam || (fam === "condo" && f === "townhouse") || (fam === "townhouse" && f === "condo"); };
  let pool = raw.filter((r) => num(r.sold_price) && r.sold_date && famMatch(r.normalized_type) && !JUNK_TYPE.test(str(r.normalized_type)) && !JUNK_DESC.test(str(r.description).slice(0, 160)));

  // 2. Enrich with the listing record (beds, year, lot, waterfront, address)
  const extra = new Map<string, any>();
  const ids = [...new Set(pool.map((r) => str(r.mls_number)))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("listing_rows").select("mls_number, address, beds, baths, year_built, lot_size_sqft, lot_size_acres, waterfront, ocean_view, normalized_area, image_url").in("mls_number", ids.slice(i, i + 200));
    for (const r of data || []) { const k = str(r.mls_number), had = extra.get(k); if (!had || (!had.beds && r.beds)) extra.set(k, r); }
  }

  // 3. Time adjustment from the sold index
  const index = await loadIndex(city, fam);
  const timeFactor = (date: string) => index ? clamp(index.now / index.at(date.slice(0, 7)), 0.8, 1.25) : 1;

  const comps0 = pool.map((r) => {
    const x = extra.get(str(r.mls_number)) || {};
    const price = Number(r.sold_price), tf = timeFactor(String(r.sold_date));
    return {
      mls: str(r.mls_number), address: str(x.address) || str(r.address) || null, type: r.normalized_type, family: familyOf(r.normalized_type),
      area: str(r.normalized_area || x.normalized_area || r.raw_area) || null,
      sqft: num(r.sqft), beds: num(r.beds) ?? num(x.beds), baths: num(r.baths) ?? num(x.baths), year: num(r.year_built) ?? num(x.year_built), lot: num(r.lot_size_sqft) ?? lotOf(x),
      lat: num(r.lat) ? Number(r.lat) : null, lng: Number.isFinite(Number(r.lng)) && Number(r.lng) !== 0 ? Number(r.lng) : null,
      waterfront: x.waterfront == null ? null : truthy(x.waterfront), image: imgUrl(x.image_url, "small"),
      listPrice: num(r.list_price), soldPrice: price, soldDate: String(r.sold_date).slice(0, 10), dom: r.dom ?? null,
      days: Math.max(0, Math.round((today.getTime() - new Date(String(r.sold_date) + "T12:00:00Z").getTime()) / DAY)),
      timeFactor: tf, timePrice: price * tf,
    };
  });

  // 4. Rates for size, lot and age, worked out from the last year of this city's sales
  // cutoff (blind tests): fit only on the 12 months before the test window
  const cut0 = cutoff ? iso(new Date(new Date(cutoff + "T12:00:00Z").getTime() - 365 * DAY)) : "";
  const yr = comps0.filter((c) => (cutoff ? c.soldDate < cutoff && c.soldDate >= cut0 : c.days <= 365) && (fam === "land" || c.sqft));
  const ppsf = median(yr.filter((c) => c.sqft && c.sqft > 300).map((c) => c.timePrice / c.sqft!)) || 400;
  const useLot = fam === "house" || fam === "land";
  const rates: any = { source: "defaults", sqft: 0.5 * ppsf, lot: fam === "land" ? 4 : 2, year: fam === "house" ? 1500 : 1000, ppsf: Math.round(ppsf) };
  {
    const feats = (c: any) => fam === "land" ? (c.lot ? [c.lot] : null) : (c.sqft && c.year ? (useLot ? (c.lot ? [c.sqft, c.lot, c.year] : null) : [c.sqft, c.year]) : null);
    const rows = yr.map((c) => ({ f: feats(c), y: c.timePrice })).filter((r) => r.f && (useLot ? r.f[fam === "land" ? 0 : 1] < 5 * 43560 : true));
    if (rows.length >= 25) {
      const b = ols(rows.map((r) => r.f!), rows.map((r) => r.y));
      if (b) {
        if (fam === "land") rates.lot = clamp(b[1], 0.5, 40);
        else { rates.sqft = clamp(b[1], 0.4 * ppsf, 0.9 * ppsf); if (useLot) { rates.lot = clamp(b[2], 0, 25); rates.year = clamp(b[3], 0, 6000); } else rates.year = clamp(b[2], 0, 6000); }
        rates.source = `fitted from ${rows.length} sales in the last 12 months`;
      }
    }
  }
  return { pool, comps0, index, rates, useLot, famMatch };
}

export async function runCma(city: string, s: Subject, opts: { asOf?: string; skipActives?: boolean; cutoff?: string } = {}) {
  const sb = db();
  const fam = s.family;
  const ctx = await getContext(city, fam, opts.cutoff || "");
  const { pool, index, rates, useLot, famMatch } = ctx;
  // asOf (backtests): only sales before that date count, and recency is measured from it
  const asOfMs = opts.asOf ? new Date(opts.asOf + "T12:00:00Z").getTime() : 0;
  const comps0 = (ctx.comps0 as any[]).filter((c) => c.mls !== str(s.mls) && (!opts.asOf || c.soldDate < opts.asOf))
    .map((c) => opts.asOf ? { ...c, days: Math.round((asOfMs - new Date(c.soldDate + "T12:00:00Z").getTime()) / DAY) } : c);

  // 5. Filter, widening until there are at least 5 comps
  const sameArea = (c: any) => !!(s.area && c.area && areaKey(c.area) === areaKey(s.area));
  let step = 0, picked: any[] = [];
  for (; step < STEPS.length; step++) {
    const st = STEPS[step];
    picked = comps0.filter((c) => {
      if (c.days > st.days) return false;
      if (fam !== "land" && s.sqft && c.sqft && Math.abs(c.sqft / s.sqft - 1) > st.sq) return false;
      if (fam !== "land" && s.sqft && !c.sqft) return false;
      if (s.beds && c.beds && Math.abs(c.beds - s.beds) > st.beds) return false;
      if (st.lot && useLot && s.lot && c.lot && (c.lot / s.lot > st.lot || s.lot / c.lot > st.lot)) return false;
      if (fam === "land" && s.lot && c.lot && Math.abs(Math.log(c.lot / s.lot)) > (step < 2 ? 0.7 : 1.2)) return false;
      if (!st.km) return true;
      if (s.lat && s.lng && c.lat && c.lng) return km(s.lat, s.lng, c.lat, c.lng) <= st.km || (step < 2 && sameArea(c));
      return step < 2 ? sameArea(c) : true;
    });
    if (picked.length >= 5) break;
  }
  step = Math.min(step, STEPS.length - 1);

  // 6. Adjust and weight each comp
  const cap = (v: number, p: number) => clamp(v, -0.15 * p, 0.15 * p);
  const comps = picked.map((c) => {
    const adj: { label: string; amount: number }[] = [];
    adj.push({ label: c.timeFactor === 1 ? "Time (no index change)" : `Time: ${index?.ticker} index since ${c.soldDate.slice(0, 7)} (${c.timeFactor >= 1 ? "+" : ""}${((c.timeFactor - 1) * 100).toFixed(1)}%)`, amount: c.timePrice - c.soldPrice });
    if (fam !== "land" && s.sqft && c.sqft && s.sqft !== c.sqft) adj.push({ label: `Size: ${Math.round(s.sqft - c.sqft).toLocaleString("en-CA")} sq ft × $${Math.round(rates.sqft)}`, amount: cap((s.sqft - c.sqft) * rates.sqft, c.timePrice) });
    if (useLot && s.lot && c.lot && Math.abs(s.lot - c.lot) > 500) adj.push({ label: `Lot: ${Math.round(s.lot - c.lot).toLocaleString("en-CA")} sq ft × $${rates.lot.toFixed(2)}`, amount: cap((s.lot - c.lot) * rates.lot, c.timePrice) });
    if (fam !== "land" && s.year && c.year && s.year !== c.year) adj.push({ label: `Age: built ${c.year} vs ${s.year} (${s.year - c.year > 0 ? "+" : ""}${s.year - c.year} yrs × $${Math.round(rates.year).toLocaleString("en-CA")})`, amount: cap((s.year - c.year) * rates.year, c.timePrice) });
    const adjusted = c.soldPrice + adj.reduce((t, a) => t + a.amount, 0);
    const gross = adj.slice(1).reduce((t, a) => t + Math.abs(a.amount), 0) / c.soldPrice;
    const distKm = s.lat && s.lng && c.lat && c.lng ? km(s.lat, s.lng, c.lat, c.lng) : null;
    const flags: string[] = [];
    let w = Math.exp(-c.days / 120);
    w *= distKm != null ? 1 / (1 + (distKm / 1.2) ** 2) : sameArea(c) ? 0.7 : 0.35;
    w *= fam !== "land" && s.sqft && c.sqft ? Math.exp(-Math.abs(Math.log(c.sqft / s.sqft)) / 0.12) : 0.6;
    w *= fam !== "land" ? (s.year && c.year ? Math.exp(-Math.abs(s.year - c.year) / 20) : 0.8) : 1;
    w *= useLot ? (s.lot && c.lot ? Math.exp(-Math.abs(Math.log(c.lot / s.lot)) / 0.6) : 0.85) : 1;
    w *= s.beds && c.beds ? (s.beds === c.beds ? 1 : 0.75) : 0.85;
    if (s.waterfront != null && c.waterfront != null && s.waterfront !== c.waterfront) { w *= 0.3; flags.push(c.waterfront ? "Waterfront (subject isn't)" : "Not waterfront (subject is)"); }
    if (c.family !== fam) { w *= 0.6; flags.push(`Different type (${c.type})`); }
    if (gross > 0.25) { w *= 0.5; flags.push(`Heavy adjustments (${Math.round(gross * 100)}%)`); }
    w *= Math.exp(-gross / 0.25);
    return { ...c, distKm: distKm == null ? null : Math.round(distKm * 10) / 10, adjustments: adj, adjusted: Math.round(adjusted), gross: Math.round(gross * 1000) / 10, weight: w, flags };
  }).sort((a, b) => b.weight - a.weight).slice(0, 15);
  const wSum = comps.reduce((t, c) => t + c.weight, 0) || 1;
  comps.forEach((c) => (c.weight = Math.round((c.weight / wSum) * 1000) / 10));
  const sm0 = summarize(comps);
  const confidence = sm0 ? confidenceOf(sm0, fam, step > 0, s.waterfront) : { level: "low", reasons: ["No comps"], band: BANDS.low, core: CORE.low };

  // 7. Competition: active listings like the subject
  if (opts.skipActives) return { subject: s, criteria: STEPS[step].label, widened: step > 0, poolSize: pool.length, index: null, rates, comps, actives: [], activeCount: 0, areas: [], confidence };
  const keys = [city, city.replace(/-/g, " ")];
  const actRaw = await pageAll((a, b) => sb.from("listing_rows").select(ROW_COLS).eq("status", "A").or(keys.map((k) => `normalized_city.ilike."${k}"`).join(",")).range(a, b));
  const seenA = new Set<string>();
  const actives = actRaw.filter((r: any) => {
    const k = str(r.mls_number); if (!k || seenA.has(k) || k === str(s.mls)) return false; seenA.add(k);
    if (!famMatch(r.normalized_type) || !num(r.price)) return false;
    if (fam !== "land" && s.sqft && (!num(r.sqft) || Math.abs(num(r.sqft)! / s.sqft - 1) > 0.25)) return false;
    if (s.lat && s.lng && num(r.lat) && Number(r.lng)) return km(s.lat, s.lng, Number(r.lat), Number(r.lng)) <= 3 || (!!s.area && areaKey(r.normalized_area || r.area) === areaKey(s.area));
    return !s.area || areaKey(r.normalized_area || r.area) === areaKey(s.area);
  }).map((r: any) => ({ mls: r.mls_number, address: r.address, area: r.normalized_area || r.area, price: num(r.price), sqft: num(r.sqft), beds: num(r.beds), year: num(r.year_built), listedAt: r.listed_at, image: imgUrl(r.image_url, "small"), lat: num(r.lat), lng: Number.isFinite(Number(r.lng)) && Number(r.lng) !== 0 ? Number(r.lng) : null }))
    .sort((a: any, b: any) => (a.price || 0) - (b.price || 0));

  const areas = [...new Set(comps0.map((c) => areaKey(c.area)).filter(Boolean))].sort();
  return {
    subject: s, criteria: STEPS[step].label, widened: step > 0, poolSize: pool.length,
    index: index ? { ticker: index.ticker, asOf: index.asOf } : null,
    rates: { source: rates.source, sqft: Math.round(rates.sqft), lot: Math.round(rates.lot * 100) / 100, year: Math.round(rates.year), medianPpsf: rates.ppsf },
    comps, actives: actives.slice(0, 12), activeCount: actives.length, areas, confidence,
  };
}

/** cma-since-v1: what a past purchase price would be worth today, moved by the city's sold index. */
export async function valueSince(city: string, family: Family, month: string, price: number) {
  const index = await loadIndex(city, family === "other" ? "house" : family);
  if (!index) return { error: "No sold index for this city." };
  if (month < index.first) return { error: `The index only goes back to ${index.first}.`, first: index.first };
  const then = index.at(month), f = index.now / then;
  return { ticker: index.ticker, first: index.first, asOf: index.asOf, month, price, factor: f, value: Math.round((price * f) / 1000) * 1000, change: Math.round((f - 1) * 1000) / 10 };
}

export async function cityAreas(city: string) {
  const sb = db();
  const since = iso(new Date(Date.now() - 730 * DAY));
  const rows = await pageAll((a, b) => sb.from("sold_listings").select("normalized_area").or(`city.ilike.${city},market_city.ilike.${city}`).gte("sold_date", since).range(a, b));
  return [...new Set(rows.map((r: any) => areaKey(r.normalized_area)).filter(Boolean))].sort();
}

// cma-confidence-v1: range bands from the Nanaimo backtest (Nov 2026, ~680 sales over 180 days).
// Each pair is the 10th and 90th percentile of sold ÷ estimate at that confidence level, so about 80% of sales land inside.
const BANDS: Record<string, [number, number]> = { high: [0.87, 1.15], medium: [0.81, 1.16], low: [0.77, 1.37], mobile: [0.69, 1.45] };
// Middle half (25th-75th percentile): where half of sales landed. Shown as the headline range.
const CORE: Record<string, [number, number]> = { high: [0.945, 1.076], medium: [0.905, 1.065], low: [0.851, 1.147], mobile: [0.8, 1.09] };
const TIER: Record<string, [number, number]> = { house: [350_000, 1_500_000], condo: [220_000, 800_000], townhouse: [300_000, 900_000], mobile: [150_000, 550_000], land: [0, Infinity], other: [0, Infinity] };

export function confidenceOf(sm: { likely: number; spread: number; n: number }, fam: Family, widened: boolean, waterfront?: boolean | null) {
  const low: string[] = [], med: string[] = [];
  if (fam === "mobile") low.push("Mobile homes are hard to value from comps (park, pad fees and age vary a lot)");
  if (widened) low.push("Not enough close matches, so the search was widened");
  if (sm.n < 6) low.push(`Only ${sm.n} comps`);
  else if (sm.n < 10) med.push(`${sm.n} comps`);
  if (sm.spread > 0.35) low.push("Comps disagree a lot on price");
  else if (sm.spread > 0.2) med.push("Comps are spread out on price");
  const [lo, hi] = TIER[fam] || [0, Infinity];
  if (sm.likely > hi) low.push("Upper-end home; few true comparables");
  if (sm.likely < lo) low.push("Low-end price; condition drives value");
  if (waterfront) low.push("Waterfront; comps rarely match");
  const level = low.length ? "low" : med.length ? "medium" : "high";
  const key = fam === "mobile" ? "mobile" : level;
  return { level, reasons: low.length ? low : med, band: BANDS[key], core: CORE[key] };
}

/** Same summary the page shows: weighted 20th / 50th / 80th percentile of adjusted prices. */
export function summarize(comps: { adjusted: number; weight: number }[]) {
  const s = comps.map((c) => ({ v: c.adjusted, w: Math.max(c.weight, 0.1) })).sort((a, b) => a.v - b.v);
  if (!s.length) return null;
  const tot = s.reduce((t, x) => t + x.w, 0);
  const pct = (p: number) => { let acc = 0; for (const x of s) { acc += x.w; if (acc / tot >= p) return x.v; } return s[s.length - 1].v; };
  const likely = pct(0.5);
  return { likely, spread: (pct(0.8) - pct(0.2)) / likely, n: s.length };
}

/** cma-backtest-v1: value each recent sale using only earlier sales, and compare with what it sold for. Read-only. */
export async function backtest(city: string, fam: Family, days = 90, includeRows = false, blind = false) {
  const cutoff = blind ? iso(new Date(Date.now() - days * DAY)) : "";
  const ctx = await getContext(city, fam);
  const subjects = (ctx.comps0 as any[]).filter((c) => c.days <= days && c.family === fam && (fam === "land" || c.sqft));
  const rows: any[] = [];
  for (const c of subjects) {
    const s: Subject = { mls: c.mls, address: c.address, type: c.type, family: fam, area: c.area, sqft: c.sqft, beds: c.beds, year: c.year, lot: c.lot, lat: c.lat, lng: c.lng, waterfront: c.waterfront };
    const r = await runCma(city, s, { asOf: c.soldDate, skipActives: true, cutoff });
    const sm = summarize(r.comps);
    if (!sm) continue;
    // compare like with like: both in the sale month's money
    const back = 1 / c.timeFactor, pred = sm.likely * back, cf = (r as any).confidence;
    rows.push({ level: cf.level, spread: Math.round(sm.spread * 1000) / 1000, wf: !!c.waterfront, likelyNow: Math.round(sm.likely), mls: c.mls, address: c.address, area: c.area, soldDate: c.soldDate, sold: c.soldPrice, predicted: Math.round(pred), lo: Math.round(pred * cf.band[0]), hi: Math.round(pred * cf.band[1]), err: pred / c.soldPrice - 1, comps: r.comps.length, widened: r.widened });
  }
  const abs = rows.map((r) => Math.abs(r.err)).sort((a, b) => a - b);
  const share = (f: (r: any) => boolean) => rows.length ? Math.round((rows.filter(f).length / rows.length) * 1000) / 10 : 0;
  const pctl = (p: number) => abs.length ? Math.round(abs[Math.min(abs.length - 1, Math.floor(p * abs.length))] * 1000) / 10 : null;
  return {
    city, family: fam, days, blind, rateFitBefore: cutoff || null, tested: rows.length,
    medianMissPct: pctl(0.5), p80MissPct: pctl(0.8),
    biasPct: rows.length ? Math.round((median(rows.map((r) => r.err)) || 0) * 1000) / 10 : null,
    within5Pct: share((r) => Math.abs(r.err) <= 0.05), within10Pct: share((r) => Math.abs(r.err) <= 0.1),
    insideRangePct: share((r) => r.sold >= r.lo && r.sold <= r.hi),
    widenedPct: share((r) => r.widened),
    byLevel: Object.fromEntries(["high", "medium", "low"].map((lv) => { const g = rows.filter((r) => r.level === lv); const a = g.map((r) => Math.abs(r.err)).sort((x, y) => x - y); return [lv, { n: g.length, medianMissPct: a.length ? Math.round(a[Math.floor(a.length / 2)] * 1000) / 10 : null, insideRangePct: g.length ? Math.round((g.filter((r) => r.sold >= r.lo && r.sold <= r.hi).length / g.length) * 1000) / 10 : null }]; })),
    rows: includeRows ? rows.map((r) => ({ ...r, err: Math.round(r.err * 10000) / 10000 })) : undefined,
    worst: [...rows].sort((a, b) => Math.abs(b.err) - Math.abs(a.err)).slice(0, 12).map((r) => ({ ...r, err: Math.round(r.err * 1000) / 10 })),
  };
}

/** cma-blind-v1: what the CMA would have said about one sold home using only sales from before it sold. */
export async function blindValue(city: string, mls: string) {
  for (const fam of ["house", "condo", "townhouse", "mobile"] as Family[]) {
    const ctx = await getContext(city, fam);
    const c = (ctx.comps0 as any[]).find((x) => x.mls === mls && x.family === fam);
    if (!c) continue;
    const s: Subject = { mls: c.mls, address: c.address, type: c.type, family: fam, area: c.area, sqft: c.sqft, beds: c.beds, year: c.year, lot: c.lot, lat: c.lat, lng: c.lng, waterfront: c.waterfront };
    const r: any = await runCma(city, s, { asOf: c.soldDate, skipActives: true });
    const sm = summarize(r.comps);
    if (!sm) return { error: "Not enough earlier sales to value this one blind." };
    const pred = sm.likely / c.timeFactor;
    return { mls, sold: c.soldPrice, soldDate: c.soldDate, estimate: Math.round(pred / 1000) * 1000, errPct: Math.round((pred / c.soldPrice - 1) * 1000) / 10, confidence: r.confidence?.level, comps: r.comps.length };
  }
  return { error: "This sale isn't in the cached sold data." };
}
