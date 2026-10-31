
  /* Keep filter menus usable after inventory-aware controls rebuild. */
  (() => {
    const syncMenu = (select, kind) => {
      if (!(select instanceof HTMLSelectElement)) return;

      const dropdown = select.parentElement?.querySelector(`.filter-dd--${kind}`);
      const menu = dropdown?.querySelector(".filter-dd__menu");
      const value = dropdown?.querySelector(".filter-dd__value");
      if (!dropdown || !menu || !value) return;

      menu.querySelectorAll(".filter-dd__option").forEach((button) => button.remove());

      Array.from(select.options).forEach((option) => {
        const button = document.createElement("button");
        const text = document.createElement("span");
        const check = document.createElement("span");

        button.type = "button";
        button.className = "filter-dd__option";
        button.dataset.value = option.value;
        text.textContent = option.textContent || option.value;
        check.className = "filter-dd__check";
        check.textContent = "✓";

        button.append(text, check);
        button.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          dropdown.classList.remove("is-open");
        });

        menu.appendChild(button);
      });

      const selected = select.options[select.selectedIndex] || select.options[0];
      value.textContent = selected?.textContent || "";
      menu.querySelectorAll(".filter-dd__option").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.value === select.value);
      });
    };

    const repairFilters = () => {
      const type = document.querySelector(".type-filter-select");
      const price = document.querySelector(".price-filter-select");

      if (type instanceof HTMLSelectElement && type.options.length < 3) {
        const selected = new URLSearchParams(location.search).get("type") || type.value || "all";
        const choices = [
          ["all", "Any type"],
          ["house", "Homes"],
          ["condo", "Condos"],
          ["townhouse", "Townhomes"],
          ["mobile", "Mobile homes"],
          ["land", "Lots and land"],
        ];

        type.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
        type.value = choices.some(([value]) => value === selected) ? selected : "all";
      }

      if (price instanceof HTMLSelectElement && price.options.length < 2) {
        const selected = new URLSearchParams(location.search).get("price") || price.value || "all";
        const choices = [
          ["all", "Any Price"],
          ["under-450", "Under $450k"],
          ["450-650", "$450k - $650k"],
          ["650-850", "$650k - $850k"],
          ["850-1100", "$850k - $1.1M"],
          ["1100-plus", "$1.1M+"],
        ];

        price.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
        price.value = choices.some(([value]) => value === selected) ? selected : "all";
      }

      syncMenu(type, "type");
      syncMenu(price, "price");
    };

    repairFilters();

    document.querySelector(".type-filter-select")?.addEventListener("change", () => {
      window.setTimeout(repairFilters, 0);
    });
  })();
  /* map-listing-modal-bridge-v1 */
  if (!window["__mapListingModalBridgeReady"]) {
    window["__mapListingModalBridgeReady"] = true;

    document.addEventListener(
      "click",
      (event) => {
        const trigger =
          event.target instanceof Element
            ? event.target.closest("[data-map-listing-id]")
            : null;

        if (!trigger) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const listingId = String(
          trigger.getAttribute("data-map-listing-id") || ""
        ).trim();

        if (!listingId) return;

        const card =
          window.__mapListingCards?.[listingId] ||
          Array.from(
            document.querySelectorAll(
              ".original-card[data-listing-id], .refined-card[data-listing-id]"
            )
          ).find(
            (candidate) =>
              String(candidate.getAttribute("data-listing-id") || "") ===
              listingId
          );

        if (card instanceof HTMLElement) {
          card.click();
        } else {
          console.warn(
            "No modal-enabled listing card found for map listing:",
            listingId
          );
        }
      },
      true
    );
  }
