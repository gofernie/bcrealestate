import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const prerender = false;

const resendApiKey = import.meta.env.RESEND_API_KEY;
const siteUrl = import.meta.env.PUBLIC_SITE_URL;

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase env vars for send-email route.");
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

function escapeHtml(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanAgentName(value: unknown) {
  const name = String(value || "").trim();

  if (!name) return "";
  if (name.includes("@")) return "";
  if (name === "{agentName}") return "";

  return name;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const shortlistSlug =
      String(body?.slug || "").trim();

    if (!shortlistSlug) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing shortlist slug."
        }),
        { status: 400 }
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing RESEND_API_KEY."
        }),
        { status: 500 }
      );
    }

    if (!siteUrl) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing PUBLIC_SITE_URL."
        }),
        { status: 500 }
      );
    }

    const { data: shortlist, error: shortlistError } =
      await supabase
        .from("shortlist_sends")
        .select(`
          id,
          shortlist_slug,
          client_name,
          client_email,
          note,

          agent:agent_id (
            name,
            domain
          )
        `)
        .eq("shortlist_slug", shortlistSlug)
        .single();

    if (shortlistError || !shortlist) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            shortlistError?.message ||
            "Shortlist not found."
        }),
        { status: 404 }
      );
    }

    const email =
      String(
        body?.email ||
        shortlist.client_email ||
        ""
      ).trim();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No valid client email found."
        }),
        { status: 400 }
      );
    }

    const clientName =
      String(
        body?.clientName ||
        shortlist.client_name ||
        ""
      ).trim();

    const agentName =
      cleanAgentName(body?.agentName) ||
      cleanAgentName(shortlist?.agent?.name) ||
      "Your agent";

    const note =
      String(
        shortlist.note ||
        body?.note ||
        ""
      ).trim() ||
      "I pulled these homes together based on what you're looking for.";

    const cleanBase =
      String(siteUrl).replace(/\/$/, "");

    const agentDomain =
      String(
        shortlist?.agent?.domain || ""
      ).trim();

    const baseUrl = agentDomain
      ? `https://${agentDomain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "")}`
      : cleanBase;

    const shortlistUrl =
      `${baseUrl}/shortlists/${shortlistSlug}` +
      `?s=${encodeURIComponent(shortlist.id)}`;

    const safeClientName =
      escapeHtml(clientName);

    const safeAgentName =
      escapeHtml(agentName);

    const safeNote =
      escapeHtml(note).replace(/\n/g, "<br>");

    const greeting = safeClientName
      ? `Hi ${safeClientName},`
      : "Hi,";

    const subject = clientName
      ? `${clientName}, I put together some homes for you`
      : "I put together some homes for you";

    const html = `
      <div style="
        font-family:Arial,Helvetica,sans-serif;
        max-width:620px;
        margin:0 auto;
        padding:32px 20px;
        color:#171717;
        line-height:1.6;
      ">
        <p>${greeting}</p>

        <p>${safeNote}</p>

        <p style="margin:28px 0;">
          <a
            href="${escapeHtml(shortlistUrl)}"
            style="
              display:inline-block;
              background:#111827;
              color:#ffffff;
              text-decoration:none;
              padding:13px 22px;
              border-radius:8px;
              font-weight:700;
            "
          >
            View your shortlist
          </a>
        </p>

        <p>
          ${safeAgentName}
        </p>
      </div>
    `;

    const resend =
      new Resend(resendApiKey);

    const { data, error } =
      await resend.emails.send({
        from: `${agentName} <onboarding@resend.dev>`,
        to: [email],
        subject,
        html
      });

    if (error) {
      throw new Error(
        error.message ||
        "Resend failed to send email."
      );
    }

    const { error: updateError } =
      await supabase
        .from("shortlist_sends")
        .update({
          client_email: email,
          status: "sent",
          message_body: note,
          sent_at: new Date().toISOString()
        })
        .eq("id", shortlist.id);

    if (updateError) {
      console.error(
        "Failed to update shortlist after email:",
        updateError
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        id: data?.id || null
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error?.message ||
          "Failed to send email."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
