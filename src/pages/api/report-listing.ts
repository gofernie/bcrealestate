// Public listing details for the shareable CMA report. Only serves homes that are part of that report.
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { imgUrl } from "../../lib/cma";
export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": status === 200 ? "public, max-age=300" : "no-store" } });

export const GET: APIRoute = async ({ url }) => {
  try {
    const report = String(url.searchParams.get("report") || "");
    const mls = String(url.searchParams.get("mls") || "").replace(/[^A-Za-z0-9]/g, "");
    if (!UUID.test(report) || !mls) return json({ error: "Not found" }, 404);
    const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: rep } = await sb.from("cma_reports").select("data").eq("id", report).maybeSingle();
    const d: any = rep?.data;
    if (!d) return json({ error: "Not found" }, 404);
    const allowed = new Set([d.mls, ...(d.comps || []).map((c: any) => c.mls), ...(d.actives || []).map((a: any) => a.mls)].filter(Boolean).map(String));
    if (!allowed.has(mls)) return json({ error: "This home isn't part of this report." }, 403);

    const [{ data }, { data: bl }, { data: rooms }] = await Promise.all([
      sb.from("listing_rows").select("mls_number, address, image_url, images, description, beds, baths, sqft, year_built, lot_size_sqft, lot_size_acres, price, status, listing_brokerage, property_type, normalized_type, building_name, waterfront, waterfront_type, ocean_view, view_type, video_url, realtor_ca_url, listed_at, normalized_area, lat, lng").eq("mls_number", mls).limit(5),
      sb.from("board_listings").select("original_price, list_price, list_date, last_price_change, off_date, last_status").eq("mls_number", mls).limit(1),
      sb.from("listing_rooms").select("room_label, level, length, width").eq("listing_id", mls).limit(80),
    ]);
    const r: any = (data || []).sort((a: any, b: any) => (Array.isArray(b.images) ? b.images.length : 0) - (Array.isArray(a.images) ? a.images.length : 0))[0];
    if (!r) return json({ error: "No listing details on file for this home." }, 404);
    const imgs = (Array.isArray(r.images) ? r.images : []).map((x: any) => imgUrl(typeof x === "string" ? x : x?.url || x?.src || "", "large")).filter(Boolean);
    if (!imgs.length && r.image_url) imgs.push(imgUrl(r.image_url, "large"));
    const b0: any = bl?.[0] || {};
    const lotSqft = Number(r.lot_size_sqft) || (Number(r.lot_size_acres) ? Number(r.lot_size_acres) * 43560 : null);
    return json({ mls: r.mls_number, address: r.address, images: imgs, description: r.description, beds: r.beds, baths: r.baths, sqft: r.sqft, year: r.year_built, lot: lotSqft,
      listPrice: r.price, brokerage: r.listing_brokerage, propertyType: r.normalized_type || r.property_type, building: r.building_name, area: r.normalized_area, lat: Number(r.lat) || null, lng: Number(r.lng) || null,
      waterfront: r.waterfront === true || /^(true|yes|y)$/i.test(String(r.waterfront || "")) ? (r.waterfront_type || "Yes") : null, view: r.view_type || (r.ocean_view ? "Ocean" : null),
      tour: r.video_url || null, realtorCa: r.realtor_ca_url || null, listedAt: r.listed_at || b0.list_date || null,
      originalPrice: Number(b0.original_price) || null, boardListPrice: Number(b0.list_price) || null, lastPriceChange: b0.last_price_change || null,
      rooms: (rooms || []).filter((x: any) => x.room_label).map((x: any) => ({ name: x.room_label, level: x.level, size: x.length && x.width ? `${x.length} × ${x.width}` : x.length || x.width || "" })) });
  } catch (e: any) {
    return json({ error: e?.message || "Couldn't load this home." }, 500);
  }
};