// Runs automatically after every successful Netlify deploy: warms the CDN cache.
// City list comes from the live sitemap, so new cities are picked up automatically.
const BASE = "https://bc.realestate";
const FALLBACK = ["/greater-victoria", "/greater-victoria/areas", "/fernie", "/nanaimo"];
const MAX_PAGES = 60;
const CONCURRENCY = 8;

async function pathsFromSitemap(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/sitemap.xml`, { headers: { "user-agent": "cache-warmer" } });
    if (!res.ok) return FALLBACK;
    const xml = await res.text();
    const paths = new Set<string>();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      try {
        const path = new URL(m[1]).pathname.replace(/\/+$/, "") || "/";
        const parts = path.split("/").filter(Boolean);
        if (parts.length === 1 || (parts.length === 2 && parts[1] === "areas")) paths.add(path);
      } catch {}
    }
    for (const p of FALLBACK) paths.add(p);
    return [...paths].slice(0, MAX_PAGES);
  } catch {
    return FALLBACK;
  }
}

export const handler = async () => {
  const started = Date.now();
  const paths = await pathsFromSitemap();
  const lines: string[] = [];
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (path) => {
        const t = Date.now();
        const res = await fetch(BASE + path, { headers: { "user-agent": "cache-warmer" } });
        await res.arrayBuffer();
        return `${res.status} ${Date.now() - t}ms ${path}`;
      })
    );
    for (const r of results) lines.push(r.status === "fulfilled" ? r.value : `ERR ${String(r.reason)}`);
  }
  console.log(`cache warm: ${paths.length} pages in ${Date.now() - started}ms\n` + lines.join("\n"));
  return { statusCode: 200, body: lines.join("\n") };
};
