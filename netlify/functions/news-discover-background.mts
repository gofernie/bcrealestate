// Background worker for daily local news (up to 15 min). Started by news-schedule.
import { runNewsDiscovery } from '../../src/lib/news/discoverNews.mjs';

export default async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    // Stop starting new work at 13 min; anything left is picked up tomorrow.
    const stats = await runNewsDiscovery({ budgetMs: 13 * 60 * 1000 });
    console.log('Daily news discovery finished', stats);
    return new Response(JSON.stringify(stats), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('Daily news discovery failed', e);
    return new Response('failed', { status: 500 });
  }
};

export const config = { background: true };
