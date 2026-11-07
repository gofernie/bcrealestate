import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

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
const toHtml = (t: string) => escH(t).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, "<br>");

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
  if (!agentName) agentName = env("DEFAULT_AGENT_NAME") || "Chris Crump";
  if (!agentEmail) agentEmail = env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
  return { agentName, agentEmail, siteName, brokerage };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    const sessionId = String(b?.session_id || "").trim();
    const to = String(b?.to || "").trim();
    const subject = String(b?.subject || "").trim().slice(0, 200);
    const text = String(b?.body || "").trim().slice(0, 5000);
    const messageType = TYPES.includes(b?.message_type) ? b.message_type : null;
    if (!sessionId || !to || !subject || !text) return json({ error: "Missing fields" }, 400);

    // Only send to an address that is actually a lead on this session
    const { data: leads } = await supabase.from("intent_leads").select("id, email, site_id").eq("session_id", sessionId);
    const lead = (leads || []).find((l: any) => String(l.email || "").trim().toLowerCase() === to.toLowerCase());
    if (!lead) return json({ error: "That address isn't a lead on this session" }, 403);

    const { data: sess } = await supabase.from("intent_sessions").select("site_id").eq("session_id", sessionId).maybeSingle();
    const siteId = sess?.site_id || lead.site_id || null;
    const agent = await agentFor(siteId);

    const key = env("RESEND_API_KEY");
    if (!key) return json({ error: "RESEND_API_KEY is not set" }, 500);
    const senderAddr = env("SENDER_ADDRESS") || "notify@bc.realestate";
    const fromName = agent.agentName.replace(/["<>]/g, "").trim() || "Your agent";
    const from = `${fromName} <${senderAddr}>`;
    const sig = [agent.agentName, agent.brokerage || env("LEAD_BROKERAGE"), agent.agentEmail].filter(Boolean).join("\n");
    const optout = `You're receiving this because you contacted ${agent.siteName || "us"} about a home. Reply "unsubscribe" and I won't email you again.`;

    const plain = `${text}\n\n--\n${sig}\n\n${optout}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${toHtml(text)}<br><br><div style="color:#555;font-size:13px">${toHtml(sig)}</div><div style="color:#999;font-size:12px;margin-top:16px">${toHtml(optout)}</div></div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: plain, html, reply_to: agent.agentEmail }),
    });
    const out: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: out?.message || "Email send failed" }, 502);

    const { error: logErr } = await supabase.from("session_messages").insert({
      session_id: sessionId, site_id: siteId, lead_id: lead.id, channel: "email",
      message_type: messageType, to_email: to, subject, body: text,
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