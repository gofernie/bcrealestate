
/* inventory-aware-price-bands-v2 */
(() => {
  const priceSelect =
    document.querySelector(".price-filter-select");

  const typeSelect =
    document.querySelector(".type-filter-select");

  if (
    !(priceSelect instanceof HTMLSelectElement) ||
    priceSelect.dataset.inventoryPricingReady === "true"
  ) {
    return;
  }

  priceSelect.dataset.inventoryPricingReady = "true";

  const normalizeType = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    const aliases = {
      all: "all",
      home: "house",
      homes: "house",
      houses: "house",
      condo: "condo",
      condos: "condo",
      apartment: "condo",
      apartments: "condo",
      townhome: "townhouse",
      townhomes: "townhouse",
      "mobile-home": "mobile",
      "mobile-homes": "mobile",
      lot: "land",
      lots: "land",
    };

    return aliases[normalized] || normalized || "all";
  };

  const getActiveType = () => {
    if (typeSelect instanceof HTMLSelectElement) {
      return normalizeType(typeSelect.value);
    }

    return normalizeType(
      document
        .getElementById("dynamic-results-heading")
        ?.dataset.fixedTypeLabel || "all"
    );
  };

  const getInventory = () => {
    try {
      const inventory = JSON.parse(
        document.getElementById(
          "price-band-inventory-data"
        )?.textContent || "[]"
      );

      if (Array.isArray(inventory) && inventory.length) {
        return inventory;
      }
    } catch {}

    return [];
  };

  const isFractionalOwnership = (listing) => {
    const text = String(
      listing.address || ""
    ).toLowerCase();

    return (
      /\b\d+[a-z]\s*[-–]/i.test(text) ||
      /\b(?:fractional|quarter[- ]?share|1\/4|1\/8|shared ownership)\b/i.test(text)
    );
  };

  const getPrices = (ownership = "all") => {
    const activeType = getActiveType();

    return getInventory()
      .filter((listing) => {
        if (
          activeType !== "all" &&
          normalizeType(listing.type) !== activeType
        ) {
          return false;
        }

        if (ownership === "fractional") {
          return isFractionalOwnership(listing);
        }

        if (ownership === "full") {
          return !isFractionalOwnership(listing);
        }

        return true;
      })
      .map((listing) =>
        Number(
          String(listing.price || 0)
            .replace(/[^0-9.]/g, "")
        )
      )
      .filter(
        (price) =>
          Number.isFinite(price) &&
          price >= 50000
      )
      .sort((a, b) => a - b);
  };

  const percentile = (prices, amount) => {
    if (!prices.length) return 0;

    return prices[
      Math.min(
        prices.length - 1,
        Math.max(
          0,
          Math.round(
            (prices.length - 1) * amount
          )
        )
      )
    ];
  };

  const roundMarketPrice = (price) => {
    const increment =
      price < 600000
        ? 50000
        : price < 1500000
          ? 100000
          : price < 4000000
            ? 250000
            : 500000;

    return Math.max(
      increment,
      Math.round(price / increment) * increment
    );
  };

  const floorMarketPrice = (price) => {
    const increment =
      price < 600000
        ? 50000
        : price < 1500000
          ? 100000
          : price < 4000000
            ? 250000
            : 500000;

    return Math.max(
      increment,
      Math.floor(price / increment) * increment
    );
  };

  const formatBandPrice = (price) => {
    if (price >= 1000000) {
      const millions = price / 1000000;

      return `${Number.isInteger(millions)
        ? millions.toFixed(0)
        : millions
            .toFixed(2)
            .replace(/0+$/, "")
            .replace(/\.$/, "")
      }M`;
    }

    return `${Math.round(price / 1000)}k`;
  };

  const uniqueSorted = (values) =>
    Array.from(new Set(values))
      .filter((value) => value > 0)
      .sort((a, b) => a - b);

  const regularOptions = (prices) => {
    if (!prices.length) {
      return [
        {
          label: "Any Price",
          value: "all",
        },
      ];
    }

    const maximum = prices.at(-1);
    const cuts = uniqueSorted(
      [0.25, 0.5, 0.75]
        .map((amount) =>
          roundMarketPrice(
            percentile(prices, amount)
          )
        )
        .filter(
          (price) =>
            price > 0 &&
            price < maximum
        )
    );

    const options = [
      {
        label: "Any Price",
        value: "all",
      },
    ];

    if (!cuts.length) {
      options.push({
        label: `Under ${formatBandPrice(maximum)}`,
        value: `under-${Math.round(maximum / 1000)}`,
      });

      return options;
    }

    options.push({
      label: `Under ${formatBandPrice(cuts[0])}`,
      value: `under-${Math.round(cuts[0] / 1000)}`,
    });

    cuts.slice(1).forEach((cut, index) => {
      const previous = cuts[index];

      options.push({
        label: `${formatBandPrice(previous)}–${formatBandPrice(cut)}`,
        value: `${Math.round(previous / 1000)}-${Math.round(cut / 1000)}`,
      });
    });

    const lastCut = cuts.at(-1);

    options.push({
      label: `${formatBandPrice(lastCut)}+`,
      value: `${Math.round(lastCut / 1000)}-plus`,
    });

    return options;
  };

  const fernieOwnershipOptions = () => {
    const hostname =
      window.location.hostname.toLowerCase();

    if (hostname !== "fernie.homes") return null;

    const fractionalPrices =
      getPrices("fractional");

    const fullTitlePrices =
      getPrices("full");

    if (
      !fractionalPrices.length ||
      !fullTitlePrices.length
    ) {
      return null;
    }

    const fullStart = floorMarketPrice(
      fullTitlePrices[0]
    );

    const fullMaximum =
      fullTitlePrices.at(-1);

    const fullCuts = uniqueSorted(
      [0.5, 0.8]
        .map((amount) =>
          roundMarketPrice(
            percentile(
              fullTitlePrices,
              amount
            )
          )
        )
        .filter(
          (price) =>
            price > fullStart &&
            price < fullMaximum
        )
    );

    const options = [
      {
        label: "Any Price",
        value: "all",
      },
      {
        label: `Fractional ownership · under ${formatBandPrice(
          fractionalPrices.at(-1)
        )}`,
        value: `under-${Math.round(
          fractionalPrices.at(-1) / 1000
        )}`,
      },
    ];

    let lowerBound = fullStart;

    fullCuts.forEach((upperBound) => {
      options.push({
        label: `Full ownership · ${formatBandPrice(
          lowerBound
        )}–${formatBandPrice(upperBound)}`,
        value: `${Math.round(
          lowerBound / 1000
        )}-${Math.round(
          upperBound / 1000
        )}`,
      });

      lowerBound = upperBound;
    });

    options.push({
      label: `Full ownership · ${formatBandPrice(
        lowerBound
      )}+`,
      value: `${Math.round(
        lowerBound / 1000
      )}-plus`,
    });

    return options;
  };

  const syncCustomPriceDropdown = () => {
    const dropdown =
      priceSelect.parentElement?.querySelector(
        ".filter-dd--price"
      );

    const menu =
      dropdown?.querySelector(
        ".filter-dd__menu"
      );

    const value =
      dropdown?.querySelector(
        ".filter-dd__value"
      );

    if (!dropdown || !menu || !value) return;

    menu
      .querySelectorAll(".filter-dd__option")
      .forEach((button) => button.remove());

    Array.from(priceSelect.options).forEach(
      (option) => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className = "filter-dd__option";
        button.dataset.value = option.value;

        const text =
          document.createElement("span");

        text.textContent = option.textContent;

        const check =
          document.createElement("span");

        check.className = "filter-dd__check";
        check.textContent = "\u2713";

        button.append(text, check);

        button.addEventListener("click", () => {
          priceSelect.value = option.value;

          priceSelect.dispatchEvent(
            new Event("change", {
              bubbles: true,
            })
          );

          dropdown.classList.remove("is-open");
        });

        menu.appendChild(button);
      }
    );

    const selected =
      priceSelect.options[
        priceSelect.selectedIndex
      ] || priceSelect.options[0];

    value.textContent =
      selected?.textContent || "Any Price";

    menu
      .querySelectorAll(".filter-dd__option")
      .forEach((button) => {
        button.classList.toggle(
          "is-selected",
          button.dataset.value ===
            priceSelect.value
        );
      });
  };

  const rebuildPriceBands = () => {
    const requestedValue =
      new URLSearchParams(
        window.location.search
      ).get("price") ||
      priceSelect.value ||
      "all";

    const options =
      fernieOwnershipOptions() ||
      (() => {
        const prices = getPrices();

        return prices.length
          ? regularOptions(prices)
          : [
              { label: "Any Price", value: "all" },
              { label: "Under $450k", value: "under-450" },
              { label: "$450k - $650k", value: "450-650" },
              { label: "$650k - $850k", value: "650-850" },
              { label: "$850k - $1.1M", value: "850-1100" },
              { label: "$1.1M+", value: "1100-plus" },
            ];
      })();

    priceSelect.replaceChildren();

    options.forEach((option) => {
      priceSelect.add(
        new Option(
          option.label,
          option.value
        )
      );
    });

    const valueExists = Array.from(
      priceSelect.options
    ).some(
      (option) =>
        option.value === requestedValue
    );

    priceSelect.value =
      valueExists ? requestedValue : "all";

    syncCustomPriceDropdown();
  };

  rebuildPriceBands();

  typeSelect?.addEventListener(
    "change",
    rebuildPriceBands
  );
})();
