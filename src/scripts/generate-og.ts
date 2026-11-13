import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Resvg } from "@resvg/resvg-js";

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DAY = 86400000;
const fmt = (v: number | null | undefined) => (v == null ? "-" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1000)}K`);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slugOf = (city: string) => city.trim().replace(/\s+/g, "-");

function poly(vals: number[], x0: number, x1: number, y0: number, y1: number, lo: number, hi: number) {
  return vals.map((v, i) => `${(x0 + (i / Math.max(1, vals.length - 1)) * (x1 - x0)).toFixed(1)},${(y1 - ((v - lo) / ((hi - lo) || 1)) * (y1 - y0)).toFixed(1)}`).join(" ");
}

async function main() {
  const { error: rollErr } = await supabase.rpc("build_region_rollups", { p_from: new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10) });
  if (rollErr) console.warn("Region rollup failed:", rollErr.message);
  const { error: distErr } = await supabase.rpc("refresh_district_monthly_stats");
  if (distErr) console.warn("District monthly stats failed:", distErr.message);
  const { error: mtnErr } = await supabase.rpc("build_months_from_monthly_stats");
  if (mtnErr) console.warn("Monthly-stats sold index failed:", mtnErr.message);

  const { data: comps, error } = await supabase.from("market_indexes")
    .select("ticker, name, city").is("prop_type", null).is("area_slug", null).is("parent_ticker", null);
  if (error) throw error;

  const since = new Date(Date.now() - 370 * DAY).toISOString().slice(0, 10);
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
  let done = 0;

  for (const comp of comps ?? []) {
    const [{ data: ticks }, { data: months }] = await Promise.all([
      supabase.from("market_ticks").select("day, ask_index, actives").eq("ticker", comp.ticker).gte("day", since).order("day"),
      supabase.from("market_months").select("month, sold_index, sold_count, thin").eq("ticker", comp.ticker).gte("month", since).order("month"),
    ]);
    const ask = (ticks ?? []).filter((t: any) => t.ask_index != null);
    if (ask.length < 2) continue;
    const sold = (months ?? []).filter((m: any) => m.sold_index != null && !m.thin && m.month < thisMonth && m.month !== prevKey);
    const last = ask[ask.length - 1];

    let change: number | null = null, basis = "";
    const win = (i: number) => sold.slice(Math.max(0, i - 2), i + 1).reduce((t: number, p: any) => t + (p.sold_count || 0), 0);
    if (sold.length >= 13 && win(sold.length - 1) >= 30 && win(sold.length - 13) >= 30) {
      change = (sold[sold.length - 1].sold_index / sold[sold.length - 13].sold_index - 1) * 100; basis = "1Y sales";
    } else if ((ask[0].actives ?? 0) >= 20 && (last.actives ?? 0) >= 20) {
      change = (last.ask_index / ask[0].ask_index - 1) * 100; basis = "1Y asking";
    }
    const up = (change ?? 0) >= 0;
    const col = change == null ? "#6b7280" : up ? "#1D9E75" : "#C0392B";
    const chip = change == null ? "New index" : `${up ? "\u2191" : "\u2193"} ${Math.abs(change).toFixed(1)}%  ${basis}`;

    const askVals = ask.map((t: any) => Number(t.ask_index));
    const soldVals = sold.map((m: any) => Number(m.sold_index));
    const all = [...askVals, ...soldVals];
    const lo = Math.min(...all) * 0.98, hi = Math.max(...all) * 1.02;
    const cityTitle = String(comp.city).replace(/\b\w/g, (ch: string) => ch.toUpperCase());

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="10" fill="${col}"/>
  <text x="70" y="95" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="4" fill="#374151">IF ${esc(cityTitle.toUpperCase())} WERE A STOCK</text>
  <text x="70" y="175" font-family="DejaVu Sans, Arial, sans-serif" font-size="56" font-weight="700" fill="#111827">${esc(comp.ticker)}</text>
  <text x="70" y="215" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#6b7280">${esc(comp.name)}</text>
  <text x="70" y="330" font-family="DejaVu Sans, Arial, sans-serif" font-size="110" font-weight="700" fill="#111827">${fmt(Number(last.ask_index))}</text>
  <text x="70" y="372" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#6b7280">CAD asking index</text>
  <rect x="70" y="400" width="${Math.max(220, chip.length * 17)}" height="56" rx="10" fill="${col}" fill-opacity="0.12"/>
  <text x="90" y="438" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="700" fill="${col}">${esc(chip)}</text>
  ${soldVals.length >= 2 ? `<polyline points="${poly(soldVals, 640, 1130, 140, 470, lo, hi)}" fill="none" stroke="#2f6f73" stroke-width="5" stroke-linejoin="round"/>` : ""}
  <polyline points="${poly(askVals, 640, 1130, 140, 470, lo, hi)}" fill="none" stroke="${col}" stroke-width="5" stroke-linejoin="round" stroke-dasharray="${ask.length > 60 ? "0" : "10 7"}"/>
  <text x="640" y="510" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#6b7280">${soldVals.length >= 2 ? "\u2014 asking   \u2014 sales" : "\u2014 asking"}  \u00b7  past year</text>
  <text x="70" y="585" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#9ca3af">bc.realestate \u00b7 Market Intel \u00b7 statistical index, not an appraisal</text>
</svg>`;

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" } }).render().asPng();
    const { error: upErr } = await supabase.storage.from("og").upload(`market/${slugOf(comp.city)}.png`, png, { upsert: true, contentType: "image/png", cacheControl: "3600" });
    if (upErr) { console.warn(`${comp.ticker}: upload failed - ${upErr.message}`); continue; }
    done++;
  }
  console.log(`Share images written: ${done}`);
}

main().catch((e) => { console.error(e); process.exit(1); });