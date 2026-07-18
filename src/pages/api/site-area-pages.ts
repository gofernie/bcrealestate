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
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const siteId = String(url.searchParams.get("siteId") || "").trim();

    if (!siteId) {
      return json(
        {
          ok: false,
          error: "Site ID is required.",
        },
        400
      );
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("*")
      .eq("id", siteId)
      .maybeSingle();

    if (siteError) {
      throw siteError;
    }

    if (!site) {
      return json(
        {
          ok: false,
          error: "Site not found.",
        },
        404
      );
    }

    const city = String(
      site.primary_city ||
        site.city ||
        "nanaimo"
    )
      .trim()
      .toLowerCase();

    const { data: areas, error: areasError } = await supabase
      .from("area_boundaries")
      .select("*")
      .ilike("city", city)
      .order("area_name", { ascending: true });

    if (areasError) {
      throw areasError;
    }

    const areaRows = Array.isArray(areas) ? areas : [];
    const areaIds = areaRows
      .map((area) => area.id)
      .filter(Boolean);

    let overrideRows: any[] = [];

    if (areaIds.length) {
      const { data: overrides, error: overridesError } =
        await supabase
          .from("site_area_pages")
          .select("*")
          .eq("site_id", siteId)
          .in("area_boundary_id", areaIds);

      if (overridesError) {
        throw overridesError;
      }

      overrideRows = Array.isArray(overrides)
        ? overrides
        : [];
    }

    const overrideByAreaId = new Map(
      overrideRows.map((row) => [
        row.area_boundary_id,
        row,
      ])
    );

    const pages = areaRows.map((area) => {
      const override =
        overrideByAreaId.get(area.id) || null;

      return {
        areaBoundaryId: area.id,
        areaName: area.area_name || "",
        areaSlug: area.area_slug || "",
        city: area.city || city,

        hasOverride: Boolean(override),
        overrideId: override?.id || null,

        isPublished:
          override?.is_published ?? true,

        heroHeading:
          override?.hero_heading ??
          area.hero_heading ??
          "",

        eyebrow:
          override?.eyebrow ??
          "",

        introCopy:
          override?.intro_copy ??
          area.intro_copy ??
          area.short_description ??
          "",

        seoTitle:
          override?.seo_title ??
          area.seo_title ??
          "",

        metaDescription:
          override?.meta_description ??
          area.meta_description ??
          "",

        seoHeading:
          override?.seo_heading ??
          area.seo_heading ??
          "",

        seoIntro:
          override?.seo_intro ??
          area.short_description ??
          "",

        seoBody:
          override?.seo_body ??
          area.intro_copy ??
          "",

        seoLong:
          override?.seo_long ??
          area.seo_long ??
          "",

        neighbourhoodCopy:
          override?.neighbourhood_copy ??
          area.neighbourhood_copy ??
          "",

        marketCommentary:
          override?.market_commentary ??
          "",
      };
    });

    return json({
      ok: true,
      site: {
        id: site.id,
        domain: site.domain || "",
        city,
      },
      pages,
    });
  } catch (error: any) {
    console.error("GET /api/site-area-pages failed:", error);

    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load area pages.",
      },
      500
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const siteId = String(body?.siteId || "").trim();
    const areaBoundaryId = String(
      body?.areaBoundaryId || ""
    ).trim();

    if (!siteId || !areaBoundaryId) {
      return json(
        {
          ok: false,
          error:
            "Site ID and area boundary ID are required.",
        },
        400
      );
    }

    const row = {
      site_id: siteId,
      area_boundary_id: areaBoundaryId,

      hero_heading: cleanText(body.heroHeading),
      eyebrow: cleanText(body.eyebrow),
      intro_copy: cleanText(body.introCopy),

      seo_title: cleanText(body.seoTitle),
      meta_description: cleanText(
        body.metaDescription
      ),
      seo_heading: cleanText(body.seoHeading),
      seo_intro: cleanText(body.seoIntro),
      seo_body: cleanText(body.seoBody),
      seo_long: cleanText(body.seoLong),

      neighbourhood_copy: cleanText(
        body.neighbourhoodCopy
      ),

      market_commentary: cleanText(
        body.marketCommentary
      ),

      is_published:
        body.isPublished !== false,

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("site_area_pages")
      .upsert(row, {
        onConflict: "site_id,area_boundary_id",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return json({
      ok: true,
      data,
    });
  } catch (error: any) {
    console.error("POST /api/site-area-pages failed:", error);

    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to save area page.",
      },
      500
    );
  }
};