import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const returnTo = String(formData.get("returnTo") || "/admin");

  if (!email || !password) {
    return redirect("/login?error=Missing email or password");
  }

  const supabase = createSupabaseServerClient(cookies);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/admin";

  return redirect(safeReturnTo);
};