
  (() => {
    const heroForm =
      document.getElementById("home-hero-search");

    if (
      !heroForm ||
      window.__homePriceControllerForm === heroForm
    ) {
      return;
    }

    window.__homePriceControllerForm = heroForm;
    const filterScrollStorageKey =
      "home-filter-scroll-position";

    const savedFilterScrollPosition =
      sessionStorage.getItem(filterScrollStorageKey);

    if (savedFilterScrollPosition !== null) {
      sessionStorage.removeItem(filterScrollStorageKey);
      history.scrollRestoration = "manual";

      window.setTimeout(() => {
        const listingAnchor =
          document.getElementById("homepage-listings");

        const siteNav =
          document.querySelector(".site-nav");

        if (!listingAnchor) return;

        const navHeight =
          siteNav?.getBoundingClientRect().height || 0;

        const filterHeight =
          heroForm.getBoundingClientRect().height || 0;

        const anchorTop =
          listingAnchor.getBoundingClientRect().top +
          window.scrollY;

        window.scrollTo({
          top: Math.max(
            0,
            anchorTop -
            navHeight -
            filterHeight -
            18
          ),
          behavior: "instant",
        });
      }, 100);
    }

    const rememberFilterScrollPosition = () => {
      sessionStorage.setItem(
        filterScrollStorageKey,
        "listings"
      );
    };

    const priceBandDataElement =
      document.getElementById("home-price-bands-data");

    let priceBandsByType = {};

    try {
      priceBandsByType = JSON.parse(
        priceBandDataElement?.textContent || "{}"
      );
    } catch {
      priceBandsByType = {};
    }

    const bedroomDataElement =
      document.getElementById(
        "home-bedroom-options-data"
      );

    let bedroomOptionsByType = {};
    let bedroomInventoryData = [];

    try {
      const bedroomPayload = JSON.parse(
        bedroomDataElement?.textContent || "{}"
      );

      bedroomOptionsByType =
        bedroomPayload?.byType || bedroomPayload || {};

      bedroomInventoryData =
        Array.isArray(bedroomPayload?.inventory)
          ? bedroomPayload.inventory.map((r) => Array.isArray(r) ? { type: r[0], price: r[1], beds: r[2] } : r)
          : [];
    } catch {
      bedroomOptionsByType = {};
      bedroomInventoryData = [];
    }

    const heroTypeSelect =
      heroForm?.querySelector('select[name="type"]');

    const heroPriceSelect =
      heroForm?.querySelector('select[name="maxPrice"]');

    const heroBedsSelect =
      heroForm?.querySelector('select[name="beds"]');

    const heroBathsSelect =
      heroForm?.querySelector('select[name="baths"]');

    const heroMinPriceInput =
      heroForm?.querySelector('input[name="minPrice"]');

    const resultsForm =
      document.getElementById("home-filter-form");

    const resultsTypeSelect =
      resultsForm?.querySelector('select[name="type"]');

    const resultsPriceSelect =
      resultsForm?.querySelector('select[name="maxPrice"]');

    const resultsBedsSelect =
      resultsForm?.querySelector('select[name="beds"]');

    const resultsBathsSelect =
      resultsForm?.querySelector('select[name="baths"]');

    const resultsMinPriceInput =
      resultsForm?.querySelector('input[name="minPrice"]');

    const normalizeInventoryType = (value) => {
      const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      const aliases = {
        homes: "house",
        home: "house",
        houses: "house",
        condos: "condo",
        apartment: "condo",
        apartments: "condo",
        townhome: "townhouse",
        townhomes: "townhouse",
        mobiles: "mobile",
        "mobile-home": "mobile",
        "mobile-homes": "mobile",
        lots: "land",
      };

      return aliases[normalized] || normalized || "all";
    };

    const dispatchResultsChange = () => {
      resultsForm?.dispatchEvent(
        new Event("change", {
          bubbles: true,
        })
      );
    };

    const updateFilterUrl = ({
      typeValue,
      priceValue,
      bedsValue,
      bathsValue =
        heroBathsSelect instanceof HTMLSelectElement
          ? heroBathsSelect.value
          : "",
    }) => {
      const nextUrl = new URL(window.location.href);

      nextUrl.searchParams.delete("type");
      nextUrl.searchParams.delete("maxPrice");
      nextUrl.searchParams.delete("minPrice");
      nextUrl.searchParams.delete("beds");
      nextUrl.searchParams.delete("baths");

      if (typeValue) {
        nextUrl.searchParams.set("type", typeValue);
      }

      const overMatch =
        String(priceValue || "").match(/^over-(\d+)$/);

      if (overMatch) {
        nextUrl.searchParams.set("minPrice", overMatch[1]);
      } else if (priceValue) {
        nextUrl.searchParams.set(
          "maxPrice",
          String(priceValue)
        );
      }

      if (bedsValue) {
        nextUrl.searchParams.set("beds", bedsValue);
      }

      if (bathsValue) {
        nextUrl.searchParams.set("baths", bathsValue);
      }

      nextUrl.hash = "homepage-listings";

      window.history.replaceState(
        {},
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document
            .getElementById("homepage-listings")
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        });
      });
    };

    const rebuildSelectOptions = (
      select,
      bands,
      selectedValue = ""
    ) => {
      if (!(select instanceof HTMLSelectElement)) {
        return;
      }

      select.replaceChildren(
        new Option("Any Price", "")
      );

      bands.forEach((band) => {
        select.add(
          new Option(
            String(band.label || ""),
            String(band.value || "")
          )
        );
      });

      select.value = selectedValue;

      if (select.selectedIndex < 0) {
        select.selectedIndex = 0;
      }
    };

    const refreshBedroomOptions = ({
      resetInvalid = false,
    } = {}) => {
      if (
        !(heroTypeSelect instanceof HTMLSelectElement) ||
        !(heroBedsSelect instanceof HTMLSelectElement)
      ) {
        return;
      }

      const inventoryType =
        normalizeInventoryType(
          heroTypeSelect.value
        );

      const priceValue =
        heroPriceSelect instanceof HTMLSelectElement
          ? String(heroPriceSelect.value || "")
          : "";

      const overMatch =
        priceValue.match(/^over[-_](\d+)$/);

      const toListingPrice = (value) => {
        const numericValue =
          Number(value || 0);

        return (
          numericValue > 0 &&
          numericValue < 10000
        )
          ? numericValue * 1000
          : numericValue;
      };

      const maximumPrice =
        !overMatch && priceValue
          ? toListingPrice(priceValue)
          : 0;

      const minimumPrice =
        overMatch
          ? toListingPrice(overMatch[1])
          : 0;

      const matchingInventory =
        bedroomInventoryData.filter((listing) => {
          if (
            inventoryType !== "all" &&
            listing.type !== inventoryType
          ) {
            return false;
          }

          if (
            maximumPrice > 0 &&
            listing.price > maximumPrice
          ) {
            return false;
          }

          if (
            minimumPrice > 0 &&
            listing.price < minimumPrice
          ) {
            return false;
          }

          return true;
        });

      const availableBeds =
        [2, 3, 4, 5].filter(
          (threshold) =>
            matchingInventory.some(
              (listing) =>
                Number(listing.beds) >= threshold
            )
        );

      let selectedValue =
        heroBedsSelect.value;

      if (
        resetInvalid &&
        selectedValue &&
        !availableBeds.includes(
          Number(selectedValue)
        )
      ) {
        const previousSelection =
          Number(selectedValue);

        const nextLowerAvailable =
          [...availableBeds]
            .filter(
              (bedCount) =>
                bedCount < previousSelection
            )
            .sort(
              (a, b) => b - a
            )[0];

        selectedValue =
          nextLowerAvailable
            ? String(nextLowerAvailable)
            : "";
      }

      [heroBedsSelect, resultsBedsSelect]
        .filter(
          (select) =>
            select instanceof HTMLSelectElement
        )
        .forEach((select) => {
          select.replaceChildren(
            new Option("Any Beds", "")
          );

          [2, 3, 4, 5].forEach((bedCount) => {
            const isAvailable =
              availableBeds.includes(bedCount);

            select.add(
              new Option(
                isAvailable
                  ? `${bedCount}+ Beds`
                  : `${bedCount}+ Beds - notify me`,
                String(bedCount)
              )
            );
          });

          select.value = selectedValue;

          if (select.selectedIndex < 0) {
            select.selectedIndex = 0;
          }
        });

      const dropdown =
        heroBedsSelect.parentElement
          ?.querySelector(
            ":scope > .hero-single-dropdown"
          );

      const menu =
        dropdown?.querySelector(
          ".hero-single-dropdown__menu"
        );

      const summary =
        dropdown?.querySelector(
          ".hero-single-dropdown__summary"
        );

      if (!menu || !summary) {
        return;
      }

      menu.replaceChildren();

      [
        {
          value: "",
          label: "Any Beds",
        },
        ...[2, 3, 4, 5].map((bedCount) => ({
          value: String(bedCount),
          label: availableBeds.includes(bedCount)
            ? `${bedCount}+ Beds`
            : `${bedCount}+ Beds - notify me`,
        })),
      ].forEach((option) => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className =
          "hero-single-dropdown__option";

        button.dataset.singleOption = "";
        button.dataset.value = option.value;
        button.setAttribute("role", "option");

        const label =
          document.createElement("span");

        label.textContent = option.label;

        const check =
          document.createElement("span");

        check.className =
          "hero-single-dropdown__check";

        check.setAttribute(
          "aria-hidden",
          "true"
        );

        const selected =
          option.value === selectedValue;

        button.classList.toggle(
          "is-selected",
          selected
        );

        button.setAttribute(
          "aria-selected",
          String(selected)
        );

        check.textContent =
          selected ? "\u2713" : "";

        button.append(label, check);

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            heroBedsSelect.value =
              option.value;

            if (
              resultsBedsSelect instanceof
                HTMLSelectElement
            ) {
              resultsBedsSelect.value =
                option.value;
            }

            summary.textContent =
              option.label;

            dropdown.classList.remove(
              "is-open"
            );

            menu.hidden = true;

            heroBedsSelect.dispatchEvent(
              new Event("change", {
                bubbles: true,
              })
            );

            // notify-bed-opens-save-search-v1
            if (
              option.value &&
              !availableBeds.includes(
                Number(option.value)
              )
            ) {
              window.setTimeout(() => {
                document
                  .getElementById(
                    "hero-save-search-btn"
                  )
                  ?.click();
              }, 150);
            }
          }
        );

        menu.appendChild(button);
      });

      summary.textContent =
        heroBedsSelect
          .selectedOptions?.[0]
          ?.textContent?.trim() ||
        "Any Beds";
    };

    // initialize-price-aware-bedrooms-v1
    // Rebuild after the generic custom selects have been created.
    const initializeBedroomOptions = () => {
      refreshBedroomOptions({
        resetInvalid: false,
      });
    };

    document.addEventListener(
      "home-search-facets:ready",
      (event) => {
        const facets = event instanceof CustomEvent
          ? event.detail
          : null;

        if (!facets || typeof facets !== "object") return;

        if (
          facets.priceBandsByType &&
          typeof facets.priceBandsByType === "object"
        ) {
          priceBandsByType = facets.priceBandsByType;
        }

        if (
          facets.bedroomOptionsByType &&
          typeof facets.bedroomOptionsByType === "object"
        ) {
          bedroomOptionsByType = facets.bedroomOptionsByType;
        }

        if (Array.isArray(facets.bedroomInventory)) {
          bedroomInventoryData = facets.bedroomInventory;
        }

        if (
          facets.typeCounts &&
          typeof facets.typeCounts === "object" &&
          heroTypeSelect instanceof HTMLSelectElement
        ) {
          Array.from(heroTypeSelect.options).forEach((option) => {
            if (!option.value) return;

            const count = Math.max(
              0,
              Number(facets.typeCounts[option.value] || 0)
            );

            option.dataset.count = String(count);

            const customOption = Array.from(
              document.querySelectorAll(
                "#home-hero-search [data-single-option]"
              )
            ).find(
              (candidate) =>
                candidate instanceof HTMLElement &&
                candidate.dataset.value === option.value
            );

            const countElement = customOption?.querySelector(
              ".hero-single-dropdown__count"
            );

            if (countElement) {
              countElement.textContent = String(count);
            }
          });
        }

        renderPriceBands({
          reset: false,
          open: false,
        });

        refreshBedroomOptions({
          resetInvalid: false,
        });
      }
    );

    document.addEventListener(
      "home-search-dropdowns:ready",
      initializeBedroomOptions
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(
        initializeBedroomOptions
      );
    });

    window.setTimeout(
      initializeBedroomOptions,
      250
    );

    let priceDropdown = null;
    let priceTrigger = null;
    let priceSummary = null;
    let priceMenu = null;

    const setPriceMenuOpen = (open) => {
      if (
        !priceDropdown ||
        !priceTrigger ||
        !priceMenu
      ) {
        return;
      }

      priceDropdown.classList.toggle(
        "is-open",
        open
      );

      priceMenu.hidden = !open;

      priceTrigger.setAttribute(
        "aria-expanded",
        String(open)
      );

      if (open) {
        requestAnimationFrame(() => {
          priceMenu.scrollTop = 0;
        });
      }
    };

    const syncPriceMenuSelection = () => {
      if (
        !(heroPriceSelect instanceof HTMLSelectElement) ||
        !priceMenu ||
        !priceSummary
      ) {
        return;
      }

      const selectedValue = heroPriceSelect.value;

      priceMenu
        .querySelectorAll(
          ".hero-single-dropdown__option"
        )
        .forEach((button) => {
          const selected =
            button.dataset.value === selectedValue;

          button.classList.toggle(
            "is-selected",
            selected
          );

          button.setAttribute(
            "aria-selected",
            String(selected)
          );

          const check = button.querySelector(
            ".hero-single-dropdown__check"
          );

          if (check) {
            check.textContent =
              selected ? "\u2713" : "";
          }
        });

      priceSummary.textContent =
        heroPriceSelect
          .selectedOptions?.[0]
          ?.textContent?.trim() ||
        "Any Price";
    };

    const selectPrice = (value) => {
      if (
        !(heroPriceSelect instanceof HTMLSelectElement)
      ) {
        return;
      }

      heroPriceSelect.value = value;

      if (
        resultsPriceSelect instanceof HTMLSelectElement
      ) {
        resultsPriceSelect.value = value;
      }

      const overMatch =
        String(value || "").match(/^over-(\d+)$/);

      if (
        heroMinPriceInput instanceof HTMLInputElement
      ) {
        heroMinPriceInput.value =
          overMatch ? overMatch[1] : "";
      }

      if (
        resultsMinPriceInput instanceof HTMLInputElement
      ) {
        resultsMinPriceInput.value =
          overMatch ? overMatch[1] : "";
      }

      refreshBedroomOptions({
        resetInvalid: true,
      });

      syncPriceMenuSelection();
      setPriceMenuOpen(false);

      updateFilterUrl({
        typeValue:
          heroTypeSelect instanceof HTMLSelectElement
            ? heroTypeSelect.value
            : "",
        priceValue: value,
        bedsValue:
          heroBedsSelect instanceof HTMLSelectElement
            ? heroBedsSelect.value
            : "",
      });

      window.positionHomeResults?.(true);
      dispatchResultsChange();

      requestAnimationFrame(() => {
        const bedsDropdown =
          heroBedsSelect?.parentElement?.querySelector(
            ":scope > .hero-single-dropdown"
          );

        const bedsTrigger =
          bedsDropdown?.querySelector(
            ".hero-single-dropdown__trigger"
          );

        if (
          bedsTrigger instanceof HTMLButtonElement &&
          !bedsDropdown.classList.contains("is-open")
        ) {
          bedsTrigger.click();
        }
      });
    };

    const renderPriceBands = ({
      reset = false,
      open = false,
    } = {}) => {
      if (
        !(heroTypeSelect instanceof HTMLSelectElement) ||
        !(heroPriceSelect instanceof HTMLSelectElement) ||
        !priceMenu
      ) {
        return;
      }

      const inventoryType =
        normalizeInventoryType(
          heroTypeSelect.value
        );

      let bands =
        priceBandsByType[inventoryType] ||
        priceBandsByType.all ||
        [];

      const selectedValue =
        reset ? "" : heroPriceSelect.value;

      if (!reset && selectedValue && new URLSearchParams(location.search).get("from") === "greater-victoria" && !bands.some((band) => String(band.value) === selectedValue)) {
        const over = selectedValue.match(/^over-(\d+)$/);
        const amount = Number(over ? over[1] : selectedValue);
        if (Number.isFinite(amount) && amount > 0) {
          bands = [{ value: selectedValue, label: `${over ? "Over" : "Under"} $${(amount * 1000).toLocaleString("en-CA")}` }, ...bands];
        }
      }

      rebuildSelectOptions(
        heroPriceSelect,
        bands,
        selectedValue
      );

      rebuildSelectOptions(
        resultsPriceSelect,
        bands,
        selectedValue
      );

      priceMenu.replaceChildren();

      [
        {
          value: "",
          label: "Any Price",
        },
        ...bands,
      ].forEach((band) => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className =
          "hero-single-dropdown__option";

        button.dataset.value =
          String(band.value || "");

        button.setAttribute(
          "role",
          "option"
        );

        const label =
          document.createElement("span");

        label.textContent =
          String(band.label || "");

        const check =
          document.createElement("span");

        check.className =
          "hero-single-dropdown__check";

        check.setAttribute(
          "aria-hidden",
          "true"
        );

        button.append(label, check);

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            selectPrice(
              String(button.dataset.value || "")
            );
          }
        );

        priceMenu.appendChild(button);
      });

      syncPriceMenuSelection();

      if (open) {
        setPriceMenuOpen(true);
      }
    };

    if (
      heroPriceSelect instanceof HTMLSelectElement
    ) {
      heroPriceSelect.classList.add(
        "hero-native-select"
      );
      heroPriceSelect.hidden = true;
      heroPriceSelect.style.setProperty(
        "display",
        "none",
        "important"
      );

      heroPriceSelect.parentElement
        ?.querySelectorAll(".hero-single-dropdown")
        .forEach((dropdown) => dropdown.remove());

      priceDropdown =
        document.createElement("div");

      priceDropdown.className =
        "hero-single-dropdown";

      priceTrigger =
        document.createElement("button");

      priceTrigger.type = "button";
      priceTrigger.className =
        "hero-single-dropdown__trigger";

      priceTrigger.setAttribute(
        "aria-haspopup",
        "listbox"
      );

      priceTrigger.setAttribute(
        "aria-expanded",
        "false"
      );

      priceSummary =
        document.createElement("span");

      priceSummary.className =
        "hero-single-dropdown__summary";

      const chevron =
        document.createElement("span");

      chevron.className =
        "hero-single-dropdown__chevron";

      chevron.setAttribute(
        "aria-hidden",
        "true"
      );

      chevron.textContent = "\u2304";

      priceMenu =
        document.createElement("div");

      priceMenu.className =
        "hero-single-dropdown__menu";

      priceMenu.setAttribute(
        "role",
        "listbox"
      );

      priceMenu.hidden = true;

      priceTrigger.append(
        priceSummary,
        chevron
      );

      priceDropdown.append(
        priceTrigger,
        priceMenu
      );

      heroPriceSelect.insertAdjacentElement(
        "afterend",
        priceDropdown
      );

      heroPriceSelect.parentElement
        ?.querySelectorAll(".hero-single-dropdown")
        .forEach((dropdown) => {
          if (dropdown !== priceDropdown) {
            dropdown.remove();
          }
        });

      const enforceInventoryPriceDropdown = () => {
        heroPriceSelect.parentElement
          ?.querySelectorAll(
            ":scope > .hero-single-dropdown"
          )
          .forEach((dropdown) => {
            dropdown.style.setProperty(
              "display",
              dropdown === priceDropdown
                ? "block"
                : "none",
              "important"
            );
          });
      };

      enforceInventoryPriceDropdown();

      const priceDropdownObserver =
        new MutationObserver(
          enforceInventoryPriceDropdown
        );

      priceDropdownObserver.observe(
        heroPriceSelect.parentElement,
        {
          childList: true,
        }
      );

      priceTrigger.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          const opening = priceMenu.hidden;

          if (opening) {
            document.dispatchEvent(
              new CustomEvent("hero-dropdown:opened", {
                detail: priceDropdown,
              })
            );
          }

          setPriceMenuOpen(opening);
        }
      );

      renderPriceBands();

      window.setTimeout(() => {
        const dropdowns = Array.from(
          heroPriceSelect.parentElement
            ?.querySelectorAll(
              ":scope > .hero-single-dropdown"
            ) || []
        );

        dropdowns.slice(1).forEach(
          (dropdown) => dropdown.remove()
        );
      }, 100);
    }

    heroTypeSelect?.addEventListener(
      "change",
      () => {
        if (
          resultsTypeSelect instanceof HTMLSelectElement
        ) {
          resultsTypeSelect.value =
            heroTypeSelect.value;
        }

        if (
          heroMinPriceInput instanceof HTMLInputElement
        ) {
          heroMinPriceInput.value = "";
        }

        if (
          resultsMinPriceInput instanceof HTMLInputElement
        ) {
          resultsMinPriceInput.value = "";
        }

        refreshBedroomOptions({
          resetInvalid: true,
        });

        renderPriceBands({
          reset: true,
          open: false,
        });

        updateFilterUrl({
          typeValue: heroTypeSelect.value,
          priceValue: "",
          bedsValue:
            heroBedsSelect instanceof HTMLSelectElement
              ? heroBedsSelect.value
              : "",
        });

        window.positionHomeResults?.(true);
        dispatchResultsChange();

        requestAnimationFrame(() => {
          setPriceMenuOpen(true);
        });
      }
    );

    heroBedsSelect?.addEventListener(
      "change",
      () => {
        if (
          resultsBedsSelect instanceof HTMLSelectElement
        ) {
          resultsBedsSelect.value =
            heroBedsSelect.value;
        }

        updateFilterUrl({
          typeValue:
            heroTypeSelect instanceof HTMLSelectElement
              ? heroTypeSelect.value
              : "",
          priceValue:
            heroPriceSelect instanceof HTMLSelectElement
              ? heroPriceSelect.value
              : "",
          bedsValue: heroBedsSelect.value,
        });

        window.positionHomeResults?.(true);
        dispatchResultsChange();
      }
    );

    heroBathsSelect?.addEventListener(
      "change",
      () => {
        if (
          resultsBathsSelect instanceof HTMLSelectElement
        ) {
          resultsBathsSelect.value =
            heroBathsSelect.value;
        }

        updateFilterUrl({
          typeValue:
            heroTypeSelect instanceof HTMLSelectElement
              ? heroTypeSelect.value
              : "",
          priceValue:
            heroPriceSelect instanceof HTMLSelectElement
              ? heroPriceSelect.value
              : "",
          bedsValue:
            heroBedsSelect instanceof HTMLSelectElement
              ? heroBedsSelect.value
              : "",
          bathsValue: heroBathsSelect.value,
        });

        window.positionHomeResults?.(true);
        dispatchResultsChange();
      }
    );
    document.addEventListener(
      "click",
      async (event) => {
        if (
          priceDropdown &&
          !priceDropdown.contains(event.target)
        ) {
          setPriceMenuOpen(false);
        }
      }
    );
    // Fast hero search: keep area changes on the page, like price/beds/baths.
    heroForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!resultsForm) return;

      const selectedAreas = Array.from(
        heroForm.querySelectorAll('input[name="area"]:checked')
      )
        .map((input) => String(input.value || "").trim())
        .filter(Boolean);

      const storyAreasInput = resultsForm.elements.storyAreas;
      const areaSelect = resultsForm.elements.area;

      if (storyAreasInput) {
        storyAreasInput.value = selectedAreas.join("|");
      }

      if (areaSelect) {
        areaSelect.value = "";
      }

      // hero-advanced-sync-v1: carry More filters values into the results form
      ["minSqft", "minLotSqft", "minYear", "viewType", "waterfrontType", "oceanViews", "primaryOnMain", "threeSameFloor", "fourSameFloor", "age55", "otherPark", "petsAllowed"].forEach((name) => {
        const heroField = heroForm.elements.namedItem(name);
        const resultsField = resultsForm.elements.namedItem(name);
        if (!heroField || !(resultsField instanceof HTMLInputElement || resultsField instanceof HTMLSelectElement)) return;
        if (heroField instanceof HTMLInputElement && heroField.type === "checkbox") {
          resultsField.value = heroField.checked ? "true" : "";
        } else if (heroField instanceof HTMLInputElement || heroField instanceof HTMLSelectElement) {
          resultsField.value = String(heroField.value || "");
        }
      });
      ["type", "maxPrice", "beds", "baths", "minPrice"].forEach((name) => {
        const heroField = heroForm.elements.namedItem(name);
        const resultsField = resultsForm.elements.namedItem(name);

        if (
          heroField instanceof HTMLInputElement ||
          heroField instanceof HTMLSelectElement
        ) {
          if (
            resultsField instanceof HTMLInputElement ||
            resultsField instanceof HTMLSelectElement
          ) {
            resultsField.value = heroField.value;
          }
        }
      });

      if (resultsForm.elements.storyMaxPrice) {
        resultsForm.elements.storyMaxPrice.value = "";
      }

      // Keep the URL shareable/back-button friendly without reloading the page.
      const nextUrl = new URL(window.location.href);

      ["area", "type", "maxPrice", "minPrice", "beds", "baths"].forEach(
        (key) => nextUrl.searchParams.delete(key)
      );

      selectedAreas.forEach((selectedArea) => {
        nextUrl.searchParams.append("area", selectedArea);
      });

      ["type", "maxPrice", "minPrice", "beds", "baths"].forEach((name) => {
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

      resultsForm.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    });

    const multiselect =
      heroForm?.querySelector("[data-area-multiselect]");

    const trigger =
      multiselect?.querySelector("[data-area-trigger]");

    const menu =
      multiselect?.querySelector("[data-area-menu]");

    const summary =
      multiselect?.querySelector("[data-area-summary]");

    const clearButton =
      multiselect?.querySelector("[data-area-clear]");
    const doneFooter = multiselect?.querySelector("[data-area-done-footer]");
    const optionsScroll = multiselect?.querySelector("[data-area-options-scroll]");

    if (!heroForm || !multiselect || !trigger || !menu || !summary) {
      return;
    }

    const options = () =>
      Array.from(
        multiselect.querySelectorAll("[data-area-option]")
      );

    const checkedOptions = () =>
      options().filter((option) =>
        option.querySelector('input[name="area"]')?.checked
      );

    const labelText = (option) =>
      String(
        option.querySelector(
          "span:not(.area-multiselect__check)"
        )?.textContent || ""
      ).trim();

    let areaSelectionDirty = false;

    function closeMenu() {
      const wasOpen = !menu.hidden;

      menu.hidden = true;
      multiselect.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");

      if (wasOpen && areaSelectionDirty) {
        areaSelectionDirty = false;
        heroForm.requestSubmit();
      }
    }

    function openMenu() {
      sortSelectedAreasFirst();
      document.dispatchEvent(
        new CustomEvent("hero-dropdown:opened", { detail: multiselect })
      );
      menu.hidden = false;
      optionsScroll.scrollTop = 0;

      multiselect.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }

    function sortSelectedAreasFirst() {
      const selectedSet = new Set(checkedOptions());

      options()
        .sort((a, b) => {
          const aSelected = selectedSet.has(a);
          const bSelected = selectedSet.has(b);

          if (aSelected !== bSelected) {
            return aSelected ? -1 : 1;
          }

          return (
          Number(
            b.querySelector(".area-multiselect__count")?.textContent || 0
          ) -
          Number(
            a.querySelector(".area-multiselect__count")?.textContent || 0
          )
        ) || labelText(a).localeCompare(labelText(b));
        })
        .forEach((option) => optionsScroll.appendChild(option));

      if (clearButton) {
        optionsScroll.prepend(clearButton);
      }
    }
    function syncDropdown() {
      const selected = checkedOptions();
      const selectedSet = new Set(selected);

      options().forEach((option) => {
        const input =
          option.querySelector('input[name="area"]');

        const check =
          option.querySelector(".area-multiselect__check");

        option.classList.toggle(
          "is-selected",
          Boolean(input?.checked)
        );

        if (check) {
          check.textContent = "";
        }
      });

      clearButton?.classList.toggle(
        "is-selected",
        selected.length === 0
      );

      const clearCheck =
        clearButton?.querySelector(
          ".area-multiselect__check"
        );

      if (clearCheck) {
        clearCheck.textContent = "";
      }

      if (clearButton) {
        optionsScroll.prepend(clearButton);
      }

      summary.textContent =
        selected.length === 0
          ? "All Neighbourhoods"
          : selected.length === 1
          ? labelText(selected[0])
          : `${selected.length} neighbourhoods`;
    }

    trigger.addEventListener("click", () => {
      menu.hidden ? openMenu() : closeMenu();
    });
    doneFooter.querySelector("button").addEventListener("click", closeMenu);

    multiselect.addEventListener("change", (event) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.name === "area"
      ) {
        const scrollPosition = optionsScroll.scrollTop;
        syncDropdown();
        areaSelectionDirty = true;
        requestAnimationFrame(() => {
          optionsScroll.scrollTop = scrollPosition;
          window.setTimeout(() => {
            optionsScroll.scrollTop = scrollPosition;
          }, 0);
        });

        requestAnimationFrame(() => {
          menu.scrollTop = 0;
          optionsScroll.scrollTop = 0;
        });
      }
    });

    clearButton?.addEventListener("click", () => {
      options().forEach((option) => {
        const input =
          option.querySelector('input[name="area"]');

        if (input) {
          input.checked = false;
        }
      });

      syncDropdown();
      areaSelectionDirty = false;
      rememberFilterScrollPosition();
          heroForm.requestSubmit();
    });

    document.addEventListener("click", async (event) => {
      if (!multiselect.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("hero-dropdown:opened", (event) => {
      if (event.detail !== multiselect) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        trigger.focus();
      }
    });

    syncDropdown();
  })();
