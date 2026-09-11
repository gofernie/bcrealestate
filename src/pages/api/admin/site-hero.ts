import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const cleanCity = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const titleCase = (value: unknown) =>
  String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

const cleanHeroImages = (value: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || "").trim())
        .filter((url) => /^https?:\/\/\S+$/i.test(url))
    )
  ).slice(0, 30);

const cleanHeroImagesByCity = (value: unknown) => {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

  return Object.fromEntries(
    Object.entries(source)
      .map(([city, images]) => [
        cleanCity(city),
        cleanHeroImages(images),
      ])
      .filter(([city]) => city)
  );
};

export const GET: APIRoute = async ({ url }) => {
  const siteId = String(
    url.searchParams.get("id") || ""
  ).trim();

  if (!siteId) {
    return json(
      { ok: false, error: "Missing site id." },
      400
    );
  }

  const { data, error } = await supabase
    .from("sites")
    .select(
      "id, city, secondary_markets, hero_images_by_city"
    )
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    return json(
      { ok: false, error: error.message },
      500
    );
  }

  if (!data) {
    return json(
      { ok: false, error: "Site not found." },
      404
    );
  }

  const primaryCity = cleanCity(data.city);

  const secondaryMarkets = Array.isArray(
    data.secondary_markets
  )
    ? data.secondary_markets
    : [];

  const markets = [
    ...(primaryCity
      ? [{
          city: primaryCity,
          label: titleCase(primaryCity),
          primary: true,
        }]
      : []),
    ...secondaryMarkets
      .map((market: any) => {
        const city = cleanCity(market?.city);

        return {
          city,
          label:
            String(market?.label || "").trim() ||
            titleCase(city),
          primary: false,
        };
      })
      .filter((market: any) => market.city),
  ];

  return json({
    ok: true,
    markets,
    hero_images_by_city:
      cleanHeroImagesByCity(data.hero_images_by_city),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));

  const siteId = String(
    body?.site_id || ""
  ).trim();

  const marketCity = cleanCity(
    body?.market_city
  );

  if (!siteId) {
    return json(
      { ok: false, error: "Missing site id." },
      400
    );
  }

  if (!marketCity) {
    return json(
      { ok: false, error: "Missing market city." },
      400
    );
  }

  const { data: site, error: loadError } =
    await supabase
      .from("sites")
      .select("hero_images_by_city")
      .eq("id", siteId)
      .maybeSingle();

  if (loadError) {
    return json(
      { ok: false, error: loadError.message },
      500
    );
  }

  if (!site) {
    return json(
      { ok: false, error: "Site not found." },
      404
    );
  }

  const heroImagesByCity =
    cleanHeroImagesByCity(site.hero_images_by_city);

  heroImagesByCity[marketCity] =
    cleanHeroImages(body?.hero_images);

  const { error: updateError } = await supabase
    .from("sites")
    .update({
      hero_images_by_city: heroImagesByCity,
    })
    .eq("id", siteId);

  if (updateError) {
    return json(
      { ok: false, error: updateError.message },
      500
    );
  }

  return json({
    ok: true,
    hero_images_by_city: heroImagesByCity,
  });
};