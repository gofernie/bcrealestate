import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const env = (k: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

// Partners: add/remove here. Tags come from env so nothing is hard-coded.
const PARTNERS: { name: string; url: (q: string) => string }[] = [
  {
    name: 'Amazon.ca',
    url: (q) => {
      const tag = env('AMAZON_ASSOCIATE_TAG');
      return `https://www.amazon.ca/s?k=${encodeURIComponent(q)}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`;
    },
  },
  { name: 'Wayfair', url: (q) => `https://www.wayfair.ca/keyword.php?keyword=${encodeURIComponent(q)}` },
  { name: 'IKEA', url: (q) => `https://www.ikea.com/ca/en/search/?q=${encodeURIComponent(q)}` },
  { name: 'Article', url: (q) => `https://www.article.com/search?q=${encodeURIComponent(q)}` },
];

const MODEL = env('LOOK_SEARCH_MODEL') ?? 'claude-haiku-5-5';
const STYLES = ['West Coast contemporary', 'Modern', 'Craftsman', 'Traditional', 'Rancher', 'Split level', 'Modern farmhouse', 'Log / timber frame', 'Cottage / cabin', 'Mid-century', 'Heritage / character', 'Mediterranean', 'Townhouse', 'Condo / apartment', 'Manufactured / mobile', 'Duplex / multi-family', 'Other'];
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function supa() {
  const url = env('SUPABASE_URL') ?? env('PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function callAI(url: string, init: RequestInit) { let r: Response | undefined; for (let i = 0; i < 3; i++) { try { r = await fetch(url, init); if (r.ok || ![429, 500, 502, 503, 529].includes(r.status)) return r; console.error('look-search retry', r.status); } catch (e) { console.error('look-search fetch error', e); } await new Promise((s) => setTimeout(s, 800 * (i + 1))); } return r ?? new Response('network error', { status: 503 }); }

export const POST: APIRoute = async ({ request }) => { try { return await handle(request); } catch (e) { console.error('look-search crash', e); return json({ error: 'Search failed (server), try again.' }, 500); } };

const handle = async (request: Request): Promise<Response> => {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const photoUrl = String(body?.photoUrl ?? '');
  const b = body?.box ?? {};
  const box = { x: +b.x, y: +b.y, w: +b.w, h: +b.h };
  if (!/^https:\/\//.test(photoUrl) || Object.values(box).some((v) => !Number.isFinite(v) || v < 0 || v > 1) || box.w < 0.02 || box.h < 0.02) {
    return json({ error: 'Bad request' }, 400);
  }

  // Optional host allowlist (comma-separated), e.g. your listing photo CDN.
  const allowed = (env('LOOK_SEARCH_IMG_HOSTS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(new URL(photoUrl).hostname)) return json({ error: 'Image not allowed' }, 400);

  const listingId = body?.listingId ? String(body.listingId).slice(0, 64) : null;
  const buyerId = body?.buyerId ? String(body.buyerId).slice(0, 64) : null;
  const r5 = (v: number) => Math.round(v * 20) / 20;
  const cacheKey = `${photoUrl}|${r5(box.x)},${r5(box.y)},${r5(box.w)},${r5(box.h)}`;
  const db = supa();

  // Cache hit: still log the tap (it's a taste signal), skip the vision call.
  if (db) {
    const { data } = await db.from('look_searches').select('result').eq('cache_key', cacheKey)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.result) {
      await db.from('look_searches').insert({
        cache_key: cacheKey, photo_url: photoUrl, listing_id: listingId, buyer_id: buyerId, box,
        item: data.result.item ?? null, style: data.result.style ?? null, result: data.result,
      });
      const r = data.result; r.results = (r.results ?? []).map((x: any) => ({ phrase: x.phrase, links: PARTNERS.map((p) => ({ name: p.name, url: p.url(x.phrase) })) })); return json(r);
    }
  }

  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Search not configured' }, 500);

  const img = await fetch(photoUrl);
  if (!img.ok) return json({ error: 'Could not load photo' }, 502);
  const mediaType = (img.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
  if (!OK_TYPES.includes(mediaType)) return json({ error: 'Unsupported image' }, 415);
  const data = Buffer.from(await img.arrayBuffer()).toString('base64');

  const pct = (v: number) => Math.round(v * 100);
  const prompt = `A home buyer drew a box on this listing photo. The box covers: left ${pct(box.x)}%, top ${pct(box.y)}%, width ${pct(box.w)}%, height ${pct(box.h)}% of the image.
Identify the single main item or design element inside that box (furniture, lighting, decor, rug, fixture, finish).
Call the report tool with these fields:
{"shoppable": true|false, "item": "short name, e.g. Live-edge dining table", "description": "one sentence on materials, colour and shape a shopper would care about", "style": "2-3 word design style, e.g. West Coast modern", "phrases": ["3 short retail search phrases, most specific first"]}
Set shoppable false if the box holds nothing a person could buy (sky, view, bare wall, people).
Also give your best guess at the exact original brand and model (guess) if the design is recognisable, with an honest confidence. Leave guess empty if you have no real idea.`;

  const ai = await callAI('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700, tools: [{ name: 'report', description: 'Report the item inside the box', input_schema: { type: 'object', properties: { shoppable: { type: 'boolean' }, item: { type: 'string' }, description: { type: 'string' }, style: { type: 'string' }, phrases: { type: 'array', items: { type: 'string' } }, guess: { type: 'string', description: 'Best guess at the exact original brand and model, e.g. Herman Miller Eames Lounge Chair. Empty string if no real idea.' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, home_style: { type: 'string', enum: [...STYLES, 'None'], description: 'Only if the box mostly shows a whole house or building exterior: its closest architectural style. Use None otherwise.' } }, required: ['shoppable', 'item', 'description', 'style', 'phrases', 'home_style'] } }], tool_choice: { type: 'tool', name: 'report' },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: prompt },
      ] }],
    }),
  });
  if (!ai.ok) { const t = await ai.text(); console.error('look-search AI error', ai.status, t); return json({ error: 'Search failed (' + ai.status + '), try again.' }, 502); }

  const out = await ai.json();
  const text: string = (out?.content ?? []).map((c: any) => c?.text ?? '').join('');
  let parsed: any = (out?.content ?? []).find((c: any) => c?.type === 'tool_use')?.input;
  if (!parsed) try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? ''); } catch { console.error('look-search parse error', text); return json({ error: 'Search failed (parse), try again.' }, 502); }

  const phrases: string[] = Array.isArray(parsed.phrases)
    ? parsed.phrases.map((p: unknown) => String(p).trim()).filter(Boolean).slice(0, 3) : [];
  const result = {
    shoppable: !!parsed.shoppable && phrases.length > 0,
    item: String(parsed.item ?? '').slice(0, 80),
    description: String(parsed.description ?? '').slice(0, 240),
    style: String(parsed.style ?? '').slice(0, 40), home_style: STYLES.find((s) => s.toLowerCase() === String(parsed.home_style ?? '').trim().toLowerCase()) ?? '', guess: String(parsed.guess ?? '').trim().slice(0, 100), confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
    results: phrases.map((phrase) => ({ phrase, links: PARTNERS.map((p) => ({ name: p.name, url: p.url(phrase) })) })),
  };

  if (db) {
    await db.from('look_searches').insert({
      cache_key: cacheKey, photo_url: photoUrl, listing_id: listingId, buyer_id: buyerId, box,
      item: result.item, style: result.style, result,
    });
  }
  return json(result);
};
