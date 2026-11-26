// crm-v1: one record per person, built from leads, sessions, reactions, emails, shortlists and watches.
import { createClient } from "@supabase/supabase-js";
import { mapListing, listingUrl, siteBase, fmtPrice } from "./sessionHomes";

export const STAGES = [
  ["new", "New"], ["active", "Active"], ["showing", "Showing"], ["offer", "Offer"],
  ["closed", "Closed"], ["past", "Past client"], ["notnow", "Not now"],
] as const;
export const stageLabel = (s: string) => (STAGES.find(([k]) => k === s) || STAGES[0])[1];

export const sbAdmin = () => createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const normEmail = (v: any) => { const s = String(v || "").trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ""; };
const normPhone = (v: any) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
export const fmtPhone = (p: string) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const keysOf = (email: any, phone: any) => [normEmail(email) && "e:" + normEmail(email), normPhone(phone) && "p:" + normPhone(phone)].filter(Boolean) as string[];
export const keysFor = (email: any, phone: any) => keysOf(email, phone);
export const normEmailX = normEmail; export const normPhoneX = normPhone;
const ts = (v: any) => (v ? new Date(v).getTime() || 0 : 0);
const chunk = <T,>(a: T[], n = 150) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function inChunks(sb: any, table: string, cols: string, col: string, vals: string[], extra?: (q: any) => any) {
  const out: any[] = [];
  for (const part of chunk([...new Set(vals)].filter(Boolean))) {
    let q = sb.from(table).select(cols).in(col, part);
    if (extra) q = extra(q);
    const { data } = await q;
    out.push(...(data || []));
  }
  return out;
}

export type Person = {
  key: string; keys: string[]; name: string; emails: string[]; phones: string[];
  stage: string; followup: string | null; followupNote: string | null; metaKey: string | null; address: string | null; birthday: string | null; spouseName: string | null; spousePhone: string | null; spouseEmail: string | null; spouseBirthday: string | null; partnerKey: string | null; manual: boolean; listingMls: string | null; boughtPrice: number | null; boughtMonth: string | null; boughtType: string | null;
  firstSeen: number; lastActivity: number; lastWhat: string; lastAgentTouch: number;
  counts: { enquiries: number; loves: number; likes: number; passes: number; shortlists: number; emails: number; notes: number; watches: number };
  recentLoves: number; sessionIds: string[]; sources: string[];
};

export async function loadPeople(siteId: string, opts: { onlyKeys?: string[] } = {}) {
  const sb = sbAdmin();
  const { data: site } = await sb.from("sites").select("*").eq("id", siteId).maybeSingle();
  if (!site) return { site: null, people: [] as Person[], raw: null as any };
  const domain = String(site.domain || "").replace(/^www\./, "");

  const [{ data: leads }, { data: msgs }, { data: meta }, { data: notes }] = await Promise.all([
    sb.from("intent_leads").select("id, created_at, session_id, city, slug, name, email, phone, source, message, question").eq("site_id", siteId).order("created_at", { ascending: false }).limit(3000),
    sb.from("session_messages").select("id, session_id, lead_id, channel, message_type, to_email, subject, body, sent_by, created_at").eq("site_id", siteId).order("created_at", { ascending: false }).limit(3000),
    sb.from("crm_people").select("*").eq("site_id", siteId),
    sb.from("crm_notes").select("*").eq("site_id", siteId).order("created_at", { ascending: false }).limit(5000),
  ]);
  const sends = site.agent_id
    ? ((await sb.from("shortlist_sends").select("id, client_name, client_phone, client_email, client_id, shortlist_url, shortlist_slug, status, sent_at, created_at, last_viewed_at, first_viewed_at, open_count, search_area, search_city").eq("agent_id", site.agent_id).order("created_at", { ascending: false }).limit(2000)).data || [])
    : [];
  const clientIds = sends.map((s: any) => s.client_id).filter(Boolean);
  const clients = clientIds.length ? await inChunks(sb, "clients", "id, name, email, phone", "id", clientIds) : [];
  const clientById = new Map(clients.map((c: any) => [String(c.id), c]));
  const watches = domain ? ((await sb.from("listing_watches").select("id, phone, listing_id, address, active, created_at, last_price, listing_url").eq("site_domain", domain).limit(2000)).data || []) : [];

  const sessionIds = [...new Set((leads || []).map((l: any) => l.session_id).filter(Boolean))] as string[];
  const [sessions, reactions] = await Promise.all([
    inChunks(sb, "intent_sessions", "session_id, slug, city, created_at, updated_at", "session_id", sessionIds),
    inChunks(sb, "intent_listing_reactions", "session_id, mls_number, address, price, decision, created_at, updated_at", "session_id", sessionIds),
  ]);

  // union-find over email/phone keys
  const parent = new Map<string, string>();
  const find = (k: string): string => { let p = parent.get(k) || k; if (p !== k) { p = find(p); parent.set(k, p); } return p; };
  const add = (k: string) => { if (!parent.has(k)) parent.set(k, k); };
  const link = (ks: string[]) => { ks.forEach(add); for (let i = 1; i < ks.length; i++) { const a = find(ks[0]), b = find(ks[i]); if (a !== b) parent.set(b, a); } };
  const leadKeys = new Map<string, string[]>(), sendKeys = new Map<string, string[]>();
  for (const l of leads || []) { const k = keysOf(l.email, l.phone); leadKeys.set(l.id, k); if (k.length) link(k); }
  for (const s of sends) { const c: any = clientById.get(String(s.client_id)) || {}; const k = keysOf(s.client_email || c.email, s.client_phone || c.phone); sendKeys.set(s.id, k); if (k.length) link(k); }
  for (const w of watches) { const k = keysOf("", w.phone); if (k.length) link(k); }
  for (const m of meta || []) { add(m.person_key); const mk = [m.person_key, ...keysOf(m.email, m.phone)]; if (mk.length > 1) link(mk); }
  for (const n of notes || []) add(n.person_key);

  const groups = new Map<string, any>();
  const G = (k: string) => {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, { keys: new Set<string>(), names: [] as [number, string][], leads: [] as any[], sends: [] as any[], watches: [] as any[], sessionIds: new Set<string>(), leadIds: new Set<string>() });
    return groups.get(r);
  };
  for (const l of leads || []) { const k = leadKeys.get(l.id)!; if (!k.length) continue; const g = G(k[0]); k.forEach((x) => g.keys.add(x)); g.leads.push(l); g.leadIds.add(l.id); if (l.session_id) g.sessionIds.add(l.session_id); if (l.name) g.names.push([ts(l.created_at), String(l.name).trim()]); }
  for (const s of sends) { const k = sendKeys.get(s.id)!; if (!k.length) continue; const g = G(k[0]); k.forEach((x) => g.keys.add(x)); g.sends.push(s); const c: any = clientById.get(String(s.client_id)) || {}; const nm = s.client_name || c.name; if (nm) g.names.push([ts(s.created_at) - 1e13, String(nm).trim()]); /* lead names win over shortlist labels */ }
  for (const w of watches) { const k = keysOf("", w.phone); if (!k.length) continue; const g = G(k[0]); k.forEach((x) => g.keys.add(x)); g.watches.push(w); }
  // keep only groups with a real record (meta/notes alone don't make a person unless keyed by e:/p:)
  for (const m of meta || []) { let g = groups.get(find(m.person_key)); if (!g && m.manual) g = G(m.person_key); if (g) { g.keys.add(m.person_key); keysOf(m.email, m.phone).forEach((x) => g.keys.add(x)); if (m.manual) g.manual = true; } }

  const sessionsBy = new Map<string, any[]>(); for (const s of sessions) { const a = sessionsBy.get(s.session_id) || []; a.push(s); sessionsBy.set(s.session_id, a); }
  const reactBy = new Map<string, any[]>(); for (const r of reactions) { const a = reactBy.get(r.session_id) || []; a.push(r); reactBy.set(r.session_id, a); }
  const metaByKey = new Map((meta || []).map((m: any) => [m.person_key, m]));
  const notesByKey = new Map<string, any[]>(); for (const n of notes || []) { const a = notesByKey.get(n.person_key) || []; a.push(n); notesByKey.set(n.person_key, a); }
  const msgsBySession = new Map<string, any[]>(), msgsByLead = new Map<string, any[]>(), msgsByEmail = new Map<string, any[]>();
  for (const m of msgs || []) {
    if (m.session_id) (msgsBySession.get(m.session_id) || msgsBySession.set(m.session_id, []).get(m.session_id)!).push(m);
    if (m.lead_id) (msgsByLead.get(m.lead_id) || msgsByLead.set(m.lead_id, []).get(m.lead_id)!).push(m);
    const e = normEmail(m.to_email); if (e) (msgsByEmail.get(e) || msgsByEmail.set(e, []).get(e)!).push(m);
  }

  const week = Date.now() - 7 * 864e5;
  const people: Person[] = [];
  const detail = new Map<string, any>();
  for (const g of groups.values()) {
    const keys = [...g.keys] as string[];
    if (opts.onlyKeys && !keys.some((k) => opts.onlyKeys!.includes(k))) continue;
    const emails = keys.filter((k) => k.startsWith("e:")).map((k) => k.slice(2));
    const phones = keys.filter((k) => k.startsWith("p:")).map((k) => k.slice(2));
    const m: any = keys.map((k) => metaByKey.get(k)).find(Boolean) || null;
    const sess = [...g.sessionIds].flatMap((id: string) => sessionsBy.get(id) || []);
    const reacts = [...g.sessionIds].flatMap((id: string) => reactBy.get(id) || []);
    const mset = new Map<string, any>();
    for (const id of g.sessionIds) for (const x of msgsBySession.get(id) || []) mset.set(x.id, x);
    for (const id of g.leadIds) for (const x of msgsByLead.get(id) || []) mset.set(x.id, x);
    for (const e of emails) for (const x of msgsByEmail.get(e) || []) mset.set(x.id, x);
    const sent = [...mset.values()];
    const pnotes = keys.flatMap((k) => notesByKey.get(k) || []);

    const acts: [number, string][] = [];
    for (const l of g.leads) acts.push([ts(l.created_at), l.question ? "Asked a question" : l.source === "saved_search" ? "Saved a search" : "Sent an enquiry"]);
    for (const r of reacts) if (["love", "like", "pass"].includes(r.decision)) acts.push([ts(r.updated_at || r.created_at), r.decision === "love" ? `Loved ${r.address || "a home"}` : r.decision === "like" ? `Liked ${r.address || "a home"}` : "Passed on a home"]);
    for (const s of sess) acts.push([ts(s.updated_at || s.created_at), "Browsed homes"]);
    for (const s of g.sends) if (s.last_viewed_at) acts.push([ts(s.last_viewed_at), "Opened a shortlist"]);
    acts.sort((a, b) => b[0] - a[0]);
    const touches = [...sent.map((x) => ts(x.created_at)), ...g.sends.map((s: any) => ts(s.sent_at)), ...pnotes.filter((n: any) => n.kind !== "system").map((n: any) => ts(n.created_at))];
    const all = [...acts.map((a) => a[0]), ...touches].filter(Boolean);
    const names = g.names.sort((a: any, b: any) => b[0] - a[0]);
    const key = m?.person_key || keys.filter((k) => k.startsWith("e:")).sort()[0] || keys.sort()[0];
    if (!g.leads.length && !g.sends.length && !g.watches.length && !g.manual) continue;
    const p: Person = {
      key, keys, name: m?.display_name || names[0]?.[1] || emails[0] || (phones[0] ? fmtPhone(phones[0]) : "Unnamed"),
      emails, phones, stage: m?.stage || "new", followup: m?.next_followup_at || null, followupNote: m?.followup_note || null, metaKey: m?.person_key || null, address: m?.address || null, birthday: m?.birthday || null, spouseName: m?.spouse_name || null, spousePhone: m?.spouse_phone || null, spouseEmail: m?.spouse_email || null, spouseBirthday: m?.spouse_birthday || null, partnerKey: m?.partner_key || null, listingMls: m?.listing_mls || null, boughtPrice: m?.bought_price != null ? Number(m.bought_price) : null, boughtMonth: m?.bought_month || null, boughtType: m?.bought_type || null, manual: !!g.manual,
      firstSeen: all.length ? Math.min(...all) : ts(m?.created_at), lastActivity: acts[0]?.[0] || (all.length ? Math.max(...all) : ts(m?.created_at)), lastWhat: acts[0]?.[1] || (g.manual ? "Added by you" : ""),
      lastAgentTouch: Math.max(0, ...touches),
      counts: { enquiries: g.leads.length, loves: reacts.filter((r: any) => r.decision === "love").length, likes: reacts.filter((r: any) => r.decision === "like").length, passes: reacts.filter((r: any) => r.decision === "pass").length, shortlists: g.sends.length, emails: sent.length, notes: pnotes.length, watches: g.watches.length },
      recentLoves: reacts.filter((r: any) => r.decision === "love" && ts(r.updated_at || r.created_at) > week).length,
      sessionIds: [...g.sessionIds], sources: [...new Set(g.leads.map((l: any) => String(l.source || "")).filter(Boolean))] as string[],
    };
    people.push(p);
    detail.set(p.key, { leads: g.leads, sessions: sess, reactions: reacts, messages: sent, sends: g.sends, watches: g.watches, notes: pnotes });
  }
  people.sort((a, b) => b.lastActivity - a.lastActivity);
  return { site, people, detail };
}

// Timeline for one person, newest first
export async function timelineFor(siteId: string, p: Person, d: any) {
  const sb = sbAdmin();
  const items: { at: number; kind: string; title: string; detail?: string; href?: string; homes?: any[] }[] = [];
  const sq = (sid: string) => `/admin/intent-sessions?site_id=${encodeURIComponent(siteId)}&session=${encodeURIComponent(sid)}`;
  for (const l of d.leads) {
    const src = String(l.source || "");
    const title = l.question ? `Asked: ${l.question}` : src === "saved_search" ? "Saved a search" : /showing/i.test(src) ? "Requested a showing" : "Sent an enquiry";
    const msg = String(l.message || "").split("\n").filter((x: string) => x.trim() && !/^\s*(Criteria|Question):/.test(x) && !/^I'm interested in this property and have a question\.?$/i.test(x.trim())).slice(0, 3).join(" · ");
    const lmsg = String(l.message || ""), lmls = (lmsg.match(/[?&]mls=(\d+)/) || [])[1], laddr = ((lmsg.match(/Property:\s*([^\n·]+)/) || [])[1] || "").trim();
    items.push({ at: ts(l.created_at), kind: "lead", title, detail: [msg, l.city && `${l.city}${l.slug ? " / " + l.slug : ""}`].filter(Boolean).join(" · "), href: l.session_id ? sq(l.session_id) : undefined, homes: lmls ? [{ mls: lmls, address: laddr || "MLS® " + lmls, price: "" }] : undefined });
  }
  const firstBySession = new Map<string, any>();
  for (const s of d.sessions) { const f = firstBySession.get(s.session_id); if (!f || ts(s.created_at) < ts(f.created_at)) firstBySession.set(s.session_id, s); }
  for (const s of firstBySession.values()) items.push({ at: ts(s.created_at), kind: "visit", title: "First visit", detail: [s.city, s.slug].filter(Boolean).join(" / "), href: sq(s.session_id) });
  // reactions grouped per day
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const byDay = new Map<string, any[]>();
  for (const r of d.reactions) { const t = ts(r.updated_at || r.created_at); const k = day(t); (byDay.get(k) || byDay.set(k, []).get(k)!).push({ ...r, t }); }
  for (const rs of byDay.values()) {
    const c = (x: string) => rs.filter((r: any) => r.decision === x);
    const loves = c("love"), likes = c("like"), passes = c("pass");
    const partsA = [loves.length && `loved ${loves.length}`, likes.length && `liked ${likes.length}`, passes.length && `passed on ${passes.length}`].filter(Boolean) as string[];
    if (!partsA.length) continue;
    const parts = partsA.join(", ") + (partsA.length === 1 ? ((loves.length + likes.length + passes.length) === 1 ? " home" : " homes") : "");
    const names = [...loves, ...likes].slice(0, 4).map((r: any) => `${r.address || r.mls_number}${r.price ? " (" + r.price + ")" : ""}`).join(" · ");
    const rhomes = [...loves, ...likes].filter((r: any) => r.mls_number).map((r: any) => ({ mls: String(r.mls_number), address: String(r.address || "MLS® " + r.mls_number), price: r.price ? (isNaN(Number(r.price)) ? String(r.price) : fmtPrice(Number(r.price))) : "" }));
    items.push({ at: Math.max(...rs.map((r: any) => r.t)), kind: loves.length ? "love" : "react", title: parts.charAt(0).toUpperCase() + parts.slice(1), detail: rhomes.length ? undefined : names, href: sq(rs[0].session_id), homes: rhomes.length ? rhomes : undefined });
  }
  // browsing: distinct homes opened per day (listing events)
  if (p.sessionIds.length) {
    const { data: ev } = await sb.from("intent_listing_events").select("session_id, listing_id, created_at").in("session_id", p.sessionIds.slice(0, 50)).order("created_at", { ascending: false }).limit(3000);
    const bd = new Map<string, { t: number; homes: Set<string>; sid: string }>();
    for (const e of ev || []) { const t = ts(e.created_at); const k = day(t); const x = bd.get(k) || { t, homes: new Set<string>(), sid: e.session_id }; x.t = Math.max(x.t, t); if (e.listing_id) x.homes.add(String(e.listing_id)); bd.set(k, x); }
    const allIds = [...new Set([...bd.values()].flatMap((x) => [...x.homes]))].slice(0, 300);
    const homeBy = new Map();
    let lbase = "";
    try {
      lbase = String((await siteBase(sb, siteId)) || "");
      if (allIds.length) {
        const { data: hr } = await sb.from("listing_rows").select("*").in("id", allIds);
        for (const h of (hr || []).map(mapListing)) homeBy.set(String(h.id), h);
        const missing = allIds.filter((id) => !homeBy.has(id));
        if (missing.length) { const { data: hr2 } = await sb.from("listing_rows").select("*").in("mls_number", missing); for (const r of hr2 || []) homeBy.set(String((r as any).mls_number), mapListing(r)); }
      }
    } catch (e) { console.error("browse homes lookup failed", e); }
    for (const x of bd.values()) if (x.homes.size) {
      const hs: any[] = [...x.homes].map((id) => homeBy.get(id)).filter(Boolean);
      const one = x.homes.size === 1 && hs.length === 1 ? hs[0] : null;
      const detail = one ? (one.price ? fmtPrice(one.price) : "") : hs.slice(0, 4).map((h) => `${h.address}${h.price ? " (" + fmtPrice(h.price) + ")" : ""}`).join(" · ") + (hs.length > 4 ? ` · +${hs.length - 4} more` : "");
      const bhomes = hs.filter((h) => h.mls).map((h) => ({ mls: String(h.mls), address: String(h.address || "MLS® " + h.mls), price: h.price ? fmtPrice(h.price) : "", url: lbase ? listingUrl(lbase, String(h.city || ""), String(h.mls), x.sid) : "" }));
      items.push({ homes: bhomes.length ? bhomes : undefined, at: x.t, kind: "browse", title: one ? `Looked at ${one.address}` : `Looked at ${x.homes.size} home${x.homes.size === 1 ? "" : "s"}`, detail: bhomes.length ? undefined : (detail || undefined), href: one && one.mls && lbase ? listingUrl(lbase, String(one.city || ""), String(one.mls), x.sid) : sq(x.sid) });
    }
  }
  for (const m of d.messages) items.push({ at: ts(m.created_at), kind: "sent", title: `You emailed: ${m.subject || "(no subject)"}`, detail: String(m.body || "").replace(/\s+/g, " ").slice(0, 160) });
  for (const s of d.sends) {
    const url = s.shortlist_url || (s.shortlist_slug ? `/shortlists/${s.shortlist_slug}` : "");
    items.push({ at: ts(s.sent_at || s.created_at), kind: "shortlist", title: s.sent_at ? "You sent a shortlist" : `Shortlist created (${s.status || "draft"})`, detail: [s.search_area, s.search_city].filter(Boolean).join(", "), href: url || undefined });
    if (s.last_viewed_at) items.push({ at: ts(s.last_viewed_at), kind: "view", title: `Opened your shortlist${s.open_count > 1 ? ` (${s.open_count} times)` : ""}`, href: url || undefined });
  }
  for (const w of d.watches) items.push({ at: ts(w.created_at), kind: "watch", title: `Started watching ${w.address || w.listing_id}`, detail: w.active ? "Price and status alerts on" : "Alerts stopped", href: w.listing_url || undefined });
  for (const n of d.notes) items.push({ at: ts(n.created_at), kind: n.kind === "system" ? "system" : "note", title: n.kind === "system" ? n.body : "Note", detail: n.kind === "system" ? undefined : n.body });
  return items.filter((i) => i.at).sort((a, b) => b.at - a.at);
}

// date helpers (kept here: some of these trip the .astro frontmatter compiler)
export const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
export const plusDays = (n: number) => { const d = new Date(todayStr() + "T12:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export function ago(t: number) {
  if (!t) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)}d ago`;
  const sameYear = new Date(t).getFullYear() === new Date().getFullYear();
  return new Date(t).toLocaleDateString("en-CA", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
export function fuText(d: string | null) {
  if (!d) return "";
  const nice = (o: any) => new Date(d + "T12:00").toLocaleDateString("en-CA", o);
  const t = todayStr();
  if (d < t) return `Overdue · ${nice({ month: "short", day: "numeric" })}`;
  if (d === t) return "Today";
  return nice({ weekday: "short", month: "short", day: "numeric" });
}
export function bdText(d: string) {
  const x = new Date(d + "T12:00"), now = new Date();
  let age = now.getFullYear() - x.getFullYear();
  if (now.getMonth() < x.getMonth() || (now.getMonth() === x.getMonth() && now.getDate() < x.getDate())) age--;
  return x.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) + (age >= 0 && age < 120 ? ` (${age})` : "");
}
export function when(t: number) {
  const sameYear = new Date(t).getFullYear() === new Date().getFullYear();
  return new Date(t).toLocaleString("en-CA", sameYear ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
