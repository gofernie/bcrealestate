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

/* agent-photo-get-v1 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const siteId = String(
      url.searchParams.get("siteId") || ""
    ).trim();

    if (!siteId) {
      return json(
        { ok: false, error: "Missing site id." },
        400
      );
    }

    const { data: site, error: siteError } =
      await supabase
        .from("sites")
        .select("agent_id")
        .eq("id", siteId)
        .maybeSingle();

    if (siteError) {
      return json(
        { ok: false, error: siteError.message },
        500
      );
    }

    if (!site?.agent_id) {
      return json({
        ok: true,
        photo_url: "",
      });
    }

    const { data: agent, error: agentError } =
      await supabase
        .from("agents")
        .select("photo_url")
        .eq("id", site.agent_id)
        .maybeSingle();

    if (agentError) {
      return json(
        { ok: false, error: agentError.message },
        500
      );
    }

    return json({
      ok: true,
      photo_url: agent?.photo_url || "",
    });

  } catch (error: any) {

    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Could not load agent photo.",
      },
      500
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();

    const siteId = String(
      form.get("siteId") || ""
    ).trim();

    const file = form.get("photo");

    if (!siteId) {
      return json(
        { ok: false, error: "Missing site id." },
        400
      );
    }

    if (!(file instanceof File)) {
      return json(
        { ok: false, error: "Choose an image." },
        400
      );
    }

    if (!file.type.startsWith("image/")) {
      return json(
        { ok: false, error: "File must be an image." },
        400
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return json(
        {
          ok: false,
          error: "Image must be smaller than 8 MB.",
        },
        400
      );
    }

    const { data: site, error: siteError } =
      await supabase
        .from("sites")
        .select("id, agent_id")
        .eq("id", siteId)
        .maybeSingle();

    if (siteError) {
      return json(
        { ok: false, error: siteError.message },
        500
      );
    }

    if (!site?.agent_id) {
      return json(
        {
          ok: false,
          error: "This site does not have a linked agent.",
        },
        400
      );
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") ||
      "jpg";

    const storagePath =
      `agents/${site.agent_id}/headshot-${Date.now()}.${extension}`;

    const bytes = await file.arrayBuffer();

    const { error: uploadError } =
      await supabase.storage
        .from("public-images")
        .upload(
          storagePath,
          bytes,
          {
            contentType: file.type,
            upsert: false,
            cacheControl: "3600",
          }
        );

    if (uploadError) {
      return json(
        { ok: false, error: uploadError.message },
        500
      );
    }

    const { data: publicData } =
      supabase.storage
        .from("public-images")
        .getPublicUrl(storagePath);

    const photoUrl =
      String(publicData?.publicUrl || "").trim();

    if (!photoUrl) {
      return json(
        {
          ok: false,
          error: "Could not create photo URL.",
        },
        500
      );
    }

    const { error: agentError } =
      await supabase
        .from("agents")
        .update({
          photo_url: photoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", site.agent_id);

    if (agentError) {
      return json(
        { ok: false, error: agentError.message },
        500
      );
    }

    return json({
      ok: true,
      photo_url: photoUrl,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Could not upload agent photo.",
      },
      500
    );
  }
};