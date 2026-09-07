import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const pageId =
      String(body?.page_id || "").trim();

    const siteId =
      String(body?.site_id || "").trim();

    if (!pageId || !siteId) {
      return json(
        {
          ok: false,
          error: "Missing page or website ID.",
        },
        400
      );
    }

    const { data: page, error: lookupError } =
      await supabase
        .from("intent_pages")
        .select("id, site_id")
        .eq("id", pageId)
        .eq("site_id", siteId)
        .maybeSingle();

    if (lookupError) {
      return json(
        {
          ok: false,
          error: lookupError.message,
        },
        500
      );
    }

    if (!page) {
      return json(
        {
          ok: false,
          error: "Page not found for this website.",
        },
        404
      );
    }

    const { error: deleteError } =
      await supabase
        .from("intent_pages")
        .delete()
        .eq("id", pageId)
        .eq("site_id", siteId);

    if (deleteError) {
      return json(
        {
          ok: false,
          error: deleteError.message,
        },
        500
      );
    }

    return json({ ok: true });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "The page could not be deleted.",
      },
      500
    );
  }
};