import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export const GET: APIRoute = async ({ url }) => {
  const siteId = String(url.searchParams.get("siteId") || "").trim();
  if (!siteId) return json({ ok: false, error: "Missing site id." }, 400);
  const { data, error } = await supabase.from("sites").select("logo_url").eq("id", siteId).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, logo_url: data?.logo_url || "" });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const siteId = String(form.get("siteId") || "").trim();
    const file = form.get("logo");
    if (!siteId) return json({ ok: false, error: "Missing site id." }, 400);
    if (!(file instanceof File) || !file.type.startsWith("image/")) return json({ ok: false, error: "Choose an image file." }, 400);
    if (file.size > 2 * 1024 * 1024) return json({ ok: false, error: "Logo must be smaller than 2 MB." }, 400);

    const { data: site, error: siteError } = await supabase.from("sites").select("id").eq("id", siteId).maybeSingle();
    if (siteError || !site) return json({ ok: false, error: siteError?.message || "Site not found." }, 404);

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const storagePath = `sites/${site.id}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("public-images").upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) return json({ ok: false, error: uploadError.message }, 500);

    const { data: publicData } = supabase.storage.from("public-images").getPublicUrl(storagePath);
    const logoUrl = String(publicData?.publicUrl || "").trim();
    const { error: updateError } = await supabase.from("sites").update({ logo_url: logoUrl }).eq("id", site.id);
    if (updateError) return json({ ok: false, error: updateError.message }, 500);

    return json({ ok: true, logo_url: logoUrl });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Could not upload logo." }, 500);
  }
};

export const DELETE: APIRoute = async ({ url }) => {
  const siteId = String(url.searchParams.get("siteId") || "").trim();
  if (!siteId) return json({ ok: false, error: "Missing site id." }, 400);
  const { error } = await supabase.from("sites").update({ logo_url: null }).eq("id", siteId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};