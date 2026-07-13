import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const allowedCities = new Set([
  "nanaimo",
  "parksville",
  "qualicum beach",
  "tofino",
  "whistler",
]);

const cleanCity = (value: unknown) => {
  const city = String(value || "nanaimo").trim().toLowerCase();
  return allowedCities.has(city) ? city : "nanaimo";
};

const cleanName = (value: unknown) =>
  String(value || "Anonymous")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24) || "Anonymous";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const GET: APIRoute = async ({ url }) => {
  const city = cleanCity(url.searchParams.get("city"));

  const { data, error } = await supabase
    .from("price_game_scores")
    .select(
      "id,player_name,score,correct_answers,close_answers,average_seconds,created_at"
    )
    .eq("city", city)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({
    ok: true,
    scores: data || [],
  });
};

export const POST: APIRoute = async ({ request }) => {
  let body: {
    playerName?: string;
    city?: string;
    score?: number;
    correctAnswers?: number;
    closeAnswers?: number;
    averageSeconds?: number;
  };

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const playerName = cleanName(body.playerName);
  const city = cleanCity(body.city);
  const score = Math.max(0, Math.floor(Number(body.score || 0)));
  const correctAnswers = Math.max(
    0,
    Math.min(10, Math.floor(Number(body.correctAnswers || 0)))
  );
  const closeAnswers = Math.max(
    0,
    Math.min(10, Math.floor(Number(body.closeAnswers || 0)))
  );
  const averageSeconds = Math.max(
    0,
    Math.min(10, Number(body.averageSeconds || 0))
  );

  if (!Number.isFinite(score)) {
    return json({ ok: false, error: "Invalid score." }, 400);
  }

  const { data, error } = await supabase
    .from("price_game_scores")
    .insert({
      player_name: playerName,
      city,
      score,
      correct_answers: correctAnswers,
      close_answers: closeAnswers,
      average_seconds: Number(averageSeconds.toFixed(2)),
    })
    .select("id")
    .single();

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const { data: rankingData } = await supabase
    .from("price_game_scores")
    .select("id,score")
    .eq("city", city)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });

  const rank =
    (rankingData || []).findIndex((entry) => entry.id === data.id) + 1;

  return json({
    ok: true,
    rank: rank || null,
  });
};