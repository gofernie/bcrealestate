import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const prerender = false;

const resendApiKey =
  import.meta.env.RESEND_API_KEY;

const siteUrl =
  import.meta.env.PUBLIC_SITE_URL;

const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for shortlist feedback."
  );
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const slug =
      String(body?.slug || "").trim();

    const buyerEmail =
      String(body?.buyerEmail || "").trim();

    const message =
      String(body?.message || "").trim();

    if (!slug) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing shortlist."
        }),
        { status: 400 }
      );
    }

    if (!buyerEmail || !buyerEmail.includes("@")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Please enter a valid email."
        }),
        { status: 400 }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Please enter a message."
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

    const { data: shortlist, error } =
      await supabase
        .from("shortlist_sends")
        .select(`
          id,
          shortlist_slug,
          client_name,
          client_email,
          agent:agent_id (
            name,
            email,
            domain
          )
        `)
        .eq("shortlist_slug", slug)
        .single();

    if (error || !shortlist) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            error?.message ||
            "Shortlist not found."
        }),
        { status: 404 }
      );
    }

    const agentEmail =
      String(shortlist?.agent?.email || "").trim();

    const agentName =
      String(
        shortlist?.agent?.name ||
        "Your agent"
      ).trim();

    if (!agentEmail) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "This agent does not have an email address configured."
        }),
        { status: 400 }
      );
    }

    const baseUrl =
      shortlist?.agent?.domain
        ? `https://${String(shortlist.agent.domain)
            .replace(/^https?:\/\//, "")
            .replace(/\/$/, "")}`
        : String(siteUrl || "")
            .replace(/\/$/, "");

    const shortlistUrl =
      `${baseUrl}/shortlists/${slug}?s=` +
      encodeURIComponent(shortlist.id);

    const buyerName =
      String(
        shortlist.client_name || "Buyer"
      ).trim();

    const safeMessage =
      escapeHtml(message)
        .replace(/\n/g, "<br>");

    const html = `
      <div style="
        font-family:Arial,Helvetica,sans-serif;
        max-width:620px;
        margin:0 auto;
        padding:32px 20px;
        color:#171717;
        line-height:1.6;
      ">
        <h2 style="margin:0 0 20px;">
          New shortlist message
        </h2>

        <p>
          <strong>From:</strong>
          ${escapeHtml(buyerName)}
        </p>

        <p>
          <strong>Email:</strong>
          ${escapeHtml(buyerEmail)}
        </p>

        <div style="
          margin:24px 0;
          padding:18px;
          background:#f5f5f5;
          border-radius:10px;
        ">
          ${safeMessage}
        </div>

        <p>
          <a
            href="${escapeHtml(shortlistUrl)}"
            style="
              display:inline-block;
              background:#111827;
              color:#fff;
              text-decoration:none;
              padding:12px 18px;
              border-radius:8px;
              font-weight:700;
            "
          >
            View shortlist
          </a>
        </p>
      </div>
    `;

    const resend =
      new Resend(resendApiKey);

    const { data, error: sendError } =
      await resend.emails.send({
        from:
          `${agentName} via Locus <onboarding@resend.dev>`,
        to: [agentEmail],
        replyTo: buyerEmail,
        subject:
          `${buyerName} sent a message about their shortlist`,
        html
      });

    if (sendError) {
      throw new Error(
        sendError.message ||
        "Failed to send feedback."
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
          "Failed to send message."
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
