import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const question = String(body.question || "").trim();
    const message = String(body.message || "").trim();

    const sessionId =
      String(body.session_id || "").trim() || crypto.randomUUID();

    const city = String(body.city || "").trim();
    const slug = String(body.slug || "").trim();
    const source = String(body.source || "intent_refined_search").trim();

    const finalMessage = [question, message]
      .filter(Boolean)
      .join("\n\n");

    if (!email && !phone) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Email or phone required",
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    /*
     * Find or create buyer
     */
    let buyerId: string | null = null;

    if (email) {
      const { data: existingBuyer, error: buyerLookupError } =
        await supabase
          .from("buyers")
          .select("id")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

      if (buyerLookupError) {
        throw buyerLookupError;
      }

      buyerId = existingBuyer?.id || null;
    }

    if (!buyerId && phone) {
      const { data: existingBuyer, error: phoneLookupError } =
        await supabase
          .from("buyers")
          .select("id")
          .eq("phone", phone)
          .limit(1)
          .maybeSingle();

      if (phoneLookupError) {
        throw phoneLookupError;
      }

      buyerId = existingBuyer?.id || null;
    }

    if (!buyerId) {
      const { data: newBuyer, error: buyerInsertError } =
        await supabase
          .from("buyers")
          .insert({
            name: name || null,
            email: email || null,
            phone: phone || null,
          })
          .select("id")
          .single();

      if (buyerInsertError) {
        throw buyerInsertError;
      }

      buyerId = newBuyer.id;
    } else {
      const { error: buyerUpdateError } = await supabase
        .from("buyers")
        .update({
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          updated_at: new Date().toISOString(),
          last_contacted_at: new Date().toISOString(),
        })
        .eq("id", buyerId);

      if (buyerUpdateError) {
        throw buyerUpdateError;
      }
    }

    /*
     * Ensure the intent session exists
     */
    const { data: existingSession, error: sessionLookupError } =
      await supabase
        .from("intent_sessions")
        .select("id")
        .eq("session_id", sessionId)
        .limit(1)
        .maybeSingle();

    if (sessionLookupError) {
      throw sessionLookupError;
    }

    if (existingSession) {
      const { error: sessionUpdateError } = await supabase
        .from("intent_sessions")
        .update({
          buyer_id: buyerId,
          intent_page_id: body.intent_page_id || null,
          city: city || null,
          slug: slug || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSession.id);

      if (sessionUpdateError) {
        throw sessionUpdateError;
      }
    } else {
      const { error: sessionInsertError } = await supabase
        .from("intent_sessions")
        .insert({
          session_id: sessionId,
          buyer_id: buyerId,
          intent_page_id: body.intent_page_id || null,
          city: city || null,
          slug: slug || null,
        });

      if (sessionInsertError) {
        throw sessionInsertError;
      }
    }

    /*
     * Create lead using the same session ID
     */
    const lead = {
      session_id: sessionId,
      intent_page_id: body.intent_page_id || null,
      city,
      slug,
      name,
      email,
      phone,
      source,
      message: finalMessage,
    };

    const { data, error: leadError } = await supabase
      .from("intent_leads")
      .insert(lead)
      .select()
      .single();

    if (leadError) {
      throw leadError;
    }

    /*
     * Send notification without failing the saved lead
     */
    try {
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
            `Source: ${source}\n` +
            `Name: ${name || "Not provided"}\n` +
            `Email: ${email || "Not provided"}\n` +
            `Phone: ${phone || "Not provided"}\n` +
            `City: ${city || "Not provided"}\n` +
            `Page: ${slug || "Not provided"}\n` +
            `Address: ${body.address || "Not provided"}\n` +
            `Price: ${body.price || "Not provided"}\n` +
            `MLS: ${body.mls_number || "Not provided"}\n` +
            `${question ? `Question: ${question}\n` : ""}` +
            `${message ? `Message: ${message}\n` : ""}` +
            `\n` +
            `${new URL(request.url).origin}/admin/intent-sessions?session=${encodeURIComponent(sessionId)}`,
        });
      }
    } catch (notificationError) {
      console.error("Twilio notification error:", notificationError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        lead: data,
        session_id: sessionId,
        buyer_id: buyerId,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("intent-lead error:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save lead",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }
};