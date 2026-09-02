import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanHost(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  return host.split(",")[0].trim().replace(/^www\./, "").split(":")[0];
}

async function getSiteId(request: Request, id?: string | null) {
  const cleanId = String(id || "").trim();
  if (cleanId && cleanId !== "undefined" && cleanId !== "null") return cleanId;

  const { data, error } = await supabase
    .from("sites")
    .select("id")
    .eq("domain", cleanHost(request))
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const siteId = await getSiteId(request, url.searchParams.get("id"));
    if (!siteId) return json({ ok: false, error: "Site not found." }, 404);

    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("id", siteId)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Could not load site settings." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const data = body?.data || {};
    const siteId = await getSiteId(request, body?.id);
    if (!siteId) return json({ ok: false, error: "Site not found." }, 404);

    const accentColor = String(data.accentColor || "").trim();
    if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) {
      return json({ ok: false, error: "Accent colour must be a six-digit hex colour." }, 400);
    }

    const { error } = await supabase
      .from("sites")
      .update({
        site_name: data.siteName || data.site_name,
        accent_color: accentColor || null,
        city: data.city,
        hero_eyebrow: data.heroEyebrow,
        hero_heading: data.heroHeading,
        hero_copy: data.heroIntro,
        intro_copy: data.cityIntro,
        bio: data.agentBio,
      })
      .eq("id", siteId);

    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Could not save site settings." }, 500);
  }
};
