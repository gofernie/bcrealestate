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

    const siteId =
      String(body?.site_id || "").trim();

    const requestedOrder =
      Array.isArray(body?.property_types)
        ? body.property_types
        : [];

    const propertyTypes = Array.from(
      new Set(
        requestedOrder
          .map((value: unknown) =>
            String(value).trim().toLowerCase()
          )
          .filter((value: string) =>
            allowedTypes.includes(value)
          )
      )
    );

    if (!siteId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing site ID.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!propertyTypes.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No visible navigation pages supplied.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { error } = await supabase
      .from("sites")
      .update({
        nav_property_types: propertyTypes,
      })
      .eq("id", siteId);

    if (error) {
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
        nav_property_types: propertyTypes,
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
            : "Could not save navigation order.",
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