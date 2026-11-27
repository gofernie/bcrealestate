// crm-v1: save stage / follow-up / name, add notes, mark followed up
import type { APIRoute } from "astro";
import { sbAdmin, STAGES, stageLabel, keysFor, normEmailX, normPhoneX } from "../../../lib/crm";
import { stopClosedPlans } from "../../../lib/drips";
export const prerender = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const POST: APIRoute = async ({ request, locals }) => {
  const b: any = await request.json().catch(() => ({}));
  const siteId = String(b.site_id || ""), key = String(b.key || "");
  if (!UUID.test(siteId) || (!/^[ep]:/.test(key) && b.action !== "create_person")) return json({ ok: false, error: "Missing site or person" }, 400);
  const access: any = (locals as any).adminAccess;
  if (access && !access.isPlatformAdmin && !(access.siteIds || []).includes(siteId)) return json({ ok: false, error: "Not your site" }, 403);
  const sb = sbAdmin();
  const by = String(access?.userId || "");
  const { data: cur } = await sb.from("crm_people").select("*").eq("site_id", siteId).eq("person_key", key).maybeSingle();
  const upsert = async (patch: any) => {
    const row = { site_id: siteId, person_key: key, stage: cur?.stage || "new", ...patch, updated_at: new Date().toISOString() };
    const { error } = await sb.from("crm_people").upsert(row, { onConflict: "site_id,person_key" });
    if (error) throw error;
  };
  let extra: any = {}; const setPartner = async (pk: string) => { if (cur?.partner_key && cur.partner_key !== pk) await sb.from("crm_people").update({ partner_key: null }).eq("site_id", siteId).eq("person_key", cur.partner_key).eq("partner_key", key); await upsert({ partner_key: pk }); }; const syncNext = async () => { const { data: nt } = await sb.from("crm_tasks").select("title, due_on").eq("site_id", siteId).eq("person_key", key).is("done_at", null).not("due_on", "is", null).order("due_on", { ascending: true }).limit(1).maybeSingle(); await upsert({ next_followup_at: nt?.due_on || null, followup_note: nt?.title || null }); }; const note = (body: string, kind = "note") => sb.from("crm_notes").insert({ site_id: siteId, person_key: key, body, kind, created_by: by });
  try {
    if (b.action === "stage") {
      const s = String(b.stage || "");
      if (!STAGES.some(([k]) => k === s)) return json({ ok: false, error: "Bad stage" }, 400);
      if (s !== (cur?.stage || "new") && ["closed", "past"].includes(s)) await stopClosedPlans(sb, siteId, key, note);
      if (s !== (cur?.stage || "new")) { await upsert({ stage: s }); await note(`Stage: ${stageLabel(cur?.stage || "new")} → ${stageLabel(s)}`, "system"); }
    } else if (b.action === "followup") {
      const d = b.date ? String(b.date).slice(0, 10) : null;
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ ok: false, error: "Bad date" }, 400);
      await upsert({ next_followup_at: d, followup_note: b.note ? String(b.note).slice(0, 300) : null });
    } else if (b.action === "done") {
      await upsert({ next_followup_at: null, followup_note: null });
      const why = String(b.note || cur?.followup_note || "").trim(); const { data: nr } = await sb.from("crm_notes").insert({ site_id: siteId, person_key: key, body: why ? `Followed up: ${why.slice(0, 500)}` : "Followed up", kind: "system", created_by: by }).select("id").single(); extra = { undo: { date: cur?.next_followup_at || null, note: cur?.followup_note || null, noteId: nr?.id || null } };
    } else if (b.action === "undo_done") { const d = b.date ? String(b.date).slice(0, 10) : null; if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ ok: false, error: "Bad date" }, 400); await upsert({ next_followup_at: d, followup_note: b.note ? String(b.note).slice(0, 300) : null }); if (b.noteId) await sb.from("crm_notes").delete().eq("id", String(b.noteId)).eq("site_id", siteId).eq("person_key", key).eq("kind", "system");
    } else if (b.action === "task_add") {
      const title = String(b.title || "").trim().slice(0, 300);
      if (!title) return json({ ok: false, error: "Empty task" }, 400);
      const due = b.due ? String(b.due).slice(0, 10) : null;
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return json({ ok: false, error: "Bad date" }, 400);
      const { error } = await sb.from("crm_tasks").insert({ site_id: siteId, person_key: key, title, due_on: due, created_by: by });
      if (error) throw error;
      await syncNext();
    } else if (["task_done", "task_undo", "task_delete"].includes(b.action)) {
      const id = String(b.id || "");
      if (!UUID.test(id)) return json({ ok: false, error: "Bad task" }, 400);
      const { data: tk } = await sb.from("crm_tasks").select("*").eq("id", id).eq("site_id", siteId).eq("person_key", key).maybeSingle();
      if (!tk) return json({ ok: false, error: "Task not found" }, 404);
      if (b.action === "task_done") {
        await sb.from("crm_tasks").update({ done_at: new Date().toISOString() }).eq("id", id);
        await note(`Done: ${tk.title}`, "system");
      } else if (b.action === "task_undo") {
        await sb.from("crm_tasks").update({ done_at: null }).eq("id", id);
        const { data: dn } = await sb.from("crm_notes").select("id").eq("site_id", siteId).eq("person_key", key).eq("kind", "system").eq("body", `Done: ${tk.title}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (dn) await sb.from("crm_notes").delete().eq("id", dn.id);
      } else {
        await sb.from("crm_tasks").delete().eq("id", id);
      }
      await syncNext();
    } else if (b.action === "note") {
      const body = String(b.body || "").trim().slice(0, 4000);
      if (!body) return json({ ok: false, error: "Empty note" }, 400);
      await note(body);
      if (!cur) await upsert({});
    } else if (b.action === "details") {
      const s = (v: any, n: number) => String(v || "").trim().slice(0, n) || null;
      const bd = s(b.birthday, 10);
      if (bd && !/^\d{4}-\d{2}-\d{2}$/.test(bd)) return json({ ok: false, error: "Bad birthday" }, 400);
      const sbd = s(b.spouse_birthday, 10);
      if (sbd && !/^\d{4}-\d{2}-\d{2}$/.test(sbd)) return json({ ok: false, error: "Bad spouse birthday" }, 400);
      await upsert({ address: s(b.address, 300), birthday: bd });
    } else if (b.action === "create_person") {
      const name = String(b.name || "").trim().slice(0, 120);
      const em = normEmailX(b.email), ph = normPhoneX(b.phone);
      const nk = keysFor(em, ph)[0];
      if (!name) return json({ ok: false, error: "Name needed" }, 400);
      if (!nk) return json({ ok: false, error: "Valid email or phone needed" }, 400);
      if (nk === key) return json({ ok: false, error: "That's this person's own email or phone" }, 400);
      const pbd = String(b.birthday || "").slice(0, 10) || null;
      if (pbd && !/^\d{4}-\d{2}-\d{2}$/.test(pbd)) return json({ ok: false, error: "Bad birthday" }, 400);
      const linking = !!b.link && /^[ep]:/.test(key);
      const row: any = { site_id: siteId, person_key: nk, display_name: name, email: em || null, phone: ph || null, manual: true, updated_at: new Date().toISOString() };
      if (pbd) row.birthday = pbd;
      if (linking) row.partner_key = key;
      const { error } = await sb.from("crm_people").upsert(row, { onConflict: "site_id,person_key" });
      if (error) throw error;
      if (linking) { await setPartner(nk); await upsert({ spouse_name: null, spouse_phone: null, spouse_email: null, spouse_birthday: null }); }
      extra = { key: nk };
    } else if (b.action === "link_partner") {
      const pk = String(b.partner_key || "");
      if (!/^[ep]:/.test(pk) || pk === key) return json({ ok: false, error: "Bad partner" }, 400);
      const { error } = await sb.from("crm_people").upsert({ site_id: siteId, person_key: pk, partner_key: key, updated_at: new Date().toISOString() }, { onConflict: "site_id,person_key" });
      if (error) throw error;
      await setPartner(pk);
    } else if (b.action === "unlink_partner") {
      await sb.from("crm_people").update({ partner_key: null }).eq("site_id", siteId).eq("partner_key", key);
      await upsert({ partner_key: null });
    } else if (b.action === "profile") {
      const s = (v: any, n: number) => String(v || "").trim().slice(0, n) || null;
      const pbd = s(b.birthday, 10);
      if (pbd && !/^\d{4}-\d{2}-\d{2}$/.test(pbd)) return json({ ok: false, error: "Bad birthday" }, 400);
      const rawE = String(b.email || "").trim(), rawP = String(b.phone || "").trim();
      const em = normEmailX(rawE), ph = normPhoneX(rawP);
      if (rawE && !em) return json({ ok: false, error: "That email doesn't look right" }, 400);
      if (rawP && !ph) return json({ ok: false, error: "Phone needs 10 digits" }, 400);
      await upsert({ display_name: s(b.name, 120), address: s(b.address, 300), birthday: pbd, email: em || null, phone: ph || null, listing_mls: String(b.listing_mls || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || null, bought_price: Number(String(b.bought_price || "").replace(/[^0-9.]/g, "")) || null, bought_month: /^\d{4}-\d{2}$/.test(String(b.bought_month || "")) ? String(b.bought_month) : null, bought_type: ["house", "townhouse", "apartment"].includes(String(b.bought_type)) ? String(b.bought_type) : null, main_city: s(b.main_city, 60) });
    } else if (b.action === "roles") {
      const tri = (v: any) => (v === true || v === false ? v : null);
      await upsert({ is_buyer: tri(b.is_buyer), is_seller: tri(b.is_seller) });
    } else if (b.action === "name") {
      await upsert({ display_name: String(b.name || "").trim().slice(0, 120) || null });
    } else return json({ ok: false, error: "Unknown action" }, 400);
    return json({ ok: true, ...extra });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Save failed" }, 500);
  }
};
