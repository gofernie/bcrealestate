import type { APIRoute } from "astro";
import { hostFrom, pageEntries, urlsetXml, xmlResponse } from "../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => xmlResponse(urlsetXml(await pageEntries(hostFrom(url))));