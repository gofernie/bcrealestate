import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  findSavedSearchMatches,
} from "./findSavedSearchMatches";

type SavedSearch = {
  id: string;
  city: string;
  channel: string;
  filters: Record<string, any>;
};

export async function baselineSavedSearch(
  supabase: SupabaseClient,
  savedSearch: SavedSearch
) {
  const matches =
    await findSavedSearchMatches(
      supabase,
      savedSearch
    );

  if (!matches.length) {
    return {
      count: 0,
    };
  }

  const now =
    new Date().toISOString();

  const rows =
    matches.map(
      (listing) => ({
        saved_search_id:
          savedSearch.id,

        mls_number:
          String(
            listing.mls_number
          ),

        channel:
          savedSearch.channel,

        discovered_at:
          now,

        /*
         * Existing listings are the
         * baseline, so consider them
         * already seen/sent.
         */
        sent_at:
          now,
      })
    );

  const {
    error,
  } = await supabase
    .from(
      "saved_search_notifications"
    )
    .upsert(
      rows,
      {
        onConflict:
          "saved_search_id,mls_number",

        ignoreDuplicates: true,
      }
    );

  if (error) {
    throw error;
  }

  return {
    count: rows.length,
  };
}