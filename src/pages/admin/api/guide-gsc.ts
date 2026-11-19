import type { APIRoute } from "astro";
import { getAdminUser } from "../../../lib/guideAccess";
import { gscQueries } from "../../../lib/gsc";
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = await getAdminUser(cookies);
  if (!me) return json({ error: "Not allowed" }, 401);
  const b: any = await request.json().catch(() => ({}));
  const place = String(b.place || "").trim(), town = String(b.town || "").trim();
  try {
    let rows = place ? await gscQueries(place) : [];
    if (rows.length < 3 && town && town.toLowerCase() !== place.toLowerCase()) rows = await gscQueries(town);
    return json({ queries: rows.slice(0, 15) });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
};