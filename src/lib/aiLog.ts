import { createClient } from "@supabase/supabase-js";

const env = (k: string) => (import.meta as any).env?.[k] || process.env[k];

/** Log one AI call to ai_usage with who, which guide and which site. Never throws. */
export async function logAi(o: { user?: any; guide_id?: string | null; site_id?: string | null; kind: string; model?: string; usage?: any; searches?: number }) {
  try {
    const db = createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const guide = o.guide_id ? String(o.guide_id) : null;
    let site = o.site_id || null;
    if (!site && guide) { const { data } = await db.from("guide_pages").select("site_id").eq("id", guide).maybeSingle(); site = data?.site_id || null; }
    const model = String(o.model || "");
    const tier = /haiku/i.test(model) ? "HAIKU" : /opus/i.test(model) ? "OPUS" : "";
    const def = tier === "HAIKU" ? [1, 5] : tier === "OPUS" ? [5, 25] : [3, 15];
    const pin = +(env(tier ? `AI_PRICE_${tier}_IN` : "AI_PRICE_IN") || def[0]), pout = +(env(tier ? `AI_PRICE_${tier}_OUT` : "AI_PRICE_OUT") || def[1]);
    const u = o.usage || {};
    const inT = (+u.input_tokens || 0) + (+u.cache_read_input_tokens || 0) + (+u.cache_creation_input_tokens || 0), outT = +u.output_tokens || 0;
    const cost = (inT * pin + outT * pout) / 1e6 + (o.searches || 0) * +(env("AI_PRICE_SEARCH") || 0.01);
    const me = o.user || {};
    await db.from("ai_usage").insert({
      site_id: site, guide_id: guide, kind: o.kind, model, input_tokens: inT, output_tokens: outT, searches: o.searches || 0,
      cost_usd: Math.round(cost * 10000) / 10000,
      user_email: String(me.email || me.user?.email || me.username || "").trim() || null,
      user_id: String(me.id || me.user?.id || "").trim() || null,
    });
  } catch {}
}