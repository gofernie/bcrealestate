import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genericEmail = "no-reply@bc.realestate";
const genericName = "bc.realestate";

const { data: usersData, error: usersError } =
  await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

if (usersError) throw usersError;

let genericUser = (usersData.users || []).find(
  (user) => String(user.email || "").toLowerCase() === genericEmail
);

if (!genericUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: genericEmail,
    password: randomUUID(),
    email_confirm: true,
  });

  if (error) throw error;
  genericUser = data.user;
  console.log("Created internal generic account.");
}

const { error: agentError } = await supabase
  .from("agents")
  .upsert(
    {
      id: genericUser.id,
      name: genericName,
      credentials: "Local Market Guides",
      email: null,
      phone: null,
      brokerage: null,
      legal_name: null,
      brokerage_logo_url: null,
    },
    { onConflict: "id" }
  );

if (agentError) throw agentError;

const { data: sites, error: sitesError } = await supabase
  .from("sites")
  .select("id, city, site_name")
  .eq("domain", "bc.realestate")
  .in("city", ["victoria", "oak bay"]);

if (sitesError) throw sitesError;

if (!sites?.length) {
  throw new Error("Could not find the Victoria or Oak Bay bc.realestate site records.");
}

const { error: updateError } = await supabase
  .from("sites")
  .update({ agent_id: genericUser.id })
  .in("id", sites.map((site) => site.id));

if (updateError) throw updateError;

console.table(
  sites.map((site) => ({
    city: site.city,
    site: site.site_name,
    agent: genericName,
  }))
);

