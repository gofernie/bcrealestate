// cma-vision-v1: read listing photos + description and rate condition (shared by the admin CMA and shared report links)
import { logAi } from "./aiLog";
import { imgUrl } from "./cma";

const envv = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const VISION_CACHE = new Map<string, any>();
export async function readCondition(mls: string, user: any, fresh = false) {
  if (!fresh && VISION_CACHE.has(mls)) return VISION_CACHE.get(mls);
  const key = envv("ANTHROPIC_API_KEY"); if (!key) return { error: "No ANTHROPIC_API_KEY set." };
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb.from("listing_rows").select("images, image_url, description, year_built, normalized_type").eq("mls_number", mls).limit(5);
  const r: any = (data || []).sort((a: any, b: any) => (Array.isArray(b.images) ? b.images.length : 0) - (Array.isArray(a.images) ? a.images.length : 0))[0];
  if (!r) return { error: "No listing record with photos for this home." };
  const all = (Array.isArray(r.images) ? r.images : []).map((x: any) => imgUrl(typeof x === "string" ? x : x?.url || x?.src || "", "medium")).filter(Boolean) as string[];
  if (all.length < 3) return { error: "Not enough photos to judge condition." };
  // spread 15 picks across the set (interiors sit in the middle of most listings)
  const n = Math.min(15, all.length), picks = [...new Set(Array.from({ length: n }, (_, i) => all[Math.min(all.length - 1, Math.round((i * (all.length - 1)) / (n - 1)))]))];
  const prompt = `You are helping a BC real estate agent judge the condition of a ${r.normalized_type || "home"}${r.year_built ? ` built in ${r.year_built}` : ""} for a market valuation. Comparable sales are typical homes in average condition for their age. Look at the listing photos and read the description, then rate how this home's finish and condition compare with a typical home of its age in the area.

Description: """${String(r.description || "").slice(0, 2500)}"""

Judge only what you can see or what the description states. Ignore staging, furniture, photo quality and virtual staging. Note it if the photos look virtually staged or hide the kitchen or bathrooms.

Return ONLY JSON:
{"overall": "dated" | "average" | "updated" | "renovated",
 "suggested_pct": integer from -20 to 10 (fixer/teardown -15 to -20, dated -5 to -10, average 0, updated +3 to +6, fully renovated +7 to +10),
 "confidence": "low" | "medium" | "high",
 "areas": [{"area": "Kitchen" | "Bathrooms" | "Flooring" | "Windows/exterior" | "Overall finish", "rating": "dated" | "average" | "updated", "note": "under 14 words, what you saw"}],
 "summary": "one sentence an agent can read to a seller"}`;
  const content: any[] = picks.map((u) => ({ type: "image", source: { type: "url", url: u } }));
  content.push({ type: "text", text: prompt });
  const model = envv("CMA_VISION_MODEL") || "claude-sonnet-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: "user", content }] }),
  });
  const o: any = await res.json();
  if (!res.ok) return { error: o?.error?.message || "AI " + res.status };
  logAi({ user, kind: "cma-photos", model, usage: o.usage });
  const text = (o.content || []).map((c: any) => c.text || "").join("");
  let out: any;
  try { out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { return { error: "Couldn't read the photo assessment." }; }
  out.suggested_pct = Math.max(-20, Math.min(10, Math.round(Number(out.suggested_pct) || 0)));
  out.photos = picks.length;
  VISION_CACHE.set(mls, out);
  return out;
}
