import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  discoverSavedSearchMatches,
} from "./discoverSavedSearchMatches";

import {
  sendSavedSearchNotifications,
} from "./sendSavedSearchNotifications";

import {
  baselineSavedSearch,
} from "./baselineSavedSearch";

import {
  isRegionDistrict,
  REGION_CITY,
} from "./pageSearch";

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
  const refreshed =
    city
      .toLowerCase()
      .trim();

  // A Greater Victoria district refresh also checks the region-wide searches.
  searchesQuery =
    isRegionDistrict(refreshed)
      ? searchesQuery.in("city", [refreshed, REGION_CITY])
      : searchesQuery.eq("city", refreshed);
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
      // New searches first record what's already on the market, so the first
      // alert is only genuinely new listings.
      if (savedSearch.filters?.pending_baseline) {
        const baseline =
          await baselineSavedSearch(
            supabase,
            savedSearch,
            env.PUBLIC_SITE_URL
          );

        const { pending_baseline: _done, ...filters } =
          savedSearch.filters;

        const { error: clearError } = await supabase
          .from("saved_searches")
          .update({ filters })
          .eq("id", savedSearch.id);

        if (clearError) throw clearError;

        results.push({
          id: savedSearch.id,
          city: savedSearch.city,
          frequency: savedSearch.frequency,
          baselined: baseline.count,
          sent: 0,
        });

        continue;
      }

      const discovery =
        await discoverSavedSearchMatches(
          supabase,
          savedSearch,
          env.PUBLIC_SITE_URL
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
  savedSearch.frequency === "update" &&
  discovery.discovered > 25
) {
  console.error(
    "Saved search discovery spike blocked",
    {
      id: savedSearch.id,
      city: savedSearch.city,
      matched: discovery.matched,
      discovered: discovery.discovered,
    }
  );

  results.push({
    id: savedSearch.id,
    city: savedSearch.city,
    frequency: savedSearch.frequency,
    matched: discovery.matched,
    discovered: discovery.discovered,
    sent: 0,
    blocked: true,
  });

  continue;
}
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