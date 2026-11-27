// crm-import v1: add contacts from a CSV. Existing people (same email/phone) only get blank fields filled.
import type { APIRoute } from "astro";
import { sbAdmin, STAGES, keysFor, normEmailX, normPhoneX, todayStr } from "../../../lib/crm";
export const prerender = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const stageOf = (v: any) => {
  const s = String(v || "").toLowerCase().trim(); if (!s) return "";
  const hit = STAGES.find(([k, l]) => k === s || l.toLowerCase() === s); if (hit) return hit[0];
  if (/past|former|sphere/.test(s)) return "past"; if (/closed|sold/.test(s)) return "closed";
  if (/not ?now|cold|inactive|dead|archive/.test(s)) return "notnow"; if (/active|hot|warm|buyer|seller/.test(s)) return "active";
  return "";
};
const dateOf = (v: any) => {
  const s = String(v || "").trim(); if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { let y = Number(m[3]); if (y < 100) y += y > 30 ? 1900 : 2000; const a = Number(m[1]), b = Number(m[2]); const mo = a > 12 ? b : a, d = a > 12 ? a : b; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  const t = Date.parse(s); return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};
export const POST: APIRoute = async ({ request, locals }) => {
  const b: any = await request.json().catch(() => ({}));
  const siteId = String(b.site_id || "");
  if (!UUID.test(siteId)) return json({ ok: false, error: "Missing site" }, 400);
  const access: any = (locals as any).adminAccess;
  if (access && !access.isPlatformAdmin && !(access.siteIds || []).includes(siteId)) return json({ ok: false, error: "Not your site" }, 403);
  const rows: any[] = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
  const o: any = b.opts || {};
  const defStage = STAGES.some(([k]) => k === o.stage) ? o.stage : "new";
  const sb = sbAdmin(), by = String(access?.userId || ""), now = new Date().toISOString(), today = todayStr();
  try {
    const { data: existing } = await sb.from("crm_people").select("*").eq("site_id", siteId);
    const byKey = new Map<string, any>();
    for (const r of existing || []) { byKey.set(r.person_key, r); for (const k of keysFor(r.email, r.phone)) if (!byKey.has(k)) byKey.set(k, r); }
    let added = 0, updated = 0, skipped = 0; const inserts: any[] = [], notes: any[] = [];
    const s = (v: any, n: number) => String(v || "").trim().slice(0, n) || null;
    for (const x of rows) {
      const em = normEmailX(x.email), ph = normPhoneX(x.phone), keys = keysFor(em, ph);
      if (!keys.length) { skipped++; continue; }
      const rawBm = String(x.bought_month || "").trim();
      const bm = /^\d{4}-\d{2}$/.test(rawBm) ? rawBm : (dateOf(rawBm) || "").slice(0, 7) || null;
      const fields: any = { display_name: s(x.name, 120), email: em || null, phone: ph || null, address: s(x.address, 300), birthday: dateOf(x.birthday), main_city: s(x.main_city, 60), bought_price: Number(String(x.bought_price || "").replace(/[^0-9.]/g, "")) || null, bought_month: bm };
      const st = stageOf(x.stage) || defStage;
      const cur = keys.map((k) => byKey.get(k)).find(Boolean);
      let pk = keys[0];
      if (cur) {
        pk = cur.person_key;
        const patch: any = {};
        for (const [k, v] of Object.entries(fields)) if (v != null && (cur[k] == null || cur[k] === "")) patch[k] = v;
        if ((cur.stage || "new") === "new" && st !== "new") patch.stage = st;
        if (o.is_buyer && cur.is_buyer == null) patch.is_buyer = true;
        if (o.is_seller && cur.is_seller == null) patch.is_seller = true;
        if (o.consent && !cur.consent_express_on) patch.consent_express_on = today;
        if (Object.keys(patch).length && cur.site_id) { patch.updated_at = now; const { error } = await sb.from("crm_people").update(patch).eq("site_id", siteId).eq("person_key", pk); if (error) throw error; Object.assign(cur, patch); }
        updated++;
      } else {
        const row: any = { site_id: siteId, person_key: pk, manual: true, stage: st, ...fields, is_buyer: o.is_buyer ? true : null, is_seller: o.is_seller ? true : null, consent_express_on: o.consent ? today : null, updated_at: now };
        inserts.push(row); for (const k of keys) byKey.set(k, row); byKey.set(pk, row);
        notes.push({ site_id: siteId, person_key: pk, body: "Imported from CSV", kind: "system", created_by: by });
        added++;
      }
      const nt = s(x.note, 4000); if (nt) notes.push({ site_id: siteId, person_key: pk, body: nt, kind: "note", created_by: by });
    }
    if (inserts.length) { const { error } = await sb.from("crm_people").insert(inserts); if (error) throw error; }
    if (notes.length) await sb.from("crm_notes").insert(notes);
    return json({ ok: true, added, updated, skipped });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Import failed" }, 500);
  }
};