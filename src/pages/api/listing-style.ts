import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getSite } from '../../lib/getSite';

export const prerender = false;

const env = (k: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

const json = (body: unknown, status = 200, cache = true) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(cache ? { 'cache-control': 'public, max-age=3600' } : {}),
    },
  });

// Home style (AI-tagged) + waterfront (MLS) for one listing, by id or MLS number.
export const GET: APIRoute = async ({ url, request }) => {
  const id = String(url.searchParams.get('id') || '').trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return json({ style: '', waterfront: false }, 400, false);

  const sbUrl = env('SUPABASE_URL') ?? env('PUBLIC_SUPABASE_URL');
  const sbKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!sbUrl || !sbKey) return json({ style: '', waterfront: false }, 500, false);

  const db = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('listing_rows')
    .select('home_style, waterfront, waterfront_type, normalized_type, normalized_city, lot_size_sqft, lot_size_acres, year_built')
    .or(`id.eq.${id},mls_number.eq.${id}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('listing-style lookup failed', error);
    return json({ style: '', waterfront: false }, 500, false);
  }

  const wType = String(data?.waterfront_type || '').trim().toLowerCase();
  const waterfront = data?.waterfront === true || (!!wType && !['none', 'no', 'false', 'n/a'].includes(wType));

  // Published intent pages for this listing's city, matched by topic (not by slug).
  const cityKey = String(data?.normalized_city || '').trim().toLowerCase().replace(/\s+/g, '-');
  // Intent pages belong to a site. Look in the page the visitor is browsing first (e.g. saanich-east),
  // then the listing's own city (e.g. saanich); resolve the site the same way the pages do.
  const rawHost = String(url.searchParams.get('site') || new URL(request.url).hostname || '').trim().toLowerCase().replace(/^www\./, '');
  // Same rule as the pages: local dev is bc.realestate.
  const host = rawHost === 'localhost' || rawHost === '127.0.0.1' ? 'bc.realestate' : rawHost;
  const pageCity = String(url.searchParams.get('pageCity') || '').trim().toLowerCase().replace(/\s+/g, '-');
  const lookIn = [...new Set([pageCity, cityKey].filter(Boolean))];
  let waterPage = '';
  let viewPage = '';
  let acreagePage = '';
  let newBuildPage = '';
  const lType = String(data?.normalized_type || '').toLowerCase();
  const lotSqft = Number(data?.lot_size_sqft) || (Number(data?.lot_size_acres) || 0) * 43560;
  const yearBuilt = Number(data?.year_built) || 0;
  const thisYear = new Date().getFullYear();
  for (const c of lookIn) {
    if (waterPage && viewPage && acreagePage && newBuildPage) break;
    let siteId = '';
    try {
      const site: any = host ? await getSite(host, c) : null;
      siteId = site?.id ? String(site.id) : '';
    } catch (e) {
      console.error('listing-style getSite failed', e);
    }
    if (!siteId) continue;
    const { data: pages } = await db
      .from('intent_pages')
      .select('slug, city, waterfront_type, requires_ocean_view, requires_waterfront, min_lot_sqft, min_year, area, property_type, price_min, price_max, beds_min, baths_min, min_sqft, view_type, primary_on_main')
      .eq('city', c)
      .eq('is_published', true)
      .eq('site_id', siteId)
      .or('requires_ocean_view.eq.true,waterfront_type.not.is.null,min_lot_sqft.not.is.null,min_year.not.is.null')
      .limit(60);
    for (const p of pages || []) {
      const pType = String(p.waterfront_type || '').toLowerCase();
      if (!waterPage && waterfront && wType && pType === wType) waterPage = `/${p.city}/${p.slug}`;
      if (!viewPage && p.requires_ocean_view === true) viewPage = `/${p.city}/${p.slug}`;
      const pure = !p.area && !p.price_min && !p.price_max && !p.beds_min && !p.baths_min && !p.min_sqft && !p.view_type && !p.requires_waterfront && !p.requires_ocean_view && !p.waterfront_type && !p.primary_on_main && (!p.property_type || String(p.property_type).toLowerCase() === lType);
      if (!acreagePage && pure && !p.min_year && Number(p.min_lot_sqft) >= 43560 && lotSqft >= Number(p.min_lot_sqft)) acreagePage = `/${p.city}/${p.slug}`;
      if (!newBuildPage && pure && !p.min_lot_sqft && Number(p.min_year) >= thisYear - 1 && yearBuilt >= Number(p.min_year)) newBuildPage = `/${p.city}/${p.slug}`;
    }
  }

  return json({
    style: data?.home_style || '',
    waterfront,
    waterfrontType: waterfront ? (wType || 'waterfront') : '',
    type: String(data?.normalized_type || '').toLowerCase(),
    waterPage,
    viewPage,
    acreagePage,
    newBuildPage,
    lotSqft,
    yearBuilt,
    city: cityKey,
  });
};
