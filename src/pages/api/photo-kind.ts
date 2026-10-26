import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

// photo-kind-v1: is this listing photo an interior with furniture/decor? Asked once per photo, then cached.
const env = (k: string) => (import.meta.env as any)[k] ?? process.env[k];
const MODEL = env("PHOTO_KIND_MODEL") ?? env("LOOK_SEARCH_MODEL") ?? "claude-haiku-5-5";
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const json = (body: unknown, status = 200, cache = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": cache ? "public, max-age=86400, s-maxage=31536000" : "no-store" },
  });

export const GET: APIRoute = async ({ url }) => {
  const photo = String(url.searchParams.get("url") || "").trim().split("?")[0];
  let host = "";
  try { host = new URL(photo).hostname; } catch {}
  if (host !== "cdn.repliers.io") return json({ error: "Image not allowed" }, 400);

  const sb = createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: hit } = await sb.from("photo_kinds").select("interior").eq("url", photo).maybeSingle();
  if (hit) return json({ interior: hit.interior }, 200, true);

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Not configured" }, 500);
  // Send Haiku a small copy (faster, fewer tokens); fall back to the original if the resize isn't available.
  let img: Response | null = null;
  if (!import.meta.env.DEV) img = await fetch(`${url.origin}/.netlify/images?url=${encodeURIComponent(photo)}&w=512&fm=jpg&q=70`).catch(() => null);
  if (!img || !img.ok) img = await fetch(photo);
  if (!img.ok) return json({ error: "Image fetch failed" }, 502);
  const mediaType = (img.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  if (!OK_TYPES.includes(mediaType)) return json({ error: "Unsupported image" }, 415);
  const data = Buffer.from(await img.arrayBuffer()).toString("base64");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 60,
      tools: [{ name: "classify", description: "Classify the listing photo", input_schema: { type: "object", properties: { interior: { type: "boolean", description: "true only for an indoor room photo showing furniture, fixtures or decor a buyer might want to shop for" } }, required: ["interior"] } }],
      tool_choice: { type: "tool", name: "classify" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: "Is this an indoor room photo with furniture, fixtures or decor a buyer might shop for? Exterior, aerial, yard, street, floorplan, map, empty-room and empty-lot photos are false." },
      ] }],
    }),
  });
  if (!r.ok) return json({ error: "Classifier failed" }, 502);
  const out = await r.json();
  const interior = out?.content?.find((c: any) => c.type === "tool_use")?.input?.interior === true;
  await sb.from("photo_kinds").upsert({ url: photo, interior });
  return json({ interior }, 200, true);
};