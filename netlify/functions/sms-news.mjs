// Netlify Function: text a news URL to your Twilio number -> AI drafts headline/blurb -> reply Y to publish, N to skip.
// Webhook URL for Twilio ("A message comes in", HTTP POST): https://YOUR-DOMAIN/.netlify/functions/sms-news
// Optional town prefix:  "sparwood https://..."  |  "fernie https://..."  |  "valley https://..."
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = (k) => process.env[k];
const digits = (s = '') => String(s).replace(/\D/g, '').slice(-10);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const twiml = (msg) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${esc(msg)}</Message>` : ''}</Response>`,
  { headers: { 'content-type': 'text/xml' } }
);

const decode = (s = '') => s.replace(/&#8217;|&#8216;|&#039;|&#39;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&#8211;|&#8212;/g, '-').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&#\d+;/g, '');
const strip = (h = '') => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const TOWNS = { fernie: 'fernie', sparwood: 'sparwood', valley: 'elk-valley', 'elk-valley': 'elk-valley', elk: 'elk-valley' };

// Twilio request signature check: HMAC-SHA1(url + sorted key/value pairs) with your auth token
function validTwilio(url, signature, params) {
  const token = env('TWILIO_AUTH_TOKEN');
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readArticle(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`site returned ${r.status}`);
  const html = await r.text();
  const meta = (p) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)="${p}"[^>]+content="([^"]*)"`, 'i'))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${p}"`, 'i'))?.[1];
  const title = decode(meta('og:title') || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const site = decode(meta('og:site_name') || new URL(url).hostname.replace(/^www\./, ''));
  const published = meta('article:published_time');
  const body = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 40).join('\n');
  return { title, site, published, body: body || decode(meta('og:description') || '') };
}

async function draft(art, forcedTown) {
  const prompt = `You write short local-news notes for a real estate website covering Fernie and Sparwood, BC (Elk Valley). Readers are home buyers and owners.

Source: ${art.site}
Title: ${art.title}
Text: ${art.body.slice(0, 5000)}

${forcedTown ? `This story is for: ${forcedTown}.` : `Decide where it applies: "fernie", "sparwood", or "elk-valley" (both / whole valley). RDEK Area A is the rural Elk Valley; Area F is the Columbia Valley, not Fernie.`}

Reply with JSON only:
{"area": "fernie|sparwood|elk-valley", "title": "new headline in your own words, max 70 chars", "blurb": "2 sentences in your own words: what happened, and why it matters for buyers/owners. Do not quote the source.", "tag": "Housing|Development|Infrastructure|Amenities|Community"}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.status);
  const text = j.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('no text in AI reply');
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('ok');

  const form = await req.formData();
  const params = {};
  form.forEach((v, k) => { params[k] = String(v); });

  const webhookUrl = env('NEWS_SMS_WEBHOOK_URL') || req.url;
  if (!validTwilio(webhookUrl, req.headers.get('x-twilio-signature'), params)) {
    console.warn('sms-news: bad Twilio signature for', webhookUrl);
    return new Response('forbidden', { status: 403 });
  }
  if (digits(params.From) !== digits(env('NEWS_ADMIN_PHONE'))) return twiml(); // ignore everyone else silently

  const text = (params.Body || '').trim();
  const sb = createClient(env('PUBLIC_SUPABASE_URL') || env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  // Y / N -> act on the most recent texted draft
  if (/^(y|yes|n|no)$/i.test(text)) {
    const { data: last } = await sb.from('local_news').select('id,title')
      .eq('via', 'sms').eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!last) return twiml('Nothing waiting. Text me a news link.');
    const publish = /^y/i.test(text);
    await sb.from('local_news').update({ status: publish ? 'approved' : 'skipped' }).eq('id', last.id);
    return twiml(publish ? `✅ Published: ${last.title}` : `🗑️ Skipped: ${last.title}`);
  }

  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!url) return twiml('Text me a news link (optionally start with fernie, sparwood or valley). Reply Y or N to a draft.');
  const forced = TOWNS[text.split(/\s+/)[0].toLowerCase()];

  const { data: existing } = await sb.from('local_news').select('status,title').eq('url', url).maybeSingle();
  if (existing?.status === 'approved') return twiml(`Already live: ${existing.title}`);

  let art, ai;
  try { art = await readArticle(url); } catch (e) { return twiml(`Couldn't read that page (${e.message}). Try another link to the same story.`); }
  try { ai = await draft(art, forced); } catch (e) { return twiml(`AI draft failed (${e.message}). Try again in a minute.`); }

  const city = forced || (['fernie', 'sparwood', 'elk-valley'].includes(ai.area) ? ai.area : 'fernie');
  const row = {
    city, source: art.site, url, source_title: art.title,
    published_at: art.published ? new Date(art.published).toISOString() : new Date().toISOString(),
    title: ai.title, blurb: ai.blurb, tag: ai.tag || null, status: 'pending', via: 'sms',
  };
  const { error } = await sb.from('local_news').upsert(row, { onConflict: 'url' });
  if (error) return twiml(`Save failed: ${error.message}`);

  const label = city === 'elk-valley' ? 'Elk Valley' : city[0].toUpperCase() + city.slice(1);
  return twiml(`📰 ${label} · ${row.tag || 'News'}\n${row.title}\n\n${row.blurb}\n\nReply Y to publish, N to skip. Wrong town? Resend starting with fernie, sparwood or valley.`);
};
