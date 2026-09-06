import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getAgentForSite(site: any) {
  const agentId = String(site?.agent_id || "").trim();

  if (!agentId) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    console.error("Agent branding lookup failed:", error);
    return null;
  }

  return data;
}