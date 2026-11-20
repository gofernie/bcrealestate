import type { APIRoute } from "astro";
import { getAdminUser } from "../../../lib/guideAccess";
import { logAi } from "../../../lib/aiLog";
import { createClient } from "@supabase/supabase-js";
import { getAgentForSite } from "../../../lib/getAgentForSite";
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const plain = (md: string) => md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^\s*\|.*$/gm, " ").replace(/[#*_>`]/g, " ").replace(/\s+/g, " ").trim();
const arr = (x: any) => (Array.isArray(x) ? x : x ? [x] : []).map((s: any) => String(s || "").trim()).filter(Boolean);

export const POST: APIRoute = async ({ request, cookies }) => {
  const __me = await getAdminUser(cookies); if (!__me) return json({ error: "Not allowed" }, 401);
  const key = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "No ANTHROPIC_API_KEY" }, 500);
  const b: any = await request.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 200);
  const raw = String(b.body || "");
  const opening = plain(raw.split(/\n##\s/).slice(0, 2).join("\n")).slice(0, 1400);
  const headings = (raw.match(/^##\s+.+$/gm) || []).map((h) => h.replace(/^##\s+/, "").trim()).slice(0, 12);
  const body = plain(raw).slice(0, 5000);
  let brand = "";
  if (b.id) {
    try {
      const db = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: g } = await db.from("guide_pages").select("site_id").eq("id", String(b.id)).maybeSingle();
      if (g?.site_id) {
        const { data: s } = await db.from("sites").select("*").eq("id", g.site_id).maybeSingle();
        const a: any = s ? await getAgentForSite(s) : null;
        const n = String(a?.name || "").trim();
        if (n && n.toLowerCase() !== "bc.realestate") brand = n.slice(0, 40);
      }
    } catch {}
  }
  if (!brand) brand = String(b.brand || "").trim().slice(0, 40);
  if (!title && !body) return json({ error: "Write or insert the guide first" }, 400);
  const prompt = [
    `You write search snippets for a local real estate agent's guide pages in British Columbia.`,
    `PAGE TITLE (the H1, this is the phrase the page should rank for): "${title}"`,
    opening ? `OPENING OF THE GUIDE (its direct answer):\n${opening}` : "",
    headings.length ? `SECTIONS COVERED: ${headings.join(" / ")}` : "",
    body ? `MORE OF THE GUIDE (for facts only):\n${body}` : "",
    `Write 3 SEO titles and 3 meta descriptions.`,
    `TITLES (40 to 58 characters each, no brand name):`,
    `1. The page title almost as-is, tidied up, keeping its exact main phrase and question form.`,
    `2. The page title's main phrase plus a short specific hook taken from the guide (for example what it breaks down).`,
    `3. A natural variant a buyer might type into Google, still containing the place name.`,
    `DESCRIPTIONS (140 to 160 characters each):`,
    `- Open with an action phrase that restates the page title as what the reader will learn, for example "Find out how much houses cost in Duncan, BC." or "See what houses sell for in Duncan, BC."`,
    `- Then one sentence on what the guide covers. Lead it with the page's most distinctive feature, something most real estate sites don't offer (for example real sold prices by neighbourhood, a local agent's first-hand tips, the true costs to budget for), then one or two other topics from its sections.`,
    `- No numbers, prices or dates (they go stale in search results). No "I", "we" or "our". No quotes, no emoji.`,
    `- Match the title's subject exactly (houses vs condos vs a neighbourhood).`,
    `- The 3 options vary the opening verb and which distinctive feature they lead with.`,
    `- Target example for "How much are houses in Duncan BC?": "Find out how much houses cost in Duncan, BC. See real sold prices by neighbourhood, what's listed now, and the costs to budget for."`,
    `Reply with ONLY JSON: {"titles":["...","...","..."],"descriptions":["...","...","..."]}`,
  ].filter(Boolean).join("\n\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: import.meta.env.SEO_MODEL || process.env.SEO_MODEL || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
    });
    const o: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(o?.error?.message || "AI " + r.status); logAi({ user: __me, guide_id: b.id || null, kind: "seo", model: o.model, usage: o.usage });
    const text = (o.content || []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    let v: any = null; try { v = m ? JSON.parse(m[0]) : null; } catch {}
    let titles = arr(v?.titles || v?.title), descriptions = arr(v?.descriptions || v?.description);
    if (!titles.length || !descriptions.length) throw new Error("Couldn't read the AI reply: " + (text.replace(/\s+/g, " ").slice(0, 160) || "(empty, stop: " + (o.stop_reason || "?") + ")"));
    if (brand) titles = titles.map((t) => ((t + " | " + brand).length <= 70 ? t + " | " + brand : t));
    return json({ title: titles[0], description: descriptions[0], titles: titles.slice(0, 3), descriptions: descriptions.slice(0, 3) });
  } catch (e: any) { return json({ error: String(e?.message || e) }, 500); }
};