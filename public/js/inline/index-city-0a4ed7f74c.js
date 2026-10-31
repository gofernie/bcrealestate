
  /* home-adjacent-area-suggestion-v1 */
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

    const clearSuggestion = () =>
      document.getElementById(suggestionId)?.remove();

    const renderSuggestion = () => {
      const form = document.getElementById("home-filter-form");
      const footer = document.getElementById(
        "home-search-complete"
      );
      const budgetButton = document.getElementById(
        "home-more-budget-btn"
      );
      const boundaryData = document.getElementById(
        "home-area-boundaries-json"
      );

      if (!form || !footer || !boundaryData) {
        clearSuggestion();
        return;
      }

      const expandedByOneKilometre = Array.from(
        document.querySelectorAll(
          "#home-listings-grid .home-results-expansion-divider"
        )
      ).some((divider) =>
        /within\s+1\s*km/i.test(divider.textContent || "")
      );

      const selectedAreas = [
        ...String(form.elements.storyAreas?.value || "")
          .split("|")
          .map(normaliseArea)
          .filter(Boolean),
        normaliseArea(form.elements.area?.value || ""),
      ].filter(Boolean);

      const priceIsExhausted =
        !(budgetButton instanceof HTMLElement) ||
        budgetButton.hidden;

      if (
        !expandedByOneKilometre ||
        !priceIsExhausted ||
        selectedAreas.length !== 1 ||
        !window.turf?.buffer ||
        !window.turf?.booleanIntersects
      ) {
        clearSuggestion();
        return;
      }

      let boundaries = [];

      try {
        boundaries = JSON.parse(
          boundaryData.textContent || "[]"
        );
      } catch {
        clearSuggestion();
        return;
      }

      const selectedArea = selectedAreas[0];

      const toFeature = (boundary) => {
        const geometry =
          boundary?.geometry?.type === "Feature"
            ? boundary.geometry.geometry
            : boundary?.geometry;

        return geometry
          ? {
              type: "Feature",
              properties: { slug: normaliseArea(boundary.slug) },
              geometry,
            }
          : null;
      };

      const selectedFeature = toFeature(
        boundaries.find(
          (boundary) =>
            normaliseArea(boundary.slug) === selectedArea
        )
      );

      if (!selectedFeature) {
        clearSuggestion();
        return;
      }

      let nearbyBoundary;

      try {
        const edge = window.turf.buffer(selectedFeature, 0.25, {
          units: "kilometers",
          steps: 12,
        });

        nearbyBoundary = boundaries
          .filter(
            (boundary) =>
              normaliseArea(boundary.slug) !== selectedArea
          )
          .map((boundary) => ({
            boundary,
            feature: toFeature(boundary),
          }))
          .filter(({ feature }) => feature)
          .filter(({ feature }) =>
            window.turf.booleanIntersects(edge, feature)
          )
          .sort((a, b) => {
            const from = window.turf.centroid(selectedFeature);
            return (
              window.turf.distance(from, window.turf.centroid(a.feature)) -
              window.turf.distance(from, window.turf.centroid(b.feature))
            );
          })[0]?.boundary;
      } catch {
        clearSuggestion();
        return;
      }

      const suggestedArea = normaliseArea(nearbyBoundary?.slug);

      if (!suggestedArea) {
        clearSuggestion();
        return;
      }

      const existing = document.getElementById(suggestionId);

      if (existing?.dataset.area === suggestedArea) {
        return;
      }

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
        `${titleCase(suggestedArea)} is right next to ${titleCase(selectedArea)}.`;

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
        if (form.elements.storyAreas) {
          form.elements.storyAreas.value = suggestedArea;
        }

        if (form.elements.area) {
          form.elements.area.value = "";
        }

        window.__homeAreaExpanded = false;
        window.__homeAreaBufferKm = 0;

        if (typeof homeAreaBufferKm !== "undefined") {
          homeAreaBufferKm = 0;
        }

        clearSuggestion();

        form.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        fetchHomeListings({ append: false });
      });

      card.append(copy, button);
      footer.insertAdjacentElement("afterend", card);
    };

    const grid = document.getElementById("home-listings-grid");

    if (!grid) return;

    const scheduleRender = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(renderSuggestion);
      });
    };

    new MutationObserver(scheduleRender).observe(grid, {
      childList: true,
      subtree: true,
    });

    scheduleRender();
  })();
