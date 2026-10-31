
  /* type-area-docked-more-panel-v7 */
  (() => {
    const start = () => {
      const controls = document.querySelector(
        "#listing-results-anchor.intent-controls"
      );
      const panel = document.querySelector("[data-type-more-panel]");
      const toggle = document.querySelector("[data-type-more-toggle]");

      if (!controls || !panel || !toggle) return;

      const home = document.createComment("more-filters-home");
      panel.before(home);

      let wasDocked = false;
      let frame = 0;

      const isDocked = () =>
        Boolean(controls.closest(".listing-filter-rail"));

      const revealDockedPanel = () => {
        panel.style.removeProperty("visibility");
        panel.style.removeProperty("opacity");
      };

      const prepareDockedPanel = () => {
        if (!isDocked()) return;
        panel.style.setProperty("visibility", "hidden", "important");
        panel.style.setProperty("opacity", "0", "important");
      };

      const restorePanel = () => {
        if (!home.parentNode) return;
        home.after(panel);
        panel.style.removeProperty("width");
        panel.style.removeProperty("margin-left");
        panel.style.removeProperty("margin-right");
        panel.style.removeProperty("margin-top");
        revealDockedPanel();
      };

      const closePanel = () => {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.classList.remove("is-open");
      };

      const placePanelBelowDockedBar = () => {
        if (!isDocked() || panel.hidden) return;

        const bounds = controls.getBoundingClientRect();

        panel.style.setProperty(
          "width",
          `${bounds.width}px`,
          "important"
        );
        panel.style.setProperty(
          "margin-left",
          `${bounds.left}px`,
          "important"
        );
        panel.style.setProperty("margin-right", "0", "important");
        panel.style.setProperty("margin-top", "0", "important");

        controls.after(panel);
      };

      const syncDockState = () => {
        frame = 0;
        const docked = isDocked();

        if (docked && !wasDocked) {
          if (!panel.hidden) closePanel();
          restorePanel();
        }

        if (!docked && wasDocked) {
          restorePanel();
        }

        wasDocked = docked;
      };

      const requestSync = () => {
        if (!frame) frame = requestAnimationFrame(syncDockState);
      };

      document.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        if (!event.target.closest("[data-type-more-toggle]")) return;

        prepareDockedPanel();

        requestAnimationFrame(() => {
          syncDockState();

          if (isDocked() && !panel.hidden) {
            placePanelBelowDockedBar();
            requestAnimationFrame(revealDockedPanel);
          } else if (!isDocked()) {
            restorePanel();
          }
        });
      });

      window.addEventListener("scroll", requestSync, { passive: true });
      window.addEventListener("resize", requestSync, { passive: true });
      requestSync();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  })();
