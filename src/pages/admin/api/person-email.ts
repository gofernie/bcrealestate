// crm-v4: email composer for one person. GET = ready-to-edit ideas, POST = send + log to timeline
import type { APIRoute } from "astro";
import { sbAdmin, loadPeople } from "../../../lib/crm";
import { getMarketPulse } from "../../../lib/marketPulse";
import { siteBase } from "../../../lib/sessionHomes";
import { RATES } from "../../../lib/rates";
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
    const rawCity = String(seller?.city || d.leads?.[0]?.city || d.sessions?.[0]?.city || (site as any)?.city || "nanaimo");
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
    let context = "";
    if (seller) {
      const S = seller, last = p.lastAgentTouch ? Math.round((Date.now() - p.lastAgentTouch) / 864e5) : null;
      context = `🏷 Selling ${String(S.address).split(",")[0]} · asking ${money(S.listPrice)}${S.dom != null ? ` · ${S.dom} days on market` : ""}` +
        (S.likely ? `\nCMA likely ${money(S.likely)} · asking is ${S.gap >= 0 ? "" : "−"}${Math.abs(Math.round(S.gap * 100))}% ${S.gap >= 0 ? "above" : "below"} it` : "") +
        `\nLast contact: ${last == null ? "none logged" : last === 0 ? "today" : last + " day" + (last === 1 ? "" : "s") + " ago"}` +
        (S.gap != null && S.gap >= 0.02 ? "\nA pricing conversation is due." : "\nKeep them posted on the market.");
    }
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
    const optout = `You're receiving this because you've been in touch with ${agent.agentName}. Reply "unsubscribe" and I won't email you again.`;
    const plain = `${text}\n\n--\n${sig}\n\n${optout}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${toHtml(text)}<br><br><div style="color:#555;font-size:13px">${toHtml(sig)}</div><div style="color:#999;font-size:12px;margin-top:16px">${toHtml(optout)}</div></div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${rkey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: plain, html, reply_to: agent.agentEmail }),
    });
    const out: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: out?.message || "Email send failed" }, 502);

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