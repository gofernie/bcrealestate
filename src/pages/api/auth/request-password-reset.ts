import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({
  request,
  redirect,
}) => {
  const formData =
    await request.formData();

  const email =
    String(
      formData.get("email") || ""
    ).trim();

  if (!email) {
    return redirect(
      "/forgot-password?error=" +
        encodeURIComponent(
          "Enter your email address."
        )
    );
  }

  const supabase =
    createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: "implicit",
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

  const origin =
    new URL(request.url).origin;

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          `${origin}/reset-password`,
      }
    );

  if (error) {
    return redirect(
      "/forgot-password?error=" +
        encodeURIComponent(
          error.message
        )
    );
  }

  return redirect(
    "/forgot-password?sent=1"
  );
};