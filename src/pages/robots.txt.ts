import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const origin = new URL(request.url).origin;

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap-index.xml
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
};