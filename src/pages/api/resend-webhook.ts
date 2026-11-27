// email-tracking v1: Resend webhooks -> opens, clicks and replies in the CRM. Events: email.opened, email.clicked, email.received
import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sbAdmin, loadPeople, todayStr, syncNextFollowup } from "../../lib/crm";
export const prerender = false;
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const res = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
function verify(raw: string, h: Headers) {
  const secret = env("RESEND_WEBHOOK_SECRET"), id = h.get("svix-id") || "", t = h.get("svix-timestamp") || "", sig = h.get("svix-signature") || "";
  if (!secret || !id || !t || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const expected = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64")).update(`${id}.${t}.${raw}`).digest("base64");
  return sig.split(" ").some((s) => { const v = s.split(",")[1] || ""; return v.length === expected.length && timingSafeEqual(Buffer.from(v), Buffer.from(expected)); });
}
const emailOf = (v: any) => { const s = Array.isArray(v) ? String(v[0] || "") : String(v || ""); const m = s.match(/<([^>]+)>/); return (m ? m[1] : s).trim().toLowerCase(); };
const uuidOf = (hex: string) => (/^[0-9a-f]{32}$/i.test(hex) ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : "");
function stripQuoted(t: string) {
  const out: string[] = [];
  for (const l of String(t || "").replace(/\r/g, "").split("\n")) {
    const x = l.trim();
    if (/^On .+wrote:$/.test(x) || /^-{2,}\s*Original Message/i.test(x) || /^From: /.test(x) || /^Sent from my /i.test(x)) break;
    if (/^>/.test(x)) continue;
    out.push(l);
  }
  return out.join("\n").trim().slice(0, 4000);
}
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  if (!verify(raw, request.headers)) return res({ ok: false, error: "bad signature" }, 401);
  let ev: any = {}; try { ev = JSON.parse(raw); } catch { return res({ ok: false }, 400); }
  const type = String(ev.type || ""), d = ev.data || {}, sb = sbAdmin();
  try {
    if (type === "email.opened" || type === "email.clicked") {
      const pid = String(d.email_id || ""); if (!pid) return res({ ok: true });
      const { data: m } = await sb.from("session_messages").select("site_id, to_email, subject").eq("provider_id", pid).limit(1).maybeSingle();
      if (!m?.site_id) return res({ ok: true, skipped: "not a CRM email" });
      await sb.from("crm_email_events").insert({ site_id: m.site_id, provider_id: pid, kind: type === "email.opened" ? "open" : "click", email: String(m.to_email || emailOf(d.to)).toLowerCase(), subject: m.subject || d.subject || null, link: type === "email.clicked" ? String(d.click?.link || "").slice(0, 1000) || null : null });
      return res({ ok: true });
    }
    if (type === "email.received") {
      const tos: string[] = (Array.isArray(d.to) ? d.to : [d.to]).map(emailOf);
      const cap = tos.find((x) => /^r-[0-9a-f]{32}@/i.test(x)); if (!cap) return res({ ok: true, skipped: "not a reply address" });
      const siteId = uuidOf(cap.slice(2, 34)), from = emailOf(d.from); if (!siteId || !from) return res({ ok: true });
      let body = "";
      try {
        const r = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(String(d.email_id || ""))}`, { headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}` } });
        if (r.ok) { const j: any = await r.json(); body = stripQuoted(j.text || String(j.html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")); }
      } catch (e) { console.error("reply body fetch failed", e); }
      await sb.from("crm_email_events").insert({ site_id: siteId, provider_id: String(d.email_id || "") || null, kind: "reply", email: from, subject: String(d.subject || "").slice(0, 300) || null, body: body || null });
      const { people } = await loadPeople(siteId);
      const p: any = (people || []).find((x: any) => x.emails.includes(from));
      if (p) {
        const { data: ens } = await sb.from("crm_plan_enrollments").select("id, plan_id").eq("site_id", siteId).in("person_key", p.keys).eq("status", "active");
        if (ens?.length) {
          const { data: pls } = await sb.from("crm_plans").select("id, name").in("id", ens.map((e: any) => e.plan_id)).eq("pause_on_reply", true);
          for (const pl of pls || []) for (const e of ens.filter((x: any) => x.plan_id === pl.id)) {
            await sb.from("crm_plan_enrollments").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", e.id);
            await sb.from("crm_notes").insert({ site_id: siteId, person_key: p.key, body: `Paused plan: ${pl.name} (they replied)`, kind: "system", created_by: "" });
          }
        }
        if (!["closed", "past"].includes(p.stage)) {
          await sb.from("crm_tasks").insert({ site_id: siteId, person_key: p.key, title: `Reply to ${p.name}: ${String(d.subject || "their email")}`.slice(0, 300), due_on: todayStr(), created_by: "" });
          await syncNextFollowup(sb, siteId, p.key);
        }
      }
      return res({ ok: true });
    }
    return res({ ok: true, ignored: type });
  } catch (e: any) {
    console.error("resend webhook failed", e);
    return res({ ok: false, error: e?.message || "failed" });
  }
};