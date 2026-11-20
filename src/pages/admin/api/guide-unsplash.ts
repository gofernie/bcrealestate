import type { APIRoute } from "astro";
import { getAdminUser } from "../../../lib/guideAccess";
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const UTM = "utm_source=fernie_pages&utm_medium=referral";

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await getAdminUser(cookies))) return json({ error: "Not allowed" }, 401);
  const key = import.meta.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return json({ error: "UNSPLASH_ACCESS_KEY is not set" }, 500);
  const b: any = await request.json().catch(() => ({}));
  if (b.action === "track") {
    const u = String(b.download || "");
    if (u.startsWith("https://api.unsplash.com/")) await fetch(u, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(4000) }).catch(() => {});
    return json({ ok: true });
  }
  const q = String(b.q || "").trim().slice(0, 100);
  if (!q) return json({ error: "Type something to search for" }, 400);
  const page = Math.max(1, Math.min(20, +b.page || 1));
  const r = await fetch(`https://api.unsplash.com/search/photos?${new URLSearchParams({ query: q, per_page: "12", page: String(page), orientation: "landscape", content_filter: "high" })}`, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, signal: AbortSignal.timeout(6000),
  }).catch((e) => null);
  if (!r) return json({ error: "Unsplash didn't respond" }, 502);
  if (!r.ok) return json({ error: r.status === 401 ? "Unsplash says the key is wrong" : r.status === 403 ? "Unsplash hourly limit reached, try again later" : `Unsplash error ${r.status}` }, 502);
  const d: any = await r.json();
  const results = (d.results || []).map((p: any) => ({
    id: p.id,
    thumb: p.urls?.small,
    inline: `${p.urls?.raw}&w=1600&q=75&fm=webp&fit=max`,
    hero: `${p.urls?.raw}&w=2000&h=875&fit=crop&q=75&fm=webp`,
    alt: p.alt_description || q,
    name: p.user?.name || "Unsplash",
    href: `${p.user?.links?.html || "https://unsplash.com"}?${UTM}`,
    raw: p.urls?.raw,
    download: p.links?.download_location,
  }));
  return json({ results });
};