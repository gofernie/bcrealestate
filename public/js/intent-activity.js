(() => {
  if (window.__intentActivityInit) return;
  window.__intentActivityInit = true;

  const ENDPOINT = "/api/intent-event";
  const SID_KEY = "intent_activity_sid";
  const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const nativeFetch = window.fetch.bind(window);
  const $ = (id) => document.getElementById(id);

  // ---- intent session id ----
  let sid = null;
  try { sid = sessionStorage.getItem(SID_KEY); } catch {}

  function remember(value) {
    const v = String(value || "").trim();
    if (!v) return;
    sid = v;
    try { sessionStorage.setItem(SID_KEY, v); } catch {}
  }

  // Learn the real session id from the site's own /api/intent-* calls.
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input && input.url) || "";
      if (url.indexOf("/api/intent") !== -1 && url.indexOf(ENDPOINT) === -1 && init && typeof init.body === "string") {
        const b = JSON.parse(init.body);
        if (b && b.session_id) remember(b.session_id);
      }
    } catch {}
    return nativeFetch(input, init);
  };

  function scanStorage() {
    for (const store of [localStorage, sessionStorage]) {
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k || k === SID_KEY || !/session/i.test(k)) continue;
          let v = store.getItem(k) || "";
          try {
            const p = JSON.parse(v);
            if (typeof p === "string") v = p;
            else if (p && p.session_id) v = p.session_id;
          } catch {}
          v = String(v).trim();
          if (UUIDISH.test(v)) return v;
        }
      } catch {}
    }
    return null;
  }

  function getSid() {
    if (!sid) { const s = scanStorage(); if (s) remember(s); }
    return sid;
  }

  // ---- queue ----
  let queue = [];

  function push(event, listingId, value, meta) {
    queue.push({ event, listing_id: listingId || null, value: value ?? null, meta: meta || {} });
    if (queue.length > 100) queue = queue.slice(-100);
    if (queue.length >= 12) flush(false);
  }

  function flush(beacon) {
    const s = getSid();
    if (!s || !queue.length) return;
    const body = JSON.stringify({ session_id: s, host: location.hostname, path: location.pathname, events: queue });
    queue = [];
    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {}
    nativeFetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  // ---- current listing ----
  const currentId = () => {
    try { return typeof window.__modalListingId === "function" ? String(window.__modalListingId() || "") : ""; }
    catch { return ""; }
  };

  let cur = null;

  function pause() { if (cur && cur.since) { cur.acc += Date.now() - cur.since; cur.since = null; } }
  function resume() { if (cur && !cur.since && !document.hidden) cur.since = Date.now(); }

  function checkpoint() {
    if (!cur) return;
    pause();
    const sec = Math.round(cur.acc / 1000);
    if (sec >= 2) { push("dwell", cur.id, Math.min(sec, 1800)); cur.acc = 0; }
    if (cur.photos.size && cur.photos.size !== cur.sentPhotos) {
      push("photos", cur.id, cur.photos.size, { total: cur.total });
      cur.sentPhotos = cur.photos.size;
    }
    resume();
  }

  function readPhoto() {
    if (!cur) return;
    const m = ($("sheet-photo-count")?.textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return;
    cur.photos.add(Number(m[1]));
    cur.total = Number(m[2]);
  }

  function startListing(id) {
    cur = { id, acc: 0, since: document.hidden ? null : Date.now(), photos: new Set(), total: 0, sentPhotos: 0 };
    push("listing_open", id);
    readPhoto();
  }

  function endListing() {
    if (!cur) return;
    checkpoint();
    cur = null;
    flush(false);
  }

  function sheetOpen() {
    const s = $("preview-sheet");
    return !!s && (s.classList.contains("open") || s.getAttribute("aria-hidden") === "false");
  }

  function sync() {
    const open = sheetOpen();
    if (!open) { if (cur) endListing(); return; }
    const id = currentId();
    if (!id) return;
    if (!cur) startListing(id);
    else if (cur.id !== id) { endListing(); startListing(id); }
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; sync(); readPhoto(); });
  }

  // ---- clicks ----
  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const hit = (sel) => t.closest(sel);
    const id = (cur && cur.id) || currentId();

    if (hit("#sheet-floorplan-btn, #mobile-media-floorplan")) push("floorplan_open", id);
    else if (hit("#sheet-floorplan-download-btn")) push("floorplan_download", id);
    else if (hit("#sheet-brochure-btn")) push("brochure_download", id);
    else if (hit("#sheet-map-btn, #mobile-media-map")) push("map_open", id);
    else if (hit("#together-btn")) push("partner_open", id);
    else if (hit("#watch-home-btn")) push("watch_click", id);
    else if (hit("#ask-question-btn")) push("ask_click", id);
    else if (hit("#book-showing-btn")) push("book_click", id);
    else if (hit("#sheet-share-btn, #sheet-photo-share-btn")) push("share_click", id);
    else {
      const end = hit("[data-end-action]");
      if (end) push("search_target", null, null, {
        action: end.getAttribute("data-end-action"),
        label: (end.textContent || "").trim().slice(0, 80),
      });
    }
  }, true);

  document.addEventListener("submit", (e) => {
    if (e.target instanceof Element && e.target.id === "together-form") {
      push("partner_invite", (cur && cur.id) || currentId());
      flush(false);
    }
  }, true);

  // Arrived from a partner invite link (read before the together script strips it)
  if (new URLSearchParams(location.search).get("together")) push("partner_join", null);

  // ---- lifecycle ----
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { checkpoint(); flush(true); } else { resume(); }
  });
  window.addEventListener("pagehide", () => { checkpoint(); flush(true); });
  setInterval(() => flush(false), 15000);

  function init() {
    const sheet = $("preview-sheet");
    if (sheet) new MutationObserver(schedule).observe(sheet, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
    const addr = $("sheet-address");
    if (addr) new MutationObserver(schedule).observe(addr, { childList: true, characterData: true, subtree: true });
    const count = $("sheet-photo-count");
    if (count) new MutationObserver(() => readPhoto()).observe(count, { childList: true, characterData: true, subtree: true });
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
  document.addEventListener("astro:page-load", init);

  window.__intentActivity = { sid: () => getSid(), pending: () => queue.length };
})();