import type {
  APIRoute,
} from "astro";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  findSavedSearchMatches,
} from "../../lib/savedSearches/findSavedSearchMatches";

export const prerender = false;

const supabase =
  createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

export const GET: APIRoute =
  async ({ url }) => {
    try {
      const id =
        url.searchParams.get("id");

      if (!id) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Missing saved search id.",
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
        data: savedSearch,
        error: searchError,
      } = await supabase
        .from("saved_searches")
        .select(
          `
            id,
            city,
            filters
          `
        )
        .eq("id", id)
        .single();

      if (searchError) {
        console.error(
          "Saved search lookup failed:",
          searchError
        );

        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Saved search not found.",
          }),
          {
            status: 404,
            headers: {
              "content-type":
                "application/json",
            },
          }
        );
      }

      const matches =
        await findSavedSearchMatches(
          supabase,
          savedSearch
        );

      return new Response(
        JSON.stringify(
          {
            ok: true,
            savedSearch,
            count:
              matches.length,
            matches:
              matches.slice(
                0,
                10
              ),
          },
          null,
          2
        ),
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
        "Saved search match test failed:",
        error
      );

      return new Response(
        JSON.stringify({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to test saved search.",
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
  };