// cma-share-v1: public photo read for a shared pitch report. Only reads that report's own home, and only once:
// the result is saved into the report, so re-opening the link never costs another AI call.
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { readCondition } from "../../lib/cmaVision";
export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const GET: APIRoute = async ({ url }) => {
  const id = String(url.searchParams.get("report") || "");
  if (!UUID.test(id)) return json({ error: "Not found" }, 404);
  const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rep } = await sb.from("cma_reports").select("data").eq("id", id).maybeSingle();
  const d: any = rep?.data;
  if (!d || !d.pitch || !d.mls) return json({ error: "Not available for this report." }, 404);
  if (d.photoRead && !d.photoRead.error) return json(d.photoRead);
  try {
    const out: any = await readCondition(String(d.mls), { email: "shared-report" });
    if (out && !out.error) await sb.from("cma_reports").update({ data: { ...d, photoRead: out } }).eq("id", id);
    return json(out);
  } catch (e: any) {
    return json({ error: e?.message || "Couldn't read the photos." }, 500);
  }
};
