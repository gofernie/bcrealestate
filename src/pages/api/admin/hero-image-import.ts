import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

function publicAddress(address: string): boolean {
  if (isIP(address) === 6) {
    // Global unicast only; exclude IPv4-mapped and local IPv6 addresses.
    return /^[23][0-9a-f]{3}:/i.test(address);
  }
  if (isIP(address) !== 4) return false;

  const [a, b, c] = address.split(".").map(Number);
  if (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && c === 0))) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) return false;
  return true;
}

async function checkedUrl(value: string): Promise<URL> {
  const url = new URL(value);

  if (
    url.hostname === "images.unsplash.com" ||
    url.hostname === "plus.unsplash.com"
  ) {
    url.searchParams.delete("auto");
    url.searchParams.delete("h");
    url.searchParams.set("fm", "jpg");
    url.searchParams.set("fit", "max");
    url.searchParams.set("w", "2000");
    url.searchParams.set("q", "85");
  }

  if (
    url.protocol !== "https:" ||
    url.username || url.password ||
    (url.port && url.port !== "443") ||
    url.hostname.endsWith(".local")
  ) throw new Error("Use a public HTTPS image URL.");

  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
    throw new Error("This image host is not public.");
  }
  return url;
}

async function downloadImage(value: string): Promise<{ bytes: Uint8Array; type: string }> {
  let url = await checkedUrl(value);

  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "image/jpeg,image/png,image/webp,image/avif" },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === 3) throw new Error("Too many image redirects.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Image redirect has no destination.");
      await response.body?.cancel();
      url = await checkedUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Image host returned HTTP ${response.status}.`);
    }

    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type)) {
      await response.body.cancel();
      throw new Error("URL must return a JPG, PNG, WebP or AVIF image.");
    }

    const statedSize = Number(response.headers.get("content-length") || 0);
    if (statedSize > MAX_BYTES) {
      await response.body.cancel();
      throw new Error("Image must be under 8 MB.");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) throw new Error("Image must be under 8 MB.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    if (!total) throw new Error("Image is empty.");
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const valid =
      (type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
      (type === "image/png" && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
      (type === "image/webp" && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP") ||
      (type === "image/avif" && new TextDecoder().decode(bytes.subarray(4, 8)) === "ftyp" &&
        new TextDecoder().decode(bytes.subarray(8, 12)).startsWith("avif"));

    if (!valid) throw new Error("Downloaded file does not match its image type.");
    return { bytes, type };
  }

  throw new Error("Could not download image.");
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = createSupabaseServerClient(cookies);
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "Sign in to import images." }, 401);

    const body = await request.json();
    const siteId = String(body.siteId || "").trim();
    const city = String(body.marketCity || "").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const sourceUrl = String(body.url || "").trim();

    if (!/^[a-z0-9-]+$/i.test(siteId) || !city || !sourceUrl) {
      return json({ ok: false, error: "Choose a site, market and image URL." }, 400);
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: site, error: siteError } = await supabase
      .from("sites").select("id, agent_id, admin_scope").eq("id", siteId).maybeSingle();

    if (siteError || !site) return json({ ok: false, error: "Site not found." }, 404);
    const platformAdminUserIds = new Set([
      "e6ef2640-eeff-4d57-8df2-c4c5f820a182",
      "0282af0e-cef9-4f8e-a263-d456c6c26b1b",
    ]);

    const isPlatformAdmin =
      platformAdminUserIds.has(user.id);

    const canManageSite = isPlatformAdmin
      ? site.admin_scope === "platform"
      : site.agent_id === user.id;

    if (!canManageSite) {
      return json({ ok: false, error: "You cannot import images for this site." }, 403);
    }

    const { bytes, type } = await downloadImage(sourceUrl);
    const extension: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png",
      "image/webp": "webp", "image/avif": "avif",
    };
    const storagePath =
      `sites/${siteId}/hero/${city}/${crypto.randomUUID()}.${extension[type]}`;

    const { error: uploadError } = await supabase.storage
      .from("public-images")
      .upload(storagePath, bytes, {
        contentType: type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) return json({ ok: false, error: uploadError.message }, 500);

    const { data } = supabase.storage.from("public-images").getPublicUrl(storagePath);
    return json({ ok: true, url: data.publicUrl });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "Could not import image." }, 400);
  }
};