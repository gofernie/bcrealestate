(() => {
  const KEY = "lastAreas:" + location.pathname;
  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const areasOf = (q) => new URLSearchParams(q).getAll("area").map(norm).filter(Boolean);
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const save = (a) => { try { sessionStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let userMoved = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) => addEventListener(t, () => { userMoved = true; }, { passive: true }));

  const findHead = (name) => {
    const re = new RegExp("^" + esc(name) + "\\s*\\u00b7\\s*\\d+\\s+homes?$", "i");
    let hit = null;
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