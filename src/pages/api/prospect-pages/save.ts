import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = createSupabaseServerClient(cookies);

    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Not authenticated",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await request.json();

    const agentName = String(body.agentName || "").trim();
    const domain = String(body.domain || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");

    const slug = String(body.slug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!agentName || !domain || !slug) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Agent name, domain and slug are required.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const record = {
      slug,
      agent_name: agentName,
      domain,

      primary_market:
        String(body.primaryMarket || "").trim() || null,

      other_markets: Array.isArray(body.otherMarkets)
        ? body.otherMarkets
            .map((value: unknown) => String(value).trim())
            .filter(Boolean)
        : [],

      personal_note:
        String(body.personalNote || "").trim() || null,

      price:
        String(body.price || "$59/month").trim(),

      sections:
        body.sections &&
        typeof body.sections === "object"
          ? body.sections
          : {},

      links:
        body.links &&
        typeof body.links === "object"
          ? body.links
          : {},

      is_published: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("prospect_pages")
      .upsert(record, {
        onConflict: "domain,slug",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Prospect page save failed:", error);

      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        prospect: data,
        url: `https://${domain}/for/${slug}`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Prospect save error:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save prospect page.",
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
