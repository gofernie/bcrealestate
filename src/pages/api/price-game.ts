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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const shuffle = <T>(items: T[]) => {
  const output = [...items];

  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[randomIndex]] = [
      output[randomIndex],
      output[index],
    ];
  }

  return output;
};

const listingStylePrice = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;

  // Keep prices looking like believable listing prices.
  const rounded = Math.round(value / 10_000) * 10_000;

  return Math.max(49_900, rounded - 100);
};

const buildPriceOptions = (askingPrice: number) => {
  const varianceChoices = [0.07, 0.08, 0.09, 0.1, 0.12];
  const variance =
    varianceChoices[Math.floor(Math.random() * varianceChoices.length)];

  let lower = listingStylePrice(askingPrice * (1 - variance));
  let upper = listingStylePrice(askingPrice * (1 + variance));

  // Avoid duplicate choices for unusually rounded prices.
  if (lower === askingPrice) {
    lower = listingStylePrice(askingPrice - 50_000);
  }

  if (upper === askingPrice || upper === lower) {
    upper = listingStylePrice(askingPrice + 50_000);
  }

  return shuffle([lower, askingPrice, upper]);
};

export const GET: APIRoute = async ({ url }) => {
  const city = cleanCity(url.searchParams.get("city"));
  const exclude = url.searchParams.get("exclude")?.trim() || "";

  let countQuery = supabase
    .from("listing_rows")
    .select("id", { count: "exact", head: true })
    .eq("normalized_city", city)
    .eq("status", "A")
    .gt("price", 0)
    .not("image_url", "is", null);

  if (exclude) {
    countQuery = countQuery.neq("id", exclude);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    return json({ ok: false, error: countError.message }, 500);
  }

  if (!count) {
    return json(
      { ok: false, error: "No playable listings found." },
      404
    );
  }

  const offset = Math.floor(Math.random() * count);

  let listingQuery = supabase
    .from("listing_rows")
    .select(
      "id,address,image_url,price,beds,baths,sqft,normalized_area,normalized_city,normalized_type"
    )
    .eq("normalized_city", city)
    .eq("status", "A")
    .gt("price", 0)
    .not("image_url", "is", null)
    .range(offset, offset)
    .limit(1);

  if (exclude) {
    listingQuery = listingQuery.neq("id", exclude);
  }

  const { data, error } = await listingQuery.maybeSingle();

  if (error || !data) {
    return json(
      {
        ok: false,
        error: error?.message || "Listing not found.",
      },
      500
    );
  }

  const askingPrice = Number(data.price);

  return json({
    ok: true,
    listing: {
      id: data.id,
      image: data.image_url,
      beds: data.beds,
      baths: data.baths,
      sqft: data.sqft,
      area: data.normalized_area,
      city: data.normalized_city,
      type: data.normalized_type,
      options: buildPriceOptions(askingPrice),
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
 let body: {
  listingId?: string;
  guess?: number;
  secondsRemaining?: number;
  timedOut?: boolean;
};

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

 const listingId = String(body.listingId || "").trim();
const guess = Number(body.guess || 0);
const timedOut = Boolean(body.timedOut);

const secondsRemaining = Math.max(
  0,
  Math.min(10, Math.floor(Number(body.secondsRemaining || 0)))
);

if (!listingId) {
  return json(
    { ok: false, error: "Listing is missing." },
    400
  );
}

if (!timedOut && (!Number.isFinite(guess) || guess <= 0)) {
  return json(
    { ok: false, error: "Choose a valid price." },
    400
  );
}

  const { data, error } = await supabase
    .from("listing_rows")
    .select("id,price,address,normalized_area,normalized_city")
    .eq("id", listingId)
    .eq("status", "A")
    .maybeSingle();

  if (error || !data) {
    return json(
      {
        ok: false,
        error: error?.message || "Listing not found.",
      },
      404
    );
  }

const askingPrice = Number(data.price);

const difference = timedOut
  ? askingPrice
  : Math.abs(guess - askingPrice);

const isCorrect = !timedOut && guess === askingPrice;

const direction = timedOut
  ? "timeout"
  : isCorrect
    ? "exact"
    : guess > askingPrice
      ? "high"
      : "low";

const percentError =
  askingPrice > 0
    ? (difference / askingPrice) * 100
    : 100;

let points = 0;
let rating = "Time's up";

if (!timedOut) {
  if (isCorrect) {
    points = 1000 + secondsRemaining * 50;
    rating = "Correct";
  } else if (percentError <= 10) {
    points = 400 + secondsRemaining * 25;
    rating = "Very close";
  } else {
    points = 150 + secondsRemaining * 10;
    rating = "Good try";
  }
}

return json({
  ok: true,
  result: {
    askingPrice,
    guess: Math.round(guess),
    difference: Math.round(difference),
    direction,
    percentError: Number(percentError.toFixed(1)),
    isCorrect,
    timedOut,
    secondsRemaining,
    points,
    rating,
    address: data.address,
    area: data.normalized_area,
    city: data.normalized_city,
  },
});
};