import type { APIRoute } from "astro";
export const prerender = false;
// temporary probe, safe to delete
export const GET: APIRoute = async () => new Response("gone", { status: 404 });
