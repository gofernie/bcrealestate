import { generateTypeCopy } from "../../src/lib/copy/generateTypeCopy";

// Regenerates property-type page copy for one city. Called by type-copy-schedule.
export default async (request: Request) => {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const city = String(new URL(request.url).searchParams.get("city") || "").trim().toLowerCase();
  if (!city) return new Response("Missing city", { status: 400 });
  await generateTypeCopy(city, { force: true });
  return new Response("ok");
};
