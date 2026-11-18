// Who can touch which guides. Platform admins see everything; agents only their own sites (sites.agent_id = user.id).
import { createSupabaseServerClient } from "./supabaseServer";

const PLATFORM_ADMIN_IDS = new Set([
  "e6ef2640-eeff-4d57-8df2-c4c5f820a182",
  "0282af0e-cef9-4f8e-a263-d456c6c26b1b",
]);
const NIL = "00000000-0000-0000-0000-000000000000";

export type AdminMe = { user: { id: string }; isPlatformAdmin: boolean };

export async function getAdminUser(cookies: any): Promise<AdminMe | null> {
  try {
    const auth = createSupabaseServerClient(cookies);
    const { data: { user } } = await auth.auth.getUser();
    return user ? { user, isPlatformAdmin: PLATFORM_ADMIN_IDS.has(user.id) } : null;
  } catch { return null; }
}

/** null = all sites (platform admin); otherwise the site ids this agent owns ([NIL] if none, so .in() matches nothing). */
export async function allowedSiteIds(db: any, me: AdminMe): Promise<string[] | null> {
  if (me.isPlatformAdmin) return null;
  const { data } = await db.from("sites").select("id").eq("agent_id", me.user.id);
  const ids = (data || []).map((r: any) => r.id);
  return ids.length ? ids : [NIL];
}

export async function canEditGuide(db: any, me: AdminMe, guideId: string): Promise<boolean> {
  if (!guideId) return false;
  if (me.isPlatformAdmin) return true;
  const { data: g } = await db.from("guide_pages").select("site_id").eq("id", guideId).maybeSingle();
  if (!g?.site_id) return false;
  const { data: s } = await db.from("sites").select("agent_id").eq("id", g.site_id).maybeSingle();
  return !!s && s.agent_id === me.user.id;
}