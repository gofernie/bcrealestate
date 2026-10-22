import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: nanaimo, error: nanaimoError } = await supabase
  .from("sites")
  .select("agent_id")
  .eq("domain", "bc.realestate")
  .eq("city", "nanaimo")
  .eq("admin_scope", "platform")
  .maybeSingle();

if (nanaimoError) throw nanaimoError;
if (!nanaimo?.agent_id) {
  throw new Error("Nanaimo's platform site has no linked agent.");
}

const { data, error } = await supabase
  .from("sites")
  .update({ agent_id: nanaimo.agent_id })
  .eq("domain", "bc.realestate")
  .eq("admin_scope", "platform")
  .in("city", ["victoria", "oak bay"])
  .select("site_name,city");

if (error) throw error;

console.log("Linked to Nanaimo's agent:", data);
