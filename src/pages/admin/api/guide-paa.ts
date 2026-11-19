import type { APIRoute } from "astro";
import { getAdminUser } from "../../../lib/guideAccess";
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = await getAdminUser(cookies);
  if (!me) return json({ error: "Not allowed" }, 401);
  const key = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "No ANTHROPIC_API_KEY" }, 500);
  const b: any = await request.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 200);
  const place = String(b.place || "").trim().slice(0, 80);
  if (!title && !place) return json({ error: "Pick a town first" }, 400);
  const subject = title ? `this topic: "${title}"${place ? ` (place: ${place}, British Columbia, Canada)` : ""}` : `living in or moving to ${place}, British Columbia, Canada`;
  const prompt = [
    `Find the questions people commonly search on Google about ${subject}.`,
    `Use web search to see what people actually ask: "People also ask" style questions, forums, local FAQs.`,
    `Return ONLY a JSON array of up to 8 short questions, phrased the way people type them into Google, most useful first for someone thinking of moving to or buying a home there. Skip trivia unrelated to living or buying there (movies, celebrities). No other text.`,
  ].join("\n\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: import.meta.env.PAA_MODEL || process.env.PAA_MODEL || "claude-haiku-5-5", max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }], messages: [{ role: "user", content: prompt }] }),
    });
    const o: any = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: o?.error?.message || "AI " + r.status }, 502);
    const text = (o.content || []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("");
    const m = text.match(/\[[\s\S]*\]/); let qs: any[] = [];
    try { qs = JSON.parse(m ? m[0] : "[]"); } catch {}
    return json({ questions: qs.map((q) => String(q || "").trim()).filter(Boolean).slice(0, 8) });
  } catch (e: any) { return json({ error: String(e?.message || e) }, 500); }
};