
    /* intent-sort-pill-layout-v2 */
    (() => {
      const placeIntentSort = () => {
        const row = document.querySelector(".filter-save-row");
        const saveButton = document.querySelector(
          ".slug-save-search [data-slug-save-open]"
        );
        const sortSelect = document.querySelector(".sort-filter-select");
        const customSort = document.querySelector(".filter-dd--sort");
        const oldSortPill = document.querySelector(".filter-sort-pill");

        if (!row || !saveButton || !customSort) return false;

        if (
          oldSortPill instanceof HTMLElement &&
          sortSelect instanceof HTMLSelectElement &&
          oldSortPill.contains(sortSelect)
        ) {
          oldSortPill.before(sortSelect);
          oldSortPill.remove();
        }

        row.insertBefore(customSort, saveButton);

        customSort.classList.add("intent-sort-pill");
        customSort.style.cssText =
          "position:relative;display:inline-flex;width:auto;min-width:0;" +
          "height:40px;align-self:auto;";

        const trigger = customSort.querySelector(".filter-dd__trigger");
        const label = customSort.querySelector(".filter-dd__label");
        const value = customSort.querySelector(".filter-dd__value");

        if (trigger instanceof HTMLElement) {
          trigger.style.cssText =
            "width:auto;min-height:40px;padding:0 30px 0 13px;" +
            "border:1px solid #d8dfdd;border-radius:999px;" +
            "background:#fff;color:#355c64;font:inherit;" +
            "font-size:.85rem;font-weight:700;";
        }

        if (label instanceof HTMLElement) {
          label.textContent = "Sort";
          label.style.cssText =
            "display:inline;color:#111;font:inherit;" +
            "font-size:.85rem;font-weight:800;";
        }

        const syncSortText = () => {
          if (
            value instanceof HTMLElement &&
            sortSelect instanceof HTMLSelectElement
          ) {
            value.textContent =
              sortSelect.options[sortSelect.selectedIndex]
                ?.textContent?.trim() || "Newest first";
          }
        };

        if (value instanceof HTMLElement) {
          value.style.cssText =
            "display:inline;margin-left:6px;color:#355c64;font:inherit;" +
            "font-size:.85rem;font-weight:600;";
        }

        syncSortText();
        sortSelect?.addEventListener("change", syncSortText);
        return true;
      };

      const run = () => {
        placeIntentSort();
        setTimeout(placeIntentSort, 100);
        setTimeout(placeIntentSort, 350);
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
      } else {
        run();
      }
    })();
  