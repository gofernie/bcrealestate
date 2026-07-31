import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const REPORT_EMAIL =
  process.env.CRON_REPORT_EMAIL ||
  process.env.AGENT_EMAIL ||
  "";

const REPORT_FROM =
  process.env.CRON_REPORT_FROM ||
  "Locus <onboarding@resend.dev>";

type MarketRow = {
  city: string;
  enabled: boolean;
  refresh_priority: number | null;
  last_refresh_status: string | null;
  last_success_at: string | null;
  last_refresh_at: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    "en-CA",
    {
      timeZone: "America/Vancouver",
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function hoursSince(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp =
    new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return (
    Date.now() - timestamp
  ) / (1000 * 60 * 60);
}

function getMarketHealth(
  market: MarketRow
) {
  const status =
    String(
      market.last_refresh_status || ""
    ).toLowerCase();

  const refreshAge =
    hoursSince(
      market.last_refresh_at
    );

  const successAge =
    hoursSince(
      market.last_success_at
    );

  /*
   * A refresh left "running" for more
   * than one hour is considered stale.
   */
  if (
    status === "running" &&
    refreshAge !== null &&
    refreshAge > 1
  ) {
    return {
      level: "error",
      label: "STUCK",
      reason:
        `Running for ${refreshAge.toFixed(1)} hours`,
    };
  }

  if (status === "failed") {
    return {
      level: "error",
      label: "FAILED",
      reason:
        "Last refresh failed",
    };
  }

  /*
   * With 13-ish markets, 4 markets
   * per run and 4 runs per day,
   * each market should normally
   * complete within roughly a day.
   *
   * Give it 30 hours before flagging.
   */
  if (
    successAge === null
  ) {
    return {
      level: "error",
      label: "NEVER",
      reason:
        "No successful refresh recorded",
    };
  }

  if (successAge > 30) {
    return {
      level: "warning",
      label: "OVERDUE",
      reason:
        `Last success ${successAge.toFixed(1)} hours ago`,
    };
  }

  if (status === "running") {
    return {
      level: "info",
      label: "RUNNING",
      reason:
        refreshAge === null
          ? "Refresh in progress"
          : `Running for ${refreshAge.toFixed(1)} hours`,
    };
  }

  return {
    level: "good",
    label: "OK",
    reason:
      `${successAge.toFixed(1)} hours since last success`,
  };
}

export default async function handler() {
  if (!REPORT_EMAIL) {
    throw new Error(
      "Missing CRON_REPORT_EMAIL or AGENT_EMAIL"
    );
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "Missing RESEND_API_KEY"
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("listing_markets")
    .select(`
      city,
      enabled,
      refresh_priority,
      last_refresh_status,
      last_success_at,
      last_refresh_at
    `)
    .eq("enabled", true)
    .order(
      "refresh_priority",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Could not load listing markets: ${error.message}`
    );
  }

  const markets =
    (data || []) as MarketRow[];

  const healthRows =
    markets.map(
      (market) => ({
        market,
        health:
          getMarketHealth(
            market
          ),
      })
    );

  const failed =
    healthRows.filter(
      ({ health }) =>
        health.level === "error"
    );

  const warnings =
    healthRows.filter(
      ({ health }) =>
        health.level === "warning"
    );

  const running =
    healthRows.filter(
      ({ health }) =>
        health.label === "RUNNING"
    );

  const healthy =
    healthRows.filter(
      ({ health }) =>
        health.level === "good"
    );

  const problemCount =
    failed.length +
    warnings.length;

  const subject =
    problemCount > 0
      ? `⚠️ Locus market refresh report — ${problemCount} issue${problemCount === 1 ? "" : "s"}`
      : `✓ Locus market refresh report — ${markets.length} markets healthy`;

  const rowsHtml =
    healthRows
      .map(
        ({
          market,
          health,
        }) => {
          let statusBackground =
            "#eef7f1";

          let statusColor =
            "#24633d";

          if (
            health.level ===
            "error"
          ) {
            statusBackground =
              "#fff0f0";
            statusColor =
              "#9b2525";
          }

          if (
            health.level ===
            "warning"
          ) {
            statusBackground =
              "#fff8e8";
            statusColor =
              "#8a5b00";
          }

          if (
            health.level ===
            "info"
          ) {
            statusBackground =
              "#eef5ff";
            statusColor =
              "#285b91";
          }

          return `
            <tr>
              <td style="
                padding: 11px 10px;
                border-bottom: 1px solid #ececec;
                font-weight: 700;
              ">
                ${escapeHtml(market.city)}
              </td>

              <td style="
                padding: 11px 10px;
                border-bottom: 1px solid #ececec;
              ">
                <span style="
                  display: inline-block;
                  padding: 4px 8px;
                  border-radius: 999px;
                  background: ${statusBackground};
                  color: ${statusColor};
                  font-size: 11px;
                  font-weight: 800;
                ">
                  ${health.label}
                </span>
              </td>

              <td style="
                padding: 11px 10px;
                border-bottom: 1px solid #ececec;
                color: #535353;
              ">
                ${escapeHtml(
                  market.last_refresh_status ||
                  "unknown"
                )}
              </td>

              <td style="
                padding: 11px 10px;
                border-bottom: 1px solid #ececec;
                color: #535353;
                white-space: nowrap;
              ">
                ${escapeHtml(
                  formatDate(
                    market.last_success_at
                  )
                )}
              </td>

              <td style="
                padding: 11px 10px;
                border-bottom: 1px solid #ececec;
                color: #535353;
              ">
                ${escapeHtml(
                  health.reason
                )}
              </td>
            </tr>
          `;
        }
      )
      .join("");

  const html = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      color: #17201d;
      line-height: 1.45;
    ">
      <h1 style="
        margin: 0 0 8px;
        font-size: 24px;
      ">
        Locus market refresh report
      </h1>

      <p style="
        margin: 0 0 24px;
        color: #68706c;
      ">
        ${escapeHtml(
          new Date().toLocaleString(
            "en-CA",
            {
              timeZone:
                "America/Vancouver",
              dateStyle:
                "full",
              timeStyle:
                "short",
            }
          )
        )}
      </p>

      <div style="
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 24px;
      ">
        <div style="
          padding: 12px 16px;
          border: 1px solid #e7e7e7;
          border-radius: 8px;
        ">
          <strong>${markets.length}</strong><br>
          <span style="color:#777;">Markets</span>
        </div>

        <div style="
          padding: 12px 16px;
          border: 1px solid #e7e7e7;
          border-radius: 8px;
        ">
          <strong>${healthy.length}</strong><br>
          <span style="color:#777;">Healthy</span>
        </div>

        <div style="
          padding: 12px 16px;
          border: 1px solid #e7e7e7;
          border-radius: 8px;
        ">
          <strong>${running.length}</strong><br>
          <span style="color:#777;">Running</span>
        </div>

        <div style="
          padding: 12px 16px;
          border: 1px solid #e7e7e7;
          border-radius: 8px;
        ">
          <strong>${warnings.length}</strong><br>
          <span style="color:#777;">Overdue</span>
        </div>

        <div style="
          padding: 12px 16px;
          border: 1px solid #e7e7e7;
          border-radius: 8px;
        ">
          <strong>${failed.length}</strong><br>
          <span style="color:#777;">Failures</span>
        </div>
      </div>

      <table
        cellpadding="0"
        cellspacing="0"
        style="
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          font-size: 13px;
        "
      >
        <thead>
          <tr style="
            background: #f7f8f7;
            text-align: left;
          ">
            <th style="padding:10px;">Market</th>
            <th style="padding:10px;">Health</th>
            <th style="padding:10px;">Status</th>
            <th style="padding:10px;">Last success</th>
            <th style="padding:10px;">Detail</th>
          </tr>
        </thead>

        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <p style="
        margin-top: 20px;
        color: #777;
        font-size: 12px;
      ">
        STUCK = marked running for more than one hour.
        OVERDUE = no successful refresh within 30 hours.
      </p>
    </div>
  `;

  const result =
    await resend.emails.send({
      from: REPORT_FROM,
      to: [REPORT_EMAIL],
      subject,
      html,
    });

  if (result.error) {
    console.error(
      "Market refresh report email failed:",
      result.error
    );

    throw new Error(
      result.error.message ||
      "Could not send market report"
    );
  }

  console.log(
    "Market refresh report sent",
    {
      recipient:
        REPORT_EMAIL,
      markets:
        markets.length,
      healthy:
        healthy.length,
      running:
        running.length,
      warnings:
        warnings.length,
      failed:
        failed.length,
    }
  );

  return new Response(
    JSON.stringify({
      ok: true,
      recipient:
        REPORT_EMAIL,
      markets:
        markets.length,
      healthy:
        healthy.length,
      running:
        running.length,
      warnings:
        warnings.length,
      failed:
        failed.length,
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
}

export const config: Config = {
  schedule:
    "45 1,7,13,19 * * *",
};