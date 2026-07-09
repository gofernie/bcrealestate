import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { buildNeighbourhoodBrief } from "../../lib/intelligence/buildNeighbourhoodBrief";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildHighlights(input: {
  area?: string;
  city?: string;
  shortDescription?: string | null;
}) {
  const text = `${input.area || ""} ${input.city || ""} ${
    input.shortDescription || ""
  }`.toLowerCase();

  const rules = [
    { test: ["ocean", "waterfront", "view", "bay"], label: "🌊 Waterfront feel" },
    { test: ["beach", "shore"], label: "🏖️ Beach access" },
    { test: ["ferry", "terminal"], label: "⛴️ Ferry access" },
    { test: ["marina", "boat", "harbour", "harbor"], label: "⛵ Marina nearby" },
    { test: ["trail", "forest", "park"], label: "🌲 Outdoor access" },
    { test: ["school", "family"], label: "👨‍👩‍👧 Family friendly" },
    { test: ["walk", "downtown", "old city"], label: "🚶 Walkable pockets" },
    { test: ["golf"], label: "⛳ Golf nearby" },
    { test: ["cafe", "coffee", "shop"], label: "☕ Local stops" },
    { test: ["quiet", "residential"], label: "🏡 Quieter streets" },
  ];

  const highlights: string[] = [];

  for (const rule of rules) {
    if (rule.test.some((word) => text.includes(word))) {
      highlights.push(rule.label);
    }
  }

  const fallbacks = [
    "🏡 Residential streets",
    "🚗 Practical access",
    "🌳 Local parks",
    "🛒 Everyday errands",
  ];

  return [...new Set([...highlights, ...fallbacks])].slice(0, 4);
}

export const POST: APIRoute = async ({ request }) => {
  const { city = "nanaimo", area_slug } = await request.json();

  if (!area_slug) {
    return new Response(JSON.stringify({ error: "Missing area_slug" }), {
      status: 400,
    });
  }

  const brief = await buildNeighbourhoodBrief({
    city,
    areaSlug: area_slug,
  });

  const prompt = `
You are writing concise neighbourhood intelligence for a premium real estate exploration application called Locus.

Your writing should feel closer to Apple Maps Guides, Airbnb destination descriptions, Monocle city guides and a knowledgeable local REALTOR® than a market report.

Write with quiet confidence.

Observe rather than advertise.

Describe the place as though you've spent time walking the neighbourhood.

Use the supplied data only as supporting context, not as the focus.

Never sound like an AI assistant, market analyst or SEO writer.

Return valid JSON only using this exact schema:

{
  "overview":"",
  "market":"",
  "buyers":"",
  "lifestyle":"",
  "demographics":"",
  "watch":""
}

WRITING RULES

Overview:
- Write exactly two short editorial sentences.
- Answer: "What is this place actually like?"
- Mention recognizable physical characteristics when appropriate.
- Avoid statistics unless they naturally support the description.

Market:
- Do not repeat listing counts or prices.
- Explain what current conditions mean for someone shopping here.
- Mention choice, limited inventory, range of homes, or competition where relevant.

Buyers:
- Describe who tends to like this area in lifestyle terms, not demographic terms.

Lifestyle:
- Paint a picture of daily life.
- Mention walks, beaches, cafés, schools, parks, shopping, marinas, trails, cycling, ferry access, or quieter residential streets only when supported by the briefing.

Demographics:
- Interpret the numbers.
- Do not repeat the numbers.
- Explain what they suggest about neighbourhood character, stability, age mix, ownership, or change.

Watch:
- Give one useful neutral buyer observation.
- This is not a warning.

STYLE

Calm.
Observational.
Specific.
Practical.
Local.
Never salesy.
Never exaggerated.
Never SEO fluff.

Avoid these phrases:
offers something for everyone
has seen growth
the data shows
buyers may appreciate
established neighbourhood
vibrant community
ideal for
perfect for
hidden gem
highly desirable

Return JSON only. No markdown. No commentary. No extra keys.

Neighbourhood briefing:
${JSON.stringify(brief, null, 2)}
`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": import.meta.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const claudeJson = await claudeRes.json();
  const text = claudeJson?.content?.[0]?.text || "{}";

  const cleanText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  let copy;

  try {
    copy = JSON.parse(cleanText);
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Claude JSON", text, cleanText }),
      { status: 500 }
    );
  }

  const aiInsights = {
    overview: copy.overview || null,
    highlights: buildHighlights({
      area: brief.place.area,
      city: brief.place.city,
      shortDescription: brief.place.shortDescription,
    }),
    market: copy.market || null,
    buyers: copy.buyers || null,
    lifestyle: copy.lifestyle || null,
    demographics: copy.demographics || null,
    watch: copy.watch || null,
    updated: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("area_boundaries")
    .update({
      ai_insights: aiInsights,
      insight_updated_at: new Date().toISOString(),
    })
    .eq("city", city)
    .eq("area_slug", area_slug);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, brief, copy, aiInsights }), {
    status: 200,
  });
};