import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let { data: generic, error } = await supabase
  .from("agents")
  .select("id,name")
  .eq("name", "bc.realestate")
  .maybeSingle();

if (error) throw error;

if (!generic) {
  const created = await supabase
    .from("agents")
    .insert({
      name: "bc.realestate",
      title: "Local Market Guides",
      email: null,
      phone: null,
      brokerage: null,
      legal_name: null,
      credentials: null,
    })
    .select("id,name")
    .single();

  if (created.error) throw created.error;
  generic = created.data;
  console.log("Created generic profile:", generic.name);
} else {
  console.log("Using existing generic profile:", generic.name);
}

const { data, error: updateError } = await supabase
  .from("sites")
  .update({ agent_id: generic.id })
  .eq("domain", "bc.realestate")
  .eq("admin_scope", "platform")
  .in("city", ["victoria", "oak bay"])
  .select("site_name,city");

if (updateError) throw updateError;

console.log("Updated sites:", data);
