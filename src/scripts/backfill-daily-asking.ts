import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DAYS = Number(process.argv[2] || 60);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = DAYS; i >= 1; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    let error: any = null;
    for (let t = 1; t <= 5; t++) {
      ({ error } = await supabase.rpc("compute_board_asking", { p_day: d }));
      if (!error) break;
      console.warn(`${d} failed, retry ${t}/5: ${error.message}`);
      await sleep(3000 * t);
    }
    if (error) throw error;
    console.log(`${d} done`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });