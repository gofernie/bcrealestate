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
  if (!r.ok) throw new Error(o?.error?.message || "AI " + r.status); if (o?.usage) { __usage.in += +o.usage.input_tokens || 0; __usage.out += +o.usage.output_tokens || 0; __usage.searches += +(o.usage.server_tool_use?.web_search_requests) || 0; __usage.model = String(payload?.model || ""); }
  return o;
}

export async function writeGuide(env: GuideEnv, title: string, city: string, notes = "", answers: Record<string, any> = {}, market = "", photos: any[] = []) {
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
    `Use web search to verify every current rule, program, threshold, fee and date. Prefer official government, city and regulator sources. Never invent figures; leave out anything you can't verify. Check every threshold, rate, amount and date against an official source (gov.bc.ca, canada.ca, CRA, the municipality) before using it. If no official source confirms it, leave it out or clearly say it is proposed.`,
    `Write plain, direct Canadian English in the second person, with short sentences. Be specific to ${cityName} wherever you can. Keep it under about 2,000 words, and spend most of them on what is specific to ${cityName}. Province- or country-wide topics (property transfer tax, GST, down payment and mortgage rules, foreign buyer rules) get one short paragraph each with a link to the official source, unless the title is specifically about that topic.`,
    `Only use this Markdown: ## and ### headings, paragraphs, "- " and "1. " lists, pipe tables, **bold**, *italic*, [links](url).`,
    notes ? `Author notes, follow these:\n${notes}` : "",
  ].filter(Boolean).join("\n\n");

  const model = env.GUIDE_MODEL || "claude-sonnet-5-5";
  const __lbl: Record<string, string> = Object.fromEntries([...RESEARCH_PROMPTS, ...AGENT_PROMPTS]);
  const __bits: string[] = Object.entries(answers || {}).filter(([k, v]) => k !== "followups" && typeof v === "string" && v.trim()).map(([k, v]) => `### ${__lbl[k] || k}\n${String(v).trim()}`);
  (Array.isArray(answers?.followups) ? answers.followups : []).forEach((f: any) => { if (String(f?.q || "").trim() && String(f?.a || "").trim()) __bits.push(`### ${String(f.q).trim()}\n${String(f.a).trim()}`); });
  const fullPrompt = __bits.length ? prompt + "\n\n" + [
    `The local agent publishing this guide has shared their own experience below. Weave it in where it fits, in the first person as the agent (for example "In my experience..." or a short **Agent tip:** line), keeping their meaning and voice. Use every point they made. Keep their personality, but drop text-speak and filler (for example "lol", "haha", "like", "you know") and fix dictation slips.`,
    `Their experience is for colour, local detail and advice only. Facts, figures, rules and dates still come from your verified research. If something the agent said conflicts with a verified current rule, go with the verified source and leave that part out. Do not invent any agent experience beyond what is below.`,
    `The agent's answers:\n\n${__bits.join("\n\n")}`,
  ].join("\n\n") : prompt;  const finalPrompt = market ? fullPrompt + "\n\n" + [
    `Below is this website's own market data, calculated from its MLS listing feed. Use it as the primary source for prices, sales volumes, days on market and trends, and say where the figures come from (for example "based on this site's listing data, ${new Date().toLocaleDateString("en-CA", { month: "long", year: "numeric" })}"). Present aggregates only: never name an individual property, address or its sold price. If a web source disagrees, prefer this data and mention the date. Lead with sold prices, then asking prices for what is available now. Put the figures in two pipe tables under these exact headings: "## What homes actually sell for" (columns: Area | Homes sold | Median sold price) and "## What is for sale now" (columns: Property type | Active listings | Median asking price). On the live page these two tables are replaced with fresh data every few hours, so anywhere in the prose (including the short answer) do NOT repeat exact prices, counts, medians or percentages from them. Describe the patterns instead (which areas cost more or sell most, how property types compare, what that means for a buyer) and point readers to the tables. This overrides any earlier instruction about quoting or dating figures: market prices, sale counts, listing counts, medians and percentages from the market data appear ONLY inside those two tables, never in the short answer, other sections, bullet points or the FAQ, and the prose should not say which month the data is from. Tax, mortgage and policy figures (rates, thresholds, exemption limits) are fine to state.`,
    market,
  ].join("\n\n") : fullPrompt;  const __cap = (p: any) => String(p.caption || p.alt || title).replace(/[\[\]]/g, "");
  const withPhotos = photos.length ? finalPrompt + "\n\n" + `The author's own photos are below. Place each one exactly once, on its own line, right after the paragraph it best fits (never inside a table, the FAQ or Sources), using this exact form: ![caption](url). Use the caption exactly as given. Do not add any other images.\n${photos.map((p: any) => `- ![${__cap(p)}](${p.url})`).join("\n")}` : finalPrompt;  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];
  let messages: any[] = [{ role: "user", content: withPhotos }];
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
  for (const p of photos) if (p?.url && !md.includes(p.url)) { const img = `\n\n![${__cap(p)}](${p.url})\n\n`; md = /\n##\s*Sources/i.test(md) ? md.replace(/\n(##\s*Sources)/i, img + "$1") : md + img; }
  const truncated = stop === "max_tokens" || stop === "pause_turn" || !/##\s*Sources/i.test(md);
  return { md, truncated };
}

// Site's own market data (aggregates only) for research guides.
async function __pageAll(q: () => any, max = 6000) {
  const out: any[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const __med = (a: number[]) => { const s = a.filter((n) => n > 0).sort((x, y) => x - y); if (!s.length) return 0; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const __money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const __tc = (s: string) => String(s || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const __group = (rows: any[], key: string) => rows.reduce((m: Record<string, any[]>, r: any) => { const k = String(r[key] || "Other"); (m[k] = m[k] || []).push(r); return m; }, {});

export async function marketBlock(db: any, city: string) {
  const slug = String(city || "").toLowerCase().trim();
  if (!slug) return "";
  const name = slug.replace(/-/g, " ");
  const cityOr = (cols: string[]) => cols.flatMap((c) => [`${c}.ilike.${slug}`, `${c}.ilike."${name}"`]).join(",");
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const y1 = iso(new Date(now.getTime() - 365 * 864e5)), y2 = iso(new Date(now.getTime() - 730 * 864e5));
  const junk = (r: any) => /park|storage|locker|fraction|timeshare|time share|interest|moorage|boat slip/i.test(`${r.normalized_type || ""} ${r.property_type || ""} ${r.property_sub_type || ""}`);
  const act = (await __pageAll(() => db.from("market_active_listings").select("normalized_type,property_type,price").or(cityOr(["city", "normalized_city", "market_city"])).is("off_market_at", null)))
    .filter((r: any) => +r.price >= 50000 && !junk(r));
  const recs = (await __pageAll(() => db.from("market_sale_records").select("sold_date,sold_price,list_price,sale_to_list_ratio,days_on_market,property_sub_type,is_single_family,is_fractional,eligible_for_market_stats").or(cityOr(["city"])).gte("sold_date", y2)))
    .filter((r: any) => !r.is_fractional && r.eligible_for_market_stats !== false && +r.sold_price >= 50000 && !junk(r));
  const areaSold = (await __pageAll(() => db.from("sold_listings").select("normalized_area,sold_price,sold_date").or(cityOr(["city", "market_city"])).gte("sold_date", y1)))
    .filter((r: any) => +r.sold_price >= 50000);
  if (!act.length && !recs.length) return "";
  const asOf = now.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const pct = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(1)}%` : "");
  const L: string[] = [`Market data for ${__tc(name)}, as of ${asOf}. Sold figures are qualifying MLS sales (fractional ownership excluded). Asking figures exclude listings under $50,000 and parking, storage and fractional listings.`];
  const s1 = recs.filter((r: any) => String(r.sold_date) >= y1), s0 = recs.filter((r: any) => String(r.sold_date) < y1);
  if (s1.length) {
    const m1 = __med(s1.map((r: any) => +r.sold_price)), m0 = __med(s0.map((r: any) => +r.sold_price));
    const sf1 = s1.filter((r: any) => r.is_single_family), sf0 = s0.filter((r: any) => r.is_single_family);
    const stlRaw = s1.map((r: any) => { let v = +r.sale_to_list_ratio; if (!v && +r.list_price > 0) v = r.sold_price / r.list_price; return v ? Math.round((v < 3 ? v * 100 : v) * 10) : 0; });
    const stl = __med(stlRaw) / 10;
    L.push(`\nSOLD, last 12 months: ${s1.length} sales, median sold price ${__money(m1)}${s0.length >= 5 ? ` (previous 12 months: ${__money(m0)} across ${s0.length} sales, ${pct(m1, m0)})` : ""}.`);
    if (sf1.length >= 3) L.push(`Detached / single-family: ${sf1.length} sales, median ${__money(__med(sf1.map((r: any) => +r.sold_price)))}${sf0.length >= 3 ? ` (previous 12 months: ${__money(__med(sf0.map((r: any) => +r.sold_price)))}, ${pct(__med(sf1.map((r: any) => +r.sold_price)), __med(sf0.map((r: any) => +r.sold_price)))})` : ""}.`);
    L.push(`Median days on market: ${__med(s1.map((r: any) => +r.days_on_market))}.${stl ? ` Median sale-to-list ratio: ${stl}%.` : ""}`);
    for (const [t, rs] of Object.entries(__group(s1, "property_sub_type")).sort((a: any, b: any) => b[1].length - a[1].length))
      if ((rs as any[]).length >= 3) L.push(`- ${__tc(t)}: ${(rs as any[]).length} sold, median ${__money(__med((rs as any[]).map((r) => +r.sold_price)))}`);
  }
  const areas = Object.entries(__group(areaSold, "normalized_area")).filter(([a, rs]: any) => a !== "Other" && rs.length >= 3).sort((a: any, b: any) => b[1].length - a[1].length).slice(0, 10);
  if (areas.length) {
    L.push(`\nSOLD by neighbourhood, last 12 months (areas with 3+ sales):`);
    for (const [a, rs] of areas) L.push(`- ${__tc(a)}: ${(rs as any[]).length} sold, median ${__money(__med((rs as any[]).map((r) => +r.sold_price)))}`);
  }
  if (act.length) {
    const prices = act.map((r: any) => +r.price);
    L.push(`\nFOR SALE now: ${act.length} active listings, lowest asking ${__money(Math.min(...prices))}.`);
    for (const [t, rs] of Object.entries(__group(act, "normalized_type")).sort((a: any, b: any) => b[1].length - a[1].length))
      L.push(`- ${__tc(t)}: ${(rs as any[]).length} active, median asking ${__money(__med((rs as any[]).map((r) => +r.price)))}`);
  }
  return L.join("\n");
}const RESEARCH_PROMPTS: [string, string][] = [
  ["re_homes", "What homes actually cost here"], ["re_hidden", "Costs that catch newcomers off guard"], ["re_worth", "Is it worth it? My take"], ["rg_routes", "How my clients get in and out"], ["rg_winter", "Winter driving on the way in"], ["rg_tip", "Planning a viewing trip"],
  ["rf_mistake", "What first-time buyers here get wrong"], ["rf_budget", "What a realistic starter home looks like here"], ["rf_advice", "My advice for first-time buyers"],
  ["rt_surprise", "What surprises my clients about taxes and closing costs"], ["rt_typical", "Typical property taxes I've seen"], ["rt_quirk", "Local tax quirks"],
  ["ra_why", "Why Albertans buy here"], ["ra_trip", "What catches Alberta buyers off guard"], ["ra_tip", "My advice for out-of-province buyers"],
  ["rs_where", "Where short-term rentals work here"], ["rs_trap", "STR mistakes I've seen"], ["rs_numbers", "Realistic bookings and income"],
  ["rp_timeline", "Typical timeline from offer to keys"], ["rp_local", "What's different about buying here"], ["rp_tip", "What I wish every buyer knew"],
  ["rx_red", "Strata red flags I look for"], ["rx_buildings", "Buildings buyers should know about"], ["rx_tip", "My advice before a strata offer"],
  ["rq_story", "A client story"],
];
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
    `Use ONLY what is in the agent's answers below. Do not add facts, places, prices, statistics, schools, businesses or claims that are not in the answers, and do not research anything. Include every point the agent made; do not drop any of their content. The answers may be dictated: remove filler words and text-speak (lol, haha), repeated points (say each thing once, in the section where it fits best) and dictation slips (for example "period" or "end of sentence" spoken aloud), and skip any fragment you cannot make sense of rather than guessing. If the answers are thin, write a shorter guide rather than padding it.`,
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
let __usage = { in: 0, out: 0, searches: 0, model: "" };
async function __logUsage(db: any, env: any, site: any, guide: string, kind: string) {
  if (!__usage.in && !__usage.out) return;
  const pin = +(env.AI_PRICE_IN || process.env.AI_PRICE_IN || 3), pout = +(env.AI_PRICE_OUT || process.env.AI_PRICE_OUT || 15), ps = +(env.AI_PRICE_SEARCH || process.env.AI_PRICE_SEARCH || 0.01);
  const cost = (__usage.in * pin + __usage.out * pout) / 1e6 + __usage.searches * ps;
  await db.from("ai_usage").insert({ site_id: site || null, guide_id: guide || null, kind, model: __usage.model, input_tokens: __usage.in, output_tokens: __usage.out, searches: __usage.searches, cost_usd: Math.round(cost * 10000) / 10000 });
}export async function runGuideJob(env: GuideEnv, id: string, notes = "", titleOverride = "") {
  __usage = { in: 0, out: 0, searches: 0, model: "" }; let __site: any = null, __kind = "research";
  const db = guideDb(env);
  try {
    const { data } = await db.from("guide_pages").select("*").eq("id", id).maybeSingle();
    if (!data) throw new Error("Guide not found"); __site = data.site_id; __kind = (String(data.topic || "").startsWith("r-") || !(data.agent_answers && Object.values(data.agent_answers).some((v: any) => typeof v === "string" ? v.trim() : Array.isArray(v) && v.length))) ? "research" : "agent";
    const __answers = data.agent_answers && typeof data.agent_answers === "object" ? data.agent_answers : null;
    const __hasAnswers = !!__answers && Object.values(__answers).some((v: any) => String(v || "").trim());
    let __related: { href: string; label: string } | null = null;
    if (__hasAnswers && data.related_intent_slug) {
      const { data: ip } = await db.from("intent_pages").select("slug,card_title,nav_label,hero_heading").eq("slug", data.related_intent_slug).eq("site_id", data.site_id).limit(1).maybeSingle();
      if (ip) __related = { href: `/${data.city}/${ip.slug}`, label: `See ${String(ip.card_title || ip.nav_label || ip.hero_heading || "homes").trim()} for sale` };
    }
    const __research = String(data.topic || "").startsWith("r-"); const { md, truncated } = __research ? await writeGuide(env, titleOverride || data.title || "", data.city || data.city_slug || "", notes, __answers || {}, __research ? await marketBlock(db, data.city || data.city_slug || "").catch(() => "") : "", Array.isArray(data.photos) ? data.photos.filter((p: any) => p && p.url) : []) : __hasAnswers
      ? await writeAgentGuide(env, titleOverride || data.title || "", data.city || "", __answers, __related, notes, Array.isArray(data.photos) ? data.photos.filter((p: any) => p && p.url) : [])
      : await writeGuide(env, titleOverride || data.title || "", data.city || data.city_slug || "", notes);
    if (!md) throw new Error("The draft came back empty");
    await __logUsage(db, env, __site, id, __kind).catch(() => {}); await db.from("guide_pages").update({ ai_status: "done", ai_draft: md, ai_error: truncated ? "May be cut off" : null }).eq("id", id);
  } catch (e: any) {
    await db.from("guide_pages").update({ ai_status: "failed", ai_error: String(e?.message || e).slice(0, 500) }).eq("id", id); await __logUsage(db, env, __site, id, __kind).catch(() => {});
  }
}