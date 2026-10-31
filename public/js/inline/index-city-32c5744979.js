
  // nanaimo-mobile-park-rule-bar-v1
  (() => {
    const siteDomain = new URLSearchParams(window.location.search)
      .get("siteDomain")
      ?.toLowerCase()
      .replace(/^www\./, "");

    if (
      location.hostname.toLowerCase().replace(/^www\./, "") !==
        "nanaimomobiles.com" &&
      siteDomain !== "nanaimomobiles.com"
    ) {
      return;
    }

    const heroForm = document.getElementById("home-hero-search");
    const resultsForm = document.getElementById("home-filter-form");

    if (!heroForm || !resultsForm) return;

    const parkRuleAnchor = heroForm.querySelector(
      ".locus-home-more-panel"
    );

    const params = new URLSearchParams(window.location.search);

    const bar = document.createElement("div");
    bar.className = "nanaimo-mobile-park-rule-bar";
    bar.innerHTML = `
      <span class="nanaimo-mobile-park-rule-bar__label">Park rules</span>
      <label class="nanaimo-mobile-park-rule-bar__option">
        <input type="checkbox" name="age55">
        <span>55+ only</span>
      </label>
      <label class="nanaimo-mobile-park-rule-bar__option">
        <input type="checkbox" name="otherPark">
        <span>All other parks</span>
      </label>
      <label class="nanaimo-mobile-park-rule-bar__option">
        <input type="checkbox" name="petsAllowed">
        <span>Pets allowed</span>
      </label>
    `;

    if (parkRuleAnchor) {
      parkRuleAnchor.before(bar);
    } else {
      heroForm.appendChild(bar);
    }

    const inputs = Array.from(
      bar.querySelectorAll('input[type="checkbox"]')
    );

    const ensureResultField = (name) => {
      let field = resultsForm.elements.namedItem(name);

      if (!(field instanceof HTMLInputElement)) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        resultsForm.appendChild(field);
      }

      return field;
    };

    inputs.forEach((input) => {
      input.checked = params.get(input.name) === "true";
    });

    bar.addEventListener(
      "change",
      (event) => {
        const changed = event.target;

        if (
          !(changed instanceof HTMLInputElement) ||
          !changed.checked ||
          !["age55", "otherPark"].includes(changed.name)
        ) {
          return;
        }

        inputs.forEach((input) => {
          if (
            input !== changed &&
            ["age55", "otherPark"].includes(input.name)
          ) {
            input.checked = false;
          }
        });
      },
      true
    );
    const refreshResults = () => {
      // A park cannot be both 55+ and family/all-ages.
      const age55 = bar.querySelector('input[name="age55"]');
      const otherPark = bar.querySelector('input[name="otherPark"]');

      if (
        age55 instanceof HTMLInputElement &&
        otherPark instanceof HTMLInputElement
      ) {
        if (age55.checked) otherPark.checked = false;
        if (otherPark.checked) age55.checked = false;
      }

      inputs.forEach((input) => {
        ensureResultField(input.name).value =
          input.checked ? "true" : "";
      });

      const nextUrl = new URL(window.location.href);

      inputs.forEach((input) => {
        nextUrl.searchParams.delete(input.name);

        if (input.checked) {
          nextUrl.searchParams.set(input.name, "true");
        }
      });

      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );

      resultsForm.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    };

    inputs.forEach((input) => {
      input.addEventListener("change", refreshResults);
    });

    if (inputs.some((input) => input.checked)) {
      requestAnimationFrame(refreshResults);
    }
  })();
