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
function linkOrButton(u: string) {
  const m = u.match(/\/([a-z0-9-]+)\/market-intelligence/i);
  if (!m) return `<a href="${u}" style="color:#1f6b60">${u}</a>`;
  const city = m[1].replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
  return `<br><a href="${u}" style="display:inline-block;margin-top:8px;background:#1f6b60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 18px;border-radius:6px">See the ${city} market report &rarr;</a>`;
}
const toHtml = (t: string) => escH(t).replace(/https?:\/\/[^\s<]+/g, (u) => linkOrButton(u)).replace(/^[ \t]*\u2022[ \t]*/gm, "&nbsp;&nbsp;&nbsp;&bull;&nbsp;").replace(/\n/g, "<br>");
const money = (n: number) => (n > 0 ? "$" + Math.round(n).toLocaleString("en-CA") : "");
const nice = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-CA", { month: "long", day: "numeric" });
const TYPE_OF: Record<string, string> = { market: "market", rates: "financing", loved: "homes", checkin: "checkin", value: "market" };
const ORDER: Record<string, number> = { birthday: 0, pbirthday: 1, loved: 2, market: 3, rates: 4, value: 5, checkin: 6 };

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

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const siteId = String(url.searchParams.get("site_id") || ""), key = String(url.searchParams.get("key") || "");
    const c: any = await load(locals, siteId, key);
    if (c.error) return json({ ok: false, error: c.error }, c.status);
    const { site, people, p, d } = c;
    const sb = sbAdmin();
    const first = /@/.test(p.name) ? "there" : String(p.name).trim().split(/\s+/)[0];
    const rawCity = String(d.leads?.[0]?.city || d.sessions?.[0]?.city || (site as any)?.city || "nanaimo");
    const city = rawCity.toLowerCase().trim().replace(/\s+/g, "-");
    let pulse: any = null;
    try { pulse = await getMarketPulse(sb, city); } catch (e) { console.error("pulse failed", e); }
    const area = pulse?.cityLabel || rawCity.replace(/\b\w/g, (x: string) => x.toUpperCase());
    let base = "";
    try { base = String((await siteBase(sb, siteId)) || "").replace(/\/$/, ""); } catch {}
    const reportUrl = base ? `${base}/${city}/market-intelligence` : "";
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
    return json({ ok: true, ideas, area });
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