// Run: node --env-file=.env scripts/discover-news.mjs            (all regions)
//      node --env-file=.env scripts/discover-news.mjs crd cowichan   (only some regions)
//      add --approve to publish immediately
// The same code runs daily on Netlify (netlify/functions/news-discover-background.mts).
import { runNewsDiscovery, REGIONS } from '../src/lib/news/discoverNews.mjs';

const args = process.argv.slice(2);
const regions = args.filter((a) => !a.startsWith('--'));
const unknown = regions.filter((r) => !REGIONS[r]);
if (unknown.length) {
  console.error(`Unknown region(s): ${unknown.join(', ')}. Known: ${Object.keys(REGIONS).join(', ')}`);
  process.exit(1);
}

await runNewsDiscovery({
  approve: args.includes('--approve'),
  regions: regions.length ? regions : undefined,
});
