import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanHost(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";

  return host
    .split(",")[0]
    .trim()
    .replace(/^www\./, "")
    .split(":")[0];
}

async function getSiteId(
  request: Request,
  id?: string | null
) {
  const cleanId = String(id || "").trim();

  if (
    cleanId &&
    cleanId !== "undefined" &&
    cleanId !== "null"
  ) {
    return cleanId;
  }

  const domain = cleanHost(request);

  const { data, error } = await supabase
    .from("sites")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();

  if (error) {
    console.error(
      "Site ID lookup failed:",
      error
    );
  }

  return data?.id || null;
}

/*
 * GET
 *
 * Loads the site plus its linked agent identity
 * and returns everything using the field names
 * expected by the Site Settings form.
 */
export const GET: APIRoute = async ({
  request,
  url,
}) => {
  const siteId = await getSiteId(
    request,
    url.searchParams.get("id")
  );

  if (!siteId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Site not found for this domain.",
      }),
      {
        status: 404,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }

  const {
    data: site,
    error: siteError,
  } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: siteError.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }

  if (!site) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Site not found.",
      }),
      {
        status: 404,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }

  /*
   * Load linked agent if one exists.
   */
  let agent: any = null;

  if (site.agent_id) {
    const {
      data: agentData,
      error: agentError,
    } = await supabase
      .from("agents")
      .select("*")
      .eq("id", site.agent_id)
      .maybeSingle();

    if (agentError) {
      console.error(
        "Agent lookup failed:",
        agentError
      );
    }

    agent = agentData || null;
  }

  return new Response(
    JSON.stringify({
      ok: true,

      data: {
        ...site,

        /*
         * Agent identity
         */
        agentName:
          agent?.name || "",

        agentTitle:
          agent?.title || "",

        brokerage:
          agent?.brokerage || "",

        phone:
          agent?.phone || "",

        email:
          agent?.email || "",

        photoUrl:
          agent?.photo_url || "",

        agentBio:
          agent?.bio ||
          site.bio ||
          "",

        /*
         * Existing site settings mapped
         * to form field names.
         */
        siteName:
          site.site_name || "",

        accentColor:
          site.accent_color ||
          "#2f6f73",

        heroEyebrow:
          site.hero_eyebrow || "",

        heroHeading:
          site.hero_heading || "",

        heroIntro:
          site.hero_copy || "",

        heroImageUrl:
          site.hero_image_url || "",

        cityIntro:
          site.intro_copy || "",

        city:
          site.city || "",

        siteType:
          site.site_type ||
          "general",

        homepageStyle:
          site.homepage_style ||
          "city",

        primaryCity:
          site.primary_city ||
          site.city ||
          "",

        primaryType:
          site.primary_type || "",

        useRootHomepage:
          Boolean(
            site.use_root_homepage
          ),
      },
    }),
    {
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
};

/*
 * POST
 *
 * Saves agent identity + site settings
 * in one operation.
 */
export const POST: APIRoute = async ({
  request,
}) => {
  try {
    const body =
      await request.json();

    const {
      id,
      data = {},
    } = body || {};

    const siteId =
      await getSiteId(request, id);

    if (!siteId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Site not found for this domain.",
        }),
        {
          status: 404,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    /*
     * Get current site so we know:
     *
     * - existing agent_id
     * - domain
     * - existing values we should preserve
     */
    const {
      data: currentSite,
      error: currentSiteError,
    } = await supabase
      .from("sites")
      .select(
        `
          id,
          agent_id,
          domain,
          site_name,
          city
        `
      )
      .eq("id", siteId)
      .maybeSingle();

    if (currentSiteError) {
      throw currentSiteError;
    }

    if (!currentSite) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Site not found.",
        }),
        {
          status: 404,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    /*
     * Agent identity coming from the
     * Site Settings form.
     */
    const agentPayload = {
      name:
        String(
          data.agentName || ""
        ).trim() || null,

      title:
        String(
          data.agentTitle || ""
        ).trim() || null,

      brokerage:
        String(
          data.brokerage || ""
        ).trim() || null,

      phone:
        String(
          data.phone || ""
        ).trim() || null,

      email:
        String(
          data.email || ""
        ).trim() || null,

      photo_url:
        String(
          data.photoUrl || ""
        ).trim() || null,

      bio:
        String(
          data.agentBio || ""
        ).trim() || null,

      domain:
        currentSite.domain || null,

      updated_at:
        new Date().toISOString(),
    };

    const agentId =
  currentSite.agent_id || null;

if (agentId) {
  const {
    error: agentUpdateError,
  } = await supabase
    .from("agents")
    .update(agentPayload)
    .eq("id", agentId);

  if (agentUpdateError) {
    throw agentUpdateError;
  }
}

    /*
     * Update site settings and attach
     * the agent.
     */
    const {
      error: siteUpdateError,
    } = await supabase
      .from("sites")
      .update({
        agent_id: agentId,

        site_name:
          data.siteName ||
          data.site_name ||
          currentSite.site_name ||
          null,

        accent_color:
          data.accentColor ||
          "#2f6f73",

        city:
          data.city ||
          currentSite.city,

        site_type:
          data.siteType ||
          "general",

        homepage_style:
          data.homepageStyle ||
          "city",

        primary_city:
          data.primaryCity ||
          data.city ||
          currentSite.city ||
          null,

        primary_type:
          data.primaryType ||
          null,

        use_root_homepage:
          Boolean(
            data.useRootHomepage
          ),

        /*
         * Homepage content
         */
        hero_eyebrow:
          data.heroEyebrow ||
          null,

        hero_heading:
          data.heroHeading ||
          null,

        hero_copy:
          data.heroIntro ||
          null,

        hero_image_url:
          data.heroImageUrl ||
          null,

        intro_copy:
          data.cityIntro ||
          null,

        /*
         * Keep this for backwards
         * compatibility for now.
         *
         * The canonical bio is now
         * agents.bio.
         */
        bio:
          data.agentBio ||
          null,
      })
      .eq("id", siteId);

    if (siteUpdateError) {
      throw siteUpdateError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        siteId,
        agentId,
      }),
      {
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "Site settings save failed:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error?.message ||
          "Unable to save site settings.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
};