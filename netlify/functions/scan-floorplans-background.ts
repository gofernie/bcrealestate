import type { Config } from "@netlify/functions";
import { scanNewFloorplans } from "../../src/lib/floorplans/scanFloorplans";

const CRON_SECRET = process.env.CRON_SECRET;

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

  const city = String(
    requestUrl.searchParams.get("city") ||
    "nanaimo"
  )
    .trim()
    .toLowerCase();

 const requestedLimit = Number(
  requestUrl.searchParams.get("limit") ||
  50
);

const limit = Math.max(
  1,
  Math.min(
    Number.isFinite(requestedLimit)
      ? requestedLimit
      : 50,
    50
  )
);

  console.log("Starting floorplan scan", {
    city,
    limit
  });

  try {
    const result = await scanNewFloorplans({
      city,
      limit
    });

    console.log(
      "Completed floorplan scan",
      result
    );

    return json(result);
  } catch (error: any) {
    console.error(
      "Floorplan scan failed",
      {
        city,
        message:
          error?.message ||
          String(error),
        stack: error?.stack
      }
    );

    return json(
      {
        ok: false,
        city,
        error:
          error?.message ||
          "Unknown floorplan scan error"
      },
      500
    );
  }
}

export const config: Config = {
  background: true
};
