import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerClient } from "./lib/supabaseServer";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (!isAdminRoute) {
    return next();
  }

  const supabase = createSupabaseServerClient(context.cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `${pathname}${search}`;

    return context.redirect(
      `/login?returnTo=${encodeURIComponent(returnTo)}`
    );
  }

  return next();
});
