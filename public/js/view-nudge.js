(() => {
  if (window.__viewNudge) return; window.__viewNudge = true;
  if (location.pathname.startsWith("/admin")) return;
  const KEY = "locus:nudge5:v1", SKEY = "locus:nudge5:shown", NEED = 5, DAY = 864e5;
  const test = new URLSearchParams(location.search).has("nudgetest");
  const ls = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
  };
  const shownThisVisit = () => { try { return sessionStorage.getItem(SKEY) === "1"; } catch { return false; } };
  const markShown = () => { try { sessionStorage.setItem(SKEY, "1"); } catch {} };
  const hasSaved = () => { try { const a = JSON.parse(localStorage.getItem("locus:buyer-saved-searches:v1") || "[]"); return Array.isArray(a) && a.length > 0; } catch { return false; } };
  const blocked = () => {
    const s = ls.get();
    if (s.done) return true;
    if (s.dismissedAt && Date.now() - s.dismissedAt < 7 * DAY) return true;
    return shownThisVisit() || hasSaved();
  };
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v) => { const n = Number(String(v || "").replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? n : 0; };
  const pick = (d, ...keys) => { for (const k of keys) { const v = d && d[k]; if (v && String(v).trim()) return String(v).trim(); } return ""; };
  const NONCITY = ["explore", "listings", "shortlists", "my-searches", ""];
  const pathCity = () => { const s = location.pathname.split("/").filter(Boolean)[0] || ""; return NONCITY.includes(s) ? "" : s; };
  const slugify = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Mark done if they use Watch or Search together
  document.addEventListener("submit", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.id === "watch-home-form" || t.id === "together-form" || t.closest("#watch-sheet")) { const s = ls.get(); s.done = true; ls.set(s); }
  }, true);

  const findCard = (id) => {
    if (!id) return null;
    const s = CSS.escape(id);
    return document.querySelector(`[data-listing-id="${s}"],[data-card-id="${s}"],[data-mls="${s}"]`);
  };
  const readListing = () => {
    const pid = (location.pathname.match(/\/listing\/([^/?#]+)/) || [])[1] || "";
    const a1 = window.__activeIntentCard; const ad = (a1 && a1.dataset) || {};
    const curAddr = (document.getElementById("sheet-address")?.textContent || "").trim(); const c2 = (curAddr && [...document.querySelectorAll("[data-address]")].find((x) => (x.dataset.address || "").trim() === curAddr)) || findCard(pick(ad, "listingId", "cardId", "mls")) || findCard(pid); const d = { ...((c2 && c2.dataset) || {}) };
    for (const [k, v] of Object.entries(ad)) if (v && String(v).trim() && !d[k]) d[k] = v;
    const a = document.getElementById("sheet-address");
    const addr = (a?.textContent || "").trim();
    const id = pick(d, "listingId", "cardId", "mls") || pid || addr;
    if (!id) return null;
    let beds = parseInt(pick(d, "beds"), 10) || 0;
    if (!beds && a) {
      let el = a;
      for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
        const m = (el.textContent || "").match(/(\d+)\s*(?:bd|bed)/i);
        if (m) { beds = +m[1]; break; }
      }
    }
    return {
      id,
      price: num(pick(d, "price")) || num(document.getElementById("sheet-price")?.textContent),
      beds,
      area: pick(d, "area"),
      type: pick(d, "type", "propertyType"),
      city: pathCity() || slugify(pick(d, "city")),
    };
  };
  let lastAddr = "", obsEl = null, mo = null, pending = false;
  const onChange = () => {
    const addr = (document.getElementById("sheet-address")?.textContent || "").trim();
    if (!addr || addr === lastAddr) return;
    lastAddr = addr;
    const r = readListing(); if (!r) return;
    const s = ls.get(); s.seen = Array.isArray(s.seen) ? s.seen : [];
    if (!s.seen.some((x) => x.id === r.id)) { s.seen.push(r); s.seen = s.seen.slice(-20); ls.set(s); }
    if (s.seen.length >= NEED && !blocked()) pending = true;
  };

  const sheetOpen = () => {
    const ws = document.getElementById("watch-sheet");
    if (ws && ws.classList.contains("is-open")) return true;
    if (document.body.style.overflow === "hidden" || document.documentElement.style.overflow === "hidden") return true;
    const el = document.getElementById("sheet-address");
    if (!el || !el.getClientRects().length) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const mode = (arr) => { const m = new Map(); arr.filter(Boolean).forEach((v) => m.set(v, (m.get(v) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const money = (n) => n >= 1e6 ? "$" + Math.round(n / 5e4) / 20 + "M" : "$" + Math.round(n / 1e3) + "k";

  const pattern = () => {
    const seen = (ls.get().seen || []).slice(-10);
    const prices = seen.map((x) => x.price).filter(Boolean).sort((a, b) => a - b);
    const lo0 = prices[0] || 0, hi0 = prices[prices.length - 1] || 0;
    const priceTight = prices.length >= 4 && lo0 > 0 && hi0 / lo0 <= 1.6;
    const bt = mode(seen.map((x) => x.beds))[0]; const bedsHit = bt && bt[1] >= 3 ? bt[0] : 0;
    const am = mode(seen.map((x) => x.area));
    const areasHit = am[0] && am[0][1] >= 3 ? am.filter((e) => e[1] >= 2).slice(0, 2).map((e) => e[0]) : [];
    const tt = mode(seen.map((x) => x.type))[0]; const typeHit = tt && tt[1] >= 4 ? tt[0] : "";
    const ct = mode(seen.map((x) => x.city))[0]; const city = pathCity() || (ct ? ct[0] : "");
    const cityName = city ? city.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "";
    const loHit = priceTight ? Math.floor(lo0 / 25000) * 25000 : 0;
    const hiHit = priceTight ? Math.ceil(hi0 / 25000) * 25000 : 0;
    const parts = [bedsHit ? bedsHit + "+ bed" : "", loHit && hiHit ? money(loHit) + "\u2013" + money(hiHit) : "", areasHit.join(" & ")].filter(Boolean);
    const strong = parts.length >= 2;
    const lo = strong ? loHit : 0, hi = strong ? hiHit : 0, beds = strong ? bedsHit : 0;
    const areas = strong ? areasHit : [], type = strong ? typeHit : "";
    const label = strong ? parts.join(" \u00B7 ") : "";
    const q = new URLSearchParams();
    areas.forEach((a) => q.append("area", String(a).toLowerCase()));
    const t = String(type || "").toLowerCase();
    const typeSlug = /condo|apartment/.test(t) ? "condo" : /town/.test(t) ? "townhouse" : "";
    if (typeSlug) q.set("type", typeSlug);
    const opts = [...(document.querySelector('select[name="maxPrice"]')?.options || [])].map((o) => Number(o.value)).filter((n) => n > 0).sort((a, b) => a - b);
    const band = hi ? (opts.find((n) => n >= Math.ceil(hi / 1000)) || 0) : 0;
    if (band) q.set("maxPrice", String(band));
    if (beds) q.set("beds", String(beds));
    const url = location.origin + "/" + (city || "") + (q.toString() ? "?" + q.toString() : "") + "#homepage-listings";
    const mk = [...document.querySelectorAll("a[href]")].find((a) => /market intel/i.test(a.textContent || ""));
    return { lo, hi, beds, areas, type, city, cityName, label, strong, url, market: mk ? mk.href : "" };
  };
  const css = `
    #view-nudge{position:fixed;right:20px;bottom:20px;width:360px;max-width:calc(100vw - 32px);z-index:99980;background:#fff;color:#10202c;border-radius:10px;box-shadow:0 18px 44px rgba(0,0,0,.22);padding:18px 18px 14px;font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;transform:translateY(calc(100% + 40px));transition:transform .35s ease;}
    #view-nudge.is-in{transform:none} #view-nudge button.vn-go{width:100%;border:0;cursor:pointer;font:inherit;font-weight:700} #view-nudge [hidden]{display:none!important}
    #view-nudge .vn-x{position:absolute;top:8px;right:10px;background:none;border:0;font-size:24px;line-height:1;color:#5b6670;padding:4px;cursor:pointer}
    #view-nudge .vn-t{font-weight:700;font-size:17px;padding-right:26px;margin:0 0 4px}
    #view-nudge .vn-p{margin:0 0 14px;color:#3b4650}
    #view-nudge .vn-p b{color:#10202c}
    #view-nudge .vn-go{display:block;text-align:center;padding:13px;border-radius:4px;background:var(--accent,#2f6f73);color:#fff;font-weight:700;text-decoration:none}
    #view-nudge .vn-txt{display:block;margin:12px auto 0;background:none;border:0;color:var(--accent,#2f6f73);font-weight:600;font-size:14px;cursor:pointer;text-decoration:underline}
    #view-nudge form{display:grid;gap:8px;margin-top:12px}
    #view-nudge input{font-size:16px;padding:12px;border:1px solid rgba(16,32,44,.25);border-radius:4px;width:100%;box-sizing:border-box}
    #view-nudge .vn-send{padding:12px;border:0;border-radius:4px;background:#10202c;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
    #view-nudge .vn-small{font-size:12px;color:#5b6670;margin:0}
    #view-nudge .vn-no{display:block;margin:10px auto 0;background:none;border:0;color:#5b6670;font-size:13px;cursor:pointer}
    @media (max-width:640px){#view-nudge{left:0;right:0;bottom:0;width:auto;max-width:none;border-radius:14px 14px 0 0;padding-bottom:calc(14px + env(safe-area-inset-bottom))}}`;

  const hide = (el) => { el.classList.remove("is-in"); setTimeout(() => el.remove(), 400); };

  const show = () => {
    if (document.getElementById("view-nudge")) return;
    if (!document.getElementById("view-nudge-css")) document.head.insertAdjacentHTML("beforeend", `<style id="view-nudge-css">${css}</style>`);
    const p = pattern();
    markShown();
    const el = document.createElement("div");
    el.id = "view-nudge"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "New homes like these");
    el.innerHTML = p.strong ? `
      <button class="vn-x" type="button" aria-label="Close">\u00D7</button>
      <p class="vn-t">Spotted a pattern \u{1F440}</p>
      <p class="vn-p">The homes you've looked at are mostly <b>${esc(p.label)}</b></p>
      <button class="vn-go" type="button" data-go="${esc(p.url)}">Show me more like these</button>
      <button class="vn-txt" type="button">Text me new ones that match</button>` : `
      <button class="vn-x" type="button" aria-label="Close">\u00D7</button>
      <p class="vn-t">Still looking around${p.cityName ? " " + esc(p.cityName) : ""}?</p>
      <p class="vn-p">No rush. Here's what the market's doing right now: prices, new listings and what's selling.</p>
      ${p.market ? `<a class="vn-go" href="${esc(p.market)}">See the ${esc(p.cityName || "local")} market</a>` : ""}
      <button class="vn-txt" type="button">Text me new ${esc(p.cityName)} listings</button>`;
    el.insertAdjacentHTML("beforeend", `
      <form hidden novalidate>
        <input type="tel" inputmode="tel" autocomplete="tel" placeholder="Mobile number" aria-label="Mobile number">
        <button class="vn-send" type="submit">${p.strong ? "Send me matches" : "Send me new listings"}</button>
        <p class="vn-small">No calls. Reply STOP anytime.</p>
        <p class="vn-small vn-msg" aria-live="polite"></p>
      </form>
      <button class="vn-no" type="button">Not now</button>`);
    document.body.appendChild(el);
    el.querySelector("[data-go]")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); location.assign(e.currentTarget.dataset.go); });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));

    const dismiss = () => { const s = ls.get(); s.dismissedAt = Date.now(); s.seen = []; ls.set(s); hide(el); };
    el.querySelector(".vn-x").addEventListener("click", dismiss);
    el.querySelector(".vn-no").addEventListener("click", dismiss);
    const form = el.querySelector("form");
    el.querySelector(".vn-txt").addEventListener("click", (e) => { e.currentTarget.hidden = true; form.hidden = false; form.querySelector("input").focus(); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input"), btn = form.querySelector(".vn-send"), msg = form.querySelector(".vn-msg");
      const phone = input.value.trim();
      if (phone.replace(/\D/g, "").length < 10) { msg.textContent = "Please enter a 10-digit mobile number."; return; }
      btn.disabled = true; btn.textContent = "\u2026";
      try {
        const res = await fetch("/api/intent-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "", email: "", phone,
            city: p.city, slug: "",
            source: "view_nudge",
            criteria: { areaBufferKm: 0, url: p.url, area: p.areas, propertyType: p.type, price: "", minPrice: p.lo || "", maxPrice: p.hi || "", beds: p.beds || "" },
            search_name: p.strong ? "New matches: " + p.label : "New " + (p.cityName || "") + " listings",
            message: "View nudge after " + NEED + " homes: " + (p.label || "(no clear pattern)") + "\nSearch URL: " + p.url,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const s = ls.get(); s.done = true; ls.set(s);
        el.innerHTML = `<p class="vn-t">Done \u2713</p><p class="vn-p" style="margin:0">You'll get a text when new ones list.</p>`;
        setTimeout(() => hide(el), 3500);
      } catch {
        msg.textContent = "Couldn't save that. Try again.";
        btn.disabled = false; btn.textContent = "Send me matches";
      }
    });
  };

  setInterval(() => {
    const el = document.getElementById("sheet-address");
    if (el && el !== obsEl) {
      if (mo) mo.disconnect();
      obsEl = el; mo = new MutationObserver(onChange);
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    }
    try { onChange(); } catch {}
    if (pending && !sheetOpen()) { pending = false; if (!blocked()) show(); }
  }, 700);

  if (test) setTimeout(show, 800);
})();