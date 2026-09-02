(() => {
  if (!document.getElementById("hero-single-dropdown-styles")) {
    const style = document.createElement("style");
    style.id = "hero-single-dropdown-styles";
    style.textContent = `
      #home-hero-search .hero-native-select {
        display: none !important;
      }

      #home-hero-search .hero-single-dropdown {
        position: relative;
        width: 100%;
      }

      #home-hero-search .hero-single-dropdown__trigger {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 22px;
        align-items: center;
        width: 100%;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--locus-ink, #0d3049);
        font: inherit;
        font-size: .9rem;
        font-weight: 750;
        text-align: left;
        cursor: pointer;
      }

      #home-hero-search .hero-single-dropdown__summary {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #home-hero-search .hero-single-dropdown__chevron {
        line-height: 1;
        text-align: right;
        transition: transform .18s ease;
      }

      #home-hero-search .hero-single-dropdown.is-open
      .hero-single-dropdown__chevron {
        transform: rotate(180deg);
      }

      #home-hero-search .hero-single-dropdown__menu {
        position: absolute;
        z-index: 70;
        top: calc(100% + 18px);
        left: -14px;
        box-sizing: border-box;
        width: calc(100% + 28px);
        min-width: 210px;
        max-height: 360px;
        overflow-x: hidden;
        overflow-y: auto;
        border: 1px solid #d9dfe2;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 22px 48px rgba(8, 36, 58, .18);
      }

      #home-hero-search .hero-single-dropdown__menu[hidden] {
        display: none !important;
      }

      #home-hero-search .hero-single-dropdown__option {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 24px;
        align-items: center;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        min-height: 44px;
        padding: 10px 14px;
        border: 0;
        border-bottom: 1px solid #e6e9eb;
        background: #fff;
        color: var(--locus-ink, #0d3049);
        font: inherit;
        font-size: .86rem;
        text-align: left;
        cursor: pointer;
      }

      #home-hero-search .hero-single-dropdown__option:last-child {
        border-bottom: 0;
      }

      #home-hero-search .hero-single-dropdown__option:hover {
        background: #f8faf9;
      }

      #home-hero-search .hero-single-dropdown__option.is-selected {
        background: color-mix(
          in srgb,
          var(--accent, #2f6f73) 12%,
          white
        );
        color: var(--accent, #2f6f73);
        font-weight: 750;
      }

      #home-hero-search .hero-single-dropdown__check {
        color: var(--accent, #2f6f73);
        font-size: .95rem;
        font-weight: 850;
        text-align: right;
      }
    `;

    document.head.appendChild(style);
  }

  const form = document.getElementById("home-hero-search");
  if (!form || form.dataset.singleDropdownsReady === "true") return;

  form.dataset.singleDropdownsReady = "true";

  const scrollStorageKey =
    `home-filter-scroll:${window.location.pathname}`;

  const savedScrollPosition =
    sessionStorage.getItem(scrollStorageKey);

  if (savedScrollPosition !== null) {
    sessionStorage.removeItem(scrollStorageKey);

    const restoreScrollPosition = () => {
      window.scrollTo({
        top: Number(savedScrollPosition) || 0,
        left: 0,
        behavior: "instant"
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(restoreScrollPosition);
    });

    window.addEventListener(
      "load",
      restoreScrollPosition,
      { once: true }
    );
  }

  form.addEventListener("submit", () => {
    sessionStorage.setItem(
      scrollStorageKey,
      String(window.scrollY)
    );
  });

  const closeAll = (except = null) => {
    form.querySelectorAll(".hero-single-dropdown.is-open").forEach((dropdown) => {
      if (dropdown === except) return;

      dropdown.classList.remove("is-open");
      dropdown.querySelector("[data-single-menu]").hidden = true;
      dropdown
        .querySelector("[data-single-trigger]")
        .setAttribute("aria-expanded", "false");
    });
  };

  ["type", "beds", "baths"].forEach((name) => {
    const select = form.querySelector(`select[name="${name}"]`);
    if (!select || select.dataset.enhanced === "true") return;

    select.dataset.enhanced = "true";
    select.classList.add("hero-native-select");

    const dropdown = document.createElement("div");
    dropdown.className = "hero-single-dropdown";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "hero-single-dropdown__trigger";
    trigger.dataset.singleTrigger = "";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const summary = document.createElement("span");
    summary.className = "hero-single-dropdown__summary";

    const chevron = document.createElement("span");
    chevron.className = "hero-single-dropdown__chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "⌄";

    trigger.append(summary, chevron);

    const menu = document.createElement("div");
    menu.className = "hero-single-dropdown__menu";
    menu.dataset.singleMenu = "";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    const sync = () => {
      const selected =
        select.options[select.selectedIndex] || select.options[0];

      summary.textContent = selected?.textContent?.trim() || "";

      menu.querySelectorAll("[data-single-option]").forEach((option) => {
        const isSelected = option.dataset.value === select.value;

        option.classList.toggle("is-selected", isSelected);
        option.setAttribute("aria-selected", String(isSelected));

        const check = option.querySelector(
          ".hero-single-dropdown__check"
        );

        if (check) check.textContent = isSelected ? "✓" : "";
      });
    };

    Array.from(select.options).forEach((nativeOption) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "hero-single-dropdown__option";
      option.dataset.singleOption = "";
      option.dataset.value = nativeOption.value;
      option.setAttribute("role", "option");

      const label = document.createElement("span");
      label.textContent = nativeOption.textContent?.trim() || "";

      const check = document.createElement("span");
      check.className = "hero-single-dropdown__check";
      check.setAttribute("aria-hidden", "true");

      option.append(label, check);

      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        select.value = nativeOption.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));

        sync();
        closeAll();
        trigger.focus();
      });

      menu.appendChild(option);
    });

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const opening = !dropdown.classList.contains("is-open");

      closeAll(dropdown);
      if (opening) {
        document.dispatchEvent(
          new CustomEvent("hero-dropdown:opened", { detail: dropdown })
        );
      }
      dropdown.classList.toggle("is-open", opening);
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
    });

    select.addEventListener("change", sync);

    dropdown.append(trigger, menu);
    select.insertAdjacentElement("afterend", dropdown);

    sync();
  });

  document.addEventListener("click", () => closeAll());
  document.addEventListener("hero-dropdown:opened", () => closeAll());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });

  let automaticFilterTimer;

  const applyHeroFiltersWithoutReload = () => {
    const resultsForm =
      document.getElementById("home-filter-form");

    if (!resultsForm) return;

    const selectedAreas = Array.from(
      form.querySelectorAll('input[name="area"]:checked')
    )
      .map((input) => String(input.value || "").trim())
      .filter(Boolean);

    if (resultsForm.elements.storyAreas) {
      resultsForm.elements.storyAreas.value =
        selectedAreas.join("|");
    }

    if (resultsForm.elements.area) {
      resultsForm.elements.area.value = "";
    }

    ["type", "maxPrice", "beds", "baths"].forEach((name) => {
      const heroControl = form.elements[name];
      const resultsControl = resultsForm.elements[name];

      if (heroControl && resultsControl) {
        resultsControl.value = heroControl.value;
      }
    });

    const nextUrl = new URL(window.location.href);
    nextUrl.search = "";

    const formData = new FormData(form);

    formData.forEach((value, key) => {
      const cleanValue = String(value || "").trim();

      if (cleanValue) {
        nextUrl.searchParams.append(key, cleanValue);
      }
    });

    window.history.replaceState(
      {},
      "",
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    );

    const hasActiveSearch =
      selectedAreas.length > 0 ||
      Boolean(form.elements.type?.value) ||
      Boolean(form.elements.maxPrice?.value) ||
      Boolean(form.elements.beds?.value) ||
      Boolean(form.elements.baths?.value);

    window.positionHomeResults(hasActiveSearch);
    resultsForm.dispatchEvent(
      new Event("change", { bubbles: true })
    );
  };

  form.addEventListener("change", (event) => {
    const control = event.target;

    if (
      !(control instanceof HTMLSelectElement) &&
      !(control instanceof HTMLInputElement)
    ) {
      return;
    }

    if (!["area", "type", "maxPrice", "beds", "baths"].includes(control.name)) {
      return;
    }

    clearTimeout(automaticFilterTimer);

    const delay = control.name === "area" ? 650 : 100;

    automaticFilterTimer = window.setTimeout(
      applyHeroFiltersWithoutReload,
      delay
    );
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(automaticFilterTimer);
    applyHeroFiltersWithoutReload();
  });

  window.setTimeout(() => {
    const hasInitialFilters =
      form.querySelectorAll(
        'input[name="area"]:checked'
      ).length > 0 ||
      Boolean(form.elements.type?.value) ||
      Boolean(form.elements.maxPrice?.value) ||
      Boolean(form.elements.beds?.value) ||
      Boolean(form.elements.baths?.value);

    if (hasInitialFilters) {
      applyHeroFiltersWithoutReload();
    }
  }, 0);
  window.addEventListener(
    "intent:cards-updated",
    () => {
      const map =
        document.getElementById("intent-map");

      if (
        !map ||
        map.hidden ||
        typeof window.initIntentGoogleMap !== "function"
      ) {
        return;
      }

      window.requestAnimationFrame(() => {
        window.initIntentGoogleMap();
      });
    }
  );})();