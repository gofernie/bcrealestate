import type { APIRoute } from "astro";
export const prerender = false;
/* intent-questions-v2: features in plain words, questions must cover them */
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const FLAGS: Record<string, string> = {
  requires_suite: "has a suite", requires_detached_suite: "detached suite (carriage house, garden suite, cottage)", requires_inhome_suite: "in-home suite",
  requires_shop: "a shop / workshop", requires_heat_pump: "heat pump", requires_ac: "air conditioning", requires_fireplace: "fireplace",
  requires_single_level: "no stairs, all on one level", requires_updated_kitchen: "updated kitchen", requires_waterfront: "waterfront",
  requires_ocean_view: "ocean view", primary_on_main: "primary bedroom on the main floor",
  three_plus_beds_same_floor: "3+ bedrooms on one floor", four_plus_beds_same_floor: "4+ bedrooms on one floor",
};
function describe(f: any) {
  const out: string[] = []; const one = (k: string) => (Array.isArray(f[k]) ? f[k][0] : f[k]);
  for (const [k, label] of Object.entries(FLAGS)) if (one(k) === "true" || one(k) === "on") out.push(label);
  if (one("waterfront_type")) out.push(`${one("waterfront_type")} (on the water)`);
  if (one("view_type")) out.push(`${one("view_type")} view`);
  const lot = Number(one("min_lot_sqft") || 0); if (lot) out.push(lot >= 21780 ? `${+(lot / 43560).toFixed(2)}+ acre lot` : `${lot.toLocaleString()}+ sq ft lot`);
  if (one("property_type")) out.push(`property type: ${[].concat(f.property_type).join(", ")}`);
  if (f.home_styles) out.push(`style: ${[].concat(f.home_styles).join(", ")}`);
  if (Number(one("min_parking")) >= 4) out.push(`${one("min_parking")}+ parking (RV / boat room)`); else if (one("min_parking")) out.push(`${one("min_parking")}+ parking`);
  if (Number(one("min_kitchens")) > 1) out.push(`${one("min_kitchens")}+ kitchens`);
  if (one("beds_min")) out.push(`${one("beds_min")}+ beds`);
  if (one("price_min") || one("price_max")) out.push(`price ${one("price_min") || "any"} to ${one("price_max") || "any"}`);
  if (one("area")) out.push(`area: ${one("area")}`);
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const key = env("ANTHROPIC_API_KEY"); if (!key) return json({ error: "No ANTHROPIC_API_KEY" }, 500);
    const feats = describe(b.filters || {});
    const prompt = `A real estate agent in ${b.city || "BC"} is writing a search page (working title: "${b.heading || ""}").

WHAT THIS PAGE SHOWS: ${feats.length ? feats.join("; ") : "general homes"}

Write 3 short questions for the agent, so their own local experience makes the page unique. The questions MUST be about the features above (the title may be out of date; the features win). When there are several, combine the distinctive ones (e.g. oceanfront + acreage: foreshore, erosion, wells near salt water). Lean on what's specific to each feature: waterfront (foreshore, docks, erosion, insurance, riparian rules), acreage (wells, septic, ALR, outbuildings), suites (permits, entrances, lenders), condos (strata health, rental rules), shops (power, permits, zoning).
1) what they'd tell a buyer looking for exactly this, 2) where they'd send them to look and why, 3) a local tip or watch-out.
Conversational, under 18 words, addressed to the agent as "you". Each with a realistic example answer under 25 words, BC-plausible, no exact prices.

Return ONLY JSON: [{"question":"...","example":"..."},{"question":"...","example":"..."},{"question":"...","example":"..."}]`;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env("QUESTION_MODEL") || "claude-haiku-5-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    const o: any = await r.json();
    if (!r.ok) return json({ error: o?.error?.message || "AI " + r.status }, 500);
    const text = (o.content || []).map((c: any) => c.text || "").join("");
    let questions: any = null;
    try { const s = text.indexOf("["), e = text.lastIndexOf("]"); if (s >= 0 && e > s) questions = JSON.parse(text.slice(s, e + 1)); } catch {}
    if (!questions) { try { const s = text.indexOf("{"), e = text.lastIndexOf("}"); const obj = JSON.parse(text.slice(s, e + 1)); questions = obj.questions || Object.values(obj).find((v: any) => Array.isArray(v)); } catch {} }
    if (!Array.isArray(questions) || !questions.length) return json({ error: `No questions in reply (${o.stop_reason}): ${text.slice(0, 200) || "empty"}` }, 500);
    return json({ questions: questions.slice(0, 3), features: feats });
  } catch (err: any) { return json({ error: String(err?.message || err) }, 500); }
};