import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async ({ url }) => {
  const siteId = String(
    url.searchParams.get("id") || ""
  ).trim();

  if (!siteId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing site id.",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const { data, error } = await supabase
    .from("sites")
    .select("id, hero_image_url")
    .eq("id", siteId)
    .maybeSingle();

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
      hero_image_url: data?.hero_image_url || "",
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));

  const siteId = String(
    body?.site_id || ""
  ).trim();

  const heroImageUrl = String(
    body?.hero_image_url || ""
  ).trim();

  if (!siteId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing site id.",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  if (
    heroImageUrl &&
    !/^https?:\/\/\S+$/i.test(heroImageUrl)
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Enter a complete http or https image URL.",
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
      hero_image_url: heroImageUrl || null,
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
    JSON.stringify({ ok: true }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};