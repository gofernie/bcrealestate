// crm-checklist v1: buyer / seller transaction checklists per person
import type { APIRoute } from "astro";
import { sbAdmin } from "../../../lib/crm";
export const prerender = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Edit these to change what a new checklist starts with. Existing checklists keep their own steps.
export const CHECKLISTS: Record<string, string[]> = {
  buyer: [
    "Disclosure of representation (BCFSA) reviewed",
    "Mortgage pre-approval in place",
    "Needs confirmed: areas, budget, timing",
    "Listing alerts set up",
    "Showings booked",
    "Offer written",
    "Offer accepted",
    "Deposit delivered",
    "Home inspection done",
    "Financing approved",
    "Strata documents reviewed (if strata)",
    "Title and property disclosure statement reviewed",
    "Subjects removed",
    "Rescission period over (3 business days)",
    "Lawyer or notary chosen, file sent",
    "Home insurance arranged",
    "Completion day",
    "Possession and keys",
    "Follow-up and review request",
  ],
  seller: [
    "Disclosure of representation (BCFSA) reviewed",
    "CMA and pricing discussed",
    "Listing agreement signed",
    "Property disclosure statement completed",
    "Title search done",
    "Strata documents ordered (if strata)",
    "Photos and floor plans",
    "Sign and lockbox",
    "Listed on MLS\u00ae",
    "Showings and feedback",
    "Offer received",
    "Offer accepted",
    "Subjects removed",
    "Lawyer or notary instructed",
    "Completion day",
    "Keys handed over",
    "Follow-up and review request",
  ],
};

export const POST: APIRoute = async ({ request, locals }) => {
  const b: any = await request.json().catch(() => ({}));
  const siteId = String(b.site_id || ""), key = String(b.key || "");
  if (!UUID.test(siteId) || !/^[ep]:/.test(key)) return json({ ok: false, error: "Missing site or person" }, 400);
  const access: any = (locals as any).adminAccess;
  if (access && !access.isPlatformAdmin && !(access.siteIds || []).includes(siteId)) return json({ ok: false, error: "Not your site" }, 403);
  const sb = sbAdmin(), by = String(access?.userId || ""), id = String(b.id || "");
  const note = (body: string) => sb.from("crm_notes").insert({ site_id: siteId, person_key: key, body, kind: "system", created_by: by });
  const item = async () => { if (!UUID.test(id)) return null; const { data } = await sb.from("crm_checklist").select("*").eq("id", id).eq("site_id", siteId).maybeSingle(); return data; };
  try {
    if (b.action === "start") {
      const kind = String(b.kind || "");
      if (!CHECKLISTS[kind]) return json({ ok: false, error: "Bad checklist" }, 400);
      const { data: have } = await sb.from("crm_checklist").select("id").eq("site_id", siteId).eq("person_key", key).eq("kind", kind).limit(1);
      if (have?.length) return json({ ok: false, error: "Already started" }, 400);
      const { error } = await sb.from("crm_checklist").insert(CHECKLISTS[kind].map((t, i) => ({ site_id: siteId, person_key: key, kind, item: t, position: i })));
      if (error) throw error;
      return json({ ok: true });
    }
    if (b.action === "clear") {
      const kind = String(b.kind || "");
      if (!CHECKLISTS[kind]) return json({ ok: false, error: "Bad checklist" }, 400);
      const { error } = await sb.from("crm_checklist").delete().eq("site_id", siteId).eq("person_key", key).eq("kind", kind);
      if (error) throw error;
      return json({ ok: true });
    }
    if (b.action === "add") {
      const kind = String(b.kind || ""), text = String(b.item || "").trim().slice(0, 200);
      if (!CHECKLISTS[kind] || !text) return json({ ok: false, error: "Add some text" }, 400);
      const { data: last } = await sb.from("crm_checklist").select("position").eq("site_id", siteId).eq("person_key", key).eq("kind", kind).order("position", { ascending: false }).limit(1).maybeSingle();
      const { error } = await sb.from("crm_checklist").insert({ site_id: siteId, person_key: key, kind, item: text, position: (last?.position ?? -1) + 1 });
      if (error) throw error;
      return json({ ok: true });
    }
    if (["done", "undo", "delete"].includes(b.action)) {
      const it: any = await item();
      if (!it) return json({ ok: false, error: "Step not found" }, 404);
      if (b.action === "delete") { await sb.from("crm_checklist").delete().eq("id", it.id); return json({ ok: true }); }
      if (b.action === "done") { await sb.from("crm_checklist").update({ done_at: new Date().toISOString() }).eq("id", it.id); await note(`Done: ${it.item}`); }
      else {
        await sb.from("crm_checklist").update({ done_at: null }).eq("id", it.id);
        const { data: dn } = await sb.from("crm_notes").select("id").eq("site_id", siteId).eq("person_key", key).eq("kind", "system").eq("body", `Done: ${it.item}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (dn) await sb.from("crm_notes").delete().eq("id", dn.id);
      }
      return json({ ok: true });
    }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Save failed" }, 500);
  }
};