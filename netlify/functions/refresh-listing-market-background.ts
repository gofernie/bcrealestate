import type { Config } from "@netlify/functions";
import { refreshListingMarket } from "../../src/lib/listings/refreshListingMarket";

const CRON_SECRET = process.env.CRON_SECRET;

type RefreshRequest = {
  city?: string;
  boardId?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default async function handler(request: Request) {
  if (!CRON_SECRET) {
    console.error("Missing CRON_SECRET");

    return json(
      {
        ok: false,
        error: "Missing CRON_SECRET"
      },
      500
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (authorization !== `Bearer ${CRON_SECRET}`) {
    return json(
      {
        ok: false,
        error: "Unauthorized"
      },
      401
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

  const boardId = String(
    requestUrl.searchParams.get("boardId") ||
      body.boardId ||
      ""
  ).trim();

  if (!city) {
    return json(
      {
        ok: false,
        error: "Missing city"
      },
      400
    );
  }

  console.log("Starting background listing refresh", {
    city,
    boardId: boardId || null
  });

  try {
    const result = await refreshListingMarket({
      city,
      boardId,
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

    console.log("Completed background listing refresh", {
      city,
      boardId: boardId || null,
      result
    });

    return json(result);
  } catch (error: any) {
    console.error("Background listing refresh failed", {
      city,
      boardId: boardId || null,
      message: error?.message,
      status: error?.status,
      details: error?.details,
      stack: error?.stack
    });

    return json(
      {
        ok: false,
        city,
        boardId: boardId || null,
        error:
          error?.message ||
          "Unknown listing refresh error",
        details: error?.details || null
      },
      error?.status || 500
    );
  }
}

export const config: Config = {};