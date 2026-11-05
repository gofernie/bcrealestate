import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "guide-images";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function POST({ request }) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const id = String(form.get("id") || "misc").replace(/[^a-z0-9-]/gi, "");
    if (!file || typeof file === "string" || !file.size) return json({ error: "No file" }, 400);
    if (file.size > 6 * 1024 * 1024) return json({ error: "File too large after resize" }, 400);

    const input = Buffer.from(await file.arrayBuffer());
    const base = sharp(input, { failOn: "none" }).rotate();
    const [wide, tall] = await Promise.all([
      base.clone().resize(1920, 1080, { fit: "cover", position: "attention" }).webp({ quality: 62 }).toBuffer(),
      base.clone().resize(900, 1600, { fit: "cover", position: "attention" }).webp({ quality: 60 }).toBuffer(),
    ]);

    const stamp = Date.now();
    const put = async (name, buf) => {
      const path = `interscroller/${id}/${stamp}-${name}.webp`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([Uint8Array.from(buf)], { type: "image/webp" }), {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    };
    const [img, img_mobile] = await Promise.all([put("wide", wide), put("tall", tall)]);

    return json({ img, img_mobile, kb: { wide: Math.round(wide.length / 1024), tall: Math.round(tall.length / 1024) } });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}