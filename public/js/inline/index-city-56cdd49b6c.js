
  /* homepage-search-facets-after-paint-v1 */
  (() => {
    const loadFacets = async () => {
      const form = document.getElementById("home-filter-form");
      const city = String(
        form?.elements?.city?.value || "nanaimo"
      ).trim();

      if (!city) return;

      try {
        const response = await fetch(
          `/api/home-listings?${(() => { /* facets-keep-filters-v1: count within the page's filters (except price) */ const q = new URLSearchParams(location.search); ["minPrice","maxPrice","price","sort","listing_id","mls","offset","limit","countOnly","facets","city"].forEach((k) => q.delete(k)); q.set("city", city); q.set("facets", "1"); return q; })()}`
        );

        if (!response.ok || !form?.isConnected) return;

        const facets = await response.json();

        document.dispatchEvent(
          new CustomEvent("home-search-facets:ready", {
            detail: facets,
          })
        );
      } catch {
        // The server-rendered controls remain a complete fallback.
      }
    };
    let facetsRequested = false;

    const schedule = () => {
      if (facetsRequested) return;
      facetsRequested = true;
      void loadFacets();
    };

    const form = document.getElementById("home-filter-form");
    const currentCity = String(
      form?.elements?.city?.value || ""
    ).trim().toLowerCase().replace(/\s+/g, "-");

    // Greater Victoria's regional aggregation is intentionally deferred
    // until the visitor first uses a search control.
    if (currentCity === "greater-victoria") {
      const loadOnFirstFilterIntent = () => {
        schedule();
        form?.removeEventListener("pointerdown", loadOnFirstFilterIntent);
        form?.removeEventListener("focusin", loadOnFirstFilterIntent);
        form?.removeEventListener("change", loadOnFirstFilterIntent);
      };

      form?.addEventListener("pointerdown", loadOnFirstFilterIntent, {
        once: true,
      });
      form?.addEventListener("focusin", loadOnFirstFilterIntent, {
        once: true,
      });
      form?.addEventListener("change", loadOnFirstFilterIntent, {
        once: true,
      });
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", schedule, {
        once: true,
      });
    } else {
      schedule();
    }
  })();
