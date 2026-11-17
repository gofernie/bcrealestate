import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const TEMPLATE_SITE_ID = "5e501142-4f44-4128-bc20-9360fcd49ebc"; // tammygalvin.bc.realestate
const ROOT = "bc.realestate";
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const isMaster = (url: URL) => ["bc.realestate", "localhost", "127.0.0.1"].includes(url.hostname.replace(/\.localhost$/, ".bc.realestate").replace(/^www\./, ""));
const db = () => createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export const POST: APIRoute = async ({ request, url }) => {
  if (!isMaster(url)) return json({ error: "Demos can only be created from the bc.realestate admin." }, 403);
  try {
    const b = await request.json();
    const name = String(b.name || "").trim();
    const slug = String(b.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
    const city = String(b.city || "").trim().toLowerCase();
    if (!name || !slug || !city) return json({ error: "Name, subdomain and main city are required." }, 400);
    if (["www", "admin", "api", "app", "mail", "demo"].includes(slug)) return json({ error: "That subdomain is reserved." }, 400);
    const domain = `${slug}.${ROOT}`;
    const sb = db();

    const { data: taken } = await sb.from("sites").select("id").eq("domain", domain).limit(1);
    if (taken?.length) return json({ error: `${domain} already exists.` }, 409);

    const { data: tpl, error: tErr } = await sb.from("sites").select("*").eq("id", TEMPLATE_SITE_ID).single();
    if (tErr || !tpl) return json({ error: "Template site not found. " + (tErr?.message || "") }, 500);

    const { data: au, error: uErr } = await sb.auth.admin.createUser({ email: `${slug}@demo.bc.realestate`, email_confirm: true, user_metadata: { demo: true, name } });
    if (uErr || !au?.user) return json({ error: "Login account create failed: " + (uErr?.message || "") }, 500);
    const authId = au.user.id;

    const { data: agent, error: aErr } = await sb.from("agents").upsert({ id: authId,
      name,
      email: b.email || null,
      domain,
      title: b.title || "REALTOR\u00AE",
      brokerage: b.brokerage || null,
      phone: b.phone || null,
      photo_url: b.photo_url || null,
    }).select("id").single();
    if (aErr || !agent) { await sb.auth.admin.deleteUser(authId); return json({ error: "Agent insert failed: " + (aErr?.message || "") }, 500); }

    const extras = (Array.isArray(b.extras) ? b.extras : []).map((c: any) => String(c).toLowerCase()).filter((c: string) => c && c !== city);
    const row: any = { ...tpl };
    delete row.id;
    delete row.created_at;
    Object.assign(row, {
      agent_id: agent.id,
      domain,
      city,
      primary_city: city,
      site_name: /\b(realty|real estate|homes|group|properties|team)\b/i.test(name) ? name : `${name} Real Estate`,
      accent_color: /^#[0-9a-f]{6}$/i.test(String(b.accent_color || "")) ? b.accent_color : tpl.accent_color,
      hero_eyebrow: `Curated by ${name}`,
      secondary_markets: extras.map((c: string) => ({ city: c, label: "", imageUrl: "" })),
      agent_intro_background_url: null,
      featured_listing_mls: null,
      featured_listing_images: {},
      hero_image_url: null,
      primary_area: null,
    });

    const { data: site, error: sErr } = await sb.from("sites").insert(row).select("id").single();
    if (sErr || !site) {
      await sb.from("agents").delete().eq("id", agent.id); await sb.auth.admin.deleteUser(authId);
      return json({ error: "Site insert failed: " + (sErr?.message || "") }, 500);
    }
    return json({ ok: true, id: site.id, url: `https://${domain}/${city}/` });
  } catch (e: any) {
    return json({ error: e?.message || "Create failed" }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, url }) => {
  if (!isMaster(url)) return json({ error: "Not allowed here." }, 403);
  try {
    const { id } = await request.json();
    const sb = db();
    const { data: s } = await sb.from("sites").select("id, domain, agent_id").eq("id", id).single();
    if (!s) return json({ error: "Demo not found." }, 404);
    if (!String(s.domain || "").endsWith("." + ROOT)) return json({ error: "Only demo subdomains can be deleted here." }, 400);
    if (s.id === TEMPLATE_SITE_ID) return json({ error: "That's the template demo the others are copied from, so it can't be deleted here." }, 400);
    const { error } = await sb.from("sites").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    if (s.agent_id) {
      const { data: other } = await sb.from("sites").select("id").eq("agent_id", s.agent_id).limit(1);
      if (!other?.length) { await sb.from("agents").delete().eq("id", s.agent_id); const { data: u } = await sb.auth.admin.getUserById(s.agent_id); if (String(u?.user?.email || "").endsWith("@demo.bc.realestate")) await sb.auth.admin.deleteUser(s.agent_id); }
    }
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || "Delete failed" }, 500);
  }
};