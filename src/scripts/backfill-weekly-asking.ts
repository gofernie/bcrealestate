import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FROM = process.argv[2] || "2024-10-06";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(p_day: string, p_backfill: boolean) {
  for (let t = 1; t <= 5; t++) {
    const { error } = await supabase.rpc("compute_board_asking", { p_day, p_backfill });
    if (!error) return;
    console.warn(`${p_day} failed, retry ${t}/5: ${error.message}`);
    await sleep(4000 * t);
  }
  throw new Error(`${p_day} failed after retries`);
}

async function main() {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let d = new Date(FROM + "T00:00:00Z"); d < today; d.setUTCDate(d.getUTCDate() + 7)) days.push(d.toISOString().slice(0, 10));
  for (let i = 0; i < days.length; i++) {
    await call(days[i], true);
    if (i % 10 === 0 || i === days.length - 1) console.log(`${days[i]}  (${i + 1}/${days.length})`);
    await sleep(1500);
  }
  await call(today.toISOString().slice(0, 10), false);
  const { error } = await supabase.rpc("build_region_rollups", { p_from: FROM });
  if (error) throw error;
  console.log("Done - weekly history, today, and region rollups rebuilt");
}
main().catch((e) => { console.error(e); process.exit(1); });