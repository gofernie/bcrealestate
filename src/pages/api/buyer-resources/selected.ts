import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  try {
    const shortlistSlug =
      String(
        url.searchParams.get("shortlistSlug") || ""
      ).trim();

    if (!shortlistSlug) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing shortlist slug."
        }),
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shortlist_resource_vendors")
      .select("vendor_id")
      .eq("shortlist_slug", shortlistSlug)
      .eq("is_selected", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message
        }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        vendorIds:
          (data || [])
            .map((row: any) => row.vendor_id)
            .filter(Boolean)
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
            : "Failed to load selected resources."
      }),
      { status: 500 }
    );
  }
};