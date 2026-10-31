
  /* home-adjacent-area-fallback-v1 */
  (() => {
    const suggestionId = "home-adjacent-area-suggestion";

    const normaliseArea = (value) =>
      String(value || "")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const titleCase = (value) =>
      String(value || "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (character) =>
          character.toUpperCase()
        );

    const getBoundaryBox = (geometry) => {
      const points = [];

      const visit = (value) => {
        if (
          Array.isArray(value) &&
          typeof value[0] === "number" &&
          typeof value[1] === "number"
        ) {
          points.push(value);
          return;
        }

        if (Array.isArray(value)) {
          value.forEach(visit);
        }
      };

      visit(
        geometry?.type === "Feature"
          ? geometry.geometry?.coordinates
          : geometry?.coordinates
      );

      if (!points.length) return null;

      return points.reduce(
        (box, point) => ({
          minLng: Math.min(box.minLng, point[0]),
          maxLng: Math.max(box.maxLng, point[0]),
          minLat: Math.min(box.minLat, point[1]),
          maxLat: Math.max(box.maxLat, point[1]),
        }),
        {
          minLng: Infinity,
          maxLng: -Infinity,
          minLat: Infinity,
          maxLat: -Infinity,
        }
      );
    };

    const boundaryDistance = (a, b) => {
      const lngGap = Math.max(
        0,
        a.minLng - b.maxLng,
        b.minLng - a.maxLng
      );
      const latGap = Math.max(
        0,
        a.minLat - b.maxLat,
        b.minLat - a.maxLat
      );

      return Math.hypot(
        lngGap * Math.cos(((a.minLat + a.maxLat) / 2) * Math.PI / 180),
        latGap
      );
    };

    const renderAdjacentArea = async () => {
      const form = document.getElementById("home-filter-form");
      const footer = document.getElementById(
        "home-search-complete"
      );
      const budgetButton = document.getElementById(
        "home-more-budget-btn"
      );
      const nearbyButton = document.getElementById(
        "home-change-neighbourhood-btn"
      );
      const boundaryData = document.getElementById(
        "home-area-boundaries-json"
      );
      const existing = document.getElementById(suggestionId);

      if (!form || !footer || !boundaryData) {
        existing?.remove();
        return;
      }

      const selectedAreas = [
        ...String(form.elements.storyAreas?.value || "")
          .split("|")
          .map(normaliseArea)
          .filter(Boolean),
        normaliseArea(form.elements.area?.value || ""),
      ].filter(Boolean);

      const noMorePrice =
        !(budgetButton instanceof HTMLElement) ||
        budgetButton.hidden;

      const noMoreNearby =
        !(nearbyButton instanceof HTMLElement) ||
        nearbyButton.hidden;

      if (
        selectedAreas.length !== 1 ||
        !noMorePrice ||
        !noMoreNearby
      ) {
        existing?.remove();
        return;
      }

      let boundaries = [];

      try {
        boundaries = JSON.parse(
          boundaryData.textContent || "[]"
        );
      } catch {
        existing?.remove();
        return;
      }

      const selectedArea = selectedAreas[0];

      const selectedBoundary = boundaries.find(
        (boundary) =>
          normaliseArea(boundary.slug) === selectedArea
      );

      const selectedBox = getBoundaryBox(
        selectedBoundary?.geometry
      );

      if (!selectedBox) {
        existing?.remove();
        return;
      }

      /* adjacent-area-type-inventory-v1 */
      const nearbyCandidates = boundaries
        .filter(
          (boundary) =>
            normaliseArea(boundary.slug) !== selectedArea
        )
        .map((boundary) => ({
          boundary,
          box: getBoundaryBox(boundary.geometry),
        }))
        .filter((item) => item.box)
        .map((item) => ({
          ...item,
          distance: boundaryDistance(selectedBox, item.box),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6);

      if (!nearbyCandidates.length) {
        existing?.remove();
        return;
      }

      const city =
        document.querySelector("[data-city]")?.dataset.city ||
        window.location.pathname.split("/").filter(Boolean)[0] ||
        "nanaimo";

      const selectedType = String(
        form.elements.type?.value || ""
      ).trim().toLowerCase();

      const rankedCandidates = await Promise.all(
        nearbyCandidates.map(async (candidate) => {
          const params = new URLSearchParams({
            city,
            area: normaliseArea(candidate.boundary.slug),
            offset: "0",
            limit: "1",
          });

          if (selectedType) {
            params.set("type", selectedType);
          }

          try {
            const response = await fetch(
              `/api/home-listings?${params.toString()}`
            );

            const payload = response.ok
              ? await response.json()
              : {};

            return {
              ...candidate,
              inventory: Math.max(
                0,
                Number(payload?.total || 0)
              ),
            };
          } catch {
            return {
              ...candidate,
              inventory: 0,
            };
          }
        })
      );

      const nearest = rankedCandidates
        .filter((candidate) => candidate.inventory > 0)
        .sort(
          (a, b) =>
            b.inventory - a.inventory ||
            a.distance - b.distance
        )[0]?.boundary;

      const suggestedArea = normaliseArea(nearest?.slug);
      if (!suggestedArea) {
        existing?.remove();
        return;
      }

      if (existing?.dataset.area === suggestedArea) return;

      existing?.remove();

      const typeValue = String(
        form.elements.type?.value || ""
      ).toLowerCase();

      const typeLabel =
        {
          house: "homes",
          condo: "condos",
          townhouse: "townhomes",
          mobile: "mobile homes",
          land: "lots",
          "multi-family": "multi-family homes",
        }[typeValue] || "homes";

      const card = document.createElement("div");
      card.id = suggestionId;
      card.dataset.area = suggestedArea;
      card.className = "homepage-save-nudge";
      card.style.marginTop = "18px";

      const copy = document.createElement("div");
      copy.className = "homepage-save-nudge__copy";

      const heading = document.createElement("strong");
      heading.textContent =
        `${titleCase(suggestedArea)} is nearby ${titleCase(selectedArea)}.`;

      const detail = document.createElement("span");
      detail.textContent =
        `Would you like to see ${typeLabel} there?`;

      copy.append(heading, detail);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "interrupt-btn interrupt-primary";
      button.textContent =
        `See ${typeLabel} in ${titleCase(suggestedArea)}`;

      button.addEventListener("click", () => {
        /* adjacent-area-fresh-search-v1 */
        const originalMaxPrice = Number(
          window.__homeOriginalMaxPrice ||
          form.elements.maxPrice?.value ||
          0
        );

        const nextUrl = new URL(window.location.href);

        [
          "area",
          "minPrice",
          "maxPrice",
          "type",
          "beds",
          "baths",
          "minSqft",
          "minYear",
          "primaryOnMain",
          "threeSameFloor",
          "fourSameFloor",
          "oceanViews",
          "viewType",
          "waterfrontType",
          "age55",
          "petsAllowed",
          "planMode",
          "sort",
        ].forEach((key) => nextUrl.searchParams.delete(key));

        nextUrl.searchParams.set("area", suggestedArea);

        const copyFilter = (key) => {
          const value = String(form.elements[key]?.value || "").trim();

          if (value) {
            nextUrl.searchParams.set(key, value);
          }
        };

        [
          "type",
          "beds",
          "baths",
          "minSqft",
          "minYear",
          "primaryOnMain",
          "threeSameFloor",
          "fourSameFloor",
          "oceanViews",
          "viewType",
          "waterfrontType",
          "age55",
          "petsAllowed",
          "planMode",
          "sort",
        ].forEach(copyFilter);

        if (originalMaxPrice) {
          nextUrl.searchParams.set(
            "maxPrice",
            String(originalMaxPrice)
          );
        }
        /* adjacent-area-fresh-search-v2 */
        nextUrl.hash = "homepage-listings";

        // This is intentionally a fresh page search: it prevents the
        // previous area s cards, map state, and completion state leaking in.
                /* smooth-adjacent-area-navigation-v1 */
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent =
          `Opening ${titleCase(suggestedArea)} listings `;

        document.documentElement.classList.add(
          "is-adjacent-area-navigating"
        );

        // Allow the feedback state to paint before the clean new search loads.
        window.setTimeout(() => {

                    /* smooth-neighbour-search-v2 */
        const heroForm = document.getElementById(
          "home-hero-search"
        );

        const heroMultiselect = heroForm?.querySelector(
          "[data-area-multiselect]"
        );

        const heroAreaInputs = Array.from(
          heroForm?.querySelectorAll('input[name="area"]') || []
        );

        let selectedHeroOption = null;

        heroAreaInputs.forEach((input) => {
          const isSelected =
            normaliseArea(input.value) === suggestedArea;

          input.checked = isSelected;

          const option = input.closest("[data-area-option]");

          option?.classList.toggle("is-selected", isSelected);

          if (isSelected) {
            selectedHeroOption = option;
          }
        });

        const heroSummary = heroMultiselect?.querySelector(
          "[data-area-summary]"
        );

        if (heroSummary && selectedHeroOption) {
          heroSummary.textContent = String(
            selectedHeroOption.querySelector(
              "span:not(.area-multiselect__check)"
            )?.textContent || titleCase(suggestedArea)
          ).trim();
        }

        if (form.elements.storyAreas) {
          form.elements.storyAreas.value = suggestedArea;
        }

        if (form.elements.area) {
          form.elements.area.value = "";
        }

        if (form.elements.storyMaxPrice) {
          form.elements.storyMaxPrice.value = "";
        }

        if (form.elements.minPrice) {
          form.elements.minPrice.value = "";
        }

        if (form.elements.maxPrice && originalMaxPrice) {
          form.elements.maxPrice.value =
            String(originalMaxPrice);
        }

        const heroMaxPrice = heroForm?.elements?.namedItem(
          "maxPrice"
        );

        if (heroMaxPrice instanceof HTMLSelectElement) {
          heroMaxPrice.value = String(originalMaxPrice || "");

          const summary = heroMaxPrice.parentElement?.querySelector(
            ".hero-single-dropdown__summary"
          );

          if (summary) {
            summary.textContent =
              heroMaxPrice.selectedOptions?.[0]?.textContent?.trim() ||
              "Any Price";
          }
        }

        delete window.__homeProgressiveExpansionLabel;
        window.__homeAreaExpanded = false;
        window.__homeAreaBufferKm = 0;

        if (typeof homeAreaBufferKm !== "undefined") {
          homeAreaBufferKm = 0;
        }

        window.history.pushState(
          {},
          "",
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
        );

        [150, 700].forEach((delay) => {
          window.setTimeout(() => {
            document.getElementById("homepage-listings")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });

            document
              .getElementById("home-hero-search")
              ?.classList.add("home-search-ready");

            document.documentElement.classList.remove(
              "is-adjacent-area-navigating"
            );
          }, delay);
        });

        const changedAreaField = form.elements.storyAreas;

        if (changedAreaField instanceof HTMLInputElement) {
          changedAreaField.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        } else {
          form.dispatchEvent(
          new Event("change", { bubbles: true })
        );
        }
        }, 45);
      });

      card.append(copy, button);
      footer.insertAdjacentElement("afterend", card);
    };

    const grid = document.getElementById("home-listings-grid");

    if (!grid) return;

    const schedule = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(renderAdjacentArea);
      });
    };

    new MutationObserver(schedule).observe(grid, {
      childList: true,
      subtree: true,
    });

    schedule();
  })();
