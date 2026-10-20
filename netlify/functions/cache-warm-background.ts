// Background function (up to 15 min): warms the CDN cache for every city in the sitemap.
const BASE = "https://bc.realestate";
const PRIORITY = ["/greater-victoria", "/greater-victoria/areas"];
const MAX_PAGES = 200;
const CONCURRENCY = 6;

async function pathsFromSitemap(): Promise<string[]> {
  const paths = new Set<string>(PRIORITY);
  try {
    const res = await fetch(`${BASE}/sitemap.xml`, { headers: { "user-agent": "cache-warmer" } });
    if (res.ok) {
      const xml = await res.text();
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        try {
          const path = new URL(m[1]).pathname.replace(/\/+$/, "") || "/";
          const parts = path.split("/").filter(Boolean);
          if (parts.length === 1 || (parts.length === 2 && parts[1] === "areas")) paths.add(path);
        } catch {}
      }
    }
  } catch {}
  return [...paths].slice(0, MAX_PAGES);
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
};
