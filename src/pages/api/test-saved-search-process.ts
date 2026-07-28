import type {
  APIRoute,
} from "astro";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  processSavedSearches,
} from "../../lib/savedSearches/processSavedSearches";

export const prerender = false;

const supabase =
  createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

export const GET: APIRoute =
  async () => {
    try {
      const result =
        await processSavedSearches(
          supabase,
          {
            RESEND_API_KEY:
              import.meta.env.RESEND_API_KEY,

            TWILIO_ACCOUNT_SID:
              import.meta.env.TWILIO_ACCOUNT_SID,

            TWILIO_AUTH_TOKEN:
              import.meta.env.TWILIO_AUTH_TOKEN,

            TWILIO_FROM_NUMBER:
              import.meta.env.TWILIO_FROM_NUMBER,

            PUBLIC_SITE_URL:
              import.meta.env.PUBLIC_SITE_URL,
          }
        );

      return new Response(
        JSON.stringify(
          {
            ok: true,
            ...result,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
          },
        }
      );
    } catch (error) {
      console.error(
        "Saved search process test failed:",
        error
      );

      return new Response(
        JSON.stringify(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Processing failed.",
          },
          null,
          2
        ),
        {
          status: 500,
          headers: {
            "content-type":
              "application/json",
          },
        }
      );
    }
  };