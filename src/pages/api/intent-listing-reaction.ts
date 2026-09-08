import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanHost(request: Request) {
  return clean(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host")
  )
    .split(",")[0]
    .replace(/^www\./, "")
    .split(":")[0]
    .toLowerCase();
}

function uuidOrNull(value: unknown) {
  const candidate = clean(value);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    candidate
  )
    ? candidate
    : null;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const sessionId = clean(body.session_id);
    const listingId = clean(body.listing_id);
    const intentPageId = uuidOrNull(body.intent_page_id);
    const requestedSiteId = uuidOrNull(
      body.site_id || body.siteId
    );

    if (!sessionId || !listingId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing session or listing ID.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    let siteId: string | null = null;

    if (intentPageId) {
      const { data: intentPage } = await supabase
        .from("intent_pages")
        .select("site_id")
        .eq("id", intentPageId)
        .maybeSingle();

      siteId = uuidOrNull(intentPage?.site_id);
    }

    const host = cleanHost(request);

    if (!siteId && host !== "localhost" && host !== "127.0.0.1") {
      const { data: hostSite } = await supabase
        .from("sites")
        .select("id")
        .eq("domain", host)
        .maybeSingle();

      siteId = uuidOrNull(hostSite?.id);
    }

    if (!siteId && requestedSiteId) {
      const { data: requestedSite } = await supabase
        .from("sites")
        .select("id")
        .eq("id", requestedSiteId)
        .maybeSingle();

      siteId = uuidOrNull(requestedSite?.id);
    }

    if (!siteId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Could not resolve the owning site.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: existingSession } = await supabase
      .from("intent_sessions")
      .select("site_id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (
      existingSession?.site_id &&
      existingSession.site_id !== siteId
    ) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Session belongs to another site.",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const now = new Date().toISOString();

    const { error: sessionError } = await supabase
      .from("intent_sessions")
      .upsert(
        {
          session_id: sessionId,
          site_id: siteId,
          intent_page_id: intentPageId,
          city: clean(body.city),
          slug: clean(body.slug),
          updated_at: now,
        },
        {
          onConflict: "session_id",
        }
      );

    if (sessionError) {
      throw sessionError;
    }

    const { data: existingReaction } = await supabase
      .from("intent_listing_reactions")
      .select("site_id")
      .eq("session_id", sessionId)
      .eq("listing_id", listingId)
      .maybeSingle();

    if (
      existingReaction?.site_id &&
      existingReaction.site_id !== siteId
    ) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Reaction belongs to another site.",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const reaction = {
      session_id: sessionId,
      site_id: siteId,
      intent_page_id: intentPageId,
      city: clean(body.city),
      slug: clean(body.slug),
      listing_id: listingId,
      mls_number: clean(body.mls_number),
      address: clean(body.address),
      price: clean(body.price),
      beds: clean(body.beds),
      baths: clean(body.baths),
      sqft: clean(body.sqft),
      area: clean(body.area),
      normalized_type:
        clean(body.normalized_type) || null,
      decision: clean(body.decision) || "viewed",
      liked_tags: Array.isArray(body.liked_tags)
        ? body.liked_tags
        : [],
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("intent_listing_reactions")
      .upsert(reaction, {
        onConflict: "session_id,listing_id",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reaction: data,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save reaction.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};