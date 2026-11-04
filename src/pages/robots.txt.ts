import type { APIRoute } from "astro";
import { hostFrom } from "../lib/sitemap";

export const prerender = false;

/* robots-host-v1: each domain points to its own sitemap; *.netlify.app copies are kept out of search */
export const GET: APIRoute = async ({ url }) => {
  const host = hostFrom(url);
  const body = /\.netlify\.app$/.test(host)
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://${host}/sitemap.xml\n`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
};