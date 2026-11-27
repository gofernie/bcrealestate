// email-listings v1: find listings by MLS number or address for the composer picker
import type { APIRoute } from "astro";
import { sbAdmin } from "../../../lib/crm";
import { mapListing, fmtPrice } from "../../../lib/sessionHomes";
export const prerender = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const GET: APIRoute = async ({ url, locals }) => {
  const siteId = String(url.searchParams.get("site_id") || ""), q = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  if (!UUID.test(siteId)) return json({ ok: false, error: "Missing site" }, 400);
  const access: any = (locals as any).adminAccess;
  if (access && !access.isPlatformAdmin && !(access.siteIds || []).includes(siteId)) return json({ ok: false, error: "Not your site" }, 403);
  const mlss = String(url.searchParams.get("mlss") || "").split(",").map((s) => s.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean).slice(0, 30);
  if (mlss.length) {
    const { data } = await sbAdmin().from("listing_rows").select("*").in("mls_number", mlss);
    const by = new Map((data || []).map(mapListing).map((h: any) => [String(h.mls), h]));
    return json({ ok: true, results: mlss.map((m) => by.get(m)).filter(Boolean).map((h: any) => ({ mls: h.mls, address: h.address, price: fmtPrice(h.price), city: h.city, image: h.image })) });
  }
  if (q.length < 2) return json({ ok: true, results: [] });
  const sb = sbAdmin();
  let rows: any[] = [];
  const compact = q.replace(/\s/g, "");
  if (/^[A-Za-z]?\d{5,}$/.test(compact)) { const { data } = await sb.from("listing_rows").select("*").eq("mls_number", compact).limit(5); rows = data || []; }
  if (!rows.length) { const { data } = await sb.from("listing_rows").select("*").ilike("address", `%${q.replace(/[%_,()]/g, " ").trim()}%`).limit(10); rows = data || []; }
  return json({ ok: true, results: rows.map(mapListing).filter((h: any) => h.mls).map((h: any) => ({ mls: h.mls, address: h.address, price: fmtPrice(h.price), city: h.city, image: h.image })) });
};