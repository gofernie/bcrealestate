/* home-group-by-area-v1: section homepage results by area, selected area first */
(() => {
  if (window.__homeGroupAreasInit) return;
  window.__homeGroupAreasInit = true;
  const norm = (v) => String(v || "").toLowerCase().replace(/\u00b7/g, "").replace(/^(feru|fe|se|sw|pq|na|ob)\s*-\s*/i, "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  const tc = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const selected = () => {
    const form = document.getElementById("home-filter-form");
    const multi = String(form?.elements?.storyAreas?.value || "").split("|");
    const one = form?.elements?.area?.value || new URLSearchParams(location.search).get("area") || "";
    return [...multi, one].map(norm).filter(Boolean);
  };
  const areaOf = (card) => norm(card.querySelector(".card-area")?.textContent || card.dataset.area || "");
  let obs, timer = 0;
  const group = () => {
    const grid = document.getElementById("home-listings-grid");
    if (!grid) return;
    obs.disconnect();
    try {
      grid.querySelectorAll(".home-area-group-head").forEach((h) => h.remove());
      const sel = selected();
      if (!sel.length || grid.querySelector(".home-results-expansion-divider")) return;
      const cards = [...grid.querySelectorAll(":scope > .card")];
      const groups = new Map();
      cards.forEach((c) => { const a = areaOf(c) || "other"; if (!groups.has(a)) groups.set(a, []); groups.get(a).push(c); });
      if (groups.size < 2) return;
      const order = [...groups.keys()].sort((a, b) => (sel.includes(a) ? 0 : 1) - (sel.includes(b) ? 0 : 1) || groups.get(b).length - groups.get(a).length);
      const after = cards[cards.length - 1].nextSibling;
      const frag = document.createDocumentFragment();
      order.forEach((a) => {
        const h = document.createElement("div");
        h.className = "home-area-group-head";
        h.textContent = (sel.includes(a) ? "" : "Nearby: ") + (a === "other" ? "Other areas" : tc(a));
        frag.appendChild(h);
        groups.get(a).forEach((c) => frag.appendChild(c));
      });
      grid.insertBefore(frag, after);
    } finally {
      obs.takeRecords();
      obs.observe(document.body, { subtree: true, childList: true });
    }
  };
  obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(group, 120); });
  obs.observe(document.body, { subtree: true, childList: true });
  if (!document.getElementById("home-area-group-style")) {
    const s = document.createElement("style");
    s.id = "home-area-group-style";
    s.textContent = "#home-listings-grid .home-area-group-head{grid-column:1/-1;margin:22px 0 2px;padding-bottom:8px;border-bottom:1px solid var(--line,rgba(0,0,0,.12));font-weight:800;font-size:.95rem;color:var(--ink,#08243a)}#home-listings-grid .home-area-group-head:first-child{margin-top:0}";
    document.head.appendChild(s);
  }
  window.addEventListener("load", group);
  group();
})();