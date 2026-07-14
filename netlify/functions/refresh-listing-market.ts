import type { Config } from "@netlify/functions";

const CRON_SECRET = process.env.CRON_SECRET;
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL;

type RefreshRequest = {
  city?: string;
};

export default async function handler(request: Request) {
  if (!CRON_SECRET) {
    throw new Error("Missing CRON_SECRET");
  }

  const authorization = request.headers.get("authorization");

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

  if (!PUBLIC_SITE_URL) {
    throw new Error("Missing PUBLIC_SITE_URL");
  }

const requestUrl = new URL(request.url);

let body: RefreshRequest = {};

try {
  const rawBody = await request.text();

  if (rawBody) {
    body = JSON.parse(rawBody);
  }
} catch (error) {
  console.warn("Could not parse worker request body:", error);
}

const city = String(
  requestUrl.searchParams.get("city") ||
  body.city ||
  ""
)
  .trim()
  .toLowerCase();

  if (!city) {
    throw new Error("Missing city");
  }

  const baseUrl = PUBLIC_SITE_URL.replace(/\/$/, "");

  console.log(`Starting background listing refresh for ${city}`);

  const response = await fetch(`${baseUrl}/api/repliers/refresh-city`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      city,
      trigger: "scheduled-background"
    })
  });

  const resultText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Refresh failed for ${city}: ${response.status} ${resultText.slice(0, 2000)}`
    );
  }

  console.log(`Completed background listing refresh for ${city}`);
  console.log(resultText);
  return new Response(
  JSON.stringify({
    ok: true,
    city,
    message: "Background listing refresh completed"
  }),
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