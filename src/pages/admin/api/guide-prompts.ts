import type { APIRoute } from "astro";
import { getAdminUser } from "../../../lib/guideAccess";
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

function parse(text: string): string[] {
  let qs: any[] = [];
  const m = text.match(/\[[\s\S]*?\]/g) || [];
  for (const blk of m) { try { const v = JSON.parse(blk); if (Array.isArray(v) && v.length) { qs = v; break; } } catch {} }
  if (!qs.length) qs = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").replace(/^["\u201c]|["\u201d],?$/g, "").trim()).filter((l) => /\?$/.test(l) && l.length > 12);
  return qs.map((q) => String(typeof q === "object" && q ? q.question || q.q || "" : q || "").trim()).filter(Boolean);
}

async function ask(key: string, prompt: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: import.meta.env.PAA_MODEL || process.env.PAA_MODEL || "claude-haiku-5-5", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  const o: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(o?.error?.message || "AI " + r.status);
  return (o.content || []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("");
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = await getAdminUser(cookies);
  if (!me) return json({ error: "Not allowed" }, 401);
  const key = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "No ANTHROPIC_API_KEY" }, 500);
  const b: any = await request.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 200);
  const place = String(b.place || "").trim().slice(0, 80);
  const isR = String(b.topic || "").startsWith("r-");
  const existing = (Array.isArray(b.existing) ? b.existing : []).map((q: any) => String(q || "").trim()).filter(Boolean).slice(0, 30);
  if (!title) return json({ error: "Set the title first" }, 400);
  const style = isR
    ? `The facts in this guide are researched separately, so ask for the agent's experience, opinions, client situations and local examples, not for facts or statistics.`
    : `Ask for experience, opinions, stories and specifics (names of places, streets, seasons), not statistics.`;
  const prompt = [
    `A local real estate agent${place ? ` in ${place}, British Columbia` : ""} is writing a guide for their website titled "${title}".`,
    existing.length ? `Questions they have already been asked (do not repeat or overlap these):\n${existing.map((q: string) => "- " + q).join("\n")}` : "",
    `Write exactly 5 new questions to ask the agent that draw out specific, first-hand, local detail for THIS guide: things only someone who lives and works there would know. Stay within the guide's subject. If no existing question asks for a client story, make one of the 5 a request for a short client story (no names).`,
    style,
    `Each question under 20 words, conversational, second person, ending with "?".`,
    `Reply with ONLY a JSON array of 5 strings, like ["...?", "...?"]. No other text.`,
  ].filter(Boolean).join("\n\n");
  try {
    let text = await ask(key, prompt);
    let qs = parse(text);
    if (!qs.length) {
      text = await ask(key, `Write 5 new interview questions for a local real estate agent writing a guide titled "${title}"${place ? ` about ${place}, BC` : ""}. Focus on angles not yet covered: ${existing.slice(-8).join(" | ") || "none"}. ${style} Reply with ONLY a JSON array of 5 question strings.`);
      qs = parse(text);
    }
    if (!qs.length) return json({ questions: [], debug: text.replace(/\s+/g, " ").slice(0, 200) });
    return json({ questions: qs.slice(0, 5) });
  } catch (e: any) { return json({ error: String(e?.message || e) }, 500); }
};