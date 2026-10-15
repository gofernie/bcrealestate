import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await db
  .from("intent_pages")
  .select("*")
  .ilike("city", "victoria")
  .not("area", "is", null)
  .limit(1);

if (error) throw error;
const page = data?.[0];
if (!page) throw new Error("No Victoria area page found.");

console.log("Available fields:", Object.keys(page).join(", "));
console.log(JSON.stringify(
  Object.fromEntries(
    Object.entries(page).filter(([key]) =>
      /city|area|slug|copy|description|intro|heading|body|content/i.test(key)
    )
  ), null, 2
));
