import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("listing_rows")
    .select("*")
    .eq("normalized_city", "whistler")
    .limit(5);

  if (error) throw error;

  for (const row of data ?? []) {
    console.log(JSON.stringify(row, null, 2));
    console.log("--------------------------------------------------");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
