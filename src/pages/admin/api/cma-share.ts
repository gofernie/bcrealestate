// cma-share-v1: save the CMA on screen as a shareable /report/<id> link (pitch mode: banner + "Read the photos").
// /admin/api/* needs a login (middleware admin-api-guard-v1). The report itself is public but unguessable and noindex.
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
export const prerender = false;

const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: any, max = 200) => (v == null ? null : String(v).slice(0, max));

async function agentFor(sb: any, siteId: string | null) {
  let agentName = "", agentEmail = "", siteName = "", brokerage = "";
  if (siteId) {
    const { data: s } = await sb.from("sites").select("agent_id, site_name").eq("id", siteId).maybeSingle();
    siteName = String(s?.site_name || "").trim();
    if (s?.agent_id) {
      const { data: a } = await sb.from("agents").select("name, email, brokerage").eq("id", s.agent_id).maybeSingle();
      agentName = String(a?.name || "").trim(); agentEmail = String(a?.email || "").trim(); brokerage = String((a as any)?.brokerage || "").trim();
    }
  }
  if (!agentName) agentName = siteName || env("DEFAULT_AGENT_NAME") || "Chris Crump";
  return { agentName, agentEmail, siteName, brokerage };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const access: any = (locals as any).adminAccess;
  if (!access) return json({ error: "Not signed in" }, 401);
  const b: any = await request.json().catch(() => ({}));
  const s: any = b.snapshot || {};
  const mls = String(s.mls || "").replace(/[^A-Za-z0-9]/g, "");
  const comps = Array.isArray(s.comps) ? s.comps.slice(0, 30) : [];
  if (!mls || !comps.length || !(Number(s.likely) > 0)) return json({ error: "Value a listed home first (needs an MLS® number and comps)." }, 400);
  const siteId = access.currentSiteId || null;
  const sb = createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const agent = await agentFor(sb, siteId);
  const data = {
    v: 4, pitch: true, city: str(s.city, 60), mls, address: str(s.address), listPrice: num(s.listPrice), listedAt: str(s.listedAt, 10),
    likely: num(s.likely), lo: num(s.lo), hi: num(s.hi), core: Array.isArray(s.core) ? s.core.slice(0, 2).map(Number) : [0.94, 1.07],
    criteria: str(s.criteria, 300), activeCount: num(s.activeCount),
    confidence: s.confidence ? { level: str(s.confidence.level, 10), reasons: Array.isArray(s.confidence.reasons) ? s.confidence.reasons.slice(0, 5).map((r: any) => str(r, 200)) : [] } : null,
    subject: s.subject || null,
    comps: comps.map((c: any) => ({ mls: str(c.mls, 20), image: str(c.image, 500), address: str(c.address), area: str(c.area, 80), soldDate: str(c.soldDate, 10), soldPrice: num(c.soldPrice), sqft: num(c.sqft), beds: num(c.beds), year: num(c.year), distKm: num(c.distKm), adjusted: num(c.adjusted) })),
    actives: (Array.isArray(s.actives) ? s.actives.slice(0, 20) : []).map((a: any) => ({ mls: str(a.mls, 20), image: str(a.image, 500), address: str(a.address), area: str(a.area, 80), price: num(a.price), sqft: num(a.sqft), beds: num(a.beds), year: num(a.year), listedAt: str(a.listedAt, 10) })),
    agent, generatedAt: new Date().toISOString(),
  };
  const { data: ins, error } = await sb.from("cma_reports").insert({ site_id: siteId, mls, person_key: null, data }).select("id").single();
  if (error || !ins) return json({ error: "Couldn't save the report: " + (error?.message || "") }, 500);
  return json({ id: ins.id });
};
