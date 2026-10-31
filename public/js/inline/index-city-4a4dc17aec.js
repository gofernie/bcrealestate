
  /* sticky-listing-filter-v2 */
  (() => {
    const initialiseStickySearch = () => {
      const form = document.getElementById("home-hero-search");

      if (
        !form ||
        form.dataset.stickyFilterV2 === "true"
      ) {
        return;
      }

      form.dataset.stickyFilterV2 = "true";

      const marker = document.createElement("div");
      marker.className = "listing-filter-original-position";
      marker.setAttribute("aria-hidden", "true");
      form.before(marker);

      const rail = document.createElement("div");
      rail.className = "listing-filter-rail";
      rail.setAttribute("aria-hidden", "true");

      Object.assign(rail.style, {
        position: "fixed",
        right: "0",
        left: "0",
        zIndex: "9000",
        visibility: "hidden",
        opacity: "0",
        pointerEvents: "none",
        transform: "translateY(-8px)",
        transition: "opacity 160ms ease, transform 160ms ease",
      });

      document.body.appendChild(rail);

      // The docked rail must fully contain the moved search form.
      rail.style.setProperty("background", "#ffffff", "important");
      rail.style.setProperty("height", "auto", "important");
      rail.style.setProperty("min-height", "0", "important");
      rail.style.setProperty("padding-bottom", "12px", "important");
      rail.style.setProperty("box-sizing", "border-box", "important");

      let isDocked = false;

/* restore-sticky-rail-position-v1 */
let frame = 0;

const navBottom = () => {
  const nav =
    document.querySelector(".site-nav") ||
    document.querySelector("header");

  return Math.max(
    0,
    nav?.getBoundingClientRect().bottom || 0
  );
};




      /* restore-sticky-rail-helpers-v2 */
      const showRail = () => {
        rail.classList.add("is-visible");
        rail.style.visibility = "visible";
        rail.style.opacity = "1";
        rail.style.pointerEvents = "auto";
        rail.style.transform = "translateY(0)";
      };

      const hideRail = () => {
        rail.classList.remove("is-visible");
        rail.style.visibility = "hidden";
        rail.style.opacity = "0";
        rail.style.pointerEvents = "none";
        rail.style.transform = "translateY(-8px)";
      };
      const dock = () => {
        if (isDocked) return;

        // The original hero search is already out of normal page flow.
        // Reserving its height here makes the page jump downward.
        marker.style.height = "0px";

        const dockedFormWidth = Math.round(
          form.getBoundingClientRect().width
        );

        rail.appendChild(form);

        // Override the hero-only positioning while the form lives in the fixed rail.
        form.style.setProperty("position", "relative", "important");
        form.style.setProperty("top", "auto", "important");
        form.style.setProperty("left", "auto", "important");
        form.style.setProperty("right", "auto", "important");
        form.style.setProperty("transform", "none", "important");
        form.style.setProperty("margin", "0 auto", "important");
        form.style.setProperty(
          "width",
          `${dockedFormWidth}px`,
          "important"
        );

        const dockedInventoryBoard = form.querySelector(
          ".locus-home-search__inventory-board"
        );
        if (dockedInventoryBoard) {
          dockedInventoryBoard.style.setProperty(
            "display",
            "flex",
            "important"
          );
          dockedInventoryBoard.style.setProperty(
            "align-items",
            "baseline",
            "important"
          );
          dockedInventoryBoard.style.setProperty(
            "white-space",
            "nowrap",
            "important"
          );

          dockedInventoryBoard
            .querySelectorAll(":scope > *")
            .forEach((stat) => {
              stat.style.setProperty(
                "align-self",
                "baseline",
                "important"
              );
              stat.style.setProperty(
                "white-space",
                "nowrap",
                "important"
              );
            });
        }

        form.querySelectorAll(".hero-single-dropdown__menu").forEach((menu) => {
          menu.style.setProperty(
            "top",
            "calc(100% + 27px)",
            "important"
          );
        });

        isDocked = true;
        showRail();
      };

      const restore = () => {
        if (!isDocked) return;

        marker.after(form);

        form.style.removeProperty("position");
        form.style.removeProperty("top");
        form.style.removeProperty("left");
        form.style.removeProperty("right");
        form.style.removeProperty("transform");
        form.style.removeProperty("margin");
        form.style.removeProperty("width");

        const dockedInventoryBoard = form.querySelector(
          ".locus-home-search__inventory-board"
        );
        if (dockedInventoryBoard) {
          dockedInventoryBoard.style.removeProperty("display");
          dockedInventoryBoard.style.removeProperty("align-items");
          dockedInventoryBoard.style.removeProperty("white-space");

          dockedInventoryBoard
            .querySelectorAll(":scope > *")
            .forEach((stat) => {
              stat.style.removeProperty("align-self");
              stat.style.removeProperty("white-space");
            });
        }

        form.querySelectorAll(".hero-single-dropdown__menu").forEach((menu) => {
          menu.style.removeProperty("top");
        });

        marker.style.height = "";
                isDocked = false;
        hideRail();
      };

      const update = () => {
        frame = 0;

        if (window.innerWidth < 769) {
          restore();
          return;
        }

        const shouldDock =
          marker.getBoundingClientRect().top <= navBottom();

        if (shouldDock) {
          dock();
          rail.style.setProperty("top", `${navBottom()}px`, "important");
        } else {
          restore();
        }
      };

      const requestUpdate = () => {
        if (frame) return;

        frame = window.requestAnimationFrame(update);
      };

      window.addEventListener(
        "scroll",
        requestUpdate,
        { passive: true }
      );

      window.addEventListener(
        "resize",
        requestUpdate,
        { passive: true }
      );

      update();
    };

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        initialiseStickySearch,
        { once: true }
      );
    } else {
      initialiseStickySearch();
    }
  })();
