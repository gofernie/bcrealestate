// admin-access-v1: who can open which admin screens.
// Platform admins (Chris) see everything. Agents see only the sites they own (sites.agent_id = user.id).
// A platform admin can preview the agent view of one site with the admin_view_as cookie (/admin/view-as?site_id=...).
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_ADMIN_IDS } from "./guideAccess";

export type AdminAccess = {
  userId: string;
  isPlatformAdmin: boolean;      // effective (false while previewing as an agent)
  realPlatformAdmin: boolean;    // true for Chris even while previewing
  siteIds: string[] | null;      // null = every site
  viewAsSiteId: string;          // set while previewing
  currentSiteId: string;         // the site this screen is about ("" if none)
};

export const VIEW_AS_COOKIE = "admin_view_as";
export const LAST_SITE_COOKIE = "admin_site";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown) => UUID.test(String(v || ""));

const db = () => createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);

// Screens only the platform admin uses.
const PLATFORM_ONLY = [
  /^\/admin\/sites\/?$/,
  /^\/admin\/(agents|drafts|ai-costs|area-boundaries|fetch-status|city-traffic|market-intelligence|news|prospect-email|new-demo|intent-test|buyers-old|agent-page)(\/|$)/,
  /^\/admin\/api\/(create-demo|demo-scrape)(\/|$)/,
];
// Screens about one site, and the query param that names it.
const SITE_SCOPED: [RegExp, string][] = [
  [/^\/admin\/(leads|intent-sessions|digests|watches|buyers|create-shortlist)\/?$/, "site_id"],
  [/^\/admin\/intent-pages\/new\/?$/, "site_id"],
  [/^\/admin\/intent-pages\/?$/, "site_id"],
  [/^\/admin\/guides\/?$/, "site"],
  [/^\/shortlists\/?$/, "site_id"],
  [/^\/listings\/?$/, "site_id"],
];

export function isPlatformOnly(pathname: string) {
  return PLATFORM_ONLY.some((re) => re.test(pathname));
}

/** Work out access for this request. Returns a redirect path when the agent asked for something outside their sites. */
export async function resolveAdminAccess(user: { id: string }, url: URL, cookies: any): Promise<{ access: AdminAccess; redirect?: string; forbidden?: string }> {
  const sb = db();
  const realPlatformAdmin = PLATFORM_ADMIN_IDS.has(user.id);
  const viewAsRaw = realPlatformAdmin ? String(cookies.get(VIEW_AS_COOKIE)?.value || "") : "";
  const viewAsSiteId = isUuid(viewAsRaw) ? viewAsRaw : "";
  const isPlatformAdmin = realPlatformAdmin && !viewAsSiteId;

  let siteIds: string[] | null = null;
  if (!isPlatformAdmin) {
    if (viewAsSiteId) siteIds = [viewAsSiteId];
    else {
      const { data } = await sb.from("sites").select("id").eq("agent_id", user.id).order("created_at", { ascending: true });
      siteIds = (data || []).map((r: any) => String(r.id));
    }
  }

  const { pathname } = url;
  // Which site is this screen about?
  let currentSiteId = "";
  const pathSite = (pathname.match(/^\/admin\/sites\/([0-9a-f-]{36})(\/|$)/i) || [])[1] || "";
  if (pathSite) currentSiteId = pathSite;
  const scoped = SITE_SCOPED.find(([re]) => re.test(pathname));
  if (!currentSiteId) {
    const q = url.searchParams.get(scoped ? scoped[1] : "site_id") || url.searchParams.get("site_id") || url.searchParams.get("site") || url.searchParams.get("siteId") || "";
    if (isUuid(q)) currentSiteId = q;
  }
  const editor = pathname.match(/^\/admin\/(intent-pages|guide-pages)\/([^/]+)\/edit\/?$/i);
  if (!currentSiteId && editor) {
    try {
      const { data } = await sb.from(editor[1] === "guide-pages" ? "guide_pages" : "intent_pages").select("site_id").eq("id", editor[2]).maybeSingle();
      if (isUuid(data?.site_id)) currentSiteId = String(data!.site_id);
    } catch {}
  }

  const access: AdminAccess = { userId: user.id, isPlatformAdmin, realPlatformAdmin, siteIds, viewAsSiteId, currentSiteId };

  if (isPlatformAdmin) {
    if (!currentSiteId) {
      const last = String(cookies.get(LAST_SITE_COOKIE)?.value || "");
      if (isUuid(last) && !isPlatformOnly(pathname)) access.currentSiteId = last;
    }
    return { access };
  }

  // Agent (or preview) from here on.
  const own = siteIds || [];
  if (!own.length) return { access, forbidden: "There's no website linked to this login yet. Ask Locus support to connect your site." };
  const home = `/admin/sites/${own[0]}/pages`;

  if (pathname === "/admin" || pathname === "/admin/") return { access, redirect: home };
  if (isPlatformOnly(pathname)) return { access, redirect: home };

  if (pathSite && !own.includes(pathSite)) return { access, redirect: home };
  if (editor && currentSiteId && !own.includes(currentSiteId)) return { access, redirect: home };
  if (editor && !currentSiteId) return { access, redirect: home };

  if (scoped) {
    const [, param] = scoped;
    const given = url.searchParams.get(param) || "";
    if (!given || !own.includes(given)) {
      const next = new URL(url);
      next.searchParams.set(param, own.includes(currentSiteId) ? currentSiteId : own[0]);
      if (param !== "site_id") next.searchParams.delete("site_id");
      return { access, redirect: next.pathname + next.search };
    }
  }
  if (!currentSiteId || !own.includes(currentSiteId)) access.currentSiteId = own[0];
  return { access };
}

export function forbiddenPage(message: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Locus Admin</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f5f1ea;color:#161616}div{background:#fff;border:1px solid #e6e1d8;border-radius:14px;padding:32px;max-width:420px}h1{font-size:20px;margin:0 0 8px}p{color:#6f6a62;margin:0 0 16px;line-height:1.5}form{margin:0}button{border:0;border-radius:8px;background:#161616;color:#fff;padding:10px 16px;font-weight:600;cursor:pointer}</style></head><body><div><h1>Almost there</h1><p>${message}</p><form method="post" action="/api/auth/logout"><button>Log out</button></form></div></body></html>`;
  return new Response(html, { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// admin-api-guard-v1: agents can only read/write data that belongs to their own site(s).
const PLATFORM_ONLY_API = /^\/(api\/admin\/(area-boundary|imported-boundary-lines)|api\/create-agent|api\/prospect-pages\/|admin\/api\/(create-demo|demo-scrape))(\/|$)/;
// Endpoints that check ownership themselves or touch no site data.
const SELF_CHECKED_API = /^\/(admin\/api\/(generate-guide|guide-[a-z-]+|intent-autofill)|api\/auth\/)(\/|$)/;

async function readBody(req: Request): Promise<any> {
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) return await req.json();
    if (type.includes("form")) { const f = await req.formData(); const o: any = {}; f.forEach((v, k) => { if (typeof v === "string") o[k] = v; }); return o; }
    const text = await req.text();
    try { return JSON.parse(text); } catch { return {}; }
  } catch { return {}; }
}

export async function checkApiAccess(request: Request, url: URL, access: AdminAccess): Promise<{ allowed: boolean; reason?: string }> {
  if (access.isPlatformAdmin) return { allowed: true };
  const p = url.pathname;
  if (PLATFORM_ONLY_API.test(p)) return { allowed: false, reason: "Platform only" };
  if (SELF_CHECKED_API.test(p)) return { allowed: true };
  const own = new Set(access.siteIds || []);
  const sb = db();
  const body = request.method === "GET" || request.method === "HEAD" ? {} : await readBody(request);
  const qp = (k: string) => url.searchParams.get(k) || "";
  const s = (v: any) => String(v ?? "").trim();

  const siteIds = new Set<string>();
  const addSite = (v: any) => { if (isUuid(v)) siteIds.add(String(v)); };
  let found = false;

  // Direct site ids
  for (const v of [qp("site_id"), qp("siteId"), body?.site_id, body?.siteId]) if (s(v)) { found = true; addSite(s(v)); if (!isUuid(s(v))) return { allowed: false, reason: "Bad site" }; }
  if (/^\/api\/(site-settings|admin\/site-hero)\/?$/.test(p)) for (const v of [qp("id"), body?.id]) if (s(v)) { found = true; addSite(s(v)); }

  // Things that belong to a site
  const pageIds = [body?.page_id, ...(Array.isArray(body?.items) ? body.items.map((i: any) => i?.id) : [])].map(s).filter(Boolean);
  if (pageIds.length) {
    found = true;
    const { data } = await sb.from("intent_pages").select("id, site_id").in("id", pageIds);
    if ((data || []).length !== new Set(pageIds).size) return { allowed: false, reason: "Unknown page" };
    for (const r of data || []) { if (!r.site_id) return { allowed: false, reason: "Shared page" }; addSite(r.site_id); }
  }
  const sessionId = s(body?.session_id || body?.sessionId || body?.data?.session_id || qp("session_id"));
  if (sessionId) {
    found = true;
    const { data } = await sb.from("intent_sessions").select("site_id").eq("session_id", sessionId).maybeSingle();
    if (!data?.site_id) return { allowed: false, reason: "Unknown session" };
    addSite(data.site_id);
  }
  if (/^\/api\/admin\/digests\/?$/.test(p)) {
    const cfg = s(body?.configId || (body?.action === "save-config" ? body?.id : ""));
    if (cfg) { found = true; const { data } = await sb.from("digest_configs").select("site_id").eq("id", cfg).maybeSingle(); if (!data?.site_id) return { allowed: false, reason: "Unknown digest" }; addSite(data.site_id); }
    const sub = s(body?.subscriberId);
    if (sub) { found = true; const { data } = await sb.from("digest_subscribers").select("config_id").eq("id", sub).maybeSingle(); const { data: c } = data?.config_id ? await sb.from("digest_configs").select("site_id").eq("id", data.config_id).maybeSingle() : { data: null }; if (!c?.site_id) return { allowed: false, reason: "Unknown subscriber" }; addSite(c.site_id); }
    const run = s(body?.runId);
    if (run) { found = true; const { data } = await sb.from("digest_runs").select("config_id").eq("id", run).maybeSingle(); const { data: c } = data?.config_id ? await sb.from("digest_configs").select("site_id").eq("id", data.config_id).maybeSingle() : { data: null }; if (!c?.site_id) return { allowed: false, reason: "Unknown run" }; addSite(c.site_id); }
  }
  for (const v of siteIds) if (!own.has(v)) return { allowed: false, reason: "Not your site" };

  // Shortlists and buyers belong to an agent
  const ownAgents = new Set<string>();
  const loadAgents = async () => {
    if (ownAgents.size) return;
    const { data } = await sb.from("sites").select("agent_id").in("id", [...own]);
    for (const r of data || []) if (r.agent_id) ownAgents.add(String(r.agent_id));
  };
  const shortlistId = s(body?.shortlistId);
  const shortlistSlug = /^\/api\/shortlists\//.test(p) ? s(body?.slug) : "";
  if (shortlistId || shortlistSlug) {
    found = true; await loadAgents();
    const q = sb.from("shortlist_sends").select("agent_id");
    const { data } = await (shortlistId ? q.eq("id", shortlistId) : q.eq("shortlist_slug", shortlistSlug)).maybeSingle();
    if (!data || !ownAgents.has(String(data.agent_id))) return { allowed: false, reason: "Not your shortlist" };
  }
  if (s(body?.agentId)) { found = true; await loadAgents(); if (!ownAgents.has(s(body.agentId))) return { allowed: false, reason: "Not your agent" }; }
  if (/^\/api\/buyers\//.test(p) && s(body?.name)) {
    found = true; await loadAgents();
    const { data } = await sb.from("shortlist_sends").select("id").ilike("client_name", s(body.name)).in("agent_id", [...ownAgents]).limit(1);
    if (!data?.length) return { allowed: false, reason: "Not your buyer" };
  }

  if (found) return { allowed: true };
  // Reads with nothing site-specific are fine; writes must name something we can check.
  if (request.method === "GET" || request.method === "HEAD") return { allowed: true };
  return { allowed: false, reason: "Can't tell which site this change is for" };
}
