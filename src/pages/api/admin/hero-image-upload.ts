import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = createSupabaseServerClient(cookies);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) {
      return json({ ok: false, error: "Sign in to upload images." }, 401);
    }

    const form = await request.formData();
    const siteId = String(form.get("siteId") || "").trim();
    const city = String(form.get("marketCity") || "")
      .trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const file = form.get("image");

    if (!/^[a-z0-9-]+$/i.test(siteId) || !city) {
      return json({ ok: false, error: "Choose a valid site and market." }, 400);
    }
    if (!(file instanceof File)) {
      return json({ ok: false, error: "Choose an image." }, 400);
    }

    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };
    const extension = extensions[file.type];
    if (!extension || file.size === 0 || file.size > 8 * 1024 * 1024) {
      return json({
        ok: false,
        error: "Choose a JPG, PNG, WebP or AVIF image under 8 MB.",
      }, 400);
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: site, error: siteError } = await supabase
      .from("sites").select("id, agent_id").eq("id", siteId).maybeSingle();

    if (siteError || !site) {
      return json({ ok: false, error: "Site not found." }, 404);
    }
    const isPlatformSite =
      !site.agent_id &&
      user.id === "e6ef2640-eeff-4d57-8df2-c4c5f820a182";

    if (site.agent_id !== user.id && !isPlatformSite) {
      return json({ ok: false, error: "You cannot upload images for this site." }, 403);
    }

    const path = `sites/${siteId}/hero/${city}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("public-images")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return json({ ok: false, error: uploadError.message }, 500);
    }

    const { data } = supabase.storage
      .from("public-images").getPublicUrl(path);

    return json({ ok: true, url: data.publicUrl });
  } catch (error: any) {
    return json({
      ok: false,
      error: error?.message || "Could not upload image.",
    }, 500);
  }
};