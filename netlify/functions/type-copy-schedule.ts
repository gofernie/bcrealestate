import type { Config } from "@netlify/functions";
import { listTypePageCities } from "../../src/lib/copy/generateTypeCopy";

// Weekly: Mondays 09:00 UTC (2am Pacific). Queues one background job per city.
export default async () => {
  const origin = process.env.URL || "https://bc.realestate";
  const cities = await listTypePageCities();
  for (const city of cities) {
    await fetch(`${origin}/.netlify/functions/type-copy-background?city=${encodeURIComponent(city)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
  }
  console.log(`Type copy queued for ${cities.length} cities`);
  return new Response(`queued ${cities.length}`);
};

export const config: Config = { schedule: "0 9 * * 1" };
