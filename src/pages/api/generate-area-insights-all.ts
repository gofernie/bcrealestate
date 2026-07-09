import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  const { city = "nanaimo" } = await request.json();

  const { data: areas = [], error } = await supabase
    .from("area_boundaries")
    .select("area_slug")
    .eq("city", city)
    .not("area_slug", "is", null)
    .order("area_slug", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const results = [];

  for (const area of areas) {
    const area_slug = area.area_slug;

    try {
      const res = await fetch(`${origin}/api/generate-area-insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ city, area_slug }),
      });

      const json = await res.json();

      results.push({
        area_slug,
        ok: res.ok,
        result: json,
      });

      await new Promise((resolve) => setTimeout(resolve, 1400));
    } catch (error) {
      results.push({
        area_slug,
        ok: false,
        error: String(error),
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      city,
      count: results.length,
      results,
    }),
    { status: 200 }
  );
};