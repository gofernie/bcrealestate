import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const allowedTypes = [
  "house",
  "condo",
  "townhouse",
  "mobile",
  "land",
];

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const siteId = String(body?.site_id || "").trim();
    const propertyType = String(body?.property_type || "")
      .trim()
      .toLowerCase();

    if (!siteId) {
      return new Response(
        JSON.stringify({ error: "Missing site_id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!allowedTypes.includes(propertyType)) {
      return new Response(
        JSON.stringify({ error: "Invalid property type" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id, nav_property_types")
      .eq("id", siteId)
      .maybeSingle();

    if (siteError || !site) {
      return new Response(
        JSON.stringify({
          error: siteError?.message || "Site not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const current = Array.isArray(site.nav_property_types)
      ? site.nav_property_types
          .map((value: unknown) => String(value).toLowerCase())
          .filter((value: string) => allowedTypes.includes(value))
      : [...allowedTypes];

    const isVisible = current.includes(propertyType);

    const next = isVisible
      ? current.filter((value: string) => value !== propertyType)
      : [...current, propertyType];

    const { error: updateError } = await supabase
      .from("sites")
      .update({
        nav_property_types: next,
      })
      .eq("id", siteId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        property_type: propertyType,
        visible: !isVisible,
        nav_property_types: next,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
