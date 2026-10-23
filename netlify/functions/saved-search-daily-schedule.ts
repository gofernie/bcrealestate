import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

import { processDailySavedSearches } from "../../src/lib/savedSearches/processDailySavedSearches";

// Daily saved-search roundup. Matches are found after each listing refresh and
// left pending; this sends them once a day.
export default async () => {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await processDailySavedSearches(supabase, {
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER!,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  });

  console.log("Daily saved searches sent", result);
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
};

// 15:05 UTC = 8:05 am Pacific in summer, 7:05 am in winter.
export const config: Config = { schedule: "5 15 * * *" };
