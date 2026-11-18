// Shared guide writer: used by the admin endpoint (localhost) and the Netlify background function (live).
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type GuideEnv = { ANTHROPIC_API_KEY?: string; GUIDE_MODEL?: string; PUBLIC_SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export function guideJobToken(env: GuideEnv) {
  return createHash("sha256").update("guide-job:" + String(env.SUPABASE_SERVICE_ROLE_KEY || "")).digest("hex");
}
export function guideDb(env: GuideEnv) {
  return createClient(String(env.PUBLIC_SUPABASE_URL), String(env.SUPABASE_SERVICE_ROLE_KEY));
}

async function callClaude(key: string, payload: any) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const o: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(o?.error?.message || "AI " + r.status);
  return o;
}

export async function writeGuide(env: GuideEnv, title: string, city: string, notes = "") {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No ANTHROPIC_API_KEY");
  if (!title.trim()) throw new Error("Add a title first");
  const citySlug = String(city || "fernie").toLowerCase();
  const cityName = citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const today = new Date().toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const prompt = [
    `You write buyer guides for a real estate website covering ${cityName}, British Columbia. Today is ${today}.`,
    `Write the body of a guide titled "${title}". Output Markdown only: no preamble, no notes to me, no H1 (the title renders separately). Do all your research first, then write the whole guide in one go.`,
    `Structure: start with "## The short answer" (two short paragraphs). Then 4 to 6 "##" sections with what a buyer needs to know, using pipe tables when comparing figures, **bold lead-ins** for key warnings, and a numbered "## Before you write an offer" checklist. Then "## Frequently asked questions" with 4 to 6 entries, each a **bold question** on its own line with the answer on the next line. Then a short "## Ready to start looking?" section linking to [the listings above](#type-listings). Then one italic line: general information, not legal, tax or mortgage advice; confirm before relying on it; "Last reviewed ${today}." End with "## Sources": a bulleted list of [Title](URL) links to the sources you actually used.`,
    `Use web search to verify every current rule, program, threshold, fee and date. Prefer official government, city and regulator sources. Never invent figures; leave out anything you can't verify.`,
    `Write plain, direct Canadian English in the second person, with short sentences. Be specific to ${cityName} wherever you can. Keep it under about 2,500 words.`,
    `Only use this Markdown: ## and ### headings, paragraphs, "- " and "1. " lists, pipe tables, **bold**, *italic*, [links](url).`,
    notes ? `Author notes, follow these:\n${notes}` : "",
  ].filter(Boolean).join("\n\n");

  const model = env.GUIDE_MODEL || "claude-sonnet-5-5";
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];
  let messages: any[] = [{ role: "user", content: prompt }];
  const texts: string[] = [];
  let stop = "";
  for (let turn = 0; turn < 5; turn++) {
    let out: any;
    try {
      out = await callClaude(key, { model, max_tokens: 16000, tools, messages });
    } catch (e: any) {
      if (turn === 0 && /web_search|tool/i.test(String(e?.message))) out = await callClaude(key, { model, max_tokens: 16000, messages });
      else throw e;
    }
    for (const b of out?.content || []) if (b.type === "text") texts.push(b.text);
    stop = out?.stop_reason || "";
    if (stop !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: out.content }];
  }
  let md = texts.join("");
  const start = md.indexOf("## ");
  if (start > 0) md = md.slice(start);
  md = md.trim();
  const truncated = stop === "max_tokens" || stop === "pause_turn" || !/##\s*Sources/i.test(md);
  return { md, truncated };
}

const AGENT_PROMPTS: [string, string][] = [
  ["love", "What I love about it"],
  ["who", "Who it suits, and who should look elsewhere"],
  ["local", "Local spots worth knowing"],
  ["story", "A client story"],
  ["miss", "What buyers usually miss"],
  ["friend", "What I'd tell a friend moving here"],
  ["winter", "What it's like in winter or the off-season"],
  ["money", "What your money gets you here"],
  ["saturday", "A typical Saturday"],
  ["surprised", "What surprised me or my clients"],
  ["downsides", "The downsides nobody mentions"],
  ["pockets", "Favourite streets and pockets"],
  ["around", "Getting around: commute, groceries, schools"],
];

export async function writeAgentGuide(env: GuideEnv, title: string, city: string, answers: Record<string, any>, related?: { href: string; label: string } | null, notes = "", photos: any[] = []) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No ANTHROPIC_API_KEY");
  if (!title.trim()) throw new Error("Add a title first");
  const cityName = String(city || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const filled = AGENT_PROMPTS.filter(([k]) => String(answers?.[k] || "").trim());
  const fus = Array.isArray(answers?.followups) ? answers.followups.filter((f: any) => String(f?.q || "").trim() && String(f?.a || "").trim()) : [];
  if (!filled.length && !fus.length) throw new Error("Answer at least one question first");
  const qa = [...filled.map(([k, label]) => `### ${label}\n${String(answers[k]).trim()}`), ...fus.map((f: any) => `### ${String(f.q).trim()}\n${String(f.a).trim()}`)].join("\n\n");
  const prompt = [
    `You are helping a local real estate agent in ${cityName}, British Columbia turn their own answers into a guide for their website, titled "${title}".`,
    `Write in the first person, as the agent. Keep their voice, opinions and phrasing; fix grammar, tighten and organise. Output Markdown only: no preamble, no notes, no H1 (the title renders separately).`,
    `Use ONLY what is in the agent's answers below. Do not add facts, places, prices, statistics, schools, businesses or claims that are not in the answers, and do not research anything. Include every point the agent made; do not drop any of their content. The answers may be dictated: remove filler words, repeated points (say each thing once, in the section where it fits best) and dictation slips (for example "period" or "end of sentence" spoken aloud), and skip any fragment you cannot make sense of rather than guessing. If the answers are thin, write a shorter guide rather than padding it.`,
    `Structure: an opening paragraph with no heading, then "##" sections that group related answers naturally, each with a short heading in the agent's voice. Follow-up answers belong with the topic they expand on. Use **bold** sparingly. Keep it under about 1,200 words.`,
    related ? `End with this line on its own: [${related.label} \u2192](${related.href})` : "",
    `Only use this Markdown: ## and ### headings, paragraphs, "- " and "1. " lists, **bold**, *italic*, [links](url).`,
    notes ? `Author notes, follow these:\n${notes}` : "",
    photos.length ? `Place each of these photos exactly once, on its own line, right after the paragraph it best fits, using this exact form: ![caption](url). Use the caption exactly as given. Do not add any other images.\n${photos.map((p: any) => `- ![${String(p.caption || p.alt || title).replace(/[\[\]]/g, "")}](${p.url})`).join("\n")}` : "",
    `The agent's answers:\n\n${qa}`,
  ].filter(Boolean).join("\n\n");
  const model = env.GUIDE_MODEL || "claude-sonnet-5-5";
  const out: any = await callClaude(key, { model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] });
  let md = (out?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  const start = md.indexOf("## "); const firstPara = md.search(/\S/);
  if (start > 0 && firstPara < 0) md = md.slice(start);
  for (const p of photos) if (p?.url && !md.includes(p.url)) md += `\n\n![${String(p.caption || p.alt || title).replace(/[\[\]]/g, "")}](${p.url})`;
  if (related && !md.includes(related.href)) md += `\n\n[${related.label} \u2192](${related.href})`;
  return { md, truncated: out?.stop_reason === "max_tokens" };
}
export async function runGuideJob(env: GuideEnv, id: string, notes = "", titleOverride = "") {
  const db = guideDb(env);
  try {
    const { data } = await db.from("guide_pages").select("*").eq("id", id).maybeSingle();
    if (!data) throw new Error("Guide not found");
    const __answers = data.agent_answers && typeof data.agent_answers === "object" ? data.agent_answers : null;
    const __hasAnswers = !!__answers && Object.values(__answers).some((v: any) => String(v || "").trim());
    let __related: { href: string; label: string } | null = null;
    if (__hasAnswers && data.related_intent_slug) {
      const { data: ip } = await db.from("intent_pages").select("slug,card_title,nav_label,hero_heading").eq("slug", data.related_intent_slug).eq("site_id", data.site_id).limit(1).maybeSingle();
      if (ip) __related = { href: `/${data.city}/${ip.slug}`, label: `See ${String(ip.card_title || ip.nav_label || ip.hero_heading || "homes").trim()} for sale` };
    }
    const { md, truncated } = __hasAnswers
      ? await writeAgentGuide(env, titleOverride || data.title || "", data.city || "", __answers, __related, notes, Array.isArray(data.photos) ? data.photos.filter((p: any) => p && p.url) : [])
      : await writeGuide(env, titleOverride || data.title || "", data.city || data.city_slug || "", notes);
    if (!md) throw new Error("The draft came back empty");
    await db.from("guide_pages").update({ ai_status: "done", ai_draft: md, ai_error: truncated ? "May be cut off" : null }).eq("id", id);
  } catch (e: any) {
    await db.from("guide_pages").update({ ai_status: "failed", ai_error: String(e?.message || e).slice(0, 500) }).eq("id", id);
  }
}