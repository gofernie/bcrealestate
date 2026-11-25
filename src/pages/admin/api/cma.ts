// cma-v1: agent-only CMA endpoint. /admin/api/* needs a login (middleware admin-api-guard-v1).
import type { APIRoute } from "astro";
import { findSubject, runCma, cityAreas, familyOf, valueSince, backtest, imgUrl, blindValue, type Subject } from "../../../lib/cma";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const n = (v: string | null) => { const x = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(x) && x > 0 ? x : null; };

export const GET: APIRoute = async ({ url, locals }) => {
  if (!(locals as any).adminAccess) return json({ error: "Not signed in" }, 401);
  const p = url.searchParams;
  const city = String(p.get("city") || "nanaimo").toLowerCase().replace(/[^a-z -]/g, "").trim() || "nanaimo";
  try {
    if (p.get("areas")) return json({ areas: await cityAreas(city) });
    if (p.get("blind1")) return json(await blindValue(city, String(p.get("blind1")).replace(/[^A-Za-z0-9]/g, ""))); /* cma-blind-v1 */
    if (p.get("backtest")) return json(await backtest(city, familyOf(p.get("backtest")), Math.min(365, Number(p.get("days")) || 90), !!p.get("rows"), !!p.get("blind"))); /* cma-backtest-v1 */
    if (p.get("photos")) { /* cma-photos-v1: agent-only sold photo viewer */
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
      const mls = String(p.get("photos")).replace(/[^A-Za-z0-9]/g, "");
      const [{ data }, { data: bl }, { data: rooms }] = await Promise.all([
        sb.from("listing_rows").select("mls_number, address, image_url, images, description, beds, baths, sqft, year_built, lot_size_sqft, lot_size_acres, price, status, listing_brokerage, property_type, normalized_type, building_name, waterfront, waterfront_type, ocean_view, view_type, video_url, realtor_ca_url, listed_at, normalized_area").eq("mls_number", mls).limit(5),
        sb.from("board_listings").select("original_price, list_price, list_date, last_price_change, off_date, last_status").eq("mls_number", mls).limit(1),
        sb.from("listing_rooms").select("room_label, level, length, width").eq("listing_id", mls).limit(80),
      ]);
      const r: any = (data || []).sort((a: any, b: any) => (Array.isArray(b.images) ? b.images.length : 0) - (Array.isArray(a.images) ? a.images.length : 0))[0];
      if (!r) return json({ error: "No listing record for this sale." }, 404);
      const imgs = (Array.isArray(r.images) ? r.images : []).map((x: any) => imgUrl(typeof x === "string" ? x : x?.url || x?.src || "", "large")).filter(Boolean);
      if (!imgs.length && r.image_url) imgs.push(imgUrl(r.image_url, "large"));
      const b0: any = bl?.[0] || {};
      const lotSqft = Number(r.lot_size_sqft) || (Number(r.lot_size_acres) ? Number(r.lot_size_acres) * 43560 : null);
      return json({ mls: r.mls_number, address: r.address, images: imgs, description: r.description, beds: r.beds, baths: r.baths, sqft: r.sqft, year: r.year_built, lot: lotSqft,
        listPrice: r.price, brokerage: r.listing_brokerage, propertyType: r.normalized_type || r.property_type, building: r.building_name, area: r.normalized_area,
        waterfront: r.waterfront === true || /^(true|yes|y)$/i.test(String(r.waterfront || "")) ? (r.waterfront_type || "Yes") : null, view: r.view_type || (r.ocean_view ? "Ocean" : null),
        tour: r.video_url || null, realtorCa: r.realtor_ca_url || null, listedAt: r.listed_at || b0.list_date || null,
        originalPrice: Number(b0.original_price) || null, boardListPrice: Number(b0.list_price) || null, lastPriceChange: b0.last_price_change || null,
        rooms: (rooms || []).filter((x: any) => x.room_label).map((x: any) => ({ name: x.room_label, level: x.level, size: x.length && x.width ? `${x.length} × ${x.width}` : x.length || x.width || "" })) });
    }
    if (p.get("since")) {
      const m = String(p.get("since")).slice(0, 7), price = n(p.get("price"));
      if (!/^\d{4}-\d{2}$/.test(m) || !price) return json({ error: "Enter the purchase month and price." }, 400);
      return json(await valueSince(city, familyOf(p.get("type") || "house"), m, price));
    }

    let subject: Subject | null = null;
    if (p.get("mls") || p.get("address")) {
      const found: any = await findSubject(city, { mls: p.get("mls") || "", address: p.get("address") || "" });
      if (found.matches?.length) return json({ matches: found.matches });
      if (!found.subject && !p.get("type")) return json({ error: found.error || "Not found", nearby: found.nearby || null }, 404);
      subject = found.subject;
      // cma-addr-v2: never-listed home on a known street: use the neighbour's position and area
      if (!subject && found.nearby) subject = { family: familyOf(p.get("type")), address: String(p.get("address") || "").replace(/\b\w/g, (c) => c.toUpperCase()), lat: found.nearby.lat, lng: found.nearby.lng, area: found.nearby.area } as Subject;
    }
    // Anything typed into the form overrides what the cache has
    const type = p.get("type");
    subject = {
      ...(subject || { family: familyOf(type) }),
      ...(type ? { type, family: familyOf(type) } : {}),
      ...(p.get("area") ? { area: p.get("area") } : {}),
      ...(n(p.get("sqft")) ? { sqft: n(p.get("sqft")) } : {}),
      ...(n(p.get("beds")) ? { beds: n(p.get("beds")) } : {}),
      ...(n(p.get("year")) ? { year: n(p.get("year")) } : {}),
      ...(n(p.get("lot")) ? { lot: n(p.get("lot")) } : {}),
      ...(p.get("waterfront") ? { waterfront: p.get("waterfront") === "yes" } : {}),
    } as Subject;
    if (subject.family === "land") return json({ error: "Land and lot sales aren't in the sold cache yet (the import only pulls homes), so there are no land comps to use." }, 400);
    if (subject.family === "other") return json({ error: "Pick a property type (house, condo, townhouse, mobile or land)." }, 400);
    if (!subject.sqft) return json({ error: "Need the finished square footage.", subject }, 400);
    return json(await runCma(city, subject));
  } catch (e: any) {
    console.error("CMA failed:", e);
    return json({ error: e?.message || "CMA failed" }, 500);
  }
};
