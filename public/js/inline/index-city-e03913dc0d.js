
(() => {
  if (window.__locusAnchorLock) return;
  window.__locusAnchorLock = true;
  const origIntoView = Element.prototype.scrollIntoView;
  const origScrollTo = window.scrollTo.bind(window);
  const RESULT_TARGETS = "#homepage-listings, #home-listings-grid, #home-results-experience, .results-heading, .explore-toolbar, #home-filter-form, .locus-home-listing-intro, #home-search-summary";
  const pinnedHeight = () => {
    let bottom = 0;
    document.querySelectorAll("header, nav, .site-nav, .locus-home-search, .shared-listing-filter-bar").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "sticky" && cs.position !== "fixed") return;
      bottom = Math.max(bottom, (parseFloat(cs.top) || 0) + el.offsetHeight);
    });
    return bottom || 100;
  };
  const titleY = () => {
    const t = document.getElementById("homepage-listings");
    return t ? Math.max(0, t.getBoundingClientRect().top + window.scrollY - 175) : null;
  };
  const toTitle = (behavior = "instant") => {
    const y = titleY();
    if (y !== null) origScrollTo({ top: y, left: 0, behavior });
  };
  Element.prototype.scrollIntoView = function (...args) {
    if (this.matches?.(RESULT_TARGETS)) {
      const b = (args[0] && typeof args[0] === "object" && args[0].behavior) || "instant";
      return toTitle(b);
    }
    return origIntoView.apply(this, args);
  };
  window.scrollTo = function (...args) {
    const y = titleY();
    const reqTop = typeof args[0] === "object" ? args[0]?.top : args[1];
    if (y !== null && typeof reqTop === "number" && reqTop > y && reqTop < y + 700) {
      const b = (typeof args[0] === "object" && args[0].behavior) || "instant";
      return origScrollTo({ top: y, left: 0, behavior: b });
    }
    return origScrollTo(...args);
  };
  const arm = () => {
    if (location.hash !== "#homepage-listings") return;
    toTitle();
    requestAnimationFrame(() => toTitle());
    [150, 500, 1200].forEach((ms) => setTimeout(() => toTitle(), ms));
  };
  arm();
  document.addEventListener("astro:page-load", arm);
  window.addEventListener("load", arm);
})();