import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerClient } from "./lib/supabaseServer";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  // junk-url-guard-v1: old link bug left endless "-real-estate-market" URLs; collapse or 404 them
  const JUNK_BASES = new Set(["404", "contact", "explore", "search", "searches", "login", "about", "privacy", "terms", "admin", "api"]);
  const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (pathname === "/404" || pathname === "/404/") return notFound();
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length && /(?:-real-estate-market)+$/i.test(segs[0])) {
    const base = segs[0].replace(/(?:-real-estate-market)+$/i, "").toLowerCase();
    if (!base || JUNK_BASES.has(base)) return notFound();
    const rest = segs.slice(1).join("/");
    return context.redirect(rest ? `/${base}/${rest}` : `/${base}/`, 301);
  }
  if (pathname.replace(/\/+$/, "") === "/explore") {
    const c = context.url.searchParams.get("city") || "";
    if (/-real-estate-market/i.test(c)) {
      const base = c.replace(/(?:-real-estate-market)+$/i, "").toLowerCase();
      const q = new URLSearchParams(context.url.searchParams);
      if (!base || JUNK_BASES.has(base)) q.delete("city"); else q.set("city", base);
      const qs = q.toString();
      return context.redirect(`/explore${qs ? `?${qs}` : ""}`, 301);
    }
  }

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
