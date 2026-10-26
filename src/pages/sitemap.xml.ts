import type { APIRoute } from "astro";
import { sitemapIndexXml, xmlResponse } from "../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async () => xmlResponse(sitemapIndexXml(["sitemap-pages.xml", "sitemap-listings.xml"]));