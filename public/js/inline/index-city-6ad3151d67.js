
(() => {
  const placeSearch = () => {
    const search = document.getElementById("home-hero-search");
    const hero = document.querySelector(".locus-home-hero");
    if (!search || !hero) return;

    if (window.matchMedia("(max-width: 760px)").matches) {
      let slot = document.querySelector(".home-mobile-search-slot");

      if (!slot) {
        slot = document.createElement("div");
        slot.className = "home-mobile-search-slot";
      }

      if (hero.nextElementSibling !== slot) {
        hero.insertAdjacentElement("afterend", slot);
      }
      if (search.parentElement !== slot) slot.appendChild(search);

      hero.classList.add("home-hero--search-below");
      search.classList.add("home-search--mobile-below");
    } else if (search.classList.contains("home-search--mobile-below")) {
      hero.appendChild(search);
      document.querySelector(".home-mobile-search-slot")?.remove();
      hero.classList.remove("home-hero--search-below");
      search.classList.remove("home-search--mobile-below");
    }

    search.hidden = false;
    search.classList.add("home-search-ready");

    ["display", "visibility", "opacity"].forEach((property) => {
      search.style.removeProperty(property);
    });
  };

  const initialise = () => {
    placeSearch();

    const positionResults = window.positionHomeResults;
    if (typeof positionResults === "function" &&
        !positionResults.mobilePlacementFixed) {
      const wrapped = (...args) => {
        positionResults(...args);
        placeSearch();
      };
      wrapped.mobilePlacementFixed = true;
      window.positionHomeResults = wrapped;
    }
  };

  if (window.__mobileSearchPlacementCleanup) {
    window.__mobileSearchPlacementCleanup();
  }

  document.addEventListener("DOMContentLoaded", initialise);
  document.addEventListener("astro:page-load", initialise);
  window.addEventListener("pageshow", initialise);
  window.addEventListener("resize", placeSearch);

  window.__mobileSearchPlacementCleanup = () => {
    document.removeEventListener("DOMContentLoaded", initialise);
    document.removeEventListener("astro:page-load", initialise);
    window.removeEventListener("pageshow", initialise);
    window.removeEventListener("resize", placeSearch);
  };

  if (document.readyState !== "loading") initialise();
})();
