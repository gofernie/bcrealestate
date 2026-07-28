import type {
  APIRoute,
} from "astro";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  sendSavedSearchNotifications,
} from "../../lib/savedSearches/sendSavedSearchNotifications";

export const prerender = false;

const supabase =
  createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

export const GET: APIRoute =
  async ({ url }) => {
    try {
      const id =
        url.searchParams.get("id");

      if (!id) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Missing saved search id.",
          }),
          {
            status: 400,
            headers: {
              "content-type":
                "application/json",
            },
          }
        );
      }

      const {
        data: savedSearch,
        error: searchError,
      } = await supabase
        .from("saved_searches")
       .select(
  `
    id,
    city,
    channel,
    frequency,
    phone,
    email,
    filters
  `
)
        .eq("id", id)
        .single();

      if (searchError) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Saved search not found.",
          }),
          {
            status: 404,
            headers: {
              "content-type":
                "application/json",
            },
          }
        );
      }

      const result =
        await sendSavedSearchNotifications(
          supabase,
          savedSearch,
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
            savedSearchId:
              savedSearch.id,
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
        "Saved search send test failed:",
        error
      );

      return new Response(
        JSON.stringify({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Send failed.",
        }),
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