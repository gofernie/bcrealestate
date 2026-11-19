// Google Search Console (read-only) via service account. Env: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, optional GSC_SITE.
import { createSign } from "node:crypto";
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
let cache: { t: string; exp: number } | null = null;
const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || "");

async function token() {
  if (cache && cache.exp > Date.now() + 60000) return cache.t;
  const email = env("GSC_CLIENT_EMAIL"), pk = env("GSC_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!email || !pk) throw new Error("Search Console not set up (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY)");
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const c = b64(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const s = createSign("RSA-SHA256"); s.update(h + "." + c);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: h + "." + c + "." + b64(s.sign(pk)) }) });
  const o: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(o.error_description || o.error || "Google auth failed");
  cache = { t: o.access_token, exp: Date.now() + o.expires_in * 1000 };
  return cache.t;
}

export async function gscQueries(contains: string, days = 90) {
  const t = await token();
  const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const sites = env("GSC_SITE") ? [env("GSC_SITE")] : ["sc-domain:bc.realestate", "https://bc.realestate/"];
  let lastErr = "";
  for (const site of sites) {
    const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/json" },
      body: JSON.stringify({ startDate: d(days + 3), endDate: d(3), dimensions: ["query"], rowLimit: 100,
        dimensionFilterGroups: [{ filters: [{ dimension: "query", operator: "contains", expression: contains.toLowerCase() }] }] }),
    });
    const o: any = await r.json().catch(() => ({}));
    if (!r.ok) { lastErr = o?.error?.message || "GSC " + r.status; continue; }
    return (o.rows || []).map((x: any) => ({ q: x.keys[0], impressions: x.impressions, clicks: x.clicks, position: Math.round(x.position * 10) / 10 }))
      .sort((a: any, b: any) => b.impressions - a.impressions);
  }
  throw new Error(lastErr || "No Search Console access");
}