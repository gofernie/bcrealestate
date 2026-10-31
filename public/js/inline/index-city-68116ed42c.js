
(() => {
  if (window.__gvDistrictNavigationInstalled) return;
  window.__gvDistrictNavigationInstalled = true;
  const districts = new Set(["victoria", "saanich-east", "saanich-west", "oak-bay", "esquimalt", "view-royal", "colwood", "langford", "highlands", "metchosin", "sooke", "central-saanich", "north-saanich", "sidney"]);
  const keys = ["type", "minPrice", "maxPrice", "beds", "baths", "sort", "minSqft", "minLotSqft", "minYear", "primaryOnMain", "threeSameFloor", "fourSameFloor", "planMode", "viewType", "oceanViews", "waterfrontType", "waterfront", "age55", "otherPark", "petsAllowed", "siteDomain"];
  function currentFilters() {
    const params = new URLSearchParams(location.search);
    const hero = document.getElementById("home-hero-search");
    const results = document.getElementById("home-filter-form");
    const value = (name) => {
      const field = hero?.elements.namedItem(name) || results?.elements.namedItem(name);
      if (!field) return params.get(name) || "";
      if (field.type === "checkbox") return field.checked ? field.value : "";
      return String(field.value || "");
    };
    const next = new URLSearchParams();
    for (const key of keys) { const val = value(key); if (val && val !== "0" && val !== "false") next.set(key, val); }
    const price = next.get("maxPrice") || "";
    const over = price.match(/^over-(\d+)$/);
    if (over) { next.delete("maxPrice"); next.set("minPrice", over[1]); }
    const budget = Number(results?.elements.namedItem("storyMaxPrice")?.value || 0);
    if (budget) { next.set("minPrice", String(Math.round(budget * .85))); next.set("maxPrice", String(Math.round(budget * 1.15))); }
    const beds = next.get("beds") || "";
    if (["primary-on-main", "three-same-floor", "four-same-floor"].includes(beds)) { next.delete("beds"); next.set("planMode", beds); }
    if (next.get("type") === "homes") next.set("type", "house");
    return next;
  }
  function destination(slug) {
    const params = currentFilters();
    if (slug) params.set("from", "greater-victoria");
    const path = slug ? `/${slug}/` : "/greater-victoria/";
    return path + (params.size ? `?${params}` : "");
  }
  function closeMenu() {
    const menu = document.querySelector("[data-gv-district-menu]");
    const trigger = document.querySelector("[data-gv-district-trigger]");
    if (menu) menu.hidden = true;
    document.querySelector("[data-gv-district-navigation]")?.classList.remove("is-open");
    trigger?.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-gv-district-trigger]");
    if (trigger) {
      const menu = document.querySelector("[data-gv-district-menu]");
      if (menu) { menu.hidden = !menu.hidden; trigger.closest("[data-gv-district-navigation]")?.classList.toggle("is-open", !menu.hidden); trigger.setAttribute("aria-expanded", String(!menu.hidden)); }
      return;
    }
    const link = event.target.closest("a");
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && !link.target && !link.hasAttribute("download")) {
      if (link.matches("[data-gv-return]")) {
        event.preventDefault(); event.stopImmediatePropagation(); location.assign(destination("")); return;
      }
      if (document.querySelector("[data-gv-district-navigation]")) {
        const url = new URL(link.href, location.href);
        const match = url.pathname.match(/^\/(?:greater-victoria\/)?([a-z-]+)\/?$/);
        if (url.origin === location.origin && match && districts.has(match[1])) {
          event.preventDefault(); event.stopImmediatePropagation(); location.assign(destination(match[1])); return;
        }
      }
    }
    if (!event.target.closest("[data-gv-district-navigation]")) closeMenu();
  }, true);
  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-gv-district-select]")) return;
    const slug = String(event.target.value || "").replace(/\s+/g, "-");
    if (!districts.has(slug)) return;
    event.preventDefault(); event.stopImmediatePropagation(); location.assign(destination(slug));
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector("[data-gv-district-menu]:not([hidden])")) {
      closeMenu(); document.querySelector("[data-gv-district-trigger]")?.focus();
    }
    if (event.key === "ArrowDown" && event.target.matches("[data-gv-district-trigger]")) {
      event.preventDefault(); const menu = document.querySelector("[data-gv-district-menu]");
      if (menu) { menu.hidden = false; event.target.closest("[data-gv-district-navigation]")?.classList.add("is-open"); event.target.setAttribute("aria-expanded", "true"); menu.querySelector("a")?.focus(); }
    }
  });
})();
