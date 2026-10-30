// cachedFetch-v1: short-lived in-memory cache for Supabase REST GETs on public, slow-changing tables.
// Pass to createClient(url, key, { global: { fetch: cachedFetch } }).
// Lives per warm Netlify function instance; cuts repeat queries when crawlers walk many pages.

const TTL_MS: Record<string, number> = {
  sites: 10 * 60_000,
  area_boundaries: 30 * 60_000,
  intent_pages: 10 * 60_000,
  market_metrics_public: 30 * 60_000,
  listing_refresh_runs: 5 * 60_000,
  osm_amenities: 60 * 60_000,
  listing_floorplans: 10 * 60_000,
  listing_rows: 5 * 60_000,
};

const MAX_ENTRIES = 400;
const MAX_BODY_BYTES = 3_000_000;

type Entry = { exp: number; status: number; headers: [string, string][]; body: string };
const store = new Map<string, Entry>();

export const cachedFetch: typeof fetch = async (input: any, init?: any) => {
  const url: string =
    typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || String(input);
  const method = String(init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
  const table = url.match(/\/rest\/v1\/([a-z0-9_]+)/i)?.[1] || "";
  const ttl = method === "GET" ? TTL_MS[table] || 0 : 0;

  if (!ttl) return fetch(input, init);

  const h = new Headers(init?.headers || (typeof input === "object" ? input?.headers : undefined));
  const key = [url, h.get("accept") || "", h.get("prefer") || "", h.get("range") || ""].join("|");

  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) {
    store.delete(key);
    store.set(key, hit); // keep recently used entries
    return new Response(hit.body, { status: hit.status, headers: hit.headers });
  }

  const res = await fetch(input, init);
  if (!res.ok) return res;

  const body = await res.text();
  const headers = [...res.headers.entries()] as [string, string][];

  if (body.length <= MAX_BODY_BYTES) {
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { exp: Date.now() + ttl, status: res.status, headers, body });
  }

  return new Response(body, { status: res.status, headers });
};
