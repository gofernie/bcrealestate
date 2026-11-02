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

export async function runGuideJob(env: GuideEnv, id: string, notes = "", titleOverride = "") {
  const db = guideDb(env);
  try {
    const { data } = await db.from("guide_pages").select("*").eq("id", id).maybeSingle();
    if (!data) throw new Error("Guide not found");
    const { md, truncated } = await writeGuide(env, titleOverride || data.title || "", data.city || data.city_slug || "", notes);
    if (!md) throw new Error("The draft came back empty");
    await db.from("guide_pages").update({ ai_status: "done", ai_draft: md, ai_error: truncated ? "May be cut off" : null }).eq("id", id);
  } catch (e: any) {
    await db.from("guide_pages").update({ ai_status: "failed", ai_error: String(e?.message || e).slice(0, 500) }).eq("id", id);
  }
}