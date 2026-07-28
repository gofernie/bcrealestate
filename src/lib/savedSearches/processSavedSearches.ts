import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  discoverSavedSearchMatches,
} from "./discoverSavedSearchMatches";

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

export async function processSavedSearches(
  supabase: SupabaseClient,
  env: Env,
  city?: string
) {
let searchesQuery =
  supabase
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
    .eq("active", true);

if (city) {
  searchesQuery =
    searchesQuery.eq(
      "city",
      city
        .toLowerCase()
        .trim()
    );
}

const {
  data: searches,
  error,
} = await searchesQuery;

  if (error) {
    throw error;
  }

  const results = [];

  for (const savedSearch of searches || []) {
    try {
      const discovery =
        await discoverSavedSearchMatches(
          supabase,
          savedSearch
        );

      let sent = 0;

      /*
       * "update" searches send newly
       * discovered matches now.
       *
       * "daily" searches leave them
       * pending for the roundup job.
       */
      if (
        savedSearch.frequency ===
          "update" &&
        discovery.discovered > 0
      ) {
        const sendResult =
          await sendSavedSearchNotifications(
            supabase,
            savedSearch,
            env
          );

        sent =
          sendResult.sent || 0;
      }

      results.push({
        id: savedSearch.id,
        city: savedSearch.city,
        frequency:
          savedSearch.frequency,
        matched:
          discovery.matched,
        discovered:
          discovery.discovered,
        sent,
      });
    } catch (searchError) {
      console.error(
        "Saved search processing failed:",
        {
          id: savedSearch.id,
          error: searchError,
        }
      );

      results.push({
        id: savedSearch.id,
        city: savedSearch.city,
        frequency:
          savedSearch.frequency,
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