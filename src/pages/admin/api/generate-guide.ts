import type { APIRoute } from "astro";
import { guideDb, guideJobToken, runGuideJob } from "../../../lib/guideGenerator";
export const prerender = false;

const pick = (k: string) => (import.meta.env as any)[k] ?? process.env[k];
const ENV = () => ({
  ANTHROPIC_API_KEY: pick("ANTHROPIC_API_KEY"), GUIDE_MODEL: pick("GUIDE_MODEL"),
  PUBLIC_SUPABASE_URL: pick("PUBLIC_SUPABASE_URL"), SUPABASE_SERVICE_ROLE_KEY: pick("SUPABASE_SERVICE_ROLE_KEY"),
});
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const STALE_MS = 16 * 60 * 1000;

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id") || "";
  if (!id) return json({ error: "no id" }, 400);
  const { data } = await guideDb(ENV()).from("guide_pages").select("ai_status, ai_draft, ai_error, ai_started_at, ai_notes").eq("id", id).maybeSingle();
  if (!data) return json({ status: null });
  if (data.ai_status === "working" && data.ai_started_at && Date.now() - new Date(data.ai_started_at).getTime() > STALE_MS) {
    return json({ status: "failed", error: "Timed out. Try again.", notes: data.ai_notes });
  }
  return json({ status: data.ai_status, draft: data.ai_status === "done" ? data.ai_draft : null, error: data.ai_error, notes: data.ai_notes });
};

export const POST: APIRoute = async ({ request }) => {
  const env = ENV();
  const db = guideDb(env);
  const b: any = await request.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return json({ error: "no id" }, 400);

  if (b.action === "dismiss") {
    await db.from("guide_pages").update({ ai_status: "applied" }).eq("id", id);
    return json({ ok: true });
  }

  const { data: cur } = await db.from("guide_pages").select("ai_status, ai_started_at").eq("id", id).maybeSingle();
  if (cur?.ai_status === "working" && cur.ai_started_at && Date.now() - new Date(cur.ai_started_at).getTime() < STALE_MS) {
    return json({ error: "Already writing this guide" }, 409);
  }
  await db.from("guide_pages").update({ ai_status: "working", ai_draft: null, ai_error: null, ai_started_at: new Date().toISOString(), ai_notes: String(b.notes || "").slice(0, 4000) }).eq("id", id);
  const notes = String(b.notes || "").slice(0, 4000);
  const title = String(b.title || "").trim();

  if (import.meta.env.DEV) {
    runGuideJob(env, id, notes, title); // localhost: no timeout, run in the dev server
    return json({ ok: true });
  }
  const r = await fetch(new URL("/.netlify/functions/generate-guide-background", request.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-guide-token": guideJobToken(env) },
    body: JSON.stringify({ id, notes, title }),
  }).catch(() => null);
  if (!r || (r.status !== 202 && !r.ok)) {
    await db.from("guide_pages").update({ ai_status: "failed", ai_error: "Could not start the writer" }).eq("id", id);
    return json({ error: "Could not start the writer" }, 502);
  }
  return json({ ok: true });
};