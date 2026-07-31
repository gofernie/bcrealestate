  document.addEventListener(
    "click",
    async (event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      /*
       * Open and close the saved-search panel.
       */
      const openButton =
        target.closest(
          "[data-save-search-open]"
        );

      if (
        openButton instanceof
        HTMLButtonElement
      ) {
        const saveSearch =
          openButton.closest(
            "[data-save-search]"
          );

        const panel =
          saveSearch?.querySelector(
            "[data-save-search-panel]"
          );

        if (
          panel instanceof HTMLElement
        ) {
          const opening =
            panel.hidden;

          panel.hidden = !opening;

          openButton.setAttribute(
            "aria-expanded",
            String(opening)
          );

          openButton.textContent =
            opening
              ? "Close"
              : "Save search";
        }

        return;
      }

      /*
       * Submit the saved search.
       */
      const submitButton =
        target.closest(
          "[data-save-search-submit]"
        );

      if (
        !(
          submitButton instanceof
          HTMLButtonElement
        )
      ) {
        return;
      }

      const saveSearch =
        submitButton.closest(
          "[data-save-search]"
        );

      if (
        !(saveSearch instanceof HTMLElement)
      ) {
        return;
      }

      const phoneInput =
        saveSearch.querySelector(
          'input[name="phone"]'
        );

      const emailInput =
        saveSearch.querySelector(
          'input[name="email"]'
        );

      const channelInput =
        saveSearch.querySelector(
          'input[name="channel"]:checked'
        );

      const frequencyInput =
        saveSearch.querySelector(
          'input[name="frequency"]:checked'
        );

      const phone =
        phoneInput instanceof HTMLInputElement
          ? phoneInput.value.trim()
          : "";

      const email =
        emailInput instanceof HTMLInputElement
          ? emailInput.value
              .trim()
              .toLowerCase()
          : "";

      const channel =
        channelInput instanceof HTMLInputElement
          ? channelInput.value
          : "sms";

      const frequency =
        frequencyInput instanceof HTMLInputElement
          ? frequencyInput.value
          : "daily";

      if (
        channel === "sms" &&
        !phone
      ) {
        window.alert(
          "Enter a phone number for text alerts."
        );

        return;
      }

      if (
        channel === "email" &&
        !email
      ) {
        window.alert(
          "Enter an email address for email alerts."
        );

        return;
      }

      submitButton.disabled = true;
      submitButton.textContent =
        "Saving...";

      try {
        const filters = {};

        /*
         * Start with the search represented by
         * the slug page itself.
         */
        const defaultArea =
          String(
            saveSearch.dataset
              .defaultArea || ""
          ).trim();

        const defaultType =
          String(
            saveSearch.dataset
              .defaultType || ""
          ).trim();

        const defaultMinPrice =
          String(
            saveSearch.dataset
              .defaultMinPrice || ""
          ).trim();

        const defaultMaxPrice =
          String(
            saveSearch.dataset
              .defaultMaxPrice || ""
          ).trim();

        if (defaultArea) {
          filters.area = [
            defaultArea
          ];
        }

        if (defaultType) {
          filters.type =
            defaultType;
        }

        if (defaultMinPrice) {
          filters.minPrice =
            defaultMinPrice;
        }

        if (defaultMaxPrice) {
          filters.maxPrice =
            defaultMaxPrice;
        }

        /*
         * Apply the buyer's currently selected
         * client-side refinements.
         */
        const areaSelect =
          document.querySelector(
            ".area-filter-select"
          );

        const typeSelect =
          document.querySelector(
            ".type-filter-select"
          );

        const bedsSelect =
          document.querySelector(
            ".beds-filter-select"
          );

        const priceSelect =
          document.querySelector(
            ".price-filter-select"
          );

        if (
          areaSelect instanceof
          HTMLSelectElement
        ) {
          const areaValue =
            String(
              areaSelect.value || ""
            )
              .toLowerCase()
              .trim();

          if (
            areaValue &&
            areaValue !== "all" &&
            !areaValue.startsWith("/")
          ) {
            filters.area = [
              areaValue
            ];
          }
        }

        if (
          typeSelect instanceof
          HTMLSelectElement
        ) {
          const typeValue =
            String(
              typeSelect.value || ""
            )
              .toLowerCase()
              .trim();

          if (
            typeValue &&
            typeValue !== "all"
          ) {
            filters.type =
              typeValue;
          }
        }

        if (
          bedsSelect instanceof
          HTMLSelectElement
        ) {
          const bedsValue =
            String(
              bedsSelect.value || ""
            )
              .toLowerCase()
              .trim();

          if (
            bedsValue &&
            bedsValue !== "all"
          ) {
            const bedsNumber =
              bedsValue.match(/\d+/)?.[0];

            if (bedsNumber) {
              filters.beds =
                bedsNumber;
            }
          }
        }

        /*
         * Handle common price select formats:
         * 900000
         * under-900000
         * 500000-900000
         * over-900000
         */
        if (
          priceSelect instanceof
          HTMLSelectElement
        ) {
          const priceValue =
            String(
              priceSelect.value || ""
            )
              .toLowerCase()
              .trim();

          if (
            priceValue &&
            priceValue !== "all"
          ) {
            const numbers =
              priceValue.match(
                /\d+/g
              ) || [];

            if (
              priceValue.includes(
                "under"
              ) ||
              priceValue.includes(
                "max"
              ) ||
              priceValue.includes(
                "up-to"
              )
            ) {
              if (numbers[0]) {
                filters.maxPrice =
                  numbers[0];
              }
            } else if (
              priceValue.includes(
                "over"
              ) ||
              priceValue.includes(
                "min"
              ) ||
              priceValue.includes(
                "plus"
              )
            ) {
              if (numbers[0]) {
                filters.minPrice =
                  numbers[0];
              }
            } else if (
              numbers.length >= 2
            ) {
              filters.minPrice =
                numbers[0];

              filters.maxPrice =
                numbers[1];
            } else if (
              numbers.length === 1
            ) {
              filters.maxPrice =
                numbers[0];
            }
          }
        }

        /*
         * Preserve explicit URL refinements too.
         */
        const searchParams =
          new URLSearchParams(
            window.location.search
          );

        searchParams.delete("page");
        searchParams.delete("listing");
        searchParams.delete("listing_id");
        searchParams.delete("new");
        searchParams.delete("root_rewrite");

        searchParams.forEach(
          (value, key) => {
            if (!value) {
              return;
            }

            if (key === "area") {
              if (
                !Array.isArray(
                  filters.area
                )
              ) {
                filters.area = [];
              }

              if (
                !filters.area.includes(
                  value
                )
              ) {
                filters.area.push(
                  value
                );
              }

              return;
            }

            filters[key] =
              value;
          }
        );

        /*
         * Preserve specialized intent-page
         * requirements in the saved definition.
         */
        const waterfrontType =
          String(
            saveSearch.dataset
              .waterfrontType || ""
          ).trim();

        if (waterfrontType) {
          filters.waterfrontType =
            waterfrontType;
        }

        if (
          saveSearch.dataset
            .requiresWaterfront ===
          "true"
        ) {
          filters.waterfront =
            true;
        }

        if (
          saveSearch.dataset
            .requiresOceanView ===
          "true"
        ) {
          filters.oceanView =
            true;
        }

        const siteId =
          saveSearch.dataset.siteId ||
          null;

        const city =
          saveSearch.dataset.city ||
          "";

        const response =
          await fetch(
            "/api/saved-searches",
            {
              method: "POST",

              headers: {
                "content-type":
                  "application/json",
              },

              body: JSON.stringify({
                siteId,
                city,
                phone,
                email,
                channel,
                frequency,
                filters,
              }),
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            result?.error ||
              "Unable to save search."
          );
        }

        saveSearch.innerHTML = `
          <div class="bc-save-search__success">
            <p class="bc-save-search__eyebrow">
              Search saved
            </p>

            <h3>
              You're all set.
            </h3>

            <p>
              We'll send you new matches when they appear.
            </p>
          </div>
        `;
      } catch (error) {
        console.error(
          "Slug-page save search failed:",
          error
        );

        window.alert(
          error instanceof Error
            ? error.message
            : "Unable to save search."
        );

        submitButton.disabled =
          false;

        submitButton.textContent =
          "Save my search";
      }
    }
  );
