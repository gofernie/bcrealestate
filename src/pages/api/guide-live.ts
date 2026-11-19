import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { marketBlock } from "../../lib/guideGenerator";
export const prerender = false;

const json = (o: any, s = 200, cache = false) => new Response(JSON.stringify(o), { status: s, headers: {
  "content-type": "application/json",
  ...(cache ? { "cache-control": "public, max-age=600", "netlify-cdn-cache-control": "public, s-maxage=21600, stale-while-revalidate=86400" } : { "cache-control": "no-store" }),
} });
const num = (m: string) => +String(m || "").replace(/[^\d.]/g, "") || 0;

export const GET: APIRoute = async ({ url }) => {
  const city = String(url.searchParams.get("city") || "").toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(city)) return json({ error: "bad city" }, 400);
  try {
    const db = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
    const text: string = await marketBlock(db as any, city);
    if (!text) return json({ error: "no data" }, 404);
    let sec = "";
    const sold: any[] = [], active: any[] = [];
    let activeTotal = 0, lowest = "";
    for (const line of text.split(/\r?\n/)) {
      if (/^SOLD by neighbourhood/i.test(line)) { sec = "area"; continue; }
      const fs = line.match(/^FOR SALE now:\s*(\d+) active listings, lowest asking (\$[\d,]+)/i);
      if (fs) { sec = "active"; activeTotal = +fs[1]; lowest = fs[2]; continue; }
      if (/^SOLD,/i.test(line)) { sec = "sold"; continue; }
      let m;
      if (sec === "area" && (m = line.match(/^- (.+?): (\d+) sold, median (\$[\d,]+)/))) sold.push({ name: m[1], n: +m[2], median: m[3] });
      if (sec === "active" && (m = line.match(/^- (.+?): (\d+) active, median asking (\$[\d,]+)/))) active.push({ name: m[1], n: +m[2], median: m[3] });
    }
    const out: any = { city, asOf: new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }) };
    if (sold.length) {
      const total = sold.reduce((a, r) => a + r.n, 0);
      const by = [...sold].sort((a, b) => num(a.median) - num(b.median));
      const busy = sold.slice(0, 2).map((r) => r.name);
      out.sold = { rows: sold, summary: `${total.toLocaleString("en-CA")} sales in the last 12 months across these areas. ${busy.join(" and ")} ${busy.length > 1 ? "were" : "was"} busiest. Medians run from ${by[0].median} in ${by[0].name} to ${by[by.length - 1].median} in ${by[by.length - 1].name}.` };
    }
    if (active.length) {
      const top = active[0];
      out.active = { rows: active, summary: `${activeTotal.toLocaleString("en-CA")} homes for sale right now, starting at ${lowest}. ${top.name} listings are the most common (${top.n}).` };
    }
    return json(out, 200, true);
  } catch (e: any) { return json({ error: String(e?.message || e) }, 500); }
};