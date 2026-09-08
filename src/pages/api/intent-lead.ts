import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanHost(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";

  return host
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .split(":")[0];
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // site-resolution-for-intent-lead
    const sessionId =
      String(body.session_id || "").trim();

    const intentPageId =
      String(body.intent_page_id || "").trim() ||
      null;

    let siteId: string | null = null;

    if (intentPageId) {
      const { data: intentPage } = await supabase
        .from("intent_pages")
        .select("site_id")
        .eq("id", intentPageId)
        .maybeSingle();

      siteId =
        String(intentPage?.site_id || "").trim() ||
        null;
    }

    if (!siteId) {
      const host = cleanHost(request);

      const { data: domainSite } = await supabase
        .from("sites")
        .select("id")
        .eq("domain", host)
        .maybeSingle();

      siteId =
        String(domainSite?.id || "").trim() ||
        null;
    }

    if (!siteId && body.site_id) {
      const requestedSiteId =
        String(body.site_id).trim();

      const { data: requestedSite } = await supabase
        .from("sites")
        .select("id")
        .eq("id", requestedSiteId)
        .maybeSingle();

      siteId =
        String(requestedSite?.id || "").trim() ||
        null;
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
   const phone = String(body.phone || "").trim();
const question = String(body.question || "").trim();
const message = String(body.message || "").trim();

    if (!email && !phone) {
      return new Response(JSON.stringify({ ok: false, error: "Email or phone required" }), {
        status: 400,
      });
    }
    const lead = {
      session_id: sessionId,
      intent_page_id: intentPageId,
      site_id: siteId,
      city: body.city || "",
      slug: body.slug || "",
      name,
      email,
      phone,
      source:
        body.source ||
        "intent_refined_search",
      question,
      message,
    };

    const { data, error } = await supabase
      .from("intent_leads")
      .insert(lead)
      .select()
      .single();

    if (error) throw error;

    // upsert-intent-session-for-lead
    if (sessionId) {
      const { error: sessionError } = await supabase
        .from("intent_sessions")
        .upsert(
          {
            session_id: sessionId,
            intent_page_id: intentPageId,
            site_id: siteId,
            city: body.city || "",
            slug: body.slug || "",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "session_id",
          }
        );

      if (sessionError) {
        console.error(
          "Intent session save failed:",
          sessionError.message
        );
      }
    }

    const sid = import.meta.env.TWILIO_ACCOUNT_SID;
    const token = import.meta.env.TWILIO_AUTH_TOKEN;
    const from = import.meta.env.TWILIO_FROM_NUMBER;
    const notifyPhone = import.meta.env.AGENT_PHONE_NUMBER;

    if (sid && token && from && notifyPhone) {
      const client = twilio(sid, token);

       await client.messages.create({
        from,
        to: notifyPhone,
        body:
          `New intent lead\n\n` +
          `Source: ${body.source || "intent_refined_search"}\n` +
          `Name: ${name || "Not provided"}\n` +
          `Email: ${email || "Not provided"}\n` +
          `Phone: ${phone || "Not provided"}\n` +
          `City: ${lead.city || "Not provided"}\n` +
          `Page: ${lead.slug || "Not provided"}\n` +
          `Address: ${body.address || "Not provided"}\n` +
          `Price: ${body.price || "Not provided"}\n` +
`MLS: ${body.mls_number || "Not provided"}\n` +
`${question ? `Question: ${question}\n` : ""}` +
`${message ? `Message: ${message}\n` : ""}` +
`\n` +
`${new URL(request.url).origin}/admin/leads?${
  siteId
    ? `site_id=${encodeURIComponent(siteId)}`
    : ""
}`,
      });
    }

    return new Response(JSON.stringify({ ok: true, lead: data }), {    
      status: 200,
    });
  } catch (error) {
    console.error("intent-lead error", error);

    return new Response(JSON.stringify({ ok: false, error: "Could not save lead" }), {
      status: 500,
    });
  }
};