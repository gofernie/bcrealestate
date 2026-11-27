// crm-plans v1: save/delete plans, start/pause/stop a plan for a person, send/skip queued emails
import type { APIRoute } from "astro";
import { sbAdmin, todayStr, closeDripSend } from "../../../lib/crm";
import { runDrips, sendReady, STARTER_PLANS } from "../../../lib/drips";
import { toHtml, withIntel, agentFor } from "./person-email";
import { siteBase } from "../../../lib/sessionHomes";
export const prerender = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const POST: APIRoute = async ({ request, locals }) => {
  const b: any = await request.json().catch(() => ({}));
  const siteId = String(b.site_id || "");
  if (!UUID.test(siteId)) return json({ ok: false, error: "Missing site" }, 400);
  const access: any = (locals as any).adminAccess;
  if (access && !access.isPlatformAdmin && !(access.siteIds || []).includes(siteId)) return json({ ok: false, error: "Not your site" }, 403);
  const sb = sbAdmin(), now = new Date().toISOString(), id = String(b.id || "");
  const ownPlan = async (pid: string) => { if (!UUID.test(pid)) return null; const { data } = await sb.from("crm_plans").select("id, name").eq("id", pid).eq("site_id", siteId).maybeSingle(); return data; };
  const note = (key: string, body: string) => sb.from("crm_notes").insert({ site_id: siteId, person_key: key, body, kind: "system", created_by: String(access?.userId || "") });
  try {
    if (b.action === "plan_save") {
      const name = String(b.name || "").trim().slice(0, 120);
      const description = String(b.description || "").trim().slice(0, 300) || null;
      const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 30).map((s: any) => ({
        day_offset: Math.max(0, Math.min(3650, Math.round(Number(s.day_offset) || 0))), subject: String(s.subject || "").trim().slice(0, 200),
        body: String(s.body || "").trim().slice(0, 8000), mode: s.mode === "auto" ? "auto" : "review",
      })).filter((s: any) => s.subject && s.body).map((s: any, i: number) => ({ ...s, position: i }));
      if (!name) return json({ ok: false, error: "Give the plan a name" }, 400);
      if (!steps.length) return json({ ok: false, error: "Add at least one email with a subject and message" }, 400);
      let pid = id;
      if (pid) {
        if (!(await ownPlan(pid))) return json({ ok: false, error: "Plan not found" }, 404);
        const { error } = await sb.from("crm_plans").update({ name, description, stop_when_closed: !!b.stop_when_closed, pause_on_reply: !!b.pause_on_reply, updated_at: now }).eq("id", pid); if (error) throw error;
      } else {
        const { data, error } = await sb.from("crm_plans").insert({ site_id: siteId, name, description, stop_when_closed: !!b.stop_when_closed, pause_on_reply: !!b.pause_on_reply }).select("id").single(); if (error) throw error; pid = data.id;
      }
      const { error: de } = await sb.from("crm_plan_steps").delete().eq("plan_id", pid); if (de) throw de;
      const { error: ie } = await sb.from("crm_plan_steps").insert(steps.map((s: any) => ({ ...s, plan_id: pid }))); if (ie) throw ie;
      return json({ ok: true, id: pid });
    }
    if (b.action === "plan_delete") {
      if (!(await ownPlan(id))) return json({ ok: false, error: "Plan not found" }, 404);
      const { error } = await sb.from("crm_plans").delete().eq("id", id); if (error) throw error;
      return json({ ok: true });
    }
    if (b.action === "seed") {
      const { data: have } = await sb.from("crm_plans").select("name").eq("site_id", siteId);
      const names = new Set((have || []).map((x: any) => x.name));
      for (const P of STARTER_PLANS) {
        if (names.has(P.name)) continue;
        const { data, error } = await sb.from("crm_plans").insert({ site_id: siteId, name: P.name, description: P.description, stop_when_closed: !!(P as any).stop_when_closed, pause_on_reply: !!(P as any).stop_when_closed }).select("id").single(); if (error) throw error;
        const { error: se } = await sb.from("crm_plan_steps").insert(P.steps.map((s: any, i: number) => ({ ...s, position: i, plan_id: data.id }))); if (se) throw se;
      }
      return json({ ok: true });
    }
    if (b.action === "preview") {
      const { data: st } = await sb.from("sites").select("city, primary_city").eq("id", siteId).maybeSingle();
      const slug = String(b.city || st?.primary_city || st?.city || "nanaimo").toLowerCase().trim().replace(/\s+/g, "-");
      const city = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const ag = await agentFor(sb, siteId);
      let base = ""; try { base = String((await siteBase(sb, siteId)) || "").replace(/\/$/, ""); } catch {}
      const v: Record<string, string> = { hi: "Hi Fred and Sally,", first_name: "Fred", names: "Fred and Sally", city, city_report: base ? `${base}/${slug}/market-intelligence` : "", loved_home: "123 Sample Street", agent_name: ag.agentName, agent_first: String(ag.agentName).split(/\s+/)[0] };
      const mg = (s: string) => String(s || "").replace(/\{(\w+)\}/g, (m: string, k: string) => (k in v ? v[k] : m));
      const subject = mg(b.subject), text = mg(b.body);
      if (b.block_only) return json({ ok: true, html: await withIntel(sb, toHtml(text), siteId) });
      const sig = [ag.agentName, ag.brokerage, ag.agentEmail].filter(Boolean).join("\n");
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${await withIntel(sb, toHtml(text), siteId)}<br><br><div style="color:#555;font-size:13px">${toHtml(sig)}</div><div style="color:#999;font-size:12px;margin-top:16px">You're receiving this because you've been in touch with ${ag.agentName}. <a href="#" style="color:#999">Unsubscribe</a></div></div>`;
      return json({ ok: true, subject, html });
    }
    const key = String(b.key || "");
    if (!/^[ep]:/.test(key)) return json({ ok: false, error: "Missing person" }, 400);
    if (b.action === "consent_set") {
      const on = !!b.on, val = on ? todayStr() : null;
      const { data: cp } = await sb.from("crm_people").select("person_key").eq("site_id", siteId).eq("person_key", key).maybeSingle();
      const { error } = cp
        ? await sb.from("crm_people").update({ consent_express_on: val, updated_at: now }).eq("site_id", siteId).eq("person_key", key)
        : await sb.from("crm_people").insert({ site_id: siteId, person_key: key, stage: "new", consent_express_on: val, updated_at: now });
      if (error) throw error;
      await note(key, on ? "Said yes to emails (express consent)" : "Express email consent removed");
      return json({ ok: true });
    }
    if (b.action === "assign") {
      const plan: any = await ownPlan(String(b.plan_id || ""));
      if (!plan) return json({ ok: false, error: "Plan not found" }, 404);
      const { data: out } = await sb.from("crm_people").select("email_optout").eq("site_id", siteId).eq("person_key", key).maybeSingle();
      if (out?.email_optout) return json({ ok: false, error: "They unsubscribed from plan emails" }, 400);
      const { data: dup } = await sb.from("crm_plan_enrollments").select("id").eq("site_id", siteId).eq("person_key", key).eq("plan_id", plan.id).in("status", ["active", "paused"]).limit(1);
      if (dup?.length) return json({ ok: false, error: "Already on this plan" }, 400);
      const { data: en, error } = await sb.from("crm_plan_enrollments").insert({ site_id: siteId, person_key: key, plan_id: plan.id, started_on: todayStr(), next_step: 0, status: "active" }).select("id").single();
      if (error) throw error;
      await note(key, `Started plan: ${plan.name}`);
      const log = await runDrips({ enrollmentId: en.id });
      return json({ ok: true, log });
    }
    if (b.action === "enroll_status") {
      const st = String(b.status || "");
      if (!["active", "paused", "stopped"].includes(st) || !UUID.test(id)) return json({ ok: false, error: "Bad request" }, 400);
      const { data: e } = await sb.from("crm_plan_enrollments").select("id, plan_id").eq("id", id).eq("site_id", siteId).maybeSingle();
      if (!e) return json({ ok: false, error: "Not found" }, 404);
      await sb.from("crm_plan_enrollments").update({ status: st, updated_at: now }).eq("id", id);
      if (st === "stopped") {
        const { data: rs } = await sb.from("crm_drip_sends").select("id").eq("enrollment_id", id).eq("status", "ready");
        for (const r of rs || []) await closeDripSend(sb, siteId, r.id, "skipped");
        const pl: any = await ownPlan(e.plan_id); await note(key, `Stopped plan: ${pl?.name || "plan"}`);
      }
      if (st === "active") await runDrips({ enrollmentId: id });
      return json({ ok: true });
    }
    if (b.action === "remove") {
      if (!UUID.test(id)) return json({ ok: false, error: "Bad request" }, 400);
      const { data: e } = await sb.from("crm_plan_enrollments").select("id, plan_id").eq("id", id).eq("site_id", siteId).maybeSingle();
      if (!e) return json({ ok: false, error: "Not found" }, 404);
      const { data: rs } = await sb.from("crm_drip_sends").select("id").eq("enrollment_id", id).eq("status", "ready");
      for (const r of rs || []) await closeDripSend(sb, siteId, r.id, "skipped");
      const { error } = await sb.from("crm_plan_enrollments").delete().eq("id", id);
      if (error) throw error;
      const pl: any = await ownPlan(e.plan_id); await note(key, `Removed plan: ${pl?.name || "plan"}`);
      return json({ ok: true });
    }
    if (b.action === "ready_send") { if (!UUID.test(id)) return json({ ok: false, error: "Bad request" }, 400); const r: any = await sendReady(siteId, id); return json(r, r.ok ? 200 : 400); }
    if (b.action === "ready_skip") { if (!UUID.test(id)) return json({ ok: false, error: "Bad request" }, 400); await closeDripSend(sb, siteId, id, "skipped"); return json({ ok: true }); }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Save failed" }, 500);
  }
};