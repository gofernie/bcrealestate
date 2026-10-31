
  // nanaimo-fast-hero-filter-submit-v1
  (() => {
    const heroForm = document.getElementById("home-hero-search");
    const resultsForm = document.getElementById("home-filter-form");

    if (!heroForm || !resultsForm) return;

    const syncAndRefresh = () => {
      const selectedAreas = Array.from(
        heroForm.querySelectorAll('input[name="area"]:checked')
      )
        .map((input) => String(input.value || "").trim())
        .filter(Boolean);

      if (resultsForm.elements.storyAreas) {
        resultsForm.elements.storyAreas.value = selectedAreas.join("|");
      }

      if (resultsForm.elements.area) {
        resultsForm.elements.area.value = "";
      }

      ["type", "maxPrice", "minPrice", "beds", "baths"].forEach((name) => {
        const heroField = heroForm.elements.namedItem(name);
        const resultsField = resultsForm.elements.namedItem(name);

        if (
          (heroField instanceof HTMLInputElement ||
            heroField instanceof HTMLSelectElement) &&
          (resultsField instanceof HTMLInputElement ||
            resultsField instanceof HTMLSelectElement)
        ) {
          resultsField.value = heroField.value;
        }
      });

      ["age55", "petsAllowed"].forEach((name) => {
        const heroField = heroForm.querySelector(
          `input[name="${name}"]`
        );
        const resultsField = resultsForm.elements.namedItem(name);

        if (
          heroField instanceof HTMLInputElement &&
          resultsField instanceof HTMLInputElement
        ) {
          resultsField.value = heroField.checked ? "true" : "";
        }
      });

      if (resultsForm.elements.storyMaxPrice) {
        resultsForm.elements.storyMaxPrice.value = "";
      }

      const nextUrl = new URL(window.location.href);

      ["area", "type", "maxPrice", "minPrice", "beds", "baths", "age55", "petsAllowed"]
        .forEach((key) => nextUrl.searchParams.delete(key));

      selectedAreas.forEach((selectedArea) => {
        nextUrl.searchParams.append("area", selectedArea);
      });

      ["type", "maxPrice", "minPrice", "beds", "baths", "age55", "petsAllowed"]
        .forEach((name) => {
          const field = resultsForm.elements.namedItem(name);

          if (
            (field instanceof HTMLInputElement ||
              field instanceof HTMLSelectElement) &&
            field.value
          ) {
            nextUrl.searchParams.set(name, field.value);
          }
        });

      nextUrl.hash = "homepage-listings";

      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );

      resultsForm.dispatchEvent(new Event("change", { bubbles: true }));
    };

    heroForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        syncAndRefresh();
      },
      true
    );

    heroForm
      .querySelectorAll('input[name="age55"], input[name="petsAllowed"]')
      .forEach((input) => {
        input.addEventListener("change", () => heroForm.requestSubmit());
      });
  })();
