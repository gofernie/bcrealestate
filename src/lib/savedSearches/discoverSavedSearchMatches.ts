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

export async function discoverSavedSearchMatches(
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
      matched: 0,
      discovered: 0,
    };
  }

  const mlsNumbers =
    matches
      .map((listing) =>
        String(
          listing.mls_number || ""
        )
      )
      .filter(Boolean);

  const {
    data: existingRows,
    error: existingError,
  } = await supabase
    .from(
      "saved_search_notifications"
    )
    .select("mls_number")
    .eq(
      "saved_search_id",
      savedSearch.id
    )
    .in(
      "mls_number",
      mlsNumbers
    );

  if (existingError) {
    throw existingError;
  }

  const alreadySeen =
    new Set(
      (existingRows || []).map(
        (row) =>
          String(row.mls_number)
      )
    );

  const unseen =
    matches.filter(
      (listing) =>
        !alreadySeen.has(
          String(
            listing.mls_number
          )
        )
    );

  if (!unseen.length) {
    return {
      matched: matches.length,
      discovered: 0,
    };
  }

  const now =
    new Date().toISOString();

  const rows =
    unseen.map(
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
         * NULL means discovered but
         * buyer has not been notified.
         */
        sent_at: null,
      })
    );

  const {
    error: insertError,
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

  if (insertError) {
    throw insertError;
  }

  return {
    matched: matches.length,
    discovered: rows.length,
  };
}