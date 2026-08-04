import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("listing_rows")
    .select("normalized_area")
    .eq("normalized_city", "whistler")
    .eq("status", "A");

  if (error) throw error;

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const area = String(row.normalized_area || "").trim();

    if (area) {
      counts.set(area, (counts.get(area) || 0) + 1);
    }
  }

  console.table(
    [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([area, listings]) => ({
        area,
        listings
      }))
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
