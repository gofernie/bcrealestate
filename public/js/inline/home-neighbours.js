/* home-neighbours-v2: neighbouring areas (with match counts) on the homepage "Search complete" card */
(() => {
  if (window.__homeNeighboursInit) return;
  window.__homeNeighboursInit = true;
  let map = {};
  try { map = JSON.parse(document.getElementById("area-neighbours")?.textContent || "{}"); } catch {}
  const norm = (v) => String(v || "").replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const cache = new Map();
  let lastKey = "", timer = 0;

  const selectedAreas = (form) => {
    const multi = String(form?.elements?.storyAreas?.value || "").split("|").map((v) => v.trim()).filter(Boolean);
    if (multi.length) return multi;
    const one = String(form?.elements?.area?.value || "").trim();
    return one ? [one] : [];
  };

  const render = () => {
    const footer = document.getElementById("home-search-complete");
    const form = document.getElementById("home-filter-form");
    let box = document.getElementById("home-neighbour-areas");
    const hide = () => { if (box) box.hidden = true; lastKey = ""; };
    if (!footer || footer.hidden || footer.offsetParent === null || !form) return hide();
    const picked = selectedAreas(form);
    const sel = picked.map(norm);
    if (!sel.length || !window.__homeLastParams) return hide();
    const seen = new Set(sel), cands = [];
    sel.forEach((v) => (map[v] || []).forEach((n) => { if (!seen.has(n.value)) { seen.add(n.value); cands.push(n); } }));
    if (!cands.length) return hide();

    const key = window.__homeLastParams + "|" + cands.map((c) => c.value).join(",");
    if (key === lastKey && box && !box.hidden && footer.contains(box)) return;
    lastKey = key;

    if (!box) {
      box = document.createElement("div");
      box.id = "home-neighbour-areas";
      box.style.cssText = "flex-basis:100%;grid-column:1 / -1;width:100%;margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;";
    }
    if (!footer.contains(box)) footer.appendChild(box);
    box.hidden = false;
    box.innerHTML = '<span style="flex-basis:100%;font-size:.84rem;opacity:.75;">Checking neighbouring areas...</span>';

    const hyphen = picked.some((v) => v.includes("-"));
    const asFormValue = (v) => (hyphen ? v.replace(/\s+/g, "-") : v);

    const draw = (rows) => {
      if (lastKey !== key) return;
      const hits = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
      if (!hits.length) { box.hidden = true; return; }
      box.innerHTML = '<span style="flex-basis:100%;font-size:.84rem;opacity:.75;margin-bottom:2px;">' + (hits.length === 1 ? "Try the neighbouring area:" : "Try a neighbouring area:") + "</span>";
      hits.forEach((h) => {
        const b = document.createElement("button");
        b.type = "button";
        b.style.cssText = "display:inline-flex;align-items:center;padding:9px 14px;border-radius:8px;font:inherit;font-weight:700;font-size:.84rem;cursor:pointer;border:1px solid currentColor;background:transparent;color:inherit;";
        b.textContent = h.label + " (" + h.count + ")";
        b.addEventListener("click", () => {
          const multi = form.elements.storyAreas;
          if (multi) multi.value = picked.concat(asFormValue(h.value)).join("|");
          else if (form.elements.area) form.elements.area.value = asFormValue(h.value);
          if (typeof form.requestSubmit === "function") form.requestSubmit(); else form.submit();
        });
        box.appendChild(b);
      });
    };

    if (cache.has(key)) return draw(cache.get(key));
    Promise.all(cands.slice(0, 8).map(async (c) => {
      try {
        const p = new URLSearchParams(window.__homeLastParams);
        p.delete("area"); p.delete("areas"); p.delete("areaBufferKm");
        p.set("areas", c.value); p.set("offset", "0"); p.set("limit", "1");
        const r = await fetch("/api/home-listings?" + p.toString());
        const j = await r.json();
        return { ...c, count: Number(j.total || 0) };
      } catch { return { ...c, count: 0 }; }
    })).then((rows) => { cache.set(key, rows); draw(rows); });
  };

  const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  new MutationObserver((muts) => {
    if (muts.every((m) => (m.target.id === "home-neighbour-areas") || m.target.closest?.("#home-neighbour-areas"))) return;
    schedule();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
  window.addEventListener("load", schedule);
  schedule();
})();