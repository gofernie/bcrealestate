import type { Config } from "@netlify/functions";
import { refreshListingMarket } from "../../src/lib/listings/refreshListingMarket";

const CRON_SECRET = process.env.CRON_SECRET;

type RefreshRequest = {
  city?: string;
};

export default async function handler(request: Request) {
  if (!CRON_SECRET) {
    throw new Error("Missing CRON_SECRET");
  }

  const authorization =
    request.headers.get("authorization");

  if (authorization !== `Bearer ${CRON_SECRET}`) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unauthorized"
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }

  const requestUrl = new URL(request.url);

  let body: RefreshRequest = {};

  try {
    const rawBody = await request.text();

    if (rawBody) {
      body = JSON.parse(rawBody);
    }
  } catch (error) {
    console.warn(
      "Could not parse worker request body:",
      error
    );
  }

  const city = String(
    requestUrl.searchParams.get("city") ||
      body.city ||
      ""
  )
    .trim()
    .toLowerCase();

  if (!city) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing city"
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }

  console.log(
    `Starting direct background listing refresh for ${city}`
  );

  const result = await refreshListingMarket({
    city,
    trigger: "scheduled-background",

    env: {
      PUBLIC_SUPABASE_URL:
        process.env.PUBLIC_SUPABASE_URL,

      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY,

      REPLIERS_API_KEY:
        process.env.REPLIERS_API_KEY,

      REPLIERS_BASE_URL:
        process.env.REPLIERS_BASE_URL
    }
  });

  console.log(
    `Completed direct background listing refresh for ${city}`
  );

  console.log(JSON.stringify(result));

  return new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    }
  );
}

export const config: Config = {
  background: true,
  path: "/.netlify/functions/refresh-listing-market"
};