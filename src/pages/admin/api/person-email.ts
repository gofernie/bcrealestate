// crm-v4: email composer for one person. GET = ready-to-edit ideas, POST = send + log to timeline
import type { APIRoute } from "astro";
import { sbAdmin, loadPeople } from "../../../lib/crm";
import { getMarketPulse } from "../../../lib/marketPulse";
import { siteBase, mapListing, listingUrl, fmtPrice } from "../../../lib/sessionHomes";
import { RATES } from "../../../lib/rates";
import { unsubUrl, replyTo } from "../../../lib/unsub";
import { closeDripSend } from "../../../lib/crm";
export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function chartHtml(g?: string) {
  if (!g) return "";
  const [ask, likely, sug, ...comps] = g.split("_").map(Number);
  if (!ask || !likely || comps.length < 2) return "";
  const kv = (v: number) => "$" + (v * 1000).toLocaleString("en-CA");
  const rows: any[] = [{ v: ask, l: "Your asking price", c: "#c0392b", b: 1 }, { v: likely, l: "Likely value", c: "#1f6b60", b: 1 }];
  if (sug && sug < ask) rows.push({ v: sug, l: "Suggested price", c: "#2c3e50", b: 1 });
  for (const v of comps) if (v > 0) rows.push({ v, l: "Comparable sale", c: "#c9c3b6", b: 0 });
  rows.sort((a, b) => b.v - a.v);
  const max = rows[0].v, min = rows[rows.length - 1].v;
  const base = Math.max(0, Math.floor((min - (max - min) * 0.3 - 1) / 10) * 10);
  const tr = rows.map((r) => {
    const w = Math.round(8 + 72 * (r.v - base) / Math.max(1, max - base));
    return `<tr><td style="padding:3px 10px 3px 0;font-size:12px;white-space:nowrap;width:125px;color:${r.b ? "#222222" : "#666666"};${r.b ? "font-weight:bold;" : ""}">${r.l}</td><td style="padding:3px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="${w}%" bgcolor="${r.c}" style="background:${r.c};height:16px;font-size:0;line-height:0;border-radius:3px">&nbsp;</td><td style="padding-left:6px;font-size:12px;color:#333333;white-space:nowrap;${r.b ? "font-weight:bold;" : ""}">${kv(r.v)}</td></tr></table></td></tr>`;
  }).join("");
  return `<br><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;margin:12px 0 4px;border:1px solid #e4e0d6;border-radius:8px;background:#faf9f6"><tr><td style="padding:14px 16px"><div style="font-weight:bold;font-size:15px;color:#222222;margin-bottom:8px">Where your asking price sits</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${tr}</table><div style="font-size:11px;color:#777777;margin-top:8px">Comparable sales are adjusted to your home. Bars start at ${kv(base)}, not zero, so the differences are easier to see.</div></td></tr></table>`;
}function linkOrButton(u: string) {
  if (/\/report\/[0-9a-f-]{36}/i.test(u)) return chartHtml((u.match(/[?&](?:amp;)?g=([0-9_]+)/) || [])[1]) + `<br><a href="${u.replace(/\?.*$/, "")}" style="display:inline-block;margin-top:8px;background:#1f6b60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 18px;border-radius:6px">See the comparable sales report &rarr;</a>`;
  const m = u.match(/\/([a-z0-9-]+)\/market-intelligence/i);
  if (!m) return `<a href="${u}" style="color:#1f6b60">${u}</a>`;
  const city = m[1].replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
  return `<br><a href="${u}" style="display:inline-block;margin-top:8px;background:#1f6b60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 18px;border-radius:6px">See the ${city} market report &rarr;</a>`;
}
const toHtml = (t: string) => escH(t).replace(/https?:\/\/[^\s<]+/g, (u) => linkOrButton(u)).replace(/^[ \t]*\u2022[ \t]*/gm, "&nbsp;&nbsp;&nbsp;&bull;&nbsp;").replace(/\n/g, "<br>");
const money = (n: number) => (n > 0 ? "$" + Math.round(n).toLocaleString("en-CA") : "");
const nice = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-CA", { month: "long", day: "numeric" });
const TYPE_OF: Record<string, string> = { market: "market", rates: "financing", loved: "homes", checkin: "checkin", value: "market" };
const ORDER: Record<string, number> = { since: 4.5, price: -2, sellerupdate: -1, birthday: 0, pbirthday: 1, loved: 2, market: 3, rates: 4, value: 5, checkin: 6 };

async function agentFor(sb: any, siteId: string) {
  let agentName = "", agentEmail = "", siteName = "", brokerage = "";
  const { data: s } = await sb.from("sites").select("agent_id, site_name").eq("id", siteId).maybeSingle();
  siteName = String(s?.site_name || "").trim();
  if (s?.agent_id) {
    const { data: a } = await sb.from("agents").select("name, email, brokerage").eq("id", s.agent_id).maybeSingle();
    agentName = String(a?.name || "").trim(); agentEmail = String(a?.email || "").trim(); brokerage = String((a as any)?.brokerage || "").trim();
  }
  if (!agentName && !agentEmail) {
    const fallbackEmail = env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
    const { data: fa } = await sb.from("agents").select("name, email, brokerage").eq("email", fallbackEmail).maybeSingle();
    agentName = String(fa?.name || "").trim(); agentEmail = String(fa?.email || "").trim(); brokerage = String((fa as any)?.brokerage || "").trim();
  }
  if (!agentName) agentName = env("DEFAULT_AGENT_NAME") || "Chris Crump";
  if (!agentEmail) agentEmail = env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
  return { agentName, agentEmail, siteName, brokerage };
}

async function load(locals: any, siteId: string, key: string) {
  const access: any = locals?.adminAccess;
  if (!UUID.test(siteId) || !/^[ep]:/.test(key)) return { error: "Missing site or person", status: 400 };
  if (access && !access.isPlatformAdmin && !(access.siteIds || []).includes(siteId)) return { error: "Not your site", status: 403 };
  const { site, people, detail } = await loadPeople(siteId);
  const p: any = people.find((x: any) => x.keys.includes(key));
  if (!p) return { error: "Person not found", status: 404 };
  return { site, people, p, d: detail.get(p.key) || { leads: [], sessions: [], reactions: [] } };
}

const daysUntil = (b: string | null) => {
  if (!b) return null;
  const t = new Date(), today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const d0 = new Date(t.getFullYear(), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  let diff = Math.round((d0.getTime() - today.getTime()) / 864e5);
  if (diff < -1) { d0.setFullYear(t.getFullYear() + 1); diff = Math.round((d0.getTime() - today.getTime()) / 864e5); }
  return diff <= 14 ? diff : null;
};

async function sellerCtx(request: Request, sb: any, mls: string) {
  const { data: lr } = await sb.from("listing_rows").select("*").eq("mls_number", mls).limit(1);
  const L: any = lr?.[0]; if (!L) return null;
  const city = String(L.normalized_city || L.city || "").toLowerCase().trim().replace(/\s+/g, "-");
  const origin = new URL(request.url).origin, cookie = request.headers.get("cookie") || "";
  const get = (q: string) => fetch(`${origin}/admin/api/cma?${q}`, { headers: { cookie } }).then((r) => r.json()).catch(() => null);
  const [cma, ph]: any[] = await Promise.all([get(`city=${encodeURIComponent(city)}&mls=${encodeURIComponent(mls)}`), get(`photos=${encodeURIComponent(mls)}`)]);
  const listPrice = Number(L.price || cma?.subject?.listPrice || 0);
  const listedAt = String(ph?.listedAt || L.listed_at || "").slice(0, 10);
  const dom = listedAt ? Math.max(0, Math.round((Date.now() - new Date(listedAt + "T12:00:00").getTime()) / 864e5)) : null;
  let likely = 0, lo = 0, hi = 0, compsN = 0;
  const comps = Array.isArray(cma?.comps) ? cma.comps.filter((c: any) => c.adjusted > 0) : [];
  if (comps.length) {
    const s = comps.map((c: any) => ({ v: c.adjusted, w: Math.max(Number(c.weight) || 0, 0.1) })).sort((a: any, b: any) => a.v - b.v);
    const tot = s.reduce((t: number, x: any) => t + x.w, 0); let acc = 0, med = s[s.length - 1].v;
    for (const x of s) { acc += x.w; if (acc / tot >= 0.5) { med = x.v; break; } }
    const f = 1 + (Number(cma.autoCondition) || 0) / 100, core = cma?.confidence?.core || [0.94, 1.07];
    const r = (v: number) => Math.round(v / 1000) * 1000;
    likely = r(med * f); lo = r(likely * core[0]); hi = r(likely * core[1]); compsN = comps.length;
  }
  const actives = Array.isArray(cma?.actives) ? cma.actives : [];
  const cheaper = actives.filter((a: any) => String(a.mls) !== String(mls) && a.price && listPrice && a.price < listPrice).length;
  const gap = likely && listPrice ? listPrice / likely - 1 : null;
  const suggested = likely ? Math.floor(likely / 10000) * 10000 - 1000 : 0;
  const snapshot = { v: 4, city, mls, address: String(L.address || ph?.address || "MLS® " + mls), listPrice, listedAt, likely, lo, hi, criteria: cma?.criteria || "", activeCount: Number(cma?.activeCount || actives.length || 0),
    subject: { beds: cma?.subject?.beds, baths: cma?.subject?.baths, sqft: cma?.subject?.sqft, year: cma?.subject?.year, lot: cma?.subject?.lot, type: cma?.subject?.type, area: cma?.subject?.area },
    comps: comps.map((c: any) => ({ mls: c.mls, image: c.image, address: c.address, area: c.area, soldDate: c.soldDate, soldPrice: c.soldPrice, sqft: c.sqft, beds: c.beds, year: c.year, distKm: c.distKm, adjusted: c.adjusted })),
    actives: actives.filter((a: any) => String(a.mls) !== String(mls)).map((a: any) => ({ mls: a.mls, image: a.image, address: a.address, area: a.area, price: a.price, sqft: a.sqft, beds: a.beds, year: a.year, listedAt: a.listedAt })) };
  return { snapshot, mls, city, address: String(L.address || ph?.address || "MLS® " + mls), listPrice, listedAt, dom, orig: Number(ph?.originalPrice || 0), likely, lo, hi, compsN, activeCount: Number(cma?.activeCount || actives.length || 0), cheaper, gap, suggested };
}
const kk = (v: number) => (v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000) + "K");

const CHART_ORIGIN = (env("EMAIL_ASSET_ORIGIN") || "https://bc.realestate").replace(/\/$/, "");
// season-line v1: which months listings and sales peak/dip, averaged over up to 2 years (latest preliminary month left out)
const MNL: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
function seasonLine(all: any[]) {
  const hist = all.slice(-25, -1), cal: Record<string, { n: number; s: number; c: number }> = {};
  for (const m of hist) { const k = String(m.label).split(" ")[0]; if (!MNL[k]) continue; const e = (cal[k] ||= { n: 0, s: 0, c: 0 }); e.n += Number(m.newListings) || 0; e.s += Number(m.sales) || 0; e.c++; }
  const ks = Object.keys(cal); if (ks.length < 10) return "";
  const pick = (f: "n" | "s", dir: number) => ks.reduce((b, k) => (dir * (cal[k][f] / cal[k].c - cal[b][f] / cal[b].c) > 0 ? k : b), ks[0]);
  const nHi = pick("n", 1), nLo = pick("n", -1), sHi = pick("s", 1), sLo = pick("s", -1);
  return `${hist.length >= 23 ? "Over the past two years" : "Over the past year"}, new listings peak in ${MNL[nHi]} and are thinnest in ${MNL[nLo]}. ${sHi === nHi ? "Sales peak then too" : `Sales peak in ${MNL[sHi]}`} and are slowest in ${MNL[sLo]}.`;
}
// intel-blocks v1: market intel pieces dropped into emails as [Name · City] lines
const IB = {
  wrap: (title: string, inner: string, foot = "") => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;margin:10px 0;border:1px solid #e4e0d6;border-radius:8px;background:#faf9f6"><tr><td style="padding:14px 16px">${title ? `<div style="font-size:10px;letter-spacing:1px;font-weight:bold;color:#2f4a68;text-transform:uppercase;margin-bottom:8px">${title}</div>` : ""}${inner}${foot ? `<div style="font-size:11px;color:#777777;margin-top:8px">${foot}</div>` : ""}</td></tr></table>`,
  avg: (a: number[]) => { const v = a.filter((x) => x > 0); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; },
  pct: (a: number, b: number) => (a > 0 && b > 0 ? Math.round((a / b - 1) * 1000) / 10 : null),
  arrow: (n: number | null) => (n == null ? "" : `<span style="color:${n >= 0 ? "#2f4a68" : "#b03a2e"}">${n >= 0 ? "&#9650;" : "&#9660;"} ${Math.abs(n)}%</span>`),
  lab: "font-size:10px;letter-spacing:1px;font-weight:bold;color:#777777;text-transform:uppercase",
  T: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"`,
};
const INTEL: Record<string, (P: any) => string> = {
  "Market snapshot": (P) => {
    const mh = P.monthlyHistory || [], L: any = mh.at(-1); if (!L) return "";
    const cell = (l: string, big: string, sub: string, first = false) => `<td width="25%" valign="top" style="padding:4px 8px;${first ? "" : "border-left:1px solid #e6e2d8;"}"><div style="${IB.lab}">${l}</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#1a1a1a;margin:4px 0 2px">${big}</div><div style="font-size:11px;color:#777777">${sub}</div></td>`;
    const cells = [
      cell("Active listings", (() => { const a = Number(L.activeListings || P.liveActiveCount || P.activeCount || P.activeListings || P.ratioActive || 0); return a ? Math.round(a).toLocaleString("en-CA") : "-"; })(), P.monthsOfSupply != null ? `${Number(P.monthsOfSupply).toFixed(1)} months of supply` : L.label, true),
      cell("New listings", String(L.newListings || 0), `in ${L.label}`),
      cell("Sales", String(L.sales || 0), L.saleToList ? `at ${Number(L.saleToList).toFixed(1)}% of asking` : `in ${L.label}`),
      L.medianSoldPrice ? cell("Median price", kk(L.medianSoldPrice), "single-family, sold") : "",
    ].join("");
    return IB.wrap(`${P.cityLabel} market \u00b7 ${L.label}`, `${IB.T}><tr>${cells}</tr></table>`, "The latest month can still fill in as sales are reported.");
  },
  "Market read": (P) => {
    const R = P.marketPulseRead, mh = P.monthlyHistory || [];
    const r3 = mh.slice(-3), p3 = mh.slice(-15, -12);
    const nlA = IB.avg(r3.map((m: any) => m.newListings)), slA = IB.avg(r3.map((m: any) => m.sales));
    const nl = IB.pct(nlA, IB.avg(p3.map((m: any) => m.newListings))), sl = IB.pct(slA, IB.avg(p3.map((m: any) => m.sales)));
    const stat = (l: string, v: number, n: number | null) => `<td width="50%" valign="top" style="padding:4px 8px 4px 0"><div style="${IB.lab}">${l}</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1a1a1a;margin:2px 0">${Math.round(v)} <span style="font-family:Arial,sans-serif;font-size:13px">${IB.arrow(n)}</span></div><div style="font-size:11px;color:#777777">a month, vs. the same 3 months last year</div></td>`;
    const head = R ? `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#1a1a1a">${R.headline}</div><div style="font-size:13px;color:#555555;margin:6px 0 10px">${R.detail}</div>` : "";
    const stats = nlA || slA ? `${IB.T}><tr>${stat("New listings", nlA, nl)}${stat("Sales", slA, sl)}</tr></table>` : "";
    const s = Number(P.salesToActive), mos = P.monthsOfSupply;
    let gauge = "";
    if (s > 0) {
      const pos = Math.max(1, Math.min(96, Math.round((s / 32) * 100)));
      const seg = (w: number, c: string) => `<td width="${w}%" height="8" bgcolor="${c}" style="height:8px;background:${c};font-size:0;line-height:0">&nbsp;</td>`;
      gauge = `<div style="margin-top:12px;font-size:12px;color:#333333"><b>Sales are ${s.toFixed(0)}% of active listings</b>${mos != null ? ` \u00b7 ${Number(mos).toFixed(1)} months of supply` : ""}</div>`
        + `${IB.T} style="margin-top:6px"><tr><td width="${pos}%" style="font-size:0;line-height:0">&nbsp;</td><td style="font-size:12px;line-height:12px;color:#2f4a68">&#9660;</td></tr></table>`
        + `${IB.T}><tr>${seg(37, "#cfdcea")}${seg(26, "#e2ded4")}${seg(37, "#f3dccd")}</tr></table>`
        + `${IB.T}><tr><td width="37%" style="font-size:11px;color:#777777;padding-top:3px">Buyer's market</td><td width="26%" align="center" style="font-size:11px;color:#777777;padding-top:3px">Balanced</td><td width="37%" align="right" style="font-size:11px;color:#777777;padding-top:3px">Seller's market</td></tr></table>`;
    }
    if (!head && !stats && !gauge) return "";
    return IB.wrap(`${P.cityLabel} market read`, head + stats + gauge);
  },
  "Listings vs sales": (P) => {
    const all = P.monthlyHistory || [], mh = all.slice(-12); if (mh.length < 4) return "";
    const prev = all.length >= mh.length + 12 ? all.slice(-mh.length - 12, -12) : [];
    const q = (a: any[], k: string) => a.map((m: any) => Math.round(Number(m[k]) || 0)).join(",");
    const src = `${CHART_ORIGIN}/api/chart/ls.png?n=${q(mh, "newListings")}&s=${q(mh, "sales")}${prev.length ? `&pn=${q(prev, "newListings")}&ps=${q(prev, "sales")}` : ""}`.replace(/&/g, "&amp;");
    const L: any = mh.at(-1);
    const labs = mh.map((m: any) => `<td width="${(100 / mh.length).toFixed(2)}%" align="center" style="font-size:11px;color:#666666;padding-top:6px">${String(m.label).split(" ")[0]}</td>`).join("");
    const legend = `<span style="color:#2f4a68">&#9644;</span> New listings &nbsp;&nbsp; <span style="color:#c07a35">&#9644;</span> Sales${prev.length ? ` &nbsp;&nbsp; <span style="color:#a9b6c8">- - -</span> Same months last year` : ""}`;
    const img = `<img src="${src}" width="508" alt="${P.cityLabel}: ${L.newListings || 0} new listings and ${L.sales || 0} sales in ${L.label}" style="display:block;width:100%;max-width:508px;height:auto;border:0">`;
    return IB.wrap(`${P.cityLabel}: new listings and sales`, `<div style="font-size:12px;color:#555555;margin-bottom:8px">${legend}</div>${img}${IB.T}><tr>${labs}</tr></table>${(() => { const sl = seasonLine(all); return sl ? `<div style="font-size:13px;line-height:1.45;color:#333333;margin-top:10px">${sl}</div>` : ""; })()}`, `Last 12 months, to ${L.label}. The latest month is preliminary.`);
  },
  "Price trend": (P) => {
    const mh = (P.monthlyHistory || []).slice(-24).filter((m: any) => m.medianSoldPrice > 0); if (mh.length < 6) return "";
    const vals = mh.map((m: any) => Number(m.medianSoldPrice)), max = Math.max(...vals), min = Math.min(...vals);
    const base = Math.max(0, Math.floor((min - (max - min) * 0.6 - 1) / 10000) * 10000);
    const ch = IB.pct(vals[vals.length - 1], vals[0]);
    const cols = mh.map((m: any) => { const h = Math.round(12 + (70 * (m.medianSoldPrice - base)) / Math.max(1, max - base)); return `<td valign="bottom" style="padding:0 1px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${h}" bgcolor="#7d8fa8" style="height:${h}px;background:#7d8fa8;font-size:0;line-height:0">&nbsp;</td></tr></table></td>`; }).join("");
    const head = `<div style="font-size:13px;color:#333333;margin-bottom:8px">Median single-family sold price: <b>${kk(vals[0])}</b> in ${mh[0].label} &rarr; <b>${kk(vals[vals.length - 1])}</b> in ${mh.at(-1).label}${ch != null ? ` (${ch >= 0 ? "+" : ""}${ch}%)` : ""}</div>`;
    const ends = `${IB.T}><tr><td style="font-size:9px;color:#888888;padding-top:4px">${mh[0].label}</td><td align="right" style="font-size:9px;color:#888888;padding-top:4px">${mh.at(-1).label}</td></tr></table>`;
    return IB.wrap(`${P.cityLabel} prices`, `${head}${IB.T}><tr style="height:84px">${cols}</tr></table>${ends}`, `Bars start at ${kk(base)}, not zero. Single months bounce around, so the overall direction is what matters.`);
  },
};
async function askSold(sb: any, slug: string, label: string) {
  const keys = [...new Set([slug, label, String(label).toLowerCase(), slug.replace(/-/g, " ")])];
  const { data: comps } = await sb.from("market_indexes").select("ticker").is("prop_type", null).is("area_slug", null).is("parent_ticker", null).in("city", keys).limit(1);
  const tk = comps?.[0]?.ticker; if (!tk) return null;
  const sinceD = new Date(Date.now() - 480 * 864e5).toISOString().slice(0, 10);
  const [{ data: ticks }, { data: months }] = await Promise.all([
    sb.from("market_ticks").select("day, ask_index").eq("ticker", tk).gte("day", sinceD).not("ask_index", "is", null).order("day").limit(1000),
    sb.from("market_months").select("month, sold_index, thin, method").eq("ticker", tk).gte("month", sinceD).order("month").limit(100),
  ]);
  const now = new Date(), ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const thisM = ym(now), prevM = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const F = (months || []).filter((r: any) => { const d = String(r.month).slice(0, 10); return r.sold_index != null && !r.thin && d < thisM && d !== prevM; });
  if (F.some((r: any) => r.method === "median")) return null;
  const ask = (ticks || []).map((x: any) => ({ t: new Date(String(x.day).slice(0, 10) + "T12:00:00").getTime(), v: Number(x.ask_index) }));
  const pts: any[] = [];
  for (const r of F) {
    const d = String(r.month).slice(0, 10), md = new Date(d + "T12:00:00");
    const endT = new Date(md.getFullYear(), md.getMonth() + 1, 1).getTime(), startT = new Date(md.getFullYear(), md.getMonth() - 2, 1).getTime();
    const win = ask.filter((q: any) => q.t >= startT && q.t < endT); if (win.length < 3) continue;
    const a = win.reduce((s: number, q: any) => s + q.v, 0) / win.length, v = Number(r.sold_index);
    if (v > 0) pts.push({ d, s: (a / v - 1) * 100, a, v });
  }
  const out = pts.slice(-12); return out.length >= 2 ? { ticker: tk, pts: out } : null;
}
INTEL["Asking vs sold"] = (P) => {
  const X = P._as; if (!X) return "";
  const pts = X.pts, last = pts[pts.length - 1], prev = pts[Math.max(0, pts.length - 4)];
  const delta = last.s - prev.s, trend = Math.abs(delta) < 0.5 ? "steady" : delta > 0 ? "widening" : "narrowing";
  const askMove = (last.a / prev.a - 1) * 100, soldMove = (last.v / prev.v - 1) * 100;
  const note = trend === "widening" ? (askMove > soldMove ? "sellers asking further above what is selling" : "sale prices slipping below asking")
    : trend === "narrowing" ? (soldMove > askMove ? "sale prices catching up to asking" : "asking prices coming down toward sales") : "asking and sales moving together";
  const arrow = trend === "steady" ? "&rarr;" : trend === "widening" ? "&uarr;" : "&darr;";
  const pill = trend === "narrowing" ? "#1f6b60" : trend === "widening" ? "#b03a2e" : "#777777";
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = (d: string) => `${MN[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;
  const cell = (l: string, v: string, sub: string, first = false) => `<td width="50%" valign="top" style="padding:4px 8px;${first ? "padding-left:0;" : "border-left:1px solid #e6e2d8;"}"><div style="${IB.lab}">${l}</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#1a1a1a;margin:4px 0 2px">${v}</div><div style="font-size:11px;color:#777777">${sub}</div></td>`;
  const top = `${IB.T}><tr>${cell("Asking index", kk(last.a), "what sellers are asking", true)}${cell("Sold index", kk(last.v), `what sold in ${mon(last.d)}`)}</tr></table>`;
  const s = last.s;
  const head = `<div style="margin:12px 0 2px;font-size:14px;color:#1a1a1a"><b>Asking is ${Math.abs(s).toFixed(1)}% ${s >= 0 ? "above" : "below"} sales</b> <span style="color:${pill};font-size:12px">${arrow} ${trend}</span></div><div style="font-size:12px;color:#555555;margin-bottom:8px">${note.charAt(0).toUpperCase() + note.slice(1)}.</div>`;
  const vs = pts.map((q: any) => q.s), lo = Math.min(0, Math.min(...vs)), hi = Math.max(1, Math.max(...vs));
  const cols = pts.map((q: any, i: number) => { const h = Math.max(2, Math.round(6 + (50 * (q.s - lo)) / ((hi - lo) || 1))); const c = i === pts.length - 1 ? "#2f4a68" : "#a9b6c8"; return `<td valign="bottom" style="padding:0 2px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${h}" bgcolor="${c}" style="height:${h}px;background:${c};font-size:0;line-height:0">&nbsp;</td></tr></table></td>`; }).join("");
  const ends = `${IB.T}><tr><td style="font-size:9px;color:#888888;padding-top:4px">${mon(pts[0].d)}</td><td align="right" style="font-size:9px;color:#888888;padding-top:4px">${mon(last.d)}</td></tr></table>`;
  const mean = s > 1 ? `Homes are selling about ${s.toFixed(1)}% below the general asking level, so pricing close to recent sales is what gets homes sold.` : s < -1 ? "Homes are selling above the general asking level, a sign of competition for well-priced listings." : "Homes are selling close to the general asking level.";
  return IB.wrap(`${P.cityLabel}: asking vs sold`, `${top}${head}${IB.T}><tr style="height:58px">${cols}</tr></table>${ends}<div style="font-size:12px;color:#333333;margin-top:8px">${mean}</div>`, "Spread each month: average asking index over 3 months vs. the sold index. Latest month left out until its sales are in.");
};
const INTEL_RE = /^\[(Listing|Market snapshot|Market read|Listings vs sales|Price trend|Asking vs sold) \u00b7 [^\]\n]+\][ \t]*$/gm;
// email-listings v1: [Listing · MLS] lines become listing cards
const LISTING_RE = /\[Listing \u00b7 ([A-Za-z0-9]+)\]/g;
async function withListings(sb: any, html: string, siteId?: string) {
  const ids = [...new Set([...html.matchAll(LISTING_RE)].map((m) => m[1]))];
  if (!ids.length) return html;
  const { data } = await sb.from("listing_rows").select("*").in("mls_number", ids);
  const by = new Map((data || []).map((r: any) => { const h: any = mapListing(r); return [String(h.mls), h]; }));
  let base = "https://bc.realestate";
  try { base = String((await siteBase(sb, siteId)) || base).replace(/\/$/, ""); } catch {}
  return html.replace(LISTING_RE, (_m: string, mls: string) => {
    const h: any = by.get(String(mls)); if (!h) return "";
    const url = listingUrl(base, h.city, h.mls, "");
    const facts = [h.beds ? `${h.beds} bed` : "", h.baths ? `${h.baths} bath` : "", h.sqft ? `${Math.round(h.sqft).toLocaleString("en-CA")} sq ft` : ""].filter(Boolean).join(" \u00b7 ");
    const where = [h.area, h.city].filter(Boolean).join(", ");
    const img = h.image ? `<a href="${url}"><img src="${h.image}" width="540" alt="${escH(String(h.address || ""))}" style="display:block;width:100%;max-width:540px;height:auto;border:0;border-radius:8px 8px 0 0"></a>` : "";
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;margin:10px 0;border:1px solid #e4e0d6;border-radius:8px;background:#ffffff"><tr><td style="padding:0">${img}<div style="padding:12px 16px 14px"><div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a">${fmtPrice(h.price)}</div><div style="font-size:15px;font-weight:bold;color:#1a1a1a;margin-top:2px">${escH(String(h.address || "MLS\u00ae " + h.mls))}</div>${where ? `<div style="font-size:13px;color:#666666">${escH(where)}</div>` : ""}${facts ? `<div style="font-size:13px;color:#333333;margin-top:6px">${facts}</div>` : ""}<a href="${url}" style="display:inline-block;margin-top:10px;background:#1f6b60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 16px;border-radius:6px">View this home &rarr;</a></div></td></tr></table>`;
  });
}
async function withIntel(sb: any, html: string, siteId?: string) {
  html = await withListings(sb, html, siteId);
  const re = /\[(Market snapshot|Market read|Listings vs sales|Price trend|Asking vs sold) \u00b7 ([^\]<]+)\]/g;
  const found = [...html.matchAll(re)]; if (!found.length) return html;
  const slugOf = (c: string) => String(c).toLowerCase().trim().replace(/\s+/g, "-");
  const cache: Record<string, any> = {};
  for (const m of found) { const s = slugOf(m[2]); if (!(s in cache)) { try { { const P0: any = await getMarketPulse(sb, s); cache[s] = P0 ? { ...P0, monthlyHistory: (P0.monthlyHistory || []).map((m: any) => ({ ...m, label: String(m.label || "").replace(/^([A-Za-z]{3,9}) '?(\d{2})$/, "$1 20$2") })) } : P0; } } catch (e) { console.error("intel pulse failed", s, e); cache[s] = null; } } }
  for (const m of found) { const P = cache[slugOf(m[2])]; if (m[1] === "Asking vs sold" && P && P._as === undefined) { try { P._as = await askSold(sb, slugOf(m[2]), P.cityLabel); } catch (e) { console.error("asking vs sold failed", e); P._as = null; } } }
  return html.replace(re, (_a: string, name: string, city: string) => { const P = cache[slugOf(city)]; if (!P) return ""; try { return INTEL[name]?.(P) || ""; } catch (e) { console.error("intel block failed", name, e); return ""; } });
}
export const GET: APIRoute = async ({ url, locals, request }) => {
  try {
    const siteId = String(url.searchParams.get("site_id") || ""), key = String(url.searchParams.get("key") || "");
    const c: any = await load(locals, siteId, key);
    if (c.error) return json({ ok: false, error: c.error }, c.status);
    const { site, people, p, d } = c;
    const sb = sbAdmin();
    let seller: any = null;
    if (p.listingMls) { try { seller = await sellerCtx(request, sb, String(p.listingMls)); } catch (e) { console.error("seller ctx failed", e); } }
    const first = /@/.test(p.name) ? "there" : String(p.name).trim().split(/\s+/)[0];
    const rawCity = String(seller?.city || p.mainCity || d.leads?.[0]?.city || d.sessions?.[0]?.city || (site as any)?.city || "nanaimo");
    const city = rawCity.toLowerCase().trim().replace(/\s+/g, "-");
    let pulse: any = null;
    try { pulse = await getMarketPulse(sb, city); } catch (e) { console.error("pulse failed", e); }
    const area = pulse?.cityLabel || rawCity.replace(/\b\w/g, (x: string) => x.toUpperCase());
    let base = "";
    try { base = String((await siteBase(sb, siteId)) || "").replace(/\/$/, ""); } catch {}
    const reportUrl = base ? `${base}/${city}/market-intelligence` : "";
    let since: any = null;
    if (p.boughtPrice && p.boughtMonth) {
      try {
        const origin = new URL(request.url).origin, cookie = request.headers.get("cookie") || "";
        const q = (ty: string) => fetch(`${origin}/admin/api/cma?city=${encodeURIComponent(city)}&since=${encodeURIComponent(p.boughtMonth)}&price=${Math.round(p.boughtPrice)}${ty ? `&type=${encodeURIComponent(ty)}` : ""}`, { headers: { cookie } }).then((r) => r.json()).catch(() => null);
        let sj: any = await q(String(p.boughtType || "house"));
        if (!sj || sj.error) sj = await q("");
        if (sj && !sj.error && sj.value) since = sj;
      } catch (e) { console.error("since-purchase failed", e); }
    }
    const monL = (m: string) => new Date(String(m).slice(0, 7) + "-15T12:00:00").toLocaleDateString("en-CA", { month: "long", year: "numeric" });
    const sinceLine = since ? `\n\u2022 You bought in ${monL(p.boughtMonth)} for ${money(p.boughtPrice)}. The market has moved ${since.change >= 0 ? "up" : "down"} ${Math.abs(since.change)}% since, about ${money(since.value)} in today's terms` : "";
    let reportLink = "";
    if (seller && seller.likely) {
      try {
        const since24 = new Date(Date.now() - 864e5).toISOString();
        const { data: ex } = await sb.from("cma_reports").select("id").eq("site_id", siteId).eq("mls", seller.mls).eq("data->>v", "4").gte("created_at", since24).order("created_at", { ascending: false }).limit(1);
        let rid = ex?.[0]?.id;
        if (!rid) {
          const agent = await agentFor(sb, siteId);
          const { data: ins, error: insErr } = await sb.from("cma_reports").insert({ site_id: siteId, mls: seller.mls, person_key: p.key, data: { ...seller.snapshot, since: since ? { price: p.boughtPrice, month: p.boughtMonth, value: since.value, change: since.change, ticker: since.ticker, asOf: since.asOf } : null, read: pulse?.marketPulseRead || null, areaLabel: area, agent, generatedAt: new Date().toISOString() } }).select("id").single();
          if (insErr) console.error("cma_reports insert failed:", insErr.message);
          rid = ins?.id;
        }
        if (rid && base) { const gk = (n: number) => Math.round((Number(n) || 0) / 1000); const gc = (seller.snapshot?.comps || []).map((c: any) => gk(c.adjusted)).filter((n: number) => n > 0).slice(0, 8); reportLink = `${base}/report/${rid}?g=${[gk(seller.listPrice), gk(seller.likely), gk(seller.suggested), ...gc].join("_")}`; }
      } catch (e) { console.error("report snapshot failed", e); }
    }
    const loves = (d.reactions || []).filter((r: any) => r.decision === "love").sort((a: any, b: any) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    const partner: any = p.partnerKey ? people.find((x: any) => x.keys.includes(p.partnerKey)) : null;
    const pFirst = partner && !/@/.test(partner.name) ? String(partner.name).trim().split(/\s+/)[0] : "";
    const hi = `Hi ${first}${pFirst ? ` and ${pFirst}` : ""},`;
    const owner = ["closed", "past"].includes(p.stage);
    const ideas: any[] = [];

    const latest: any = pulse?.monthlyHistory?.at(-1);
    if (pulse && latest) {
      const lines = [
        latest.medianSoldPrice > 0 ? `\u2022 Typical single-family price: ${money(latest.medianSoldPrice)} (${latest.label})` : "",
        pulse.salesRollingAverage ? `\u2022 Sales: about ${Math.round(pulse.salesRollingAverage)} a month lately${pulse.salesYoY != null ? `, ${pulse.salesYoY >= 0 ? "up" : "down"} ${Math.abs(pulse.salesYoY).toFixed(0)}% on last year` : ""}` : "",
        pulse.daysOnMarketRollingAverage ? `\u2022 Days on market: about ${Math.round(pulse.daysOnMarketRollingAverage)}${pulse.daysOnMarketContext ? `, ${pulse.daysOnMarketContext}` : ""}` : "",
        pulse.saleToListRollingAverage ? `\u2022 Homes are selling at about ${Number(pulse.saleToListRollingAverage).toFixed(1)}% of asking` : "",
      ].filter(Boolean);
      const read = pulse.marketPulseRead;
      ideas.push({ id: "market", icon: "📈", label: `${area} market update`, why: read?.headline || "Latest numbers from your market data",
        subject: `${area} market update`,
        body: `${hi}\n\nHere's a quick read on the ${area} market.\n\n${read ? `${read.headline} ${read.detail}\n\n` : ""}${lines.length ? `The numbers:\n${lines.join("\n")}\n\n` : ""}${reportUrl ? `Full report: ${reportUrl}\n\n` : ""}${owner ? "Curious what this means for your home's value? Just reply and I'll put together a quick estimate." : "If you'd like to know what this means for a specific home or price range, just reply."}` });
    }

    {
      const R: any = RATES;
      const verb = R.lastChange === "up" ? `raised its policy rate by ${R.changePoints} points to ${R.policyRate}%` : R.lastChange === "down" ? `cut its policy rate by ${R.changePoints} points to ${R.policyRate}%` : `held its policy rate at ${R.policyRate}%`;
      const varLine = R.lastChange === "up" ? "Variable-rate mortgages and lines of credit follow prime, so those payments go up." : R.lastChange === "down" ? "Variable-rate mortgages and lines of credit follow prime, so those payments come down." : "Variable-rate payments stay where they are for now.";
      ideas.push({ id: "rates", icon: "🏦", label: "Rates and financing", why: `Bank of Canada ${R.lastChange === "hold" ? "held" : R.lastChange === "up" ? "raised" : "cut"} on ${nice(R.announcedOn)}`,
        subject: R.lastChange === "hold" ? "Rates are on hold: what it means for you" : `Rates just went ${R.lastChange}: what it means for you`,
        body: `${hi}\n\nA quick heads-up on rates. On ${nice(R.announcedOn)} the Bank of Canada ${verb}.${R.note ? ` ${R.note}` : ""}\n\nWhat it means for you:\n\u2022 ${varLine}\n\u2022 Fixed rates follow bond yields, not the Bank's rate, so they don't move in lockstep. It's worth checking current offers before you commit.\n\u2022 ${owner ? "If your mortgage renews in the next year, it's a good time to start comparing options." : "If you have a pre-approval, check when it expires. Most hold a rate for 90 to 120 days."}\n\nThe next decision is ${nice(R.nextDecision)}. If it helps, I can connect you with a mortgage broker for a quick, no-obligation rate check.` });
    }

    if (seller) {
      const S = seller, dd = S.dom != null ? `${S.dom} days on the market` : "";
      const pctGap = S.gap != null ? Math.round(S.gap * 100) : null;
      const sread = pulse?.marketPulseRead;
      const short = String(S.address).split(",")[0];
      if (S.likely && pctGap != null && pctGap >= 2 && S.suggested && S.suggested < S.listPrice) {
        ideas.push({ id: "price", icon: "📉", label: `Pricing check: ${short}`, why: `Asking ~${pctGap}% above the CMA${S.dom != null ? ` · ${S.dom} days listed` : ""}`,
          subject: `${short}: where we stand and a pricing idea`,
          body: `${hi}\n\nI wanted to give you an honest update on ${short} and how it sits in today's market.\n\nWhere we are:\n\u2022 Listed at ${money(S.listPrice)}${dd ? `, ${dd}` : ""}${S.orig > S.listPrice ? ` (down from ${money(S.orig)})` : ""}${sinceLine}\n\u2022 ${S.activeCount} similar homes are for sale right now${S.cheaper ? `, and ${S.cheaper} of the closest matches are priced below ours` : ""}\n\nWhat recent sales tell us:\n\u2022 I ran a fresh valuation from ${S.compsN} comparable sales nearby, adjusted for size, lot, age and today's market.\n\u2022 It points to a likely value around ${money(S.likely)}, with similar homes mostly selling between ${kk(S.lo)} and ${kk(S.hi)}.\n\u2022 Our asking price is about ${pctGap}% above that.${sread ? `\n\u2022 Across ${area}: ${sread.headline} ${sread.detail}` : ""}\n\nMy recommendation:\nAn adjustment to ${money(S.suggested)} would put us in line with what buyers are paying now. A new price also puts the home in front of buyers whose searches stopped below our current price, and it shows up as a price change in their alerts.${reportLink ? `\n\nHere are the comparable sales I used, so you can see exactly where the numbers come from: ${reportLink}` : ""}\n\nI'd like to walk you through the comparable sales. Do you have 15 minutes this week for a call or a coffee?` });
      }
      else if (S.likely && pctGap != null) {
        ideas.push({ id: "price", icon: "\u{1F4CA}", label: `Pricing check: ${short}`, why: pctGap <= -2 ? `Asking ~${Math.abs(pctGap)}% below the CMA` : "Asking is in line with the CMA",
          subject: `${short}: how our price compares`,
          body: `${hi}\n\nI ran a fresh check on ${short} against today's market, and our price is in a good spot.\n\nWhere we are:\n\u2022 Listed at ${money(S.listPrice)}${dd ? `, ${dd}` : ""}${sinceLine}\n\u2022 ${S.activeCount} similar homes are for sale right now${S.cheaper ? `, and ${S.cheaper} of the closest matches are priced below ours` : ""}\n\nWhat recent sales tell us:\n\u2022 ${S.compsN} comparable sales nearby, adjusted for size, lot, age and today's market, point to a likely value around ${money(S.likely)}.\n\u2022 Similar homes have mostly sold between ${kk(S.lo)} and ${kk(S.hi)}.\n\u2022 ${pctGap <= -2 ? `Our asking price is about ${Math.abs(pctGap)}% below that, so we're priced to attract buyers.` : "Our asking price sits right in line with that."}${sread ? `\n\u2022 Across ${area}: ${sread.headline} ${sread.detail}` : ""}\n\nWhat that means:\nPrice isn't what's holding us back. ${S.dom != null && S.dom > 21 ? `After ${S.dom} days, the focus is on getting more of the right buyers through the door:` : "The focus now is on getting the right buyers through the door:"} fresh photos or a new lead photo, re-sharing it with buyers searching in this range, and an open house.${reportLink ? `\n\nHere are the comparable sales I used: ${reportLink}` : ""}\n\nDo you have time this week to talk through next steps?` });
      }
      ideas.push({ id: "sellerupdate", icon: "🏷", label: "Seller check-in", why: dd ? `Listed ${dd}` : "Keep them in the loop", subject: `Update on ${short}`,
        body: `${hi}\n\nA quick update on ${short}${dd ? `, now ${dd}` : ""}.\n\n\u2022 There are ${S.activeCount} similar homes for sale right now.${S.likely ? `\n\u2022 Recent comparable sales point to a likely value around ${money(S.likely)}.` : ""}${sread ? `\n\u2022 Across ${area}: ${sread.headline}` : ""}\n\nI'll keep you posted on showings and feedback. Is there anything you'd like me to change or try?` });
    }
    if (since) {
      const tl = p.boughtType === "townhouse" ? "townhouse" : p.boughtType === "apartment" ? "condo" : "home";
      const sread = pulse?.marketPulseRead;
      ideas.push({ id: "since", icon: "🏠", label: "Your home since you bought", why: `${since.change >= 0 ? "+" : "−"}${Math.abs(since.change)}% since ${monL(p.boughtMonth)}`,
        subject: `What's happened to ${area} ${tl} values since you bought`,
        body: `${hi}\n\nI was looking at the ${area} market and thought you'd find this interesting.\n\nWhen you bought in ${monL(p.boughtMonth)}, you paid ${money(p.boughtPrice)}. Since then, ${area} ${tl} prices have moved ${since.change >= 0 ? "up" : "down"} ${Math.abs(since.change)}% on the local sold-price index, which would put that same purchase at about ${money(since.value)} today.\n\nThat's a market-movement figure, not a valuation of your home: updates, condition and the lot all make a difference. If you'd like a proper estimate, I'm happy to put one together, no pressure.${sread ? `\n\nWhere the market is right now: ${sread.headline} ${sread.detail}` : ""}` });
    }
    if (loves.length) {
      const addr = String(loves[0].address || "the home you liked");
      const more = loves.length - 1;
      ideas.push({ id: "loved", icon: "🏡", label: "The home they loved", why: addr + (more > 0 ? ` (+${more} more)` : ""),
        subject: `Still thinking about ${addr}?`,
        body: `${hi}\n\nI noticed you liked ${addr}${more > 0 ? ` and ${more} other home${more > 1 ? "s" : ""}` : ""}. Would you like to see it in person? I can also pull recent sales nearby so you can see how it's priced.\n\nHappy to help either way.` });
    }

    ideas.push(owner
      ? { id: "checkin", icon: "👋", label: "Friendly check-in", why: "Past client: keep in touch", subject: "How's the house?", body: `${hi}\n\nIt's been a while, so I wanted to check in. How are you enjoying the home?\n\nIf you ever need a trade referral or a value estimate, or have friends thinking about a move, I'm always happy to help.` }
      : { id: "checkin", icon: "👋", label: "Simple check-in", why: "Short and low-pressure", subject: "Checking in", body: `${hi}\n\nJust checking in to see how your home search is going in ${area}. Has anything changed in what you're looking for, like area, budget or timing?\n\nIf it helps, I can send a short list of homes that fit, or set up an alert so new listings come to you first.` });

    if (owner && latest?.medianSoldPrice > 0) ideas.push({ id: "value", icon: "💰", label: "Home value check", why: "Past client: what's my home worth?", subject: `What homes in ${area} are selling for`, body: `${hi}\n\nHomes in ${area} have been selling for a typical ${money(latest.medianSoldPrice)} (single-family, ${latest.label}).\n\nIf you're curious what yours might be worth today, I can put together a quick, no-pressure estimate. Just reply.` });

    const bd = daysUntil(p.birthday);
    if (bd != null) ideas.push({ id: "birthday", icon: "🎂", label: "Birthday wishes", why: bd === 0 ? "Birthday is today" : bd < 0 ? "Birthday was yesterday" : `Birthday in ${bd} day${bd === 1 ? "" : "s"}`, subject: `Happy birthday, ${first}!`, body: `Hi ${first},\n\nHappy birthday! Hope it's a great one.\n\nNo business, just wanted to say it.` });
    const pbd = partner ? daysUntil(partner.birthday) : null;
    if (pbd != null && pFirst) ideas.push({ id: "pbirthday", icon: "🎂", label: `${pFirst}'s birthday`, why: pbd === 0 ? "Today" : pbd < 0 ? "Yesterday" : `In ${pbd} day${pbd === 1 ? "" : "s"}`, subject: `Happy birthday to ${pFirst}!`, body: `Hi ${first},\n\nI hear it's ${pFirst}'s birthday${pbd === 0 ? " today" : pbd < 0 ? "" : " coming up"}. Please pass along my best wishes!\n\nHope you're both doing well.` });

    ideas.sort((a, b) => (ORDER[a.id] ?? 9) - (ORDER[b.id] ?? 9));
    try {
      const { data: pls } = await sb.from("crm_plans").select("id, name").eq("site_id", siteId).order("name");
      const pids = (pls || []).map((x: any) => x.id);
      if (pids.length) {
        const { data: pst } = await sb.from("crm_plan_steps").select("id, plan_id, position, subject, body").in("plan_id", pids).order("position");
        const ag = await agentFor(sb, siteId);
        const mv: Record<string, string> = { hi, first_name: first, names: first + (pFirst ? ` and ${pFirst}` : ""), city: area, city_report: reportUrl, loved_home: String(loves[0]?.address || "the homes you saved"), agent_name: ag.agentName, agent_first: String(ag.agentName).split(/\s+/)[0] };
        const mg = (s: string) => String(s || "").replace(/\{(\w+)\}/g, (m: string, k: string) => (k in mv ? mv[k] : m));
        for (const pl of pls || []) { const ss = (pst || []).filter((s: any) => s.plan_id === pl.id); ss.forEach((s: any, i: number) => ideas.push({ id: "plan:" + s.id, group: "From your plans", icon: "\u{1F4CB}", label: mg(s.subject), why: `${pl.name} \u00b7 email ${i + 1} of ${ss.length}`, subject: mg(s.subject), body: mg(s.body) })); }
      }
    } catch (e) { console.error("plan ideas failed", e); }
    let context = "";
    if (seller) {
      const S = seller, last = p.lastAgentTouch ? Math.round((Date.now() - p.lastAgentTouch) / 864e5) : null;
      context = `🏷 Selling ${String(S.address).split(",")[0]} · asking ${money(S.listPrice)}${S.dom != null ? ` · ${S.dom} days on market` : ""}` +
        (S.likely ? `\nCMA likely ${money(S.likely)} · asking is ${Math.abs(Math.round(S.gap * 100))}% ${S.gap >= 0 ? "above" : "below"} it` : "") +
        `\nLast contact: ${last == null ? "none logged" : last === 0 ? "today" : last + " day" + (last === 1 ? "" : "s") + " ago"}` +
        (S.gap != null && S.gap >= 0.02 ? "\nA pricing conversation is due." : "\nKeep them posted on the market.");
    }
    { const IDEF: Record<string, string[]> = { market: ["Market snapshot", "Market read", "Listings vs sales"], price: ["Market read", "Asking vs sold"], sellerupdate: ["Market snapshot", "Market read", "Asking vs sold"], value: ["Price trend", "Market read"], since: ["Price trend", "Market read"], loved: ["Market snapshot", "Market read"], checkin: ["Market snapshot", "Market read"], rates: ["Price trend"] }; if (pulse) for (const it of ideas as any[]) { const bl = IDEF[it.id]; if (bl && it.body) it.body = String(it.body).trimEnd() + "\n\n" + bl.map((x) => `[${x} \u00b7 ${area}]`).join("\n"); } }
    return json({ ok: true, ideas, area, context });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Couldn't build ideas" }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b: any = await request.json().catch(() => ({}));
    const siteId = String(b.site_id || ""), key = String(b.key || "");
    const c: any = await load(locals, siteId, key);
    if (c.error) return json({ ok: false, error: c.error }, c.status);
    const { p, d } = c;
    const to = String(b.to || "").trim().toLowerCase();
    const subject = String(b.subject || "").trim().slice(0, 200);
    const text = String(b.body || "").trim().slice(0, 8000);
    if (!to || !subject || !text) return json({ ok: false, error: "Add a subject and message" }, 400);
    if (!p.emails.map((e: string) => e.toLowerCase()).includes(to)) return json({ ok: false, error: "That address isn't on this contact" }, 403);

    const sb = sbAdmin();
    const agent = await agentFor(sb, siteId);
    const rkey = env("RESEND_API_KEY");
    if (!rkey) return json({ ok: false, error: "RESEND_API_KEY is not set" }, 500);
    const senderDomain = (env("SENDER_ADDRESS") || "notify@bc.realestate").split("@")[1] || "bc.realestate";
    const localPart = agent.agentName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/\s+/)[0].replace(/[^a-z0-9]/g, "") || "notify";
    const from = `${agent.agentName.replace(/["<>]/g, "").trim() || "Your agent"} <${localPart}@${senderDomain}>`;
    const sig = [agent.agentName, agent.brokerage || env("LEAD_BROKERAGE"), agent.agentEmail].filter(Boolean).join("\n");
    let unUrl = ""; try { unUrl = unsubUrl(String((await siteBase(sb, siteId)) || ""), siteId, p.key); } catch {}
    const optLead = `You're receiving this because you've been in touch with ${agent.agentName}.`;
    const optout = `${optLead} Unsubscribe: ${unUrl}`;
    const plain = `${text.replace(INTEL_RE, "").replace(/\n{3,}/g, "\n\n").trim()}\n\n--\n${sig}\n\n${optout}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${await withIntel(sb, toHtml(text), siteId)}<br><br><div style="color:#555;font-size:13px">${toHtml(sig)}</div><div style="color:#999;font-size:12px;margin-top:16px">${escH(optLead)} <a href="${unUrl}" style="color:#999">Unsubscribe</a></div></div>`;

    if (b.preview) return json({ ok: true, html });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${rkey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: plain, html, reply_to: replyTo(siteId, agent.agentEmail), headers: unUrl ? { "List-Unsubscribe": `<${unUrl}>` } : undefined }),
    });
    const out: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: out?.message || "Email send failed" }, 502);
    if (b.drip_send_id && UUID.test(String(b.drip_send_id))) await closeDripSend(sb, siteId, String(b.drip_send_id), "sent", { subject, body: text });

    const { error: logErr } = await sb.from("session_messages").insert({
      session_id: p.sessionIds[0] || null, site_id: siteId, lead_id: d.leads?.[0]?.id || null, channel: "email",
      message_type: TYPE_OF[String(b.idea || "")] || null, to_email: to, subject, body: text,
      provider_id: out?.id || null, sent_by: agent.agentEmail || null,
    });
    if (logErr) {
      console.error("session_messages insert failed, logging as note:", logErr.message);
      await sb.from("crm_notes").insert({ site_id: siteId, person_key: p.key, body: `Emailed "${subject}"\n\n${text}`, kind: "note", created_by: String(locals?.adminAccess?.userId || "") });
    }
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Send failed" }, 500);
  }
};
export { toHtml, withIntel, agentFor, INTEL_RE };
