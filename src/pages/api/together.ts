import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import twilio from "twilio";

export const prerender = false;

const db = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const clean = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
const phoneOf = (raw: unknown) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
};
const memberOf = (v: unknown) => {
  const s = clean(v, 64);
  return /^[A-Za-z0-9-]{8,64}$/.test(s) ? s : null;
};
const priceOf = (v: unknown) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || null;
const pathOf = (v: unknown) => {
  const p = clean(v, 300) || "/";
  return /^\/[A-Za-z0-9\/_-]*$/.test(p) ? p : "/";
};
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const DECISIONS = ["love", "maybe", "pass"];
const brandFor = (host: string) => {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  if (h === "bc.realestate") return "BC Real Estate";
  return h.split(/[.-]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
};

async function sms(to: string | null | undefined, body: string) {
  if (!to) return;
  try {
    await twilio(import.meta.env.TWILIO_ACCOUNT_SID, import.meta.env.TWILIO_AUTH_TOKEN).messages.create({
      from: import.meta.env.TWILIO_FROM_NUMBER,
      to,
      body,
    });
  } catch (e) {
    console.error("[together] sms failed", e);
  }
}

function kindOf(x?: string, y?: string) {
  if (x === "love" && y === "love") return "match";
  if ((x === "love" || x === "maybe") && (y === "love" || y === "maybe")) return "maybe";
  return null;
}

function view(pair: any, member: string) {
  const side = pair.a_member === member ? "a" : "b";
  return {
    code: pair.code,
    status: pair.status,
    side,
    partner_name: (side === "a" ? pair.b_name : pair.a_name) || "your partner",
  };
}

async function pairFor(code: unknown, member: string) {
  const c = clean(code, 20);
  if (!c) return null;
  const { data } = await db.from("search_pairs").select("*").eq("code", c).neq("status", "ended").maybeSingle();
  if (!data || (data.a_member !== member && data.b_member !== member)) return null;
  return data;
}

async function seed(pairId: string, member: string, list: unknown, origin: string) {
  if (!Array.isArray(list)) return;
  const now = new Date().toISOString();
  const rows = list
    .slice(0, 300)
    .map((r: any) => {
      const listingId = clean(r?.listing_id, 40);
      return {
        pair_id: pairId,
        member,
        listing_id: listingId,
        decision: String(r?.decision || ""),
        address: clean(r?.address) || null,
        price: priceOf(r?.price),
        listing_url: listingId ? `${origin}${pathOf(r?.page_path)}?listing_id=${encodeURIComponent(listingId)}` : null,
        updated_at: now,
      };
    })
    .filter((r) => r.listing_id && DECISIONS.includes(r.decision));
  if (rows.length) await db.from("pair_reactions").upsert(rows, { onConflict: "pair_id,member,listing_id" });
}

async function recompute(pair: any) {
  if (!pair.a_member || !pair.b_member) return 0;
  const { data: rows } = await db.from("pair_reactions").select("*").eq("pair_id", pair.id);
  const A = new Map<string, any>(), B = new Map<string, any>();
  for (const r of rows || []) {
    if (r.member === pair.a_member) A.set(r.listing_id, r);
    else if (r.member === pair.b_member) B.set(r.listing_id, r);
  }
  const ups: any[] = [];
  for (const [id, ra] of A) {
    const rb = B.get(id);
    const kind = rb ? kindOf(ra.decision, rb.decision) : null;
    if (kind) {
      ups.push({
        pair_id: pair.id,
        listing_id: id,
        kind,
        address: ra.address || rb.address,
        price: ra.price || rb.price,
        listing_url: ra.listing_url || rb.listing_url,
      });
    }
  }
  if (ups.length) await db.from("pair_matches").upsert(ups, { onConflict: "pair_id,listing_id" });
  return ups.filter((u) => u.kind === "match").length;
}

export const POST: APIRoute = async ({ request, url }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  const action = clean(body.action, 20);
  const member = memberOf(body.member);
  if (!member) return json({ ok: false, error: "Missing member." }, 400);
  const brand = brandFor(url.hostname);

  // ---- Invite a partner ----
  if (action === "invite") {
    const name = clean(body.name, 40);
    const partnerName = clean(body.partner_name, 40);
    const me = phoneOf(body.my_phone);
    const them = phoneOf(body.partner_phone);
    if (!name) return json({ ok: false, error: "Add your first name." }, 400);
    if (!me || !them) return json({ ok: false, error: "Enter both 10-digit mobile numbers." }, 400);
    if (me === them) return json({ ok: false, error: "Use their number, not yours." }, 400);

    const listingId = clean(body.listing_id, 40);
    const address = clean(body.address);
    await db.from("search_pairs").update({ status: "ended" }).eq("a_member", member).neq("status", "ended");

    const code = randomBytes(5).toString("hex");
    const { data: pair, error } = await db
      .from("search_pairs")
      .insert({
        code,
        site_domain: url.hostname,
        a_member: member,
        a_name: name,
        a_phone: me,
        b_name: partnerName || null,
        b_phone: them,
        first_listing_id: listingId || null,
        first_address: address || null,
        status: "invited",
      })
      .select()
      .single();
    if (error || !pair) {
      console.error("[together] invite insert failed", error);
      return json({ ok: false, error: "Couldn't send that. Try again." }, 500);
    }
    await seed(pair.id, member, body.reactions, url.origin);

    const link =
      `${url.origin}${pathOf(body.page_path)}?` +
      (listingId ? `listing_id=${encodeURIComponent(listingId)}&` : "") +
      `together=${code}`;
    await sms(
      them,
      `${name} wants to find a home with you on ${brand} 🏡\n` +
        (address ? `Start with ${address}: rate it and see where you match.\n` : "Rate homes and see where you match.\n") +
        `${link}\nReply STOP to opt out.`
    );
    return json({ ok: true, pair: view(pair, member) });
  }

  // ---- Partner opens the invite link ----
  if (action === "join") {
    const code = clean(body.code, 20);
    const { data: pair } = await db.from("search_pairs").select("*").eq("code", code).neq("status", "ended").maybeSingle();
    if (!pair) return json({ ok: false, error: "This invite has expired." }, 404);
    if (pair.a_member === member) return json({ ok: true, pair: view(pair, member), matches: 0 });

    const firstJoin = !pair.b_member;
    const { data: updated } = await db
      .from("search_pairs")
      .update({ b_member: member, status: "linked", linked_at: pair.linked_at || new Date().toISOString() })
      .eq("id", pair.id)
      .select()
      .single();
    const linked = updated || { ...pair, b_member: member, status: "linked" };
    await seed(pair.id, member, body.reactions, url.origin);
    const matches = await recompute(linked);

    if (firstJoin) {
      await sms(
        pair.a_phone,
        `${pair.b_name || "Your partner"} joined your home search on ${brand}. When you both love a home, we'll text you both. Reply STOP to opt out.`
      );
    }
    return json({ ok: true, pair: view(linked, member), matches });
  }

  // ---- A reaction (love / maybe / pass) ----
  if (action === "react") {
    const pair = await pairFor(body.code, member);
    if (!pair) return json({ ok: false, error: "Not linked." }, 404);
    const listingId = clean(body.listing_id, 40);
    const decision = DECISIONS.includes(body.decision) ? body.decision : null;
    if (!listingId || !decision) return json({ ok: false, error: "Missing listing." }, 400);

    const address = clean(body.address) || null;
    const price = priceOf(body.price);
    const listingUrl = `${url.origin}${pathOf(body.page_path)}?listing_id=${encodeURIComponent(listingId)}`;

    await db.from("pair_reactions").upsert(
      { pair_id: pair.id, member, listing_id: listingId, decision, address, price, listing_url: listingUrl, updated_at: new Date().toISOString() },
      { onConflict: "pair_id,member,listing_id" }
    );

    const other = member === pair.a_member ? pair.b_member : pair.a_member;
    if (!other) return json({ ok: true, kind: null });

    const { data: theirs } = await db
      .from("pair_reactions")
      .select("decision")
      .eq("pair_id", pair.id)
      .eq("member", other)
      .eq("listing_id", listingId)
      .maybeSingle();
    const kind = kindOf(decision, theirs?.decision);
    const { data: existing } = await db
      .from("pair_matches")
      .select("kind")
      .eq("pair_id", pair.id)
      .eq("listing_id", listingId)
      .maybeSingle();

    if (!kind) {
      if (existing) await db.from("pair_matches").delete().eq("pair_id", pair.id).eq("listing_id", listingId);
      return json({ ok: true, kind: null });
    }

    await db.from("pair_matches").upsert(
      { pair_id: pair.id, listing_id: listingId, kind, address, price, listing_url: listingUrl },
      { onConflict: "pair_id,listing_id" }
    );

    const isNewMatch = kind === "match" && existing?.kind !== "match";
    if (isNewMatch) {
      const label = address || "a home";
      const msg = `❤️ It's a match! You both loved ${label}${price ? ` (${money(price)})` : ""}.\n${listingUrl}\nBook a showing from the listing page. Reply STOP to opt out.`;
      await sms(pair.a_phone, msg);
      await sms(pair.b_phone, msg);
      const agent = import.meta.env.AGENT_ALERT_PHONE;
      if (agent) {
        await sms(
          agent,
          `Couple match on ${url.hostname}: ${pair.a_name || "Buyer"} + ${pair.b_name || "partner"} both loved ${label}${price ? ` (${money(price)})` : ""}.\n${pair.a_phone} / ${pair.b_phone}\n${listingUrl}`
        );
      }
      await db.from("pair_matches").update({ notified_at: new Date().toISOString() }).eq("pair_id", pair.id).eq("listing_id", listingId);
    }
    return json({ ok: true, kind, isNewMatch });
  }

  // ---- Matches list ----
  if (action === "status") {
    const pair = await pairFor(body.code, member);
    if (!pair) return json({ ok: false, error: "Not linked." }, 404);
    const { data: matches } = await db
      .from("pair_matches")
      .select("listing_id, kind, address, price, listing_url, created_at")
      .eq("pair_id", pair.id)
      .order("created_at", { ascending: false });
    return json({ ok: true, pair: view(pair, member), matches: matches || [] });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
};
