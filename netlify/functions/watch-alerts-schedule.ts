import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const STALE_MS = 12 * 60 * 60 * 1000; // not seen for 12h while its city kept refreshing = off market
const STRIKES = 2;                     // must look off-market on 2 runs in a row before texting
const QUIET_START = 21;                // no texts 9pm-8am Pacific
const QUIET_END = 8;

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const slug = (s: unknown) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const safeId = (s: string) => /^[A-Za-z0-9_-]+$/.test(s);

export default async () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  if (hour >= QUIET_START || hour < QUIET_END) {
    return new Response(JSON.stringify({ skipped: "quiet hours", hour }));
  }

  const env = process.env;
  const need = ["PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) {
    console.error("[watch-alerts] missing env", missing);
    return new Response("missing env: " + missing.join(","), { status: 500 });
  }

  const db = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  const sms = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);

  const { data: watches, error } = await db.from("listing_watches").select("*").eq("active", true);
  if (error) {
    console.error("[watch-alerts] load watches", error);
    return new Response("db error", { status: 500 });
  }
  if (!watches?.length) return new Response(JSON.stringify({ checked: 0, sent: 0 }));

  // Load matching listing rows (by MLS number or id), keeping the freshest per listing.
  const ids = [...new Set(watches.map((w: any) => String(w.listing_id)).filter(safeId))];
  const rows = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150).join(",");
    const { data, error: rErr } = await db
      .from("listing_rows")
      .select("id, mls_number, price, status, address, city, market_city, last_seen_at")
      .or(`mls_number.in.(${chunk}),id.in.(${chunk})`);
    if (rErr) {
      console.error("[watch-alerts] load listing_rows", rErr);
      return new Response("db error", { status: 500 });
    }
    for (const r of data || []) {
      for (const k of [r.mls_number, r.id]) {
        if (!k) continue;
        const prev = rows.get(String(k));
        if (!prev || Date.parse(r.last_seen_at || 0) > Date.parse(prev.last_seen_at || 0)) rows.set(String(k), r);
      }
    }
  }

  // Newest last_seen_at per city = when that city's refresh last ran.
  const cityLatest = new Map<string, number>();
  const latestFor = async (r: any) => {
    const col = r.market_city ? "market_city" : "city";
    const val = r.market_city || r.city;
    const key = col + ":" + val;
    if (!cityLatest.has(key)) {
      const { data } = await db
        .from("listing_rows")
        .select("last_seen_at")
        .eq(col, val)
        .not("last_seen_at", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(1);
      cityLatest.set(key, data?.[0]?.last_seen_at ? Date.parse(data[0].last_seen_at) : 0);
    }
    return cityLatest.get(key)!;
  };

  let sent = 0;
  const now = new Date().toISOString();

  for (const w of watches as any[]) {
    const r = rows.get(String(w.listing_id));
    const label = w.address || r?.address || `MLS ${w.listing_id}`;
    const domain = w.site_domain && !/localhost|127\.0\.0\.1/.test(w.site_domain) ? w.site_domain : "";
    const citySlug = slug(r?.market_city || r?.city);
    const cityLink = domain && citySlug ? `https://${domain}/${citySlug}` : "";
    const link = cityLink ? `${cityLink}?listing_id=${encodeURIComponent(w.listing_id)}` : "";

    const update: Record<string, unknown> = { last_checked_at: now };
    let body = "";

    const seen = r?.last_seen_at ? Date.parse(r.last_seen_at) : 0;
    const latest = r ? await latestFor(r) : 0;
    const fresh = !!r && (!seen || !latest || latest - seen < STALE_MS);

    if (fresh) {
      const price = Number(r.price) || 0;
      const oldPrice = Number(w.last_price) || 0;
      if (w.last_status === "off_market") {
        body = `Back on the market: ${label}${price ? ` at ${money(price)}` : ""}.${link ? ` ${link}` : ""}`;
      } else if (price && oldPrice && price < oldPrice) {
        body = `Price drop: ${label} is now ${money(price)} (was ${money(oldPrice)}).${link ? ` ${link}` : ""}`;
      }
      if (price) update.last_price = price;
      update.last_status = r.status || "active";
      update.missing_checks = 0;
    } else if (w.last_status !== "off_market") {
      const strikes = (Number(w.missing_checks) || 0) + 1;
      update.missing_checks = strikes;
      if (strikes >= STRIKES) {
        body = `Update: ${label} is no longer listed for sale (it may have sold).${cityLink ? ` See similar homes: ${cityLink}` : ""}`;
        update.last_status = "off_market";
      }
    }

    if (body) {
      try {
        await sms.messages.create({
          from: env.TWILIO_FROM_NUMBER!,
          to: w.phone,
          body: `${domain ? domain + ": " : ""}${body} Reply STOP to unsubscribe.`,
        });
        update.last_notified_at = now;
        sent++;
      } catch (e) {
        console.error("[watch-alerts] sms failed", w.id, e);
        continue; // leave the row untouched so the next run retries
      }
    }

    const { error: uErr } = await db.from("listing_watches").update(update).eq("id", w.id);
    if (uErr) console.error("[watch-alerts] update failed", w.id, uErr);
  }

  console.log(`[watch-alerts] checked ${watches.length}, sent ${sent}`);
  return new Response(JSON.stringify({ checked: watches.length, sent }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { schedule: "15 */2 * * *" };
