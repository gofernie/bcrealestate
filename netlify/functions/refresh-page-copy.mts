// Monthly: keep the "Most current listings ... are in A, B and C." sentence on generated pages in line with live inventory.
import { createClient } from "@supabase/supabase-js";
import { refreshPageCopy } from "../../scripts/refresh-page-copy.mjs";

export default async () => {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("refresh-page-copy: missing Supabase env vars"); return new Response("missing env", { status: 500 }); }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const r = await refreshPageCopy({ sb, write: true });
  console.log("refresh-page-copy", JSON.stringify({ checked: r.checked, matched: r.matched, changed: r.changed, changes: r.changes }));
  return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
};

export const config = { schedule: "17 9 1 * *" };