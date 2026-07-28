import type {
  Config,
} from "@netlify/functions";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  processDailySavedSearches,
} from "../../src/lib/savedSearches/processDailySavedSearches";

const supabase =
  createClient(
    process.env
      .PUBLIC_SUPABASE_URL!,
    process.env
      .SUPABASE_SERVICE_ROLE_KEY!
  );

export default async function handler() {
  try {
    const result =
      await processDailySavedSearches(
        supabase,
        {
          RESEND_API_KEY:
            process.env
              .RESEND_API_KEY!,

          TWILIO_ACCOUNT_SID:
            process.env
              .TWILIO_ACCOUNT_SID!,

          TWILIO_AUTH_TOKEN:
            process.env
              .TWILIO_AUTH_TOKEN!,

          TWILIO_FROM_NUMBER:
            process.env
              .TWILIO_FROM_NUMBER!,

          PUBLIC_SITE_URL:
            process.env
              .PUBLIC_SITE_URL,
        }
      );

    console.log(
      "Daily saved searches processed:",
      result
    );

    return new Response(
      JSON.stringify({
        ok: true,
        ...result,
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Daily saved search processing failed:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Daily processing failed.",
      }),
      {
        status: 500,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control":
            "no-store",
        },
      }
    );
  }
}

export const config: Config = {
  schedule: "0 16 * * *",
};