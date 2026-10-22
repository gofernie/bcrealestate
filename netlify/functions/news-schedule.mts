// Daily trigger for local news (scheduled functions are capped at 30s, so it just starts the background worker).
// 13:23 UTC = 6:23 am Pacific (5:23 am in winter).
export default async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const origin = process.env.URL || new URL(request.url).origin;
  if (!secret) {
    console.error('news-schedule: missing CRON_SECRET');
    return new Response('missing CRON_SECRET', { status: 500 });
  }
  const r = await fetch(`${origin}/.netlify/functions/news-discover-background`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log('news-schedule: started background news run', { status: r.status });
  return new Response(`started (${r.status})`);
};

export const config = { schedule: '23 13 * * *' };
