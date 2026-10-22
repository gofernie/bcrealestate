import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ALLOWED = new Set([
  "listing_open", "dwell", "photos",
  "floorplan_open", "floorplan_download", "brochure_download", "map_open",
  "partner_open", "partner_invite", "partner_join",
  "watch_click", "ask_click", "book_click", "share_click",
  "search_target",
]);

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = JSON.parse(await request.text()); }
  catch { return new Response(null, { status: 400 }); }

  const sessionId = String(body?.session_id || "").trim().slice(0, 80);
  const events = Array.isArray(body?.events) ? body.events.slice(0, 60) : [];
  if (!sessionId || !events.length) return new Response(null, { status: 204 });

  const host = String(body.host || "").slice(0, 120);
  const path = String(body.path || "").slice(0, 300);

  const rows = events
    .filter((e: any) => e && ALLOWED.has(e.event))
    .map((e: any) => {
      let meta = e.meta && typeof e.meta === "object" ? e.meta : {};
      if (JSON.stringify(meta).length > 800) meta = {};
      const v = Number(e.value);
      return {
        session_id: sessionId,
        listing_id: e.listing_id ? String(e.listing_id).slice(0, 80) : null,
        event: e.event,
        value: e.value === null || !Number.isFinite(v) ? null : Math.min(Math.max(v, 0), 1800),
        meta,
        host,
        path,
      };
    });

  if (rows.length) {
    const { error } = await supabase.from("intent_listing_events").insert(rows);
    if (error) console.error("intent-event insert failed:", error.message);
  }
  return new Response(null, { status: 204 });
};