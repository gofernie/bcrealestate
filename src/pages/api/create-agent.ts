import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanCity(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanSubdomain(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export const POST: APIRoute = async ({ request }) => {
  let authUserId: string | null = null;

  try {
    const body = await request.json();

    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const title = clean(body.title) || "REALTOR®";
    const brokerage = clean(body.brokerage);

    const city = cleanCity(body.city) || "nanaimo";
    const subdomain = cleanSubdomain(body.subdomain);
    const siteName =
      clean(body.siteName) ||
      `${name} Real Estate`;

    const accentColor =
      clean(body.accentColor) ||
      "#2f6f73";

    if (!name) {
      throw new Error("Agent name is required.");
    }

    if (!email) {
      throw new Error("Agent email is required.");
    }

    if (!subdomain) {
      throw new Error("Subdomain is required.");
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain)) {
      throw new Error(
        "Subdomain can only contain letters, numbers, and hyphens."
      );
    }

    const domain =
      `${subdomain}.bc.realestate`;

    /*
     * Make sure the requested Locus domain
     * isn't already in use.
     */
    const {
      data: existingSite,
      error: existingSiteError,
    } = await supabase
      .from("sites")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existingSiteError) {
      throw existingSiteError;
    }

    if (existingSite) {
      throw new Error(
        `${domain} is already in use.`
      );
    }

    /*
     * Don't create a duplicate agent account.
     */
    const {
      data: existingAgent,
      error: existingAgentError,
    } = await supabase
      .from("agents")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingAgentError) {
      throw existingAgentError;
    }

    if (existingAgent) {
      throw new Error(
        "An agent with this email already exists."
      );
    }

    /*
     * Create Supabase Auth user.
     *
     * We generate a random password for now.
     * Later, the agent onboarding/login flow can
     * replace this with an invitation/password setup.
     */
    const temporaryPassword =
      `${crypto.randomUUID()}A9!`;

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    if (authError) {
      throw authError;
    }

    authUserId =
      authData.user?.id || null;

    if (!authUserId) {
      throw new Error(
        "Auth user was not created."
      );
    }

   /*
 * Auth creation already creates the agents row
 * through our database trigger.
 *
 * Populate that existing profile with the
 * onboarding details.
 */
const {
  error: agentError,
} = await supabase
  .from("agents")
  .update({
    name,
    email,
    phone: phone || null,
    title: title || null,
    brokerage: brokerage || null,
    domain,
    updated_at: new Date().toISOString(),
  })
  .eq("id", authUserId);

if (agentError) {
  throw agentError;
}

    /*
     * Create the Locus site.
     */
    const {
      data: site,
      error: siteError,
    } = await supabase
      .from("sites")
      .insert({
        agent_id: authUserId,
        domain,
        city,
        primary_city: city,

        site_name: siteName,
        accent_color: accentColor,

        template: "calm",
        site_focus: "general",
        site_type: "general",

        homepage_template: "city",
        homepage_style: "city",

        root_city_homepage: false,
        use_root_homepage: false,

        property_type_filter: null,
      })
      .select("id, domain, site_name, city")
      .single();

    if (siteError) {
      throw siteError;
    }

    /*
     * Give the site its primary market.
     */
    const {
      error: marketError,
    } = await supabase
      .from("site_markets")
      .insert({
        site_id: site.id,
        city,
        sort_order: 0,
      });

    if (marketError) {
      throw marketError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        agentId: authUserId,
        siteId: site.id,
        domain: site.domain,
        siteName: site.site_name,
        city: site.city,
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
      "Create Locus agent failed:",
      error
    );

    /*
     * If setup failed after creating Auth,
     * remove the incomplete auth account.
     */
    if (authUserId) {
      await supabase.auth.admin
        .deleteUser(authUserId)
        .catch(() => {});
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error?.message ||
          "Unable to create agent.",
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