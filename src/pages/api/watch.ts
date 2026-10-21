import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function normalizePhone(raw: unknown): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
}

export const POST: APIRoute = async ({ request, url }) => {
  let body: any = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }

  const phone = normalizePhone(body.phone);
  const listingId = String(body.listing_id || "").trim().slice(0, 40);
  const address = String(body.address || "").trim().slice(0, 200) || null;
  const price = Number(String(body.price ?? "").replace(/[^0-9.]/g, "")) || null;
  const status = String(body.status || "").trim().slice(0, 40) || null;

  if (!phone) return json({ ok: false, error: "Enter a 10-digit mobile number." }, 400);
  if (!listingId) return json({ ok: false, error: "Missing listing." }, 400);

  const db = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: existing } = await db
    .from("listing_watches")
    .select("id, active")
    .eq("phone", phone)
    .eq("listing_id", listingId)
    .maybeSingle();

  const { error } = await db.from("listing_watches").upsert(
    {
      phone,
      listing_id: listingId,
      site_domain: url.hostname,
      address,
      last_price: price,
      last_status: status,
      active: true,
    },
    { onConflict: "phone,listing_id" }
  );
  if (error) {
    console.error("[watch] upsert failed", error);
    return json({ ok: false, error: "Couldn't save that. Try again." }, 500);
  }

  // Only text on a new (or re-activated) watch, never on repeat taps.
  if (!existing?.active) {
    try {
      await twilio(import.meta.env.TWILIO_ACCOUNT_SID, import.meta.env.TWILIO_AUTH_TOKEN).messages.create({
        from: import.meta.env.TWILIO_FROM_NUMBER,
        to: phone,
        body: `You're watching ${address || "this home"} on ${url.hostname}. We'll text you if the price drops or the status changes. Reply STOP to cancel.`,
      });
    } catch (e) {
      console.error("[watch] confirmation SMS failed", e);
    }
  }

  return json({ ok: true, last4: phone.slice(-4) });
};
