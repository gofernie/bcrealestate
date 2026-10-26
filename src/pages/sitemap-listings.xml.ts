import type { APIRoute } from "astro";
import { listingEntries, urlsetXml, xmlResponse } from "../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async () => xmlResponse(urlsetXml(await listingEntries()));