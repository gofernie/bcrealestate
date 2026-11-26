// crm-plans v1: email plans (drips). Starter plans, person-panel data, the daily runner and sending.
import { sbAdmin, loadPeople, todayStr, fuText, syncNextFollowup, closeDripSend } from "./crm";
import { siteBase } from "./sessionHomes";
import { toHtml, withIntel, agentFor, INTEL_RE } from "../pages/admin/api/person-email";
import { unsubUrl } from "./unsub";

const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const escH = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const D = "\u00b7", B = "\u2022";
const nowIso = () => new Date().toISOString();
export const addDays = (d: string, n: number) => { const x = new Date(String(d).slice(0, 10) + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const L = (...lines: string[]) => lines.join("\n");
const ib = (n: string) => `[${n} ${D} {city}]`;

export const MERGE_HELP: [string, string][] = [
  ["{hi}", "Hi Fred and Sally,"], ["{first_name}", "Fred"], ["{names}", "Fred and Sally"], ["{city}", "City from their latest enquiry"],
  ["{city_report}", "Link to that city's market report"], ["{loved_home}", "The last home they loved"], ["{agent_name}", "Your full name"], ["{agent_first}", "Your first name"],
];

const R = "review";
export const STARTER_PLANS = [
  { name: "New buyer lead", description: "For new enquiries. Six emails over about six weeks.", stop_when_closed: true, steps: [
    { day_offset: 0, mode: R, subject: "Your {city} home search", body: L("{hi}", "", "Thanks for getting in touch. I'm {agent_first}, and I'll be your local contact for {city}.", "", "To point you at the right homes, it helps to know three things:", `${B} Which areas you like (or want to avoid)`, `${B} Your price range`, `${B} When you're hoping to move`, "", "Just hit reply with whatever you know so far. Rough answers are fine.") },
    { day_offset: 2, mode: R, subject: "What the {city} market is doing right now", body: L("{hi}", "", "Here's a quick read on {city}, so you know what you're walking into.", "", ib("Market read"), "", "Full report: {city_report}", "", "If anything in there surprises you, reply and I'll explain what it means for your price range.") },
    { day_offset: 5, mode: R, subject: "Get new listings the day they hit the market", body: L("{hi}", "", "The best homes in {city} often go in the first week. If you'd like, I can set up an alert so new listings that fit come straight to you the day they're listed.", "", "Reply with your must-haves and I'll set it up today.") },
    { day_offset: 10, mode: R, subject: "A few questions buyers usually ask me", body: L("{hi}", "", "A few things buyers usually ask me early on:", "", `${B} Should I get pre-approved first? Yes. It tells you your real budget and makes your offer stronger.`, `${B} How do offers work here? Most offers in BC include conditions (called subjects), like financing and inspection, with a few days to remove them.`, `${B} What does it cost to buy? Budget for property transfer tax, legal fees and an inspection on top of your down payment. First-time buyers may qualify for an exemption.`, "", "Happy to walk you through any of it, no obligation.") },
    { day_offset: 21, mode: R, subject: "Still looking in {city}?", body: L("{hi}", "", "Just checking in. Has anything changed in what you're looking for, like area, budget or timing?", "", "If you'd like to see something in person, I'm happy to book a showing.") },
    { day_offset: 45, mode: R, subject: "{city} market snapshot", body: L("{hi}", "", "Here's the latest from {city}.", "", ib("Market snapshot"), ib("Price trend"), "", "Whenever you're ready to take a closer look at something, just reply.") },
  ] },
  { name: "Quiet buyer", description: "For leads who've gone quiet. A light touch once a month for four months.", stop_when_closed: true, steps: [
    { day_offset: 0, mode: R, subject: "Still thinking about {city}?", body: L("{hi}", "", "It's been a little while, so I wanted to check in. No pressure at all. If your plans have changed or you're taking a break from looking, that's completely fine.", "", "If you're still keeping an eye on {city}, I'll send a short market update once a month.") },
    { day_offset: 30, mode: R, subject: "{city} this month", body: L("{hi}", "", "Here's this month's quick look at {city}.", "", ib("Market snapshot"), "", "If a particular home catches your eye, send it my way and I'll pull recent sales nearby.") },
    { day_offset: 60, mode: R, subject: "Are prices moving in {city}?", body: L("{hi}", "", "A lot of people ask me whether now's a good time. Here's what prices have actually been doing:", "", ib("Price trend"), ib("Asking vs sold"), "", "Happy to talk through what it means for you.") },
    { day_offset: 90, mode: R, subject: "Checking in", body: L("{hi}", "", "Just a quick check-in. Are you still thinking about a move? If so, tell me what's changed and I'll send a few homes that fit.", "", "If not, no worries. I'm here whenever you need me.") },
  ] },
  { name: "Past client", description: "Start it on closing day. Stays in touch through the first year.", steps: [
    { day_offset: 14, mode: R, subject: "Settling in?", body: L("{hi}", "", "How's the move going? I hope you're settling in well.", "", "If you need a trade (plumber, electrician, painter, cleaner), let me know. I've got a list of people I trust.") },
    { day_offset: 90, mode: R, subject: "How the {city} market has moved since you bought", body: L("{hi}", "", "I thought you'd like a quick look at the {city} market since you bought.", "", ib("Market read"), "", "If you're ever curious what your home might be worth, I'm happy to put together a quick estimate.") },
    { day_offset: 180, mode: R, subject: "Six months in", body: L("{hi}", "", "Hard to believe it's been six months. I hope the place is feeling like home.", "", "Here's where {city} prices sit right now:", "", ib("Price trend"), "", "And if friends or family are thinking about a move, I'd be grateful for the introduction.") },
    { day_offset: 365, mode: R, subject: "One year in your home", body: L("{hi}", "", "Happy one year in your home!", "", "If you'd like an updated value estimate, or have questions about property taxes or your mortgage renewal, just reply. Always happy to help.") },
  ] },
  { name: "Quarterly market update", description: "For your sphere and past clients. One market update every three months for a year.", steps: [0, 90, 180, 270].map((d) => (
    { day_offset: d, mode: R, subject: "{city} market update", body: L("{hi}", "", "Your quarterly look at the {city} market.", "", ib("Market snapshot"), ib("Market read"), "", "Full report: {city_report}", "", "Questions about your home or a move? Just reply.") })) },
];

// ---- plans page ----
export async function loadPlans(siteId: string) {
  const sb = sbAdmin();
  const { data: pl } = await sb.from("crm_plans").select("*").eq("site_id", siteId).order("name");
  const ids = (pl || []).map((x: any) => x.id);
  if (!ids.length) return [];
  const [{ data: st }, { data: en }] = await Promise.all([
    sb.from("crm_plan_steps").select("*").in("plan_id", ids).order("position"),
    sb.from("crm_plan_enrollments").select("plan_id, status").in("plan_id", ids),
  ]);
  return (pl || []).map((p: any) => {
    const steps = (st || []).filter((s: any) => s.plan_id === p.id).map((s: any) => ({ day_offset: s.day_offset, subject: s.subject, body: s.body, mode: s.mode }));
    return { id: p.id, name: p.name, description: p.description || "", stop_when_closed: !!p.stop_when_closed, steps, days: steps.reduce((m: number, s: any) => Math.max(m, s.day_offset), 0), active: (en || []).filter((e: any) => e.plan_id === p.id && e.status === "active").length };
  });
}

// ---- person page panel ----
export async function planPanelData(siteId: string, keys: string[], person: any = null, pd: any = null) {
  const sb = sbAdmin();
  const { data: plans } = await sb.from("crm_plans").select("id, name").eq("site_id", siteId).order("name");
  const ids = (plans || []).map((x: any) => x.id);
  const none = { data: [] as any[] };
  const [st, en, rd, mt]: any[] = await Promise.all([
    ids.length ? sb.from("crm_plan_steps").select("plan_id, position, day_offset, subject").in("plan_id", ids).order("position") : none,
    sb.from("crm_plan_enrollments").select("*").eq("site_id", siteId).in("person_key", keys).order("created_at", { ascending: false }),
    sb.from("crm_drip_sends").select("id, enrollment_id, subject, body, error, created_at").eq("site_id", siteId).in("person_key", keys).eq("status", "ready").order("created_at"),
    sb.from("crm_people").select("email_optout, consent_express_on").eq("site_id", siteId).in("person_key", keys),
  ] as any[]);
  const name = new Map((plans || []).map((x: any) => [x.id, x.name]));
  const stepsBy = new Map<string, any[]>();
  for (const s of st.data || []) (stepsBy.get(s.plan_id) || stepsBy.set(s.plan_id, []).get(s.plan_id)!).push(s);
  const recent = Date.now() - 30 * 864e5;
  const enrolls = (en.data || []).filter((e: any) => e.status === "active" || e.status === "paused" || new Date(e.updated_at).getTime() > recent).map((e: any) => {
    const ps = stepsBy.get(e.plan_id) || [], s = ps[e.next_step];
    const line = e.status === "done" ? `Finished ${D} ${ps.length} emails` : e.status === "stopped" ? "Stopped" : !s ? "Finishing up"
      : `${e.status === "paused" ? `Paused ${D} ` : ""}Email ${e.next_step + 1} of ${ps.length} ${D} ${s.subject} ${D} ${e.status === "paused" ? "on hold" : fuText(addDays(e.started_on, s.day_offset))}`;
    return { id: e.id, plan: name.get(e.plan_id) || "Plan", status: e.status, line };
  });
  const planOf = new Map((en.data || []).map((e: any) => [e.id, name.get(e.plan_id) || "Plan"]));
  const ready = (rd.data || []).map((r: any) => ({ ...r, plan: planOf.get(r.enrollment_id) || "Plan" }));
  const exp = (mt.data || []).map((m: any) => m.consent_express_on).find(Boolean); return { plans: plans || [], enrolls, ready, optedOut: (mt.data || []).some((m: any) => m.email_optout), consent: person ? consentFor(person, pd || {}, exp ? String(exp).slice(0, 10) : null) : null };
}

// ---- sending ----
async function siteCtx(sb: any, siteId: string) {
  const { site, people, detail } = await loadPeople(siteId);
  const agent = await agentFor(sb, siteId);
  let base = "";
  try { base = String((await siteBase(sb, siteId)) || "").replace(/\/$/, ""); } catch {}
  const { data: outs } = await sb.from("crm_people").select("person_key, email_optout, consent_express_on").eq("site_id", siteId);
  const out = new Set((outs || []).filter((o: any) => o.email_optout).map((o: any) => o.person_key)); const express = new Map((outs || []).filter((o: any) => o.consent_express_on).map((o: any) => [o.person_key, String(o.consent_express_on).slice(0, 10)]));
  return { site, people: people || [], detail: detail || new Map(), agent, base, isOut: (p: any) => p.keys.some((k: string) => out.has(k)), consent: (p: any) => consentFor(p, (detail || new Map()).get(p.key) || {}, (p.keys.map((k: string) => express.get(k)).find(Boolean) as string) || null) };
}

function mergeFor(p: any, ctx: any) {
  const d: any = ctx.detail.get(p.key) || {};
  const firstOf = (n: string) => (/@/.test(n) ? "" : String(n || "").trim().split(/\s+/)[0]);
  const first = firstOf(p.name) || "there";
  const partner = p.partnerKey ? ctx.people.find((x: any) => x.keys.includes(p.partnerKey)) : null;
  const pf = partner ? firstOf(partner.name) : "";
  const raw = String(d.leads?.[0]?.city || d.sessions?.[0]?.city || ctx.site?.city || "nanaimo");
  const slug = raw.toLowerCase().trim().replace(/\s+/g, "-");
  const city = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const loves = (d.reactions || []).filter((r: any) => r.decision === "love").sort((a: any, b: any) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
  const names = first + (pf ? ` and ${pf}` : "");
  const v: Record<string, string> = {
    hi: `Hi ${names},`, first_name: first, names, city, city_report: ctx.base ? `${ctx.base}/${slug}/market-intelligence` : "",
    loved_home: String(loves[0]?.address || "the homes you saved"), agent_name: ctx.agent.agentName, agent_first: String(ctx.agent.agentName).split(/\s+/)[0],
  };
  return (s: string) => String(s || "").replace(/\{(\w+)\}/g, (m: string, k: string) => (k in v ? v[k] : m));
}

async function sendPlanEmail(sb: any, siteId: string, p: any, ctx: any, to: string, subject: string, text: string) {
  const rkey = env("RESEND_API_KEY");
  if (!rkey) return { ok: false, error: "RESEND_API_KEY is not set" };
  const agent = ctx.agent;
  const senderDomain = (env("SENDER_ADDRESS") || "notify@bc.realestate").split("@")[1] || "bc.realestate";
  const localPart = agent.agentName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/\s+/)[0].replace(/[^a-z0-9]/g, "") || "notify";
  const from = `${agent.agentName.replace(/["<>]/g, "").trim() || "Your agent"} <${localPart}@${senderDomain}>`;
  const sig = [agent.agentName, agent.brokerage || env("LEAD_BROKERAGE"), agent.agentEmail].filter(Boolean).join("\n");
  const un = unsubUrl(ctx.base, siteId, p.key);
  const lead = `You're receiving this because you've been in touch with ${agent.agentName}.`;
  const plain = `${text.replace(INTEL_RE, "").replace(/\n{3,}/g, "\n\n").trim()}\n\n--\n${sig}\n\n${lead} Unsubscribe: ${un}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${await withIntel(sb, toHtml(text))}<br><br><div style="color:#555;font-size:13px">${toHtml(sig)}</div><div style="color:#999;font-size:12px;margin-top:16px">${escH(lead)} <a href="${escH(un)}" style="color:#999">Unsubscribe</a></div></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${rkey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: plain, html, reply_to: agent.agentEmail, headers: { "List-Unsubscribe": `<${un}>` } }),
  });
  const out: any = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: out?.message || "Email send failed" };
  const d: any = ctx.detail.get(p.key) || {};
  const { error: logErr } = await sb.from("session_messages").insert({
    session_id: p.sessionIds[0] || null, site_id: siteId, lead_id: d.leads?.[0]?.id || null, channel: "email",
    message_type: null, to_email: to, subject, body: text, provider_id: out?.id || null, sent_by: agent.agentEmail || null,
  });
  if (logErr) await sb.from("crm_notes").insert({ site_id: siteId, person_key: p.key, body: `Emailed "${subject}"\n\n${text}`, kind: "note", created_by: "" });
  return { ok: true };
}

async function queueReady(sb: any, siteId: string, e: any, p: any, subject: string, body: string, error: string | null, today: string) {
  const { data: tk } = await sb.from("crm_tasks").insert({ site_id: siteId, person_key: p.key, title: `Review plan email: ${subject}`.slice(0, 300), due_on: today, created_by: "" }).select("id").single();
  await sb.from("crm_drip_sends").insert({ site_id: siteId, enrollment_id: e.id, person_key: p.key, step_position: e.next_step, subject, body, status: "ready", error, task_id: tk?.id || null });
  await syncNextFollowup(sb, siteId, p.key);
}

// Daily runner. One step per enrollment per run; a plan waits while its last review email is still queued.
export async function runDrips(opts: { siteId?: string; enrollmentId?: string; dry?: boolean } = {}) {
  const sb = sbAdmin(), today = todayStr(), log: any[] = [];
  let q = sb.from("crm_plan_enrollments").select("*").eq("status", "active");
  if (opts.siteId) q = q.eq("site_id", opts.siteId);
  if (opts.enrollmentId) q = q.eq("id", opts.enrollmentId);
  const { data: ens, error } = await q.limit(2000);
  if (error) throw error;
  const bySite = new Map<string, any[]>();
  for (const e of ens || []) (bySite.get(e.site_id) || bySite.set(e.site_id, []).get(e.site_id)!).push(e);
  for (const [siteId, list] of bySite) {
    const planIds = [...new Set(list.map((e: any) => e.plan_id))];
    const [{ data: steps }, { data: plans }, { data: pend }] = await Promise.all([
      sb.from("crm_plan_steps").select("*").in("plan_id", planIds).order("position"),
      sb.from("crm_plans").select("id, name, stop_when_closed").in("id", planIds),
      sb.from("crm_drip_sends").select("enrollment_id").eq("site_id", siteId).eq("status", "ready").in("enrollment_id", list.map((e: any) => e.id)),
    ]);
    const planName = new Map((plans || []).map((x: any) => [x.id, x.name]));
    const waiting = new Set((pend || []).map((x: any) => x.enrollment_id)); const stopClosed = new Set((plans || []).filter((x: any) => x.stop_when_closed).map((x: any) => x.id));
    let ctx: any = null;
    for (const e of list) {
      const ps = (steps || []).filter((s: any) => s.plan_id === e.plan_id);
      const st = ps[e.next_step];
      const Lg: any = { site: siteId, enrollment: e.id, plan: planName.get(e.plan_id), person: e.person_key };
      if (!st) { if (!opts.dry) await sb.from("crm_plan_enrollments").update({ status: "done", updated_at: nowIso() }).eq("id", e.id); log.push({ ...Lg, result: "finished" }); continue; }
      if (addDays(e.started_on, st.day_offset) > today) continue;
      if (waiting.has(e.id)) { log.push({ ...Lg, result: "waiting on your review of the last email" }); continue; }
      if (!ctx) ctx = await siteCtx(sb, siteId);
      const stop = async (why: string) => { log.push({ ...Lg, result: "stopped: " + why }); if (!opts.dry) await sb.from("crm_plan_enrollments").update({ status: "stopped", updated_at: nowIso() }).eq("id", e.id); };
      const p = ctx.people.find((x: any) => x.keys.includes(e.person_key));
      if (!p) { await stop("person not found"); continue; }
      if (ctx.isOut(p)) { await stop("unsubscribed"); continue; } if (stopClosed.has(e.plan_id) && ["closed", "past"].includes(p.stage)) { await stop("moved to " + (p.stage === "past" ? "Past client" : "Closed")); continue; } if (!ctx.consent(p).ok) { await stop("no current email consent"); continue; }
      const to = p.emails[0];
      if (!to) { await stop("no email address"); continue; }
      const m = mergeFor(p, ctx);
      const subject = m(st.subject).slice(0, 200), body = m(st.body);
      Object.assign(Lg, { to, subject, mode: st.mode });
      if (opts.dry) { log.push({ ...Lg, result: st.mode === "auto" ? "would send" : "would queue for review" }); continue; }
      let res: any = { ok: false, error: null };
      if (st.mode === "auto") res = await sendPlanEmail(sb, siteId, p, ctx, to, subject, body);
      if (res.ok) await sb.from("crm_drip_sends").insert({ site_id: siteId, enrollment_id: e.id, person_key: p.key, step_position: e.next_step, subject, body, status: "sent", sent_at: nowIso() });
      else await queueReady(sb, siteId, e, p, subject, body, res.error || null, today);
      const next = e.next_step + 1;
      await sb.from("crm_plan_enrollments").update({ next_step: next, status: next >= ps.length ? "done" : "active", updated_at: nowIso() }).eq("id", e.id);
      log.push({ ...Lg, result: res.ok ? "sent" : st.mode === "auto" ? "send failed, queued for review: " + res.error : "queued for review" });
    }
  }
  return log;
}

export async function sendReady(siteId: string, id: string) {
  const sb = sbAdmin();
  const { data: r } = await sb.from("crm_drip_sends").select("*").eq("id", id).eq("site_id", siteId).maybeSingle();
  if (!r || r.status !== "ready") return { ok: false, error: "Already handled" };
  const ctx = await siteCtx(sb, siteId);
  const p = ctx.people.find((x: any) => x.keys.includes(r.person_key));
  if (!p) return { ok: false, error: "Person not found" };
  if (ctx.isOut(p)) return { ok: false, error: "They unsubscribed" }; if (!ctx.consent(p).ok) return { ok: false, error: "No current email consent. Click They said yes to emails first." };
  if (!p.emails[0]) return { ok: false, error: "No email address" };
  const s: any = await sendPlanEmail(sb, siteId, p, ctx, p.emails[0], r.subject, r.body);
  if (!s.ok) { await sb.from("crm_drip_sends").update({ error: s.error }).eq("id", id); return s; }
  await closeDripSend(sb, siteId, id, "sent");
  return { ok: true };
}

// crm-plans v2: consent. Express consent never expires; an enquiry gives about 6 months; a purchase about 2 years.
const addMonths = (d: string, n: number) => { const x = new Date(String(d).slice(0, 10) + "T12:00:00Z"); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const niceD = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
export function consentFor(p: any, d: any, expressOn: string | null) {
  if (expressOn) return { ok: true, kind: "express", text: `Email consent: they said yes on ${niceD(expressOn)}.` };
  const today = todayStr();
  const leadDates = (d?.leads || []).map((l: any) => String(l.created_at || "").slice(0, 10)).filter(Boolean).sort();
  const c: any[] = [];
  if (leadDates.length) { const last = leadDates[leadDates.length - 1]; c.push({ kind: "enquiry", until: addMonths(last, 6), from: `their enquiry on ${niceD(last)}` }); }
  if (p?.boughtMonth && ["closed", "past"].includes(p.stage)) c.push({ kind: "purchase", until: addMonths(p.boughtMonth + "-01", 24), from: "their purchase" });
  if (!c.length) return { ok: false, kind: "none", text: "No enquiry or purchase on file, so no email consent yet." };
  const best = c.sort((a, b) => b.until.localeCompare(a.until))[0];
  if (best.until < today) return { ok: false, kind: best.kind, text: `Email consent from ${best.from} ran out ${niceD(best.until)}.` };
  return { ok: true, kind: best.kind, text: `Email consent: from ${best.from}, good until ${niceD(best.until)}.` };
}

// crm-plans v2: stage moved to Closed / Past client -> stop plans marked stop_when_closed
export async function stopClosedPlans(sb: any, siteId: string, key: string, note: (b: string, k?: string) => any) {
  const { data: ens } = await sb.from("crm_plan_enrollments").select("id, plan_id").eq("site_id", siteId).eq("person_key", key).in("status", ["active", "paused"]);
  if (!ens?.length) return;
  const { data: pls } = await sb.from("crm_plans").select("id, name").in("id", ens.map((e: any) => e.plan_id)).eq("stop_when_closed", true);
  for (const pl of pls || []) for (const e of ens.filter((x: any) => x.plan_id === pl.id)) {
    await sb.from("crm_plan_enrollments").update({ status: "stopped", updated_at: new Date().toISOString() }).eq("id", e.id);
    const { data: rs } = await sb.from("crm_drip_sends").select("id").eq("enrollment_id", e.id).eq("status", "ready");
    for (const r of rs || []) await closeDripSend(sb, siteId, r.id, "skipped");
    await note(`Stopped plan: ${pl.name} (moved to Closed)`, "system");
  }
}