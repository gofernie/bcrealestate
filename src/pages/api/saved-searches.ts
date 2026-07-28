import type {
  APIRoute,
} from "astro";

import {
  createClient,
} from "@supabase/supabase-js";

export const prerender = false;

const supabase =
  createClient(
    import.meta.env
      .PUBLIC_SUPABASE_URL,
    import.meta.env
      .SUPABASE_SERVICE_ROLE_KEY
  );

export const POST: APIRoute =
  async ({ request }) => {
    try {
      const body =
        await request.json();

      const city =
        String(
          body?.city || ""
        )
          .toLowerCase()
          .trim();

      const siteId =
        body?.siteId
          ? String(body.siteId)
          : null;

      const phone =
        String(
          body?.phone || ""
        ).trim();

      const email =
        String(
          body?.email || ""
        )
          .trim()
          .toLowerCase();

      const frequency =
        body?.frequency ===
        "update"
          ? "update"
          : "daily";

      const filters =
        body?.filters &&
        typeof body.filters ===
          "object"
          ? body.filters
          : {};

      if (!city) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "City is required.",
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

      if (!phone && !email) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Enter a phone number or email address.",
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

      /*
       * V1 uses one delivery method.
       * If both are supplied, SMS wins.
       */
   const requestedChannel =
  body?.channel === "email"
    ? "email"
    : "sms";

const channel =
  requestedChannel;
  if (
  channel === "sms" &&
  !phone
) {
  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "Enter a phone number for text alerts.",
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

if (
  channel === "email" &&
  !email
) {
  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "Enter an email address for email alerts.",
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
        data,
        error,
      } = await supabase
        .from(
          "saved_searches"
        )
        .insert({
          site_id: siteId,
          city,
         phone: phone || null,
email: email || null,
          channel,
          frequency,
          filters,
          active: true,
        })
        .select("id")
        .single();

      if (error) {
        console.error(
          "Saved search insert failed:",
          error
        );

        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Unable to save search.",
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

      return new Response(
        JSON.stringify({
          ok: true,
          id: data.id,
        }),
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
        "Saved search request failed:",
        error
      );

      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Invalid request.",
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
  };