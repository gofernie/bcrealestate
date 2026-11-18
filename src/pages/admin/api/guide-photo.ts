import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
export const prerender = false;

const pick = (k: string) => (import.meta.env as any)[k] ?? process.env[k];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const guideId = String(form.get("guide_id") || "").replace(/[^a-z0-9-]/gi, "");
    const kind = String(form.get("kind") || "inline") === "hero" ? "hero" : "inline";
    if (!(file instanceof File) || !guideId) return json({ error: "Missing file or guide" }, 400);
    if (!/^image\//.test(file.type)) return json({ error: "That isn't an image" }, 400);
    const base = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "none" }).rotate();
    const lgW = kind === "hero" ? 2000 : 1600;
    const [lg, sm] = await Promise.all([
      base.clone().resize({ width: lgW, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true }),
      base.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer(),
    ]);
    const sb = createClient(pick("PUBLIC_SUPABASE_URL"), pick("SUPABASE_SERVICE_ROLE_KEY"));
    const stem = `guides/${guideId}/${randomUUID().slice(0, 8)}`;
    const up = async (path: string, buf: Buffer) => {
      const { error } = await sb.storage.from("public-images").upload(path, (() => { const ab = new ArrayBuffer(buf.length); new Uint8Array(ab).set(buf); return ab; })(), { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (error) throw error;
      return sb.storage.from("public-images").getPublicUrl(path).data.publicUrl;
    };
    const url = await up(`${stem}-lg.webp`, lg.data);
    const url_sm = await up(`${stem}-sm.webp`, sm);
    return json({ url, url_sm, width: lg.info.width, height: lg.info.height, kb: Math.round(lg.data.length / 1024) });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
};