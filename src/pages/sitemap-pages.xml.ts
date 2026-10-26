import type { APIRoute } from "astro";
import { pageEntries, urlsetXml, xmlResponse } from "../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async () => xmlResponse(urlsetXml(await pageEntries()));