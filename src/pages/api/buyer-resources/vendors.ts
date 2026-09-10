import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async () => {
  try {
    const { data: vendors, error } = await supabase
      .from("buyer_resource_vendors")
      .select("*")
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

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
        vendors: vendors || []
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
            : "Failed to load vendors."
      }),
      { status: 500 }
    );
  }
};