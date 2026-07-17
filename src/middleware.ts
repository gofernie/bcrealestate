import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(
  async (context, next) => {
    const hostname = context.url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const parts = context.url.pathname
      .split("/")
      .filter(Boolean);

    const slug = parts[0] || "";

    const reservedSlugs = new Set([
      "api",
      "admin",
      "explore",
      "_astro",
      "404"
    ]);

    const shouldRewrite =
      hostname === "nanaimomobiles.com" &&
      parts.length === 1 &&
      !reservedSlugs.has(slug) &&
      !slug.includes(".");

    if (shouldRewrite) {
      return context.rewrite(
        new URL(
          `/nanaimo/${slug}${context.url.search}`,
          context.url
        )
      );
    }

    return next();
  }
);