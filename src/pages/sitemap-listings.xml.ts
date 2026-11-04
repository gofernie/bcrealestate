import type { APIRoute } from "astro";
import { hostFrom, listingEntries, urlsetXml, xmlResponse } from "../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => xmlResponse(urlsetXml(await listingEntries(hostFrom(url))));