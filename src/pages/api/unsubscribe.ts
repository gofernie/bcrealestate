// crm-plans v1: unsubscribe page. GET shows a button (so link scanners can't unsubscribe people), POST does it.
import type { APIRoute } from "astro";
import { sbAdmin, closeDripSend } from "../../lib/crm";
import { unsubOk } from "../../lib/unsub";
export const prerender = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const page = (inner: string) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Email preferences</title></head><body style="margin:0;padding:48px 16px;background:#f3f1ec;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a"><div style="max-width:460px;margin:0 auto;background:#fff;border-radius:10px;padding:28px;line-height:1.55">${inner}</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const bad = () => page(`<h2 style="margin-top:0">That link didn't work</h2><p>Reply to any email you received and ask to be taken off the list. It'll be done right away.</p>`);
const valid = (s: string, k: string, t: string) => UUID.test(s) && /^[ep]:/.test(k) && unsubOk(s, k, t);
export const GET: APIRoute = async ({ url }) => {
  const s = String(url.searchParams.get("s") || ""), k = String(url.searchParams.get("k") || ""), t = String(url.searchParams.get("t") || "");
  if (!valid(s, k, t)) return bad();
  return page(`<h2 style="margin-top:0">Stop these emails?</h2><p>You'll stop getting scheduled update emails. You can still reply anytime if you want to get in touch.</p><form method="post"><input type="hidden" name="s" value="${esc(s)}"><input type="hidden" name="k" value="${esc(k)}"><input type="hidden" name="t" value="${esc(t)}"><button type="submit" style="background:#1a1a1a;color:#fff;border:0;border-radius:6px;padding:12px 20px;font-size:15px;cursor:pointer">Unsubscribe</button></form>`);
};
export const POST: APIRoute = async ({ request }) => {
  const f = await request.formData().catch(() => null);
  const s = String(f?.get("s") || ""), k = String(f?.get("k") || ""), t = String(f?.get("t") || "");
  if (!valid(s, k, t)) return bad();
  const sb = sbAdmin(), now = new Date().toISOString();
  const { data: cur } = await sb.from("crm_people").select("person_key, email_optout").eq("site_id", s).eq("person_key", k).maybeSingle();
  if (!cur?.email_optout) {
    if (cur) await sb.from("crm_people").update({ email_optout: true, updated_at: now }).eq("site_id", s).eq("person_key", k);
    else await sb.from("crm_people").insert({ site_id: s, person_key: k, stage: "new", email_optout: true, updated_at: now });
    const { data: ens } = await sb.from("crm_plan_enrollments").update({ status: "stopped", updated_at: now }).eq("site_id", s).eq("person_key", k).in("status", ["active", "paused"]).select("id");
    const ids = (ens || []).map((e: any) => e.id);
    if (ids.length) { const { data: rs } = await sb.from("crm_drip_sends").select("id").in("enrollment_id", ids).eq("status", "ready"); for (const r of rs || []) await closeDripSend(sb, s, r.id, "skipped"); }
    await sb.from("crm_notes").insert({ site_id: s, person_key: k, body: "Unsubscribed from emails", kind: "system", created_by: "" });
  }
  return page(`<h2 style="margin-top:0">You're unsubscribed</h2><p>You won't get any more scheduled emails. Thanks for letting me know.</p>`);
};