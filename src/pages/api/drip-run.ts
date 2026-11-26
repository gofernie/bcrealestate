// crm-plans v1: daily plan run, called by netlify/functions/drip-schedule (needs DRIP_SECRET). ?dry=1 = report only.
import type { APIRoute } from "astro";
import { runDrips } from "../../lib/drips";
export const prerender = false;
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const POST: APIRoute = async ({ request, url }) => {
  const secret = env("DRIP_SECRET");
  if (!secret || request.headers.get("x-drip-secret") !== secret) return json({ ok: false, error: "Unauthorized" }, 401);
  try {
    const log = await runDrips({ dry: url.searchParams.get("dry") === "1", siteId: url.searchParams.get("site_id") || undefined });
    return json({ ok: true, count: log.length, log });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Run failed" }, 500);
  }
};