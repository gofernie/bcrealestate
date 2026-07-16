import type { APIRoute } from "astro";
import { refreshListingMarket } from "../../../lib/listings/refreshListingMarket";

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function getInput(request: Request, url: URL) {
  if (request.method === "POST") {
    let body: Record<string, unknown> = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    return {
      city: String(
        body.city || url.searchParams.get("city") || ""
      ).trim(),

      boardId: String(
        body.boardId ||
          url.searchParams.get("boardId") ||
          ""
      ).trim(),

      trigger: String(
        body.trigger || "cron"
      ).trim()
    };
  }

  return {
    city: String(
      url.searchParams.get("city") || ""
    ).trim(),

    boardId: String(
      url.searchParams.get("boardId") || ""
    ).trim(),

    trigger: String(
      url.searchParams.get("trigger") || "manual"
    ).trim()
  };
}

async function handle(
  request: Request,
  url: URL
) {
  if (request.method === "POST") {
    const authorization =
      request.headers.get("authorization");

    if (
      !CRON_SECRET ||
      authorization !== `Bearer ${CRON_SECRET}`
    ) {
      return json(
        {
          ok: false,
          error: "Unauthorized"
        },
        401
      );
    }
  }

  const input = await getInput(request, url);

  if (!input.city) {
    return json(
      {
        ok: false,
        error: "Missing city"
      },
      400
    );
  }

  try {
    const result = await refreshListingMarket({
      city: input.city,
      boardId: input.boardId,
      trigger: input.trigger,

      env: {
        PUBLIC_SUPABASE_URL:
          import.meta.env.PUBLIC_SUPABASE_URL,

        SUPABASE_SERVICE_ROLE_KEY:
          import.meta.env.SUPABASE_SERVICE_ROLE_KEY,

        REPLIERS_API_KEY:
          import.meta.env.REPLIERS_API_KEY,

        REPLIERS_BASE_URL:
          import.meta.env.REPLIERS_BASE_URL
      }
    });

    return json(result);
} catch (error: any) {
  console.error("Listing refresh failed", {
    city: input.city,
    boardId: input.boardId,
    trigger: input.trigger,
    message: error?.message,
    status: error?.status,
    details: error?.details,
    stack: error?.stack
  });

  return json(
    {
      ok: false,
      city: input.city,
      error: error?.message || "Unknown refresh error",
      status: error?.status || 500,
      details: error?.details || null
    },
    error?.status || 500
  );
}
}

export const GET: APIRoute = async ({
  request,
  url
}) => {
  return handle(request, url);
};

export const POST: APIRoute = async ({
  request,
  url
}) => {
  return handle(request, url);
};