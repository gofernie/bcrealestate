import type { APIRoute } from "astro";
import { hostFrom, sitemapIndexXml, xmlResponse } from "../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => xmlResponse(sitemapIndexXml(["sitemap-pages.xml", "sitemap-listings.xml"], `https://${hostFrom(url)}`));