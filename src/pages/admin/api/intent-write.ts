import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { marketBlock } from "../../../lib/guideGenerator";
export const prerender = false;
/* intent-write-v1 */
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const key = env("ANTHROPIC_API_KEY"); if (!key) return json({ error: "No ANTHROPIC_API_KEY" }, 500);
    const db = createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: page } = await db.from("intent_pages").select("*").eq("id", b.id).maybeSingle();
    if (!page) return json({ error: "Page not found" }, 404);
    const { data: site } = page.site_id ? await db.from("sites").select("*").eq("id", page.site_id).maybeSingle() : ({ data: null } as any);
    const city = String(page.city || "");
    let market = ""; try { market = String(await marketBlock(db, city) || ""); } catch {}
    const agent = String(site?.agent_name || site?.name || "").trim();
    const a = b.answers || {};
    const prompt = `You write the copy for one real estate search page on ${agent ? agent + "'s" : "a"} website in ${city}, BC.

PAGE: "${b.heading || page.hero_heading || ""}"
FILTERS (what the page shows): ${JSON.stringify(b.filters || {})}
MATCHING HOMES RIGHT NOW: ${b.count ?? "unknown"}
${agent ? `AGENT: ${agent}` : ""}${site?.about_text ? `\nAGENT ABOUT (for voice only): ${String(site.about_text).slice(0, 800)}` : ""}

THE AGENT'S OWN ANSWERS (the most important input; build the copy around these and keep their specifics):
${[0, 1, 2].map((i) => `- ${(b.questions || [])[i] || ["What they would tell a buyer", "Where they would send buyers to look", "Local tips or watch-outs"][i]}: ${a["q" + (i + 1)] || "(not answered)"}`).join("\n")}


MARKET DATA (background only):
${market.slice(0, 4000)}

RULES
- Canadian spelling. Plain, warm, confident. Short sentences. No hype words (stunning, nestled, dream home, boasts).
- Number-light: describe patterns, not exact prices, counts or days on market, so the copy doesn't go stale.
- Use the agent's answers as the agent's own knowledge. Never invent personal stories, clients or opinions they didn't give.
- BC facts (permits, strata, Residential Tenancy Act, septic/wells, ALR) only when relevant, stated carefully, with "check with" advice rather than guarantees.
- Never describe who should or shouldn't live somewhere by age, family status, religion or similar.
- Don't mention AI or the filters by name.

Return ONLY JSON with these keys:
{"intro_copy": "1-2 sentences, under 45 words, sits under the page title",
 "seo_heading": "the H2 below the hero, under 60 characters",
 "neighbourhood_copy": "'What buyers should know': 2-3 short paragraphs separated by a blank line",
 "buyer_guide_heading": "under 60 characters",
 "buyer_guide_copy": "4-6 paragraphs separated by blank lines, each starting with a **bold lead-in.**",
 "meta_description": "140-158 characters, includes the main keyword and 'for sale', ends with a reason to click"}`;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env("COPY_MODEL") || "claude-sonnet-5-5", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });
    const o: any = await r.json();
    if (!r.ok) return json({ error: o?.error?.message || "AI " + r.status }, 500);
    const text = (o.content || []).map((c: any) => c.text || "").join("");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    return json({ fields: JSON.parse(text.slice(s, e + 1)) });
  } catch (err: any) { return json({ error: String(err?.message || err) }, 500); }
};