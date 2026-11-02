// Runs up to 15 minutes on Netlify. Started by /admin/api/generate-guide; writes the draft to guide_pages.
import { guideJobToken, runGuideJob } from "../../src/lib/guideGenerator";

export default async (req: Request) => {
  const env = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, GUIDE_MODEL: process.env.GUIDE_MODEL,
    PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (req.headers.get("x-guide-token") !== guideJobToken(env)) return new Response("unauthorized", { status: 401 });
  const b: any = await req.json().catch(() => ({}));
  if (!b.id) return new Response("no id", { status: 400 });
  await runGuideJob(env, String(b.id), String(b.notes || ""), String(b.title || ""));
  return new Response("ok");
};