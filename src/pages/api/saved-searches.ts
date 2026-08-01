import type {
  APIRoute,
} from "astro";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  Resend,
} from "resend";
import twilio from "twilio";
import {
  baselineSavedSearch,
} from "../../lib/savedSearches/baselineSavedSearch";
export const prerender = false;

const supabase =
  createClient(
    import.meta.env
      .PUBLIC_SUPABASE_URL,
    import.meta.env
      .SUPABASE_SERVICE_ROLE_KEY
  );

const resend =
  new Resend(
    import.meta.env
      .RESEND_API_KEY
  );
const twilioClient =
  twilio(
    import.meta.env
      .TWILIO_ACCOUNT_SID,
    import.meta.env
      .TWILIO_AUTH_TOKEN
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

      const searchName =
        String(
          body?.name || ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80) ||
        `${city
          .replace(/-/g, " ")
          .replace(/\b\w/g, (character) =>
            character.toUpperCase()
          )} Home Search`;

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
          name: searchName,
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
      try {
  const baselineResult =
    await baselineSavedSearch(
      supabase,
      {
        id: data.id,
        city,
        channel,
        filters,
      }
    );

  console.log(
    "Saved search baseline created:",
    {
      savedSearchId:
        data.id,
      count:
        baselineResult.count,
    }
  );
} catch (baselineError) {
  console.error(
    "Saved search baseline failed:",
    baselineError
  );
}
if (
  channel === "email" &&
  email
) {
  console.log(
    "Attempting saved-search email:",
    {
      email,
      channel,
      frequency,
      hasApiKey:
        Boolean(
          import.meta.env
            .RESEND_API_KEY
        ),
    }
  );

  const emailResult =
    await resend.emails.send({
      from:
        "Locus <onboarding@resend.dev>",

      to: [email],

           subject:
        `${searchName} is now active`,

      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 560px;
            margin: 0 auto;
            color: #14201c;
            line-height: 1.6;
          "
        >
          <h2>
            🏡 You're all set!
          </h2>

          <p>
            We'll email you as soon as a new home
            matches <strong>${searchName}</strong>.
          </p>

          <p style="color:#66736d;">
            ${
              frequency === "daily"
                ? "You'll receive one daily roundup when there are new matches."
                : "We'll let you know as new matches appear throughout the day."
            }
          </p>
        </div>
      `,
    });

  console.log(
    "Resend response:",
    emailResult
  );

  if (emailResult.error) {
    console.error(
      "Saved search confirmation email failed:",
      emailResult.error
    );
  }
}

if (
  channel === "sms" &&
  phone
) {
  console.log(
    "Attempting saved-search SMS:",
    {
      phone,
      channel,
      frequency,
      hasSid:
        Boolean(
          import.meta.env
            .TWILIO_ACCOUNT_SID
        ),
      hasToken:
        Boolean(
          import.meta.env
            .TWILIO_AUTH_TOKEN
        ),
      hasFromNumber:
        Boolean(
          import.meta.env
            .TWILIO_FROM_NUMBER
        ),
    }
  );

  try {
    const message =
      await twilioClient
        .messages
        .create({
          from:
            import.meta.env
              .TWILIO_FROM_NUMBER,

          to: phone,

          body:
            `🏡 You're all set!\n\nWe'll text you as soon as a new home matches ${searchName}.`,
        });

    console.log(
      "Twilio response:",
      {
        sid: message.sid,
        status: message.status,
      }
    );
  } catch (smsError) {
    console.error(
      "Saved search confirmation SMS failed:",
      smsError
    );
  }
}

return new Response(
  JSON.stringify({
    ok: true,
    id: data.id,
    name: searchName,
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