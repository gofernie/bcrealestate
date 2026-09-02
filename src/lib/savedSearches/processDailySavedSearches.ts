import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  sendSavedSearchNotifications,
} from "./sendSavedSearchNotifications";

type Env = {
  RESEND_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  PUBLIC_SITE_URL?: string;
};

export async function processDailySavedSearches(
  supabase: SupabaseClient,
  env: Env
) {
  const {
    data: searches,
    error,
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
        filters,
        active
      `
    )
    .eq("active", true)
    .eq("frequency", "daily");

  if (error) {
    throw error;
  }

  const results = [];

  for (
    const savedSearch of searches || []
  ) {
    try {
      const sendResult =
        await sendSavedSearchNotifications(
          supabase,
          savedSearch,
          env
        );

      results.push({
        id: savedSearch.id,
        city: savedSearch.city,
        channel:
          savedSearch.channel,
        sent:
          sendResult.sent || 0,
      });
    } catch (searchError) {
      console.error(
        "Daily saved search failed:",
        {
          id: savedSearch.id,
          error: searchError,
        }
      );

      results.push({
        id: savedSearch.id,
        city: savedSearch.city,
        error:
          searchError instanceof Error
            ? searchError.message
            : "Unknown error",
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}