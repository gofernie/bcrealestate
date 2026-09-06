import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export const POST: APIRoute = async ({
  request,
  cookies,
  redirect,
}) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    return redirect(
      "/forgot-password?error=" +
        encodeURIComponent("Enter your email address.")
    );
  }

  const supabase =
    createSupabaseServerClient(cookies);

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
        encodeURIComponent(error.message)
    );
  }

  return redirect(
    "/forgot-password?sent=1"
  );
};