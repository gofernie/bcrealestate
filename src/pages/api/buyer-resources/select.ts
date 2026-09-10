import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const shortlistSlug =
      String(
        body?.shortlistSlug ||
        body?.slug ||
        ""
      ).trim();

    const vendorIds =
      Array.isArray(body?.vendorIds)
        ? body.vendorIds
            .map((id: unknown) =>
              String(id || "").trim()
            )
            .filter(Boolean)
        : [];

    if (!shortlistSlug) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing shortlist slug."
        }),
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("shortlist_resource_vendors")
      .delete()
      .eq("shortlist_slug", shortlistSlug);

    if (deleteError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: deleteError.message
        }),
        { status: 500 }
      );
    }

    if (vendorIds.length) {
      const rows = vendorIds.map(
        (vendorId: string, index: number) => ({
          shortlist_slug: shortlistSlug,
          vendor_id: vendorId,
          is_selected: true,
          sort_order: index + 1
        })
      );

      const { error: insertError } = await supabase
        .from("shortlist_resource_vendors")
        .insert(rows);

      if (insertError) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: insertError.message
          }),
          { status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        vendorIds
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to save resources."
      }),
      { status: 500 }
    );
  }
};