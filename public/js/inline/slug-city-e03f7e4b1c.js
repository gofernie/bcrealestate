
  (() => {
    const start = () => {
      const controls = document.querySelector(".intent-controls");
      const moreFiltersPanel = document.getElementById("type-more-filters");
      const fastData = document.getElementById("remaining-listings-data");

      if (
        !controls ||
        controls.dataset.stickyResultFilters === "true"
      ) return;

      controls.dataset.stickyResultFilters = "true";

      const marker = document.createElement("div");
      marker.className = "listing-filter-original-position";
      marker.setAttribute("aria-hidden", "true");
      controls.before(marker);

      const rail = document.createElement("div");
      rail.className = "listing-filter-rail";
      rail.setAttribute("aria-hidden", "true");
      document.body.appendChild(rail);

      let docked = false;
      let frame = 0;
      let hideTimer = 0;

      const navBottom = () => Math.max(
        0,
        document.querySelector(".site-nav")?.getBoundingClientRect().bottom || 0
      );

      const showRail = () => {
        window.clearTimeout(hideTimer);
        rail.style.top = `${navBottom()}px`;
        rail.style.visibility = "visible";
        rail.style.pointerEvents = "auto";
        requestAnimationFrame(() => {
          rail.style.opacity = "1";
          rail.style.transform = "translateY(0)";
        });
      };

      const hideRail = () => {
        rail.style.opacity = "0";
        rail.style.pointerEvents = "none";
        rail.style.transform = "translateY(-8px)";
        hideTimer = window.setTimeout(() => {
          rail.style.visibility = "hidden";
        }, 160);
      };

      const dock = () => {
        if (docked) return;

        // Preserve the exact desktop bar geometry before moving it to the
        // fixed rail. This keeps every control in the same place on screen.
        const bounds = controls.getBoundingClientRect();
        controls.style.setProperty("width", "min(1400px, calc(100% - 80px))", "important");
        controls.style.setProperty("margin-left", "auto", "important");
        controls.style.setProperty("margin-right", "auto", "important");
        controls.style.setProperty("margin-top", "0", "important");
        controls.style.setProperty("margin-bottom", "0", "important");
        rail.appendChild(controls);
        docked = true;
        showRail();
      };

      const restore = () => {
        if (!docked) return;
        marker.after(controls);
        controls.style.removeProperty("width");
        controls.style.removeProperty("margin-left");
        controls.style.removeProperty("margin-right");
        controls.style.removeProperty("margin-top");
        controls.style.removeProperty("margin-bottom");
        docked = false;
        hideRail();
      };

      const update = () => {
        frame = 0;
        if (window.innerWidth < 769) return restore();

        if (marker.getBoundingClientRect().top <= navBottom()) {
          dock();
          rail.style.top = `${navBottom()}px`;
        } else {
          restore();
        }
      };

      const requestUpdate = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };

      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate, { passive: true });
      requestUpdate();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  })();
