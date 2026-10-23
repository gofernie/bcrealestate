import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
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

function alertPhone(raw: unknown) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
}

/** Criteria come from the save form, or (older saves) from the "Criteria: {...}" line of the message. */
function criteriaFromLead(body: any, message: string) {
  if (body?.criteria && typeof body.criteria === "object") return body.criteria;
  const line = String(message || "").match(/(?:^|\n)Criteria:\s*(\{.*\})\s*$/m);
  if (line) { try { return JSON.parse(line[1]); } catch {} }
  return null;
}

async function createSavedSearchAlert(body: any, lead: any, leadId?: string) {
  const criteria = criteriaFromLead(body, lead.message);
  const url = String(criteria?.url || String(lead.message || "").match(/Search URL:\s*(\S+)/)?.[1] || "");
  const city = String(lead.city || "").trim().toLowerCase();
  if (!city || (!criteria && !url)) return;
  const email = String(lead.email || "").trim() || null;
  const phone = alertPhone(lead.phone);
  if (!email && !phone) return;
  const { error } = await supabase.from("saved_searches").insert({
    city,
    channel: email ? "email" : "sms",
    frequency: "update",
    email,
    phone,
    active: true,
    filters: {
      url,
      criteria: criteria || {},
      name: String(body.search_name || "").trim() || String(lead.message || "").split("\n")[0],
      lead_id: leadId || null,
      pending_baseline: true,
    },
  });
  if (error) throw error;
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
const originalMessage = String(body.message || "").trim();
const submittedListingUrl = String(body.listing_url || "").trim();
const message = [
  originalMessage,
  submittedListingUrl && !/(?:^|\n)Listing:\s*/i.test(originalMessage)
    ? `Listing: ${submittedListingUrl}`
    : "",
].filter(Boolean).join("\n");

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

    // A saved search also becomes a real alert (saved_searches), not just a lead.
    if (lead.source === "saved_search") {
      try {
        await createSavedSearchAlert(body, lead, data?.id);
      } catch (alertError) {
        console.error("Saved search alert could not be created:", alertError);
      }
    }

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

    // Email the configured agent for this site instead of sending an SMS.
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    const leadEmailFrom =
      import.meta.env.LEAD_EMAIL_FROM ||
      "Locus Leads <onboarding@resend.dev>";

    let agentEmail = "";
    let agentName = "Your agent";
    let siteName = "your real estate site";

    if (siteId) {
      const { data: siteForLead, error: siteLookupError } = await supabase
        .from("sites")
        .select("agent_id, site_name")
        .eq("id", siteId)
        .maybeSingle();

      if (siteLookupError) {
        console.error("Lead notification site lookup failed:", siteLookupError.message);
      }

      siteName = String(siteForLead?.site_name || siteName).trim();

      const agentId = String(siteForLead?.agent_id || "").trim();

      if (agentId) {
        const { data: agentForLead, error: agentLookupError } = await supabase
          .from("agents")
          .select("name, email")
          .eq("id", agentId)
          .maybeSingle();

        if (agentLookupError) {
          console.error("Lead notification agent lookup failed:", agentLookupError.message);
        }

        agentName = String(agentForLead?.name || agentName).trim();
        agentEmail = String(agentForLead?.email || "").trim();
      }
    }

    // Primary alert: send Chris an SMS for every new lead.
    const leadSmsTo = String(import.meta.env.AGENT_PHONE_NUMBER || "").trim();
    const twilioAccountSid = String(import.meta.env.TWILIO_ACCOUNT_SID || "").trim();
    const twilioAuthToken = String(import.meta.env.TWILIO_AUTH_TOKEN || "").trim();
    const twilioFrom = String(import.meta.env.TWILIO_FROM_NUMBER || "").trim();

    if (!leadSmsTo || !twilioAccountSid || !twilioAuthToken || !twilioFrom) {
      console.error("Lead saved, but Twilio lead-alert settings are incomplete.");
    } else {
      const leadSms = [
        `New lead from ${siteName}`,
        `Name: ${name || "Not provided"}`,
        `Email: ${email || "Not provided"}`,
        `Phone: ${phone || "Not provided"}`,
        question ? `Question: ${question}` : "",
        body.address ? `Property: ${body.address}` : "",
        body.mls_number ? `MLS: ${body.mls_number}` : "",
      ].filter(Boolean).join("\n");

      try {
        await twilio(twilioAccountSid, twilioAuthToken).messages.create({
          from: twilioFrom,
          to: leadSmsTo,
          body: leadSms,
        });
      } catch (smsError) {
        console.error("Lead SMS notification failed:", smsError);
      }
    }
    if (resendApiKey && agentEmail) {
      const source = String(body.source || "intent_refined_search");
      const adminUrl =
        `${new URL(request.url).origin}/admin/leads?${
          siteId ? `site_id=${encodeURIComponent(siteId)}` : ""
        }`;

      const leadText = [
        "New website lead",
        "",
        `Site: ${siteName}`,
        `Source: ${source}`,
        `Name: ${name || "Not provided"}`,
        `Email: ${email || "Not provided"}`,
        `Phone: ${phone || "Not provided"}`,
        `City: ${lead.city || "Not provided"}`,
        `Page: ${lead.slug || "Not provided"}`,
        `Address: ${body.address || "Not provided"}`,
        `Price: ${body.price || "Not provided"}`,
        `MLS: ${body.mls_number || "Not provided"}`,
        question ? `Question: ${question}` : "",
        message ? `Message: ${message}` : "",
        "",
        `View lead: ${adminUrl}`,
      ].filter(Boolean).join("\n");

      try {
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: leadEmailFrom,
          to: [agentEmail],
          replyTo: email || undefined,
          subject: `New lead from ${siteName}`,
          text: leadText,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;padding:28px 20px;color:#17202a;line-height:1.55;">
              <p style="margin:0 0 8px;color:#667085;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">New website lead</p>
              <h2 style="margin:0 0 22px;">${name || "New enquiry"}</h2>
              <p><strong>Site:</strong> ${siteName}</p>
              <p><strong>Source:</strong> ${source}</p>
              <p><strong>Email:</strong> ${email || "Not provided"}</p>
              <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
              ${question ? `<p><strong>Question:</strong><br>${question}</p>` : ""}
              ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, "<br>")}</p>` : ""}
              <p style="margin-top:26px;">
                <a href="${adminUrl}" style="display:inline-block;padding:11px 16px;border-radius:7px;background:#143958;color:#fff;text-decoration:none;font-weight:700;">
                  View lead in admin
                </a>
              </p>
            </div>
          `,
        });
      } catch (notificationError) {
        console.error("Lead email notification failed:", notificationError);
      }
    } else if (!agentEmail) {
      console.warn("Lead saved, but no agent email is configured for this site.");
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