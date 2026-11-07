import { createClient } from "@supabase/supabase-js";

// Runs daily at 15:15 UTC (8:15am Fernie, MST). Silent unless something is wrong.
export const config = { schedule: "15 15 * * *" };

const env = (k: string) => String(process.env[k] || "").trim();
const PROBE_SESSION = "00000000-0000-4000-8000-000000000001";

async function sendSms(text: string) {
  const sid = env("TWILIO_ACCOUNT_SID"), token = env("TWILIO_AUTH_TOKEN"), from = env("TWILIO_FROM_NUMBER"), to = env("AGENT_PHONE_NUMBER");
  if (!sid || !token || !from || !to) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: from, To: to, Body: text.slice(0, 1500) }).toString(),
    });
  } catch (e) { console.error("health-check sms failed", e); }
}

async function sendEmail(subject: string, text: string) {
  const key = env("RESEND_API_KEY");
  const to = env("ALERT_EMAIL") || env("DEFAULT_AGENT_EMAIL") || "chris@crump.ca";
  const from = env("LEAD_EMAIL_FROM") || "Locus Leads <onboarding@resend.dev>";
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
  } catch (e) { console.error("health-check email failed", e); }
}

export default async () => {
  const supabase = createClient(env("PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const site = env("HEALTH_CHECK_URL") || "https://bc.realestate";
  const problems: string[] = [];

  // 1. Test save, exactly like a buyer's browser
  try {
    const r = await fetch(`${site}/api/intent-listing-reaction`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "locus-health-check" },
      body: JSON.stringify({
        session_id: PROBE_SESSION, listing_id: "health-probe", mls_number: "HEALTH",
        address: "Health check (auto-deleted)", price: "1", city: "nanaimo", slug: "homes", decision: "viewed",
      }),
    });
    if (!r.ok) problems.push(`Saving a buyer reaction FAILED (${r.status}): ${(await r.text()).slice(0, 160)}`);
  } catch (e: any) {
    problems.push(`Couldn't reach the reaction endpoint: ${e?.message || e}`);
  } finally {
    await supabase.from("intent_listing_reactions").delete().eq("session_id", PROBE_SESSION);
    await supabase.from("intent_sessions").delete().eq("session_id", PROBE_SESSION);
  }

  // 2. Activity counts
  const since = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  const count = async (table: string, col: string, h: number) => {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).gte(col, since(h));
    return count ?? 0;
  };
  const [r24, s24, l24, r72, s72] = await Promise.all([
    count("intent_listing_reactions", "updated_at", 24),
    count("intent_sessions", "updated_at", 24),
    count("intent_leads", "created_at", 24),
    count("intent_listing_reactions", "updated_at", 72),
    count("intent_sessions", "updated_at", 72),
  ]);
  if (r72 === 0 && s72 === 0) problems.push("No buyer reactions or sessions in 3 days. The sites may just be quiet, or tracking on the page may be broken.");

  // 3. Alert only when something is wrong
  if (problems.length) {
    const text = ["Locus health check", ...problems, `Last 24h: ${r24} reactions, ${s24} sessions, ${l24} leads.`].join("\n");
    await sendSms(text);
    await sendEmail("Locus health check: needs a look", text);
  }

  return new Response(JSON.stringify({ ok: !problems.length, problems, last24h: { reactions: r24, sessions: s24, leads: l24 } }), {
    headers: { "content-type": "application/json" },
  });
};