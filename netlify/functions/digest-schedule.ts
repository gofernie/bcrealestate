import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

import {
  generateDigestRun,
  sendDigestRun,
} from "../../src/lib/digests/digestService";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export default async function handler() {
  const now = new Date();
  const sendDay = now.getUTCDay();
  const sendHourUtc = now.getUTCHours();

  const { data: configs, error } =
    await supabase
      .from("digest_configs")
      .select("*")
      .eq("active", true)
      .in("send_mode", [
        "approval",
        "automatic",
      ])
      .eq("send_day", sendDay)
      .eq("send_hour_utc", sendHourUtc);

  if (error) {
    throw new Error(
      `Could not load scheduled digests: ${error.message}`
    );
  }

  const results: Record<string, any>[] = [];

  for (const config of configs || []) {
    try {
      const run = await generateDigestRun(
        supabase,
        config.id,
        now,
        {
          REPLIERS_API_KEY:
            process.env.REPLIERS_API_KEY,
          REPLIERS_BASE_URL:
            process.env.REPLIERS_BASE_URL,
        }
      );

      if (config.send_mode === "approval") {
        results.push({
          configId: config.id,
          runId: run.id,
          mode: config.send_mode,
          status: run.status,
          prepared: true,
          sent: false,
        });

        continue;
      }

      if (run.status === "sent") {
        results.push({
          configId: config.id,
          runId: run.id,
          mode: config.send_mode,
          status: "sent",
          prepared: false,
          sent: false,
          skipped: true,
        });

        continue;
      }

      const delivery = await sendDigestRun(
        supabase,
        run.id,
        {
          RESEND_API_KEY:
            process.env.RESEND_API_KEY!,
          PUBLIC_SITE_URL:
            process.env.PUBLIC_SITE_URL,
          DIGEST_FROM_EMAIL:
            process.env.DIGEST_FROM_EMAIL,
        }
      );

      results.push({
        configId: config.id,
        runId: run.id,
        mode: config.send_mode,
        prepared: true,
        ...delivery,
      });
    } catch (digestError) {
      console.error(
        "Scheduled digest failed:",
        {
          configId: config.id,
          error:
            digestError instanceof Error
              ? digestError.message
              : digestError,
        }
      );

      results.push({
        configId: config.id,
        mode: config.send_mode,
        error:
          digestError instanceof Error
            ? digestError.message
            : "Unknown digest error",
      });
    }
  }

  return json({
    ok: true,
    checkedAt: now.toISOString(),
    sendDay,
    sendHourUtc,
    matched: configs?.length || 0,
    results,
  });
}

export const config: Config = {
  schedule: "15 * * * *",
};
