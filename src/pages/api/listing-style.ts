import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

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
export const GET: APIRoute = async ({ url }) => {
  const id = String(url.searchParams.get('id') || '').trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return json({ style: '', waterfront: false }, 400, false);

  const sbUrl = env('SUPABASE_URL') ?? env('PUBLIC_SUPABASE_URL');
  const sbKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!sbUrl || !sbKey) return json({ style: '', waterfront: false }, 500, false);

  const db = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('listing_rows')
    .select('home_style, waterfront, waterfront_type')
    .or(`id.eq.${id},mls_number.eq.${id}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('listing-style lookup failed', error);
    return json({ style: '', waterfront: false }, 500, false);
  }

  const wType = String(data?.waterfront_type || '').trim().toLowerCase();
  const waterfront = data?.waterfront === true || (!!wType && !['none', 'no', 'false', 'n/a'].includes(wType));

  return json({ style: data?.home_style || '', waterfront });
};
