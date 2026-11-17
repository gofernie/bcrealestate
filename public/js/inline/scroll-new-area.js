(() => {
  const KEY = "lastAreas:" + location.pathname;
  const norm = (s) => (s || "").toLowerCase().replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
  const PARAMS = ["area", "areas", "neighbourhood", "neighborhood", "hood", "subarea"];
  const areasOf = (q) => { const u = new URLSearchParams(q); return PARAMS.flatMap((k) => u.getAll(k)).flatMap((v) => v.split(",")).map(norm).filter(Boolean); };
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const save = (a) => { try { sessionStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let userMoved = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) => addEventListener(t, () => { userMoved = true; }, { passive: true }));

  const findHead = (name) => {
    const n = esc(name);
    const homeRe = new RegExp("^(nearby: )?" + n + "$", "i");
    let hit = null;
    document.querySelectorAll(".home-area-group-head").forEach((el) => { if (!hit && homeRe.test(norm(el.textContent))) hit = el; });
    if (hit) return hit;
    const re = new RegExp("^" + n + "\\s*\\u00b7\\s*\\d+\\s+homes?$", "i");
    document.querySelectorAll("h2,h3,h4,div,p,strong").forEach((el) => { if (re.test(norm(el.textContent))) hit = el; });
    return hit;
  };

  const topOffset = () => {
    let off = 0;
    for (const el of document.body.getElementsByTagName("*")) {
      const p = getComputedStyle(el).position;
      if (p !== "fixed" && p !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.top < 240 && r.bottom > 0 && r.height < innerHeight / 2) off = Math.max(off, r.bottom);
    }
    return off;
  };

  const run = () => {
    const cur = areasOf(location.search);
    const prev = read();
    save(cur);
    if (!prev) return;
    const added = cur.filter((a) => !prev.includes(a));
    if (!added.length) return;
    userMoved = false;
    const go = () => {
      if (userMoved) return;
      const heads = added.map(findHead).filter(Boolean);
      if (!heads.length) return;
      heads.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const el = heads[0];
      const to = () => scrollTo({ top: el.getBoundingClientRect().top + scrollY - topOffset() - 20, behavior: "auto" });
      to(); requestAnimationFrame(to);
    };
    [100, 300, 600, 1000, 1600, 2500, 4000].forEach((ms) => setTimeout(go, ms));
    document.addEventListener("homepage-fast-results-replaced", () => setTimeout(go, 50), { once: true });
  };

  let last = location.search;
  setInterval(() => { if (location.search !== last) { last = location.search; run(); } }, 300);
  if (document.readyState === "complete") run(); else addEventListener("load", run);
})();
(() => {
  let touched = 0, userMoved = false, known = null, timer;
  const heads = () => [...document.querySelectorAll(".home-area-group-head")].filter((e) => !/^nearby:/i.test(e.textContent.trim()));
  const names = () => heads().map((e) => e.textContent.trim().toLowerCase());
  const mark = () => { touched = Date.now(); userMoved = false; };
  addEventListener("change", mark, true);
  addEventListener("click", (e) => { if (e.target.closest && e.target.closest('form,[role="listbox"],[role="dialog"],[class*="filter" i],[class*="search" i],[class*="dropdown" i],[class*="area" i]')) mark(); }, true);
  ["wheel", "touchmove"].forEach((t) => addEventListener(t, () => { userMoved = true; }, { passive: true }));

  const topOffset = () => {
    let off = 0;
    for (const el of document.body.getElementsByTagName("*")) {
      const p = getComputedStyle(el).position;
      if (p !== "fixed" && p !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.top < 240 && r.bottom > 0 && r.height < innerHeight / 2) off = Math.max(off, r.bottom);
    }
    return off;
  };

  const jumpTo = (name) => {
    const go = () => {
      if (userMoved) return;
      const el = heads().find((e) => e.textContent.trim().toLowerCase() === name);
      if (!el) return;
      const to = () => scrollTo({ top: el.getBoundingClientRect().top + scrollY - topOffset() - 20, behavior: "auto" });
      to(); requestAnimationFrame(to);
    };
    [0, 300, 800, 1500].forEach((ms) => setTimeout(go, ms));
  };

  const check = () => {
    const cur = names();
    if (!cur.length) return;
    if (!known) { known = cur; return; }
    const added = cur.filter((n) => !known.includes(n));
    known = cur;
    if (added.length && Date.now() - touched < 8000 && !userMoved) jumpTo(added[0]);
  };

  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(check, 200); }).observe(document.body, { subtree: true, childList: true });
  addEventListener("load", check);
})();
(() => { /* hold-height-v1: keep page tall while listings swap so it can't snap to top */
  let t;
  const hold = () => { const h = document.documentElement.scrollHeight; if (!document.body.style.minHeight) document.body.style.minHeight = h + "px"; clearTimeout(t); t = setTimeout(() => { document.body.style.minHeight = ""; }, 5000); };
  const inPicker = (e) => e.target && e.target.closest && e.target.closest('[data-area-menu], .area-multiselect__menu, .area-multiselect__option, .intent-controls, #home-hero-search, .filter-dd__option');
  addEventListener("pointerdown", (e) => { if (inPicker(e)) hold(); }, true);
  addEventListener("change", (e) => { if (inPicker(e)) hold(); }, true);
})();