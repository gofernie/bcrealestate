
  // home-more-budget-click-fix-v1
  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest("#home-more-budget-btn")
          : null;

      if (!button) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const resultsForm = document.getElementById("home-filter-form");
      const heroForm = document.getElementById("home-hero-search");

      if (!resultsForm) return;

      const currentBudget =
        Number(resultsForm.elements.storyMaxPrice?.value || 0) ||
        Number(resultsForm.elements.maxPrice?.value || 0);

      if (!currentBudget) return;
      if (!window.__homeOriginalMaxPrice) {
        window.__homeOriginalMaxPrice = currentBudget;
      }

      const priceSelect = resultsForm.elements.maxPrice;
      const hasOpenEndedNextBand =
        priceSelect instanceof HTMLSelectElement &&
        Array.from(priceSelect.options).some((option) => {
          const match = String(option.textContent || "").match(
            /^\s*over\s+\$?\s*([\d.]+)\s*([km])?\s*$/i
          );

          if (!match) return false;

          const value =
            Number(match[1]) *
            (match[2]?.toLowerCase() === "m" ? 1000 : 1);

          return value === currentBudget;
        });

      if (hasOpenEndedNextBand) {
        if (resultsForm.elements.storyMaxPrice) {
          resultsForm.elements.storyMaxPrice.value = "";
        }

        if (resultsForm.elements.minPrice) {
          resultsForm.elements.minPrice.value = "";
        }

        if (resultsForm.elements.maxPrice) {
          resultsForm.elements.maxPrice.value = "";
        }

        const heroMinPrice = heroForm?.elements.namedItem("minPrice");
        const heroMaxPrice = heroForm?.elements.namedItem("maxPrice");

        if (heroMinPrice instanceof HTMLInputElement) {
          heroMinPrice.value = "";
        }

        if (heroMaxPrice instanceof HTMLSelectElement) {
          heroMaxPrice.value = "";

          const summary = heroMaxPrice.parentElement?.querySelector(
            ".hero-single-dropdown__summary"
          );

          if (summary) {
            summary.textContent =
              currentBudget >= 1000
                ? `Over $${(currentBudget / 1000).toFixed(1)}M`
                : `Over $${currentBudget}k`;
          }
        }

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("minPrice");
        nextUrl.searchParams.delete("maxPrice");
        nextUrl.hash = "homepage-listings";

        window.history.replaceState(
          {},
          "",
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
        );

        window.__homeProgressiveExpansionLabel =
          "New matches after removing the price limit";

        resultsForm.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        return;
      }

      const nextBudget =
        priceSelect instanceof HTMLSelectElement
          ? Array.from(priceSelect.options)
              .map((option) => Number(option.value || 0))
              .filter((value) => value > currentBudget)
              .sort((a, b) => a - b)[0]
          : 0;

      const expandedBudget =
        nextBudget ||
        Math.ceil((currentBudget * 1.25) / 25) * 25;

      if (resultsForm.elements.storyMaxPrice) {
        resultsForm.elements.storyMaxPrice.value = "";
      }

      if (resultsForm.elements.minPrice) {
        resultsForm.elements.minPrice.value = "";
      }

      if (resultsForm.elements.maxPrice) {
        resultsForm.elements.maxPrice.value = String(expandedBudget);
      }

      const heroMinPrice = heroForm?.elements.namedItem("minPrice");
      const heroMaxPrice = heroForm?.elements.namedItem("maxPrice");

      if (heroMinPrice instanceof HTMLInputElement) {
        heroMinPrice.value = "";
      }

      if (heroMaxPrice instanceof HTMLSelectElement) {
        heroMaxPrice.value = String(expandedBudget);

        const summary = heroMaxPrice.parentElement?.querySelector(
          ".hero-single-dropdown__summary"
        );

        if (summary) {
          summary.textContent =
            heroMaxPrice.selectedOptions?.[0]?.textContent?.trim() ||
            "Any Price";
        }
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("minPrice");
      nextUrl.searchParams.set("maxPrice", String(expandedBudget));
      nextUrl.hash = "homepage-listings";

      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );

      const progressiveBudgetLabel =
        expandedBudget >= 1000
          ? `${(expandedBudget / 1000)
              .toFixed(1)
              .replace(/\.0$/, "")}M`
          : `${expandedBudget}k`;

      window.__homeProgressiveExpansionLabel =
        `New matches up to ${progressiveBudgetLabel}`;

      resultsForm.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    },
    true
  );
