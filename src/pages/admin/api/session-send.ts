import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { mapListing, listingUrl, siteBase, fmtPrice } from "../../../lib/sessionHomes";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const TYPES = ["homes", "financing", "market", "process", "checkin"];
const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// linkOrButton: market intel links render as a button, other links as text links
function linkOrButton(u: string) {
  const m = u.match(/\/([a-z0-9-]+)\/market-intelligence/i);
  if (!m) return `<a href="${u}">${u}</a>`;
  const city = m[1].replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
  return `<br><a href="${u}" style="display:inline-block;margin-top:8px;background:#1f6b60;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 18px;border-radius:6px">See the ${city} market report &rarr;</a>`;
}
// linkAddresses: turn known listing addresses in the message into links (skips text already inside links)
function linkAddresses(html: string, links: Array<[string, string]>) {
  const sorted = [...links].filter(([a]) => a && a.length >= 6).sort((a, b) => b[0].length - a[0].length);
  for (const [addr, url] of sorted) {
    const re = new RegExp(escH(addr).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    html = html
      .split(/(<a\b[^>]*>[\s\S]*?<\/a>)/)
      .map((part) => (part.startsWith("<a") ? part : part.replace(re, (m) => `<a href="${escH(url)}" style="color:#1f6b60">${m}</a>`)))
      .join("");
  }
  return html;
}
const toHtml = (t: string, links: Array<[string, string]> = []) => linkAddresses(escH(t).replace(/https?:\/\/[^\s<]+/g, (u) => linkOrButton(u)), links).replace(/\n/g, "<br>");

async function agentFor(siteId?: string | null) {
  let agentName = "", agentEmail = "", siteName = "", brokerage = "";
  if (siteId) {
    const { data: s } = await supabase.from("sites").select("agent_id, site_name").eq("id", siteId).maybeSingle();
    siteName = String(s?.site_name || "").trim();
    if (s?.agent_id) {
      const { data: a } = await supabase.from("agents").select("name, email, brokerage").eq("id", s.agent_id).maybeSingle();
      agentName = String(a?.name || "").trim();
      agentEmail = String(a?.email || "").trim();
      brokerage = String((a as any)?.brokerage || "").trim();
    }
  }
  // fallback-agent-row: site has no agent, so use the default agent's own record (name, email, brokerage)
  if (!agentName && !agentEmail) {
    const fallbackEmail = env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
    const { data: fa } = await supabase.from("agents").select("name, email, brokerage").eq("email", fallbackEmail).maybeSingle();
    agentName = String(fa?.name || "").trim();
    agentEmail = String(fa?.email || "").trim();
    brokerage = String((fa as any)?.brokerage || "").trim();
  }  if (!agentName) agentName = env("DEFAULT_AGENT_NAME") || "Chris Crump";
  if (!agentEmail) agentEmail = env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
  return { agentName, agentEmail, siteName, brokerage };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    const sessionId = String(b?.session_id || "").trim();
    const to = String(b?.to || "").trim();
    const subject = String(b?.subject || "").trim().slice(0, 200);
    let text = String(b?.body || "").trim().slice(0, 5000);
    const messageType = TYPES.includes(b?.message_type) ? b.message_type : null;
    const homeIds = (Array.isArray(b?.homes) ? b.homes : []).map((x: any) => String(x)).filter(Boolean).slice(0, 6);
    if (!sessionId || !to || !subject || !text) return json({ error: "Missing fields" }, 400);

    // Only send to an address that is actually a lead on this session
    const { data: leads } = await supabase.from("intent_leads").select("id, email, site_id").eq("session_id", sessionId);
    const lead = (leads || []).find((l: any) => String(l.email || "").trim().toLowerCase() === to.toLowerCase());
    if (!lead) return json({ error: "That address isn't a lead on this session" }, 403);

    const { data: sess } = await supabase.from("intent_sessions").select("site_id, city").eq("session_id", sessionId).maybeSingle();
    const siteId = sess?.site_id || lead.site_id || null;
    const agent = await agentFor(siteId);

    const key = env("RESEND_API_KEY");
    if (!key) return json({ error: "RESEND_API_KEY is not set" }, 500);
    const senderDomain = (env("SENDER_ADDRESS") || "notify@bc.realestate").split("@")[1] || "bc.realestate";
    const localPart = agent.agentName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/\s+/)[0].replace(/[^a-z0-9]/g, "") || "notify";
    const senderAddr = `${localPart}@${senderDomain}`;
    const fromName = agent.agentName.replace(/["<>]/g, "").trim() || "Your agent";
    const from = `${fromName} <${senderAddr}>`;
    const sig = [agent.agentName, agent.brokerage || env("LEAD_BROKERAGE"), agent.agentEmail].filter(Boolean).join("\n");
    const optout = `You're receiving this because you contacted ${agent.siteName || "us"} about a home. Reply "unsubscribe" and I won't email you again.`;

    // address-links: attached homes, the buyer's reacted homes, and their enquiry property
    const addrLinks: Array<[string, string]> = [];
    try {
      const linkBase = await siteBase(supabase, siteId);
      const cityForLinks = String((sess as any)?.city || "");
      if (homeIds.length) {
        const { data: hr } = await supabase.from("listing_rows").select("*").in("id", homeIds);
        (hr || []).map(mapListing).forEach((h) => { if (h.address && h.mls) addrLinks.push([h.address, listingUrl(linkBase, cityForLinks || h.city, h.mls, sessionId)]); });
      }
      const { data: rx } = await supabase.from("intent_listing_reactions").select("address, mls_number, city").eq("session_id", sessionId).limit(100);
      (rx || []).forEach((r: any) => { const cty = String(r.city || cityForLinks); if (r.address && r.mls_number && cty) addrLinks.push([String(r.address), listingUrl(linkBase, cty, String(r.mls_number), sessionId)]); });
      const { data: lm } = await supabase.from("intent_leads").select("message").eq("session_id", sessionId).limit(10);
      (lm || []).forEach((l: any) => {
        const msg = String(l.message || "");
        const addr = (msg.match(/Property:\s*(.+)/) || [])[1];
        const mls = (msg.match(/[?&]mls=(\d+)/) || [])[1];
        if (addr && mls && cityForLinks) addrLinks.push([addr.trim(), listingUrl(linkBase, cityForLinks, mls, sessionId)]);
      });
    } catch (e) { console.error("address links failed", e); }
    // session-homes-cards
    let homesText = "", homesHtml = "";
    if (homeIds.length) {
      const { data: hrows } = await supabase.from("listing_rows").select("*").in("id", homeIds);
      const base = await siteBase(supabase, siteId);
      const homes = (hrows || []).map(mapListing).filter((h) => h.mls).sort((a, b) => homeIds.indexOf(a.id) - homeIds.indexOf(b.id));
      const dot = " \u00b7 ";
      const urlFor = (h: any) => listingUrl(base, String((sess as any)?.city || h.city), h.mls, sessionId);
      if (homes.length && !/\bbelow\b/i.test(text)) {
        text += "\n\n" + (homes.length === 1 ? "I've also added a home below that fits what you've been looking at." : `I've also added ${homes.length} homes below that fit what you've been looking at.`);
      }
      if (homes.length) {
        homesText = "\n\n" + homes.map((h) => [h.address, [fmtPrice(h.price), h.beds ? h.beds + " bd" : "", h.baths ? h.baths + " ba" : ""].filter(Boolean).join(dot), urlFor(h)].filter(Boolean).join("\n")).join("\n\n");
        homesHtml = "<br><br>" + homes.map((h) => {
          const meta = [h.beds ? h.beds + " bed" : "", h.baths ? h.baths + " bath" : "", h.sqft ? Math.round(h.sqft).toLocaleString("en-CA") + " sq ft" : ""].filter(Boolean).join(dot);
          const img = h.image ? `<img src="${escH(h.image)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0">` : "";
          return `<a href="${escH(urlFor(h))}" style="display:block;text-decoration:none;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;margin:0 0 12px;max-width:520px">${img}<div style="padding:10px 14px"><div style="font-weight:bold;font-size:16px">${escH(fmtPrice(h.price))}</div><div style="font-size:14px;color:#333">${escH(h.address)}</div><div style="font-size:13px;color:#777">${escH(meta)}</div></div></a>`;
        }).join("");
      }
    }
    const plain = `${text}${homesText}\n\n--\n${sig}\n\n${optout}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${toHtml(text, addrLinks)}${homesHtml}<br><br><div style="color:#555;font-size:13px">${toHtml(sig)}</div><div style="color:#999;font-size:12px;margin-top:16px">${toHtml(optout)}</div></div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: plain, html, reply_to: agent.agentEmail }),
    });
    const out: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: out?.message || "Email send failed" }, 502);

    const { error: logErr } = await supabase.from("session_messages").insert({
      session_id: sessionId, site_id: siteId, lead_id: lead.id, channel: "email",
      message_type: messageType, to_email: to, subject, body: text + homesText,
      provider_id: out?.id || null, sent_by: agent.agentEmail || null,
    });
    if (logErr) console.error("session_messages insert failed:", logErr.message);

    return json({ ok: true, id: out?.id || null });
  } catch (e: any) {
    return json({ error: e?.message || "Send failed" }, 500);
  }
};

export const GET: APIRoute = async ({ url }) => {
  const sid = url.searchParams.get("session_id");
  if (!sid) return json({ messages: [] });
  const { data } = await supabase.from("session_messages").select("created_at, message_type, subject, to_email").eq("session_id", sid).order("created_at", { ascending: false }).limit(20);
  return json({ messages: data || [] });
};