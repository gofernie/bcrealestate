import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

import {
  generateDigestRun,
  sendDigestRun,
} from "../../../lib/digests/digestService";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const json = (
  body: Record<string, any>,
  status = 200
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function validSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) return true;

  try {
    return (
      new URL(origin).host ===
      new URL(request.url).host
    );
  } catch {
    return false;
  }
}

const clean = (value: unknown) =>
  String(value || "").trim();

const validEmail = (value: unknown) => {
  const email = clean(value).toLowerCase();

  return email.includes("@") &&
    email.includes(".")
    ? email
    : "";
};

export const POST: APIRoute = async ({ request }) => {
  if (!validSameOrigin(request)) {
    return json(
      {
        ok: false,
        error: "Invalid request origin.",
      },
      403
    );
  }

  try {
    const body = await request.json();
    const action = clean(body?.action);

    if (action === "save-config") {
      const id = clean(body?.id);
      const siteId = clean(body?.siteId);
      const citySlug = clean(body?.citySlug)
        .toLowerCase();

      if (!siteId || !citySlug) {
        return json(
          {
            ok: false,
            error:
              "Site and primary city are required.",
          },
          400
        );
      }

      const marketCities = Array.from(
        new Set(
          String(body?.marketCities || citySlug)
            .split(",")
            .map((city) =>
              city.trim().toLowerCase()
            )
            .filter(Boolean)
        )
      );

      const sendMode = [
        "manual",
        "approval",
        "automatic",
      ].includes(clean(body?.sendMode))
        ? clean(body?.sendMode)
        : "manual";

      const values = {
        site_id: siteId,
        name:
          clean(body?.name) ||
          "Weekly market update",
        city_slug: citySlug,
        market_name:
          clean(body?.marketName) || null,
        market_cities: marketCities,
        send_mode: sendMode,
        send_day: Math.min(
          6,
          Math.max(
            0,
            Number(body?.sendDay ?? 1)
          )
        ),
        send_hour_utc: Math.min(
          23,
          Math.max(
            0,
            Number(body?.sendHourUtc ?? 16)
          )
        ),
        subject_template:
          clean(body?.subjectTemplate) ||
          "{{market}} weekly real estate update",
        intro_text:
          clean(body?.introText) || null,
        max_listings: Math.min(
          20,
          Math.max(
            1,
            Number(body?.maxListings ?? 6)
          )
        ),
        active: body?.active !== false,
        updated_at: new Date().toISOString(),
      };

      const query = id
        ? supabase
            .from("digest_configs")
            .update(values)
            .eq("id", id)
        : supabase
            .from("digest_configs")
            .insert(values);

      const { data, error } = await query
        .select("*")
        .single();

      if (error) throw error;

      return json({
        ok: true,
        config: data,
      });
    }

    if (action === "add-subscriber") {
      const configId = clean(body?.configId);
      const email = validEmail(body?.email);

      if (!configId || !email) {
        return json(
          {
            ok: false,
            error:
              "Digest and valid email are required.",
          },
          400
        );
      }

      const { data, error } = await supabase
        .from("digest_subscribers")
        .upsert(
          {
            config_id: configId,
            name: clean(body?.name) || null,
            email,
            status: "subscribed",
            consent_source:
              clean(body?.consentSource) ||
              "agent_added",
            consent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "config_id,email",
          }
        )
        .select("*")
        .single();

      if (error) throw error;

      return json({
        ok: true,
        subscriber: data,
      });
    }

    if (action === "remove-subscriber") {
      const subscriberId =
        clean(body?.subscriberId);

      if (!subscriberId) {
        return json(
          {
            ok: false,
            error: "Subscriber is required.",
          },
          400
        );
      }

      const { error } = await supabase
        .from("digest_subscribers")
        .update({
          status: "unsubscribed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriberId);

      if (error) throw error;

      return json({ ok: true });
    }

    if (action === "generate") {
      const configId = clean(body?.configId);

      if (!configId) {
        return json(
          {
            ok: false,
            error: "Digest is required.",
          },
          400
        );
      }

      const run = await generateDigestRun(
        supabase,
        configId,
        new Date(),
        {
          REPLIERS_API_KEY:
            import.meta.env.REPLIERS_API_KEY,
          REPLIERS_BASE_URL:
            import.meta.env.REPLIERS_BASE_URL,
        }
      );

      return json({
        ok: true,
        run,
      });
    }

    if (
      action === "send" ||
      action === "approve-and-send"
    ) {
      const runId = clean(body?.runId);

      if (!runId) {
        return json(
          {
            ok: false,
            error: "Digest edition is required.",
          },
          400
        );
      }

      if (action === "approve-and-send") {
        const { error: approvalError } =
          await supabase
            .from("digest_runs")
            .update({
              approved_at:
                new Date().toISOString(),
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", runId);

        if (approvalError) {
          throw approvalError;
        }
      }

      const result = await sendDigestRun(
        supabase,
        runId,
        {
          RESEND_API_KEY:
            import.meta.env.RESEND_API_KEY,
          PUBLIC_SITE_URL:
            import.meta.env.PUBLIC_SITE_URL,
          DIGEST_FROM_EMAIL:
            import.meta.env.DIGEST_FROM_EMAIL,
        }
      );

      return json({
        ok: true,
        result,
      });
    }

    return json(
      {
        ok: false,
        error: "Unknown digest action.",
      },
      400
    );
  } catch (error) {
    console.error("Digest admin action failed:", error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Digest action failed.",
      },
      500
    );
  }
};
