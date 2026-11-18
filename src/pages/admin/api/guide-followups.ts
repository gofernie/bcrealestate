import type { APIRoute } from "astro";
export const prerender = false;

const pick = (k: string) => (import.meta.env as any)[k] ?? process.env[k];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const key = pick("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "No ANTHROPIC_API_KEY" }, 500);
  const b: any = await request.json().catch(() => ({}));
  const answers = b.answers && typeof b.answers === "object" ? b.answers : {};
  const lines: string[] = [];
  for (const [k, v] of Object.entries(answers)) {
    if (k === "followups" && Array.isArray(v)) { for (const f of v as any[]) if (String(f?.a || "").trim()) lines.push(`${String(f.q).trim()} ${String(f.a).trim()}`); }
    else if (String(v || "").trim()) lines.push(`${k}: ${String(v).trim()}`);
  }
  if (!lines.length) return json({ error: "Answer a few questions first" }, 400);
  const asked = Array.isArray(answers.followups) ? answers.followups.map((f: any) => String(f?.q || "")).filter(Boolean) : [];
  const prompt = [
    `A real estate agent is writing a local guide titled "${String(b.title || "").trim()}" about ${String(b.city || "").replace(/-/g, " ")}, British Columbia. Their answers so far:`,
    lines.join("\n"),
    asked.length ? `Already asked (do not repeat):\n${asked.join("\n")}` : "",
    `Ask 4 short follow-up questions that draw out more first-hand detail. At least one must ask them to NAME a place they mentioned without naming (a park, cafe, street, beach), and at least one must ask for a rough number from their experience (price ranges, distances, times). Other good angles: specific places they mentioned, what happened next in a story, how things change by season, who it suits and why, what they'd warn a friend about. Each question must build on something they actually said. Never ask for facts they would have to look up. Plain, friendly wording. Return only a JSON array of strings.`,
  ].filter(Boolean).join("\n\n");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: pick("GUIDE_MODEL") || "claude-sonnet-5-5", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
  });
  const o: any = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: o?.error?.message || "AI " + r.status }, 502);
  const out = (o?.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const m = out.match(/\[[\s\S]*\]/);
  let qs: string[] = [];
  try { qs = JSON.parse(m ? m[0] : "[]").map((q: any) => String(q).trim()).filter(Boolean).slice(0, 5); } catch {}
  if (!qs.length) return json({ error: "No questions came back. Try again." }, 502);
  return json({ questions: qs });
};