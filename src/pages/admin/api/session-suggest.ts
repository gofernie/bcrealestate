import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const TYPES = ["homes", "financing", "market", "process", "checkin"];
const TYPE_GUIDE: Record<string, string> = {
  homes: "Point them toward homes like the ones they've engaged with. Only mention specific homes that appear in listing_reactions, using the address/price exactly as given. If there are none, invite them to say what they'd like to see.",
  financing: "Gently raise financing readiness: have they spoken with a lender or got a pre-approval, and why it helps when the right home comes up. General only: no rates, no lender names, no promises.",
  market: "Share one or two concrete numbers from market_data (aggregates only: counts, medians, days on market, trends) and what they mean for this buyer. If market_data is empty, give a practical way to read the local market without quoting any numbers.",
  process: "Explain one practical part of buying in BC that fits them: how offers and subjects work, deposits, inspections, or strata documents and fees for condos/townhomes.",
  checkin: "A light, low-pressure check-in: what's changed, their timing, or what they'd like more of.",
};

const SYSTEM = `You write short follow-up emails from a BC real estate agent to a buyer who used the agent's website.
Return ONLY JSON: {"drafts":[{"label":"...","type":"homes|financing|market|process|checkin","subject":"...","body":"..."}]} with exactly 2 drafts.
Rules:
- Plain, warm, human. 50-120 words. No emojis, no hype, no pushy sales language.
- Greet by first name if known. End with the agent's first name only; a signature is added separately.
- Use ONLY facts present in the data. Never invent listing details, prices, statistics, rates or dates.
- Market numbers must be aggregates from market_data. Never mention an individual sold price.
- Never describe tracking (e.g. "I saw you viewed 41 photos"). Refer to their interests naturally ("since you've been looking at townhomes in Saanich East").
- If they asked a question, answer only from the data or say you'll find out. Never guess.
- Don't repeat the subject or angle of emails_already_sent.
- label: 2-4 words naming the angle, e.g. "Light check-in".`;

const prettyCity = (c?: string | null) => String(c || "").replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

function slim(r: any, dropAddress = false) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r || {})) {
    if (v == null) continue;
    if (/(^id$|_id$|photo|image|url|token|email|phone)/i.test(k)) continue;
    if (dropAddress && /(address|mls)/i.test(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") o[k] = v;
    else if (typeof v === "string" && v.length <= 140 && !/^https?:/i.test(v) && !/^[0-9a-f-]{36}$/i.test(v)) o[k] = v;
    else if (Array.isArray(v) && v.length <= 12 && v.every((x) => typeof x === "string" && x.length < 40)) o[k] = v;
  }
  return o;
}

async function agentFor(siteId?: string | null) {
  let agentName = "", agentEmail = "", siteName = "";
  if (siteId) {
    const { data: s } = await supabase.from("sites").select("agent_id, site_name").eq("id", siteId).maybeSingle();
    siteName = String(s?.site_name || "").trim();
    if (s?.agent_id) {
      const { data: a } = await supabase.from("agents").select("name, email").eq("id", s.agent_id).maybeSingle();
      agentName = String(a?.name || "").trim();
      agentEmail = String(a?.email || "").trim();
    }
  }
  if (!agentName) agentName = env("DEFAULT_AGENT_NAME") || "Chris Crump";
  if (!agentEmail) agentEmail = env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
  return { agentName, agentEmail, siteName };
}

async function marketFor(city: string) {
  const out: Record<string, unknown> = {};
  if (!city) return out;
  for (const c of [city, prettyCity(city)]) {
    const { data } = await supabase.from("market_monthly_stats").select("*").eq("city", c).order("month_start", { ascending: false }).limit(6);
    if (data?.length) { out.monthly_stats = data.map((r) => slim(r, true)); break; }
  }
  const { data: m } = await supabase.from("market_metrics_public").select("*").eq("city", city).limit(12);
  if (m?.length) out.current_metrics = m.map((r) => slim(r, true));
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { type: rawType, data, stats } = await request.json();
    const type = TYPES.includes(rawType) ? rawType : "auto";
    const sessionId = String(data?.session_id || "").trim();
    if (!sessionId) return json({ error: "Missing session" }, 400);
    const key = env("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY is not set" }, 500);

    const { data: sess } = await supabase.from("intent_sessions").select("site_id, city, slug").eq("session_id", sessionId).maybeSingle();
    const city = String(sess?.city || data?.city || "");
    const [agent, market, sentRes] = await Promise.all([
      agentFor(sess?.site_id || data?.site_id),
      marketFor(city),
      supabase.from("session_messages").select("created_at, message_type, subject").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(10),
    ]);

    const brief = {
      buyer_first_name: String(data?.name || "").trim().split(/\s+/)[0] || null,
      lead_source: data?.source || null,
      buyer_question: data?.question || null,
      buyer_message: String(data?.message || "").split("\n").filter((l: string) => !/^\s*Criteria:/.test(l)).join("\n").slice(0, 600) || null,
      city: prettyCity(city),
      page_they_used: data?.slug || sess?.slug || null,
      suggested_next_step: data?.next || null,
      activity_stats: stats || {},
      listing_reactions: (Array.isArray(data?.reactions) ? data.reactions : []).slice(0, 30).map((r: any) => slim(r)),
      emails_already_sent: (sentRes.data || []).map((m: any) => ({ date: String(m.created_at).slice(0, 10), type: m.message_type, subject: m.subject })),
      market_data: market,
      agent_first_name: agent.agentName.split(/\s+/)[0],
      today: new Date().toISOString().slice(0, 10),
    };

    const guide = Object.entries(TYPE_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n");
    const ask = type === "auto"
      ? "Choose the two message types that best fit this buyer right now. They must be different types. Avoid types sent in the last 7 days unless clearly the right move."
      : `Both drafts must be type "${type}". Give them clearly different angles or tones.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env("SESSION_MODEL") || "claude-haiku-5-5",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: `Message types:\n${guide}\n\nTask: ${ask}\n\nBuyer session data (JSON):\n${JSON.stringify(brief)}` }],
      }),
    });
    const out = await r.json();
    if (!r.ok) return json({ error: out?.error?.message || "AI request failed" }, 502);

    const text = (out.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "AI returned no drafts" }, 502);
    const parsed = JSON.parse(match[0]);
    const drafts = (parsed.drafts || []).slice(0, 2).map((d: any) => ({
      label: String(d.label || "Draft"),
      type: TYPES.includes(d.type) ? d.type : (type === "auto" ? null : type),
      subject: String(d.subject || ""),
      body: String(d.body || ""),
    }));
    return json({ drafts });
  } catch (e: any) {
    return json({ error: e?.message || "Suggest failed" }, 500);
  }
};