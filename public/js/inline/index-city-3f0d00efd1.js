
  (() => {
    const form = document.getElementById("home-filter-form");
    const resultsHeading = document.getElementById("results-heading");
const city = document.querySelector("[data-city]")?.dataset.city || "nanaimo";

    function esc(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

   function cardHtml(listing) {
  const sqft = listing.sqft ? Number(listing.sqft).toLocaleString() : "";
  const brokerage = String(
    listing.listing_brokerage || listing.brokerage || ""
  ).trim();
  const ownershipText = [
    listing.description,
    listing.raw?.description,
    listing.raw?.details?.description,
  ].filter(Boolean).join(" | ");

  const ownershipBadge =
    /\bfractional\b|\b1\s*\/\s*(?:4|8)\s*(?:ownership|interest|share)\b|\b(?:quarter|one[-\s]?quarter|half|one[-\s]?half|eighth|one[-\s]?eighth)[-\s]+(?:ownership|interest|share)\b/i.test(ownershipText)
      ? "Fractional Ownership"
      : /\btime[-\s]?share\b|\bweek\s+\d+\b/i.test(ownershipText)
        ? "Timeshare"
        : /\bphase\s*(?:ii|2)\b/i.test(ownershipText)
          ? "Hotel Phase II"
          : /\bhotel\b/i.test(ownershipText)
            ? "Hotel Suite"
            : "";
  const isFractionalOwnership =
    /\bfractional\b|\b1\s*\/\s*(?:4|8)\s*(?:ownership|interest|share)\b|\b(?:quarter|one[-\s]?quarter|half|one[-\s]?half|eighth|one[-\s]?eighth)[-\s]+(?:ownership|interest|share)\b/i.test(
      [
        listing.description,
        listing.ownership_type,
        listing.ownershipType,
      ]
        .filter(Boolean)
        .join(" ")
    );

  return `
    <article
      class="card original-card"
      data-raw-price="${esc(listing.price)}" data-original-price="${esc(listing.original_price || "")}" data-listed-at="${esc(listing.listed_at || listing.created_at || "")}" data-waterfront="${listing.waterfront === true || listing.waterfront === "true"}" data-ocean-view="${listing.ocean_view === true || listing.ocean_view === "true"}" data-year-built="${esc(listing.year_built || "")}" data-lot-acres="${esc(listing.lot_size_acres || "")}" data-lot-size="${esc(listing.lot_size_sqft ? listing.lot_size_sqft + " ft" : "")}" data-back-on-market="${esc(listing.back_on_market_at || "")}"
      data-item-id="${esc(listing.id)}"
      data-card-id="${esc(listing.id)}"
      data-listing-id="${esc(listing.id)}"
      data-price="${esc(listing.price)}"
      data-raw-price="${esc(listing.rawPrice)}"
      data-listed-at="${esc(listing.listedAt)}"
      data-address="${esc(listing.address)}"
      data-meta="${esc(`${listing.beds || "-"} bed | ${listing.baths || "-"} bath`)}"
      data-image="${esc(listing.image)}"
      data-images='${esc(JSON.stringify(listing.images || []))}'
      data-beds="${esc(listing.beds)}"
      data-baths="${esc(listing.baths)}"
      data-sqft="${esc(listing.sqft)}"
      data-description="${esc(listing.description)}"

      data-fractional="${isFractionalOwnership ? "true" : "false"}"
      data-property-type="${esc(listing.propertyType)}"
      data-type="${esc(listing.type)}"
      data-year="${esc(listing.year)}"
      data-lot-size="${esc(listing.lotSize)}"
      data-area="${esc(listing.area)}"
      data-ocean-view="${esc(listing.oceanView)}"
      data-view-type="${esc(listing.viewType)}"
      data-waterfront="${esc(listing.waterfront)}"
      data-waterfront-type="${esc(listing.waterfrontType)}"
      data-liked-tags="[]"
      data-is-favourite="false"
      data-decision=""
      data-lat="${esc(listing.lat)}"
      data-lng="${esc(listing.lng)}"
      data-city="${esc(listing.city)}"
      data-mls="${esc(listing.mls)}"
      data-listing-brokerage="${esc(brokerage)}"
      aria-label="${esc(`${listing.price}   ${listing.address}`)}"
    >
      <div class="card-image-wrap" style="position: relative; overflow: hidden;">
        <img src="${esc(window.__optCardImg ? window.__optCardImg(listing.image || "https://placehold.co/800x600?text=Photos+coming+soon") : (listing.image || "https://placehold.co/800x600?text=Photos+coming+soon"))}" alt="${esc(listing.address || "Listing")}" loading="lazy" decoding="async" />

        ${ownershipBadge ? '<span class="fractional-ownership-badge" style="position:absolute;z-index:2;left:8px;bottom:8px;display:block;padding:3px 6px;background:rgba(23,35,44,.42);color:rgba(255,255,255,.9);border:0;border-radius:4px;font-size:10px;font-weight:600;line-height:1.1;text-transform:none;letter-spacing:0;box-shadow:none;">' + esc(ownershipBadge) + '</span>' : ""}
      </div>

      <div class="card-body">
        <div class="price">${esc(listing.price)}</div>
        <div class="address">${esc(listing.address)}</div>
<div class="card-city">${esc(String(listing.city || city || "Nanaimo").replace(/\b\w/g, (char) => char.toUpperCase()))}, BC</div>
        <div class="meta">
          <span>${esc(listing.beds || "-")} bd</span>
          <span>${esc(listing.baths || "-")} ba</span>
          ${sqft ? `<span>${esc(sqft)} sq ft</span>` : ""}
          ${listing.lotSize ? `<span>Lot ${esc(listing.lotSize)}</span>` : ""}
        </div>

        ${brokerage ? `<div class="card-brokerage">Courtesy of ${esc(brokerage)}</div>` : ""}

        <div class="card-decision-badge" hidden></div>
      </div>
    </article>
  `;
}

   const HOME_PAGE_SIZE = 24;
   let homeOffset = document.querySelectorAll(".grid > .card").length;
   let homeTotal = Number(document.getElementById("results-count")?.textContent || 0);
   let homeLoading = false;
let homeAreaBufferKm = 0;
      window.__homeAreaBufferKm = 0;

    function getLoadMoreButton() {
      return document.getElementById("home-load-more");
    }

   let lastMatchingCount = 0;

function updateLoadMoreBtn() {
  const btn = getLoadMoreButton();
  if (!btn) return;

  btn.disabled = homeLoading;
  btn.textContent = homeLoading ? "Loading..." : "Load more listings";
  btn.style.display = homeOffset < homeTotal ? "block" : "none";
}

function showMoreCards() {
      fetchHomeListings({ append: true, resetVisible: false });
    }

    document.getElementById("home-load-more")?.addEventListener("click", showMoreCards);

    // Capture this action before desktop overlays or later handlers can intercept it.
    if (!window.__homeLoadMoreCaptureBound) {
      window.__homeLoadMoreCaptureBound = true;

      document.addEventListener(
        "click",
        (event) => {
          const target = event.target;
          const button =
            target instanceof Element
              ? target.closest("#home-load-more")
              : null;

          if (!button || homeLoading) return;

          event.preventDefault();
          event.stopPropagation();
          fetchHomeListings({ append: true, resetVisible: false });
        },
        true
      );
    }
    updateLoadMoreBtn();

    /* homepage-search-next-step-v1 */
    function syncHomeSearchComplete() {
      const footer = document.getElementById("home-search-complete");
      const eyebrow = document.getElementById(
        "home-search-complete-eyebrow"
      );
      const title = footer?.querySelector("strong");
      const copy = document.getElementById("home-search-complete-copy");
      const budgetButton = document.getElementById("home-more-budget-btn");
      const neighbourhoodButton = document.getElementById(
        "home-change-neighbourhood-btn"
      );

      if (!footer || !form) return;

      const selectedAreas = String(form.elements.storyAreas?.value || "")
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean);

      const selectedArea = String(form.elements.area?.value || "").trim();
      const storyBudget = Number(form.elements.storyMaxPrice?.value || 0);
      const maxPrice = Number(form.elements.maxPrice?.value || 0);
      const currentBudget = storyBudget || maxPrice;
      const priceSelect = form.elements.maxPrice;
      const nextBudget =
        currentBudget &&
        priceSelect instanceof HTMLSelectElement
          ? Array.from(priceSelect.options)
              .map((option) => Number(option.value || 0))
              .filter((value) => value > currentBudget)
              .sort((a, b) => a - b)[0] || 0
          : 0;

      const hasOpenEndedNextBand =
        !nextBudget &&
        currentBudget &&
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
      const hasArea = selectedAreas.length > 0 || Boolean(selectedArea);

      const typeValue = String(form.elements.type?.value || "").toLowerCase();
      const typeLabel =
        {
          house: "homes",
          condo: "condos",
          townhouse: "townhomes",
          mobile: "mobile homes",
          land: "lots",
          "multi-family": "multi-family homes",
        }[typeValue] || "homes";

      const titleCase = (value) =>
        String(value || "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (character) => character.toUpperCase());

      const areaLabel = selectedAreas.length
        ? selectedAreas.map(titleCase).join(" & ")
        : selectedArea
          ? titleCase(selectedArea)
          : "";

      const formatBudgetLabel = (value) =>
        value >= 1000
          ? `${(value / 1000).toFixed(1)}M`
          : `${value}k`;

      const budgetLabel = formatBudgetLabel(currentBudget);
      const nextBudgetLabel = nextBudget
        ? formatBudgetLabel(nextBudget)
        : "";

      const loadMoreButton = document.getElementById("home-load-more");

      const isComplete =
        !homeLoading &&
        homeTotal > 0 &&
        homeOffset >= homeTotal &&
        (currentBudget > 0 || hasArea) &&
        (
          !loadMoreButton ||
          loadMoreButton.hidden ||
          getComputedStyle(loadMoreButton).display === "none"
        );

      footer.hidden = !isComplete;

      if (!isComplete) return;

      if (title) {
        title.textContent = areaLabel
          ? `You've seen every match in ${areaLabel}`
          : "You've seen every match";
      }

      if (copy) {
        if (areaLabel && currentBudget) {
          copy.textContent =
            `We found ${homeTotal} ${typeLabel} in ${areaLabel} up to ${budgetLabel}. ` +
            "Where would you like to expand next?";
        } else if (currentBudget) {
          copy.textContent =
            `We found ${homeTotal} ${typeLabel} up to ${budgetLabel}. ` +
            (nextBudget
              ? `Expand your search to include ${typeLabel} up to ${nextBudgetLabel}.`
              : hasOpenEndedNextBand
                ? `Expand your search to include ${typeLabel} over ${budgetLabel}.`
                : "There are no higher price bands available.");
        } else {
          copy.textContent =
            `We found ${homeTotal} ${typeLabel} in ${areaLabel}. ` +
            "Where would you like to look next?";
        }
      }

      if (budgetButton) {
        budgetButton.hidden = !nextBudget && !hasOpenEndedNextBand;

        if (nextBudget) {
          budgetButton.textContent =
            `See ${typeLabel} up to ${nextBudgetLabel}`;
        } else if (hasOpenEndedNextBand) {
          budgetButton.textContent =
            `Show all ${typeLabel}`;
        }
      }

      if (neighbourhoodButton) {
        neighbourhoodButton.hidden = !hasArea;

        if (hasArea) {
          neighbourhoodButton.textContent =
            `Search 1 km beyond ${areaLabel}`;
        }
      }
    }

    const originalUpdateLoadMoreBtn = updateLoadMoreBtn;

    updateLoadMoreBtn = function () {
      originalUpdateLoadMoreBtn();
      syncHomeSearchComplete();
    };

        const scrollHomeListingsToStart = () => {
      const listingsStart = document.getElementById(
        "homepage-listings"
      );

      if (!listingsStart) return;

      window.scrollTo({
        top: Math.max(
          0,
          listingsStart.getBoundingClientRect().top +
            window.scrollY -
            92
        ),
        behavior: "smooth",
      });
    };
    document.getElementById("home-more-budget-btn")?.addEventListener(
      "click",
      async () => {
        const currentBudget =
          Number(form?.elements.storyMaxPrice?.value || 0) ||
          Number(form?.elements.maxPrice?.value || 0);

        if (!currentBudget) return;

        const nextBudget =
          Array.from(form.elements.maxPrice?.options || [])
            .map((option) => Number(option.value || 0))
            .filter((value) => value > currentBudget)
            .sort((a, b) => a - b)[0] ||
          Math.ceil((currentBudget * 1.25) / 25) * 25;

        form.elements.storyMaxPrice.value = "";
        form.elements.minPrice.value = String(currentBudget);
        form.elements.maxPrice.value = options[0]
          ? String(nextBudget)
          : "";
        const areaLabel = String(button.textContent || "")
          .replace(/^Search\s+1\s*km\s+beyond\s*/i, "")
          .trim() || "your selected area";

        window.__homeProgressiveExpansionLabel =
          `New matches within 1 km of ${areaLabel}`;

        fetchHomeListings({ append: false });
      }
    );

    document.getElementById("home-change-neighbourhood-btn")?.addEventListener(
      "click",
      () => {
        form?.scrollIntoView({ behavior: "smooth", block: "center" });

        const trigger = document.querySelector("[data-area-trigger]");

        if (
          trigger instanceof HTMLButtonElement &&
          trigger.getAttribute("aria-expanded") !== "true"
        ) {
          window.setTimeout(() => trigger.click(), 350);
        }
      }
    );
    syncHomeSearchComplete();

    const originalSyncHomeSearchComplete = syncHomeSearchComplete;

    syncHomeSearchComplete = function () {
      originalSyncHomeSearchComplete();

      const footer = document.getElementById("home-search-complete");


      const title = footer?.querySelector("strong");
      const copy = document.getElementById("home-search-complete-copy");
      const budgetButton = document.getElementById(
        "home-more-budget-btn"
      );
      const nearbyButton = document.getElementById(
        "home-change-neighbourhood-btn"
      );

      if (!footer || !form || footer.hidden) return;

      const selectedAreas = String(
        form.elements.storyAreas?.value || ""
      )
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean);

      const selectedArea = String(
        form.elements.area?.value || ""
      ).trim();

      const titleCase = (value) =>
        String(value || "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (character) =>
            character.toUpperCase()
          );

      const areaLabel = selectedAreas.length
        ? selectedAreas.map(titleCase).join(" & ")
        : selectedArea
          ? titleCase(selectedArea)
          : "";

      const currentBudget =
        Number(form.elements.storyMaxPrice?.value || 0) ||
        Number(form.elements.maxPrice?.value || 0);

      /* exhausted-nearby-search-v2 */
      const areaSearchAlreadyExpanded =
        Boolean(window.__homeAreaExpanded) ||
        homeAreaBufferKm > 0;

      if (!areaLabel || !currentBudget) return;

      const priceSelect = form.elements.maxPrice;
      const nextBudget =
        priceSelect instanceof HTMLSelectElement
          ? Array.from(priceSelect.options)
              .map((option) => Number(option.value || 0))
              .filter((value) => value > currentBudget)
              .sort((a, b) => a - b)[0] || 0
          : 0;

      const hasOpenEndedNextBand =
        !nextBudget &&
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

      const formatBudget = (value) =>
        value >= 1000
          ? `${(value / 1000)
              .toFixed(1)
              .replace(/\.0$/, "")}M`
          : `${value}k`;

      if (title) {
        title.textContent = areaSearchAlreadyExpanded
          ? "You've seen every nearby match"
          : `You've seen every match in ${areaLabel}`;
      }

      if (copy) {
        copy.textContent = areaSearchAlreadyExpanded
          ? `That includes all current matches in ${areaLabel} and up to 1 km beyond it.`
          : "Try a nearby area or increase your budget to see more options.";
      }

      if (nearbyButton) {
        nearbyButton.hidden = areaSearchAlreadyExpanded;
        nearbyButton.textContent =
          `Search 1 km beyond ${areaLabel}`;
      }

      if (budgetButton) {
        budgetButton.hidden =
          !nextBudget && !hasOpenEndedNextBand;

        if (nextBudget) {
          budgetButton.textContent =
            `Increase budget to ${formatBudget(nextBudget)}`;
        } else if (hasOpenEndedNextBand) {
          budgetButton.textContent = "Remove price limit";
        }
      }

    };

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        const button =
          target instanceof Element
            ? target.closest("#home-change-neighbourhood-btn")
            : null;

        if (!button || homeLoading) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        homeAreaBufferKm = 1;
        window.__homeAreaBufferKm = 1;
        window.__homeAreaExpanded = true;
        const areaLabel = String(button.textContent || "")
          .replace(/^Search\s+1\s*km\s+beyond\s*/i, "")
          .trim() || "your selected area";

        window.__homeProgressiveExpansionLabel =
          `New matches within 1 km of ${areaLabel}`;

        fetchHomeListings({ append: false });
      },
      true
    );

    form?.addEventListener(
      "change",
      (event) => {
        const changedField = event.target;

        if (
          !(
            changedField instanceof HTMLInputElement ||
            changedField instanceof HTMLSelectElement
          ) ||
          !["area", "storyAreas"].includes(changedField.name)
        ) {
          return;
        }

        homeAreaBufferKm = 0;
        window.__homeAreaBufferKm = 0;
      },
      true
    );

    syncHomeSearchComplete();


    /* clear-nearby-expansion-when-area-changes */
    form?.addEventListener(
      "change",
      (event) => {
        const changedField = event.target;

        if (
          changedField instanceof HTMLInputElement ||
          changedField instanceof HTMLSelectElement ||
          changedField instanceof HTMLTextAreaElement
        ) {
          if (["area", "storyAreas"].includes(changedField.name)) {
            window.__homeAreaExpanded = false;
          }
        }
      },
      true
    );/* homepage-area-done-refresh-v1 */
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    const doneButton =
      target instanceof Element
        ? target.closest(
            '.area-multiselect__done, [data-area-done], .area-multiselect__done-footer button'
          )
        : null;

    if (
      !(doneButton instanceof HTMLButtonElement) ||
      doneButton.textContent?.trim().toLowerCase() !== "done" ||
      homeLoading
    ) return;

    window.setTimeout(() => {
      homeAreaBufferKm = 0;
      window.__homeAreaBufferKm = 0;
      fetchHomeListings({ append: false });
    }, 0);
  },
  true
);
/* homepage-area-done-refresh-v2 */
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    const button =
      target instanceof Element
        ? target.closest("button, [role=button]")
        : null;

    if (
      !(button instanceof HTMLElement) ||
      button.textContent?.trim().toLowerCase() !== "done" ||
      homeLoading
    ) return;

    window.setTimeout(() => {
      homeAreaBufferKm = 0;
      window.__homeAreaBufferKm = 0;
      fetchHomeListings({ append: false });
    }, 100);
  },
  true
);
async function fetchHomeListings({ resetVisible = true, append = false } = {}) {
  syncSaveSearchPrompts();

  const grid = document.getElementById("home-listings-grid");
  if (!grid || !form) return;

  if (window.__homeAreaExpanded) {
    homeAreaBufferKm = 1;
    window.__homeAreaBufferKm = 1;
  }

  const progressiveExpansionLabel = String(
    window.__homeProgressiveExpansionLabel || ""
  );
  const preserveResults = Boolean(progressiveExpansionLabel);

  if (preserveResults) {
    delete window.__homeProgressiveExpansionLabel;
  }

  const areaVal = String(form.elements.area?.value || "").trim().toLowerCase();

  const storyAreas = String(form.elements.storyAreas?.value || "")
    .split("|")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  const typeVal = String(form.elements.type?.value || "").trim().toLowerCase();
const storyBudgetVal =
  Number(form.elements.storyMaxPrice?.value || 0);

const rawPriceSelection =
  String(form.elements.maxPrice?.value || "");

const overPriceMatch =
  rawPriceSelection.match(/^over-(\d+)$/);

const rawMinPriceVal = overPriceMatch
  ? Number(overPriceMatch[1])
  : Number(form.elements.minPrice?.value || 0);

const rawMaxPriceVal = overPriceMatch
  ? 0
  : Number(rawPriceSelection || 0);
const minPriceVal = storyBudgetVal
  ? Math.round(storyBudgetVal * 1000 * 0.85)
  : rawMinPriceVal * 1000;

const maxPriceVal = storyBudgetVal
  ? Math.round(storyBudgetVal * 1000 * 1.15)
  : rawMaxPriceVal * 1000;
  const bedsSelectionVal = String(form.elements.beds?.value || "");
  const bedsVal = /^\d+$/.test(bedsSelectionVal)
    ? Number(bedsSelectionVal)
    : 0;
  const bathsVal = Number(form.elements.baths?.value || 0);
  const minSqftVal = Number(form.elements.minSqft?.value || 0);
  const minLotSqftVal = Number(form.elements.minLotSqft?.value || 0);
  const minYearVal = Number(form.elements.minYear?.value || 0);
  const primaryOnMainVal =
    String(form.elements.primaryOnMain?.value || "") === "true";
  const threeSameFloorVal =
    String(form.elements.threeSameFloor?.value || "") === "true";
  const fourSameFloorVal =
    String(form.elements.fourSameFloor?.value || "") === "true";
  const oceanViewsVal =
    String(form.elements.oceanViews?.value || "") === "true";
  const viewTypeVal =
    String(form.elements.viewType?.value || "")
      .trim()
      .toLowerCase();
  const waterfrontTypeVal =
    String(form.elements.waterfrontType?.value || "")
      .trim()
      .toLowerCase();  const planModeVal = [
    "primary-on-main",
    "three-same-floor",
    "four-same-floor",
  ].includes(bedsSelectionVal)
    ? bedsSelectionVal
    : "";
  const sortVal = String(form.elements.sort?.value || "newest");

const selectedFeatures = String(document.querySelector(".story-blank[data-story-step='features']")?.dataset.label || "")
  .toLowerCase();

  const titleCase = (value) =>
    String(value || "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      );

  const selectedAreaTitle = storyAreas.length
    ? storyAreas.map(titleCase).join(" & ")
    : areaVal
      ? titleCase(areaVal)
      : "";

  const typeTitle = {
    house: "Homes",
    condo: "Condos",
    townhouse: "Townhomes",
    mobile: "Mobile Homes",
    land: "Land",
    "multi-family": "Multi-Family Homes",
  }[typeVal] || "Homes";

  const cityTitle = titleCase(city || "Nanaimo");
  const mainScope = selectedAreaTitle || `All ${cityTitle}`;
  const resultsScope = selectedAreaTitle || "All Areas";

  const mainListingsTitle =
    document.getElementById("home-listings-title");

  if (mainListingsTitle) {
    mainListingsTitle.textContent =
      `${mainScope} ${typeTitle.toLowerCase()} for sale`;
  }

  if (resultsHeading) {
    resultsHeading.textContent =
      `${resultsScope} ${typeTitle}`;
  }

  const requestOffset = preserveResults
    ? 0
    : append && !resetVisible
      ? homeOffset
      : 0;
  const params = new URLSearchParams({ city, offset: String(requestOffset), limit: String(preserveResults ? 100 : HOME_PAGE_SIZE), sort: sortVal });
  if (storyAreas.length) params.set("areas", storyAreas.join("|"));
  else if (areaVal) params.set("area", areaVal);
  if (homeAreaBufferKm && (storyAreas.length || areaVal)) {
    params.set("areaBufferKm", String(homeAreaBufferKm));
  }  if (typeVal) params.set("type", typeVal);
  if (minPriceVal) params.set("minPrice", String(minPriceVal));
  if (maxPriceVal) params.set("maxPrice", String(maxPriceVal));
  if (bedsVal) params.set("beds", String(bedsVal));
  if (bathsVal) params.set("baths", String(bathsVal));
  if (minSqftVal) params.set("minSqft", String(minSqftVal));
  if (minLotSqftVal) params.set("minLotSqft", String(minLotSqftVal));
  if (minYearVal) params.set("minYear", String(minYearVal));
  if (primaryOnMainVal) params.set("primaryOnMain", "true");
  if (threeSameFloorVal) params.set("threeSameFloor", "true");
  if (fourSameFloorVal) params.set("fourSameFloor", "true");
  if (oceanViewsVal) params.set("oceanViews", "true");
  if (viewTypeVal) params.set("viewType", viewTypeVal);
  if (waterfrontTypeVal) params.set("waterfrontType", waterfrontTypeVal);

  // nanaimo-park-rule-request-v1
  const age55Val =
    String(form.elements.age55?.value || "") === "true";
  const familyParkVal =
    String(form.elements.otherPark?.value || "") === "true";
  const petsAllowedVal =
    String(form.elements.petsAllowed?.value || "") === "true";

  if (age55Val) params.set("age55", "true");
  if (familyParkVal) params.set("otherPark", "true");
  if (petsAllowedVal) params.set("petsAllowed", "true");
  if (planModeVal) params.set("planMode", planModeVal);
  if (selectedFeatures.includes("ocean views")) {
    params.set("viewType", "ocean");
  }

  homeLoading = true;
  updateLoadMoreBtn();

  try {
    const response = await fetch(`/api/home-listings?${params.toString()}`);
    if (!response.ok) throw new Error(`Listing request failed (${response.status})`);
    const payload = await response.json();
    const pageListings = Array.isArray(payload.listings) ? payload.listings : [];
    homeTotal = Number(payload.total || 0);
    lastMatchingCount = homeTotal;

    /* sync-home-type-counts-v1 */
    if (
      payload.typeCounts &&
      typeof payload.typeCounts === "object" &&
      form.elements.type instanceof HTMLSelectElement
    ) {
      Array.from(form.elements.type.options).forEach((nativeOption) => {
        if (!nativeOption.value) return;

        const nextCount = Math.max(
          0,
          Number(payload.typeCounts[nativeOption.value] || 0)
        );

        nativeOption.dataset.count = String(nextCount);

        const customOption = Array.from(
          document.querySelectorAll(
            "#home-hero-search [data-single-option]"
          )
        ).find(
          (candidate) =>
            candidate instanceof HTMLElement &&
            candidate.dataset.value === nativeOption.value &&
            candidate.children.length === 3
        );

        if (customOption instanceof HTMLElement) {
          const countElement = customOption.children[1];

          if (countElement instanceof HTMLElement) {
            countElement.textContent = String(nextCount);
          }
        }
      });
    }

    const seenListingIds = preserveResults
      ? new Set(
          Array.from(grid.querySelectorAll("[data-listing-id]"))
            .map((card) => String(card.dataset.listingId || ""))
            .filter(Boolean)
        )
      : new Set();

    const listingsToRender = preserveResults
      ? pageListings.filter(
          (listing) =>
            !seenListingIds.has(
              String(listing?.id || listing?.mls || "")
            )
        )
      : pageListings;

    if (!preserveResults && (!append || resetVisible)) {
      grid.innerHTML = "";
      // A new refinement starts a new result set. Return to its first cards,
      // below the docked search bar; Load more and area expansion stay put.
      if (!append) {
        const dockedRail = document.querySelector(".listing-filter-rail");
        const railBottom = dockedRail
          ? dockedRail.getBoundingClientRect().bottom
          : 0;

        window.scrollTo({
          top: Math.max(
            0,
            window.scrollY + grid.getBoundingClientRect().top - railBottom - 16
          ),
          behavior: "smooth",
        });
      }
    }

    /* expansion-batch-controls-v1 */
    const expansionId = preserveResults
      ? `expansion-${Date.now()}`
      : "";

    if (preserveResults && listingsToRender.length) {
      grid.insertAdjacentHTML(
        "beforeend",
        `<div
          class="home-results-expansion-divider"
          data-expansion-id="${expansionId}"
        >
          <div class="home-results-expansion-divider__copy">
            <span>Expanded search</span>
            <strong>${esc(progressiveExpansionLabel)}</strong>
          </div>

          <div class="home-results-expansion-divider__actions">
            <button type="button" data-expansion-map>
              Map these
            </button>

            <label>
              <span class="sr-only">Sort new matches</span>
              <select data-expansion-sort>
                <option value="">Sort new matches</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
          </div>
        </div>`
      );
    }

    grid.insertAdjacentHTML(
      "beforeend",
      listingsToRender.map(cardHtml).join("")
    );

    if (preserveResults && listingsToRender.length) {
      const insertedCards = Array.from(
        grid.querySelectorAll(".card")
      ).slice(-listingsToRender.length);

      insertedCards.forEach((card) => {
        card.dataset.expansionId = expansionId;
      });

      window.__homeExpansionMarkers =
        window.__homeExpansionMarkers || {};

      const renderedListingIds = new Set(
        listingsToRender
          .map((listing) =>
            String(
              listing?.id ||
              listing?.mls ||
              listing?.mls_number ||
              ""
            )
          )
          .filter(Boolean)
      );

      window.__homeExpansionMarkers[expansionId] =
        (Array.isArray(payload.markers) ? payload.markers : [])
          .filter((marker) =>
            renderedListingIds.has(
              String(
                marker?.id ||
                marker?.mls ||
                marker?.mls_number ||
                marker?.listing_id ||
                ""
              )
            )
          );
    }
    homeOffset = requestOffset + pageListings.length;
    window.currentHomeMapListings = Array.isArray(payload.markers) ? payload.markers : [];

const summaryPriceRange = document.getElementById("summary-price-range");

if (summaryPriceRange) {
  if (storyBudgetVal) {
    const min = Math.round(storyBudgetVal * 0.85);
    const max = Math.round(storyBudgetVal * 1.15);
    summaryPriceRange.textContent = `$${min}k $${max}k`;
  } else {
    const prices = Array.from(grid.querySelectorAll(".card"))
      .map((card) => Number(card.dataset.rawPrice || 0))
      .filter(Boolean);

    summaryPriceRange.textContent = prices.length
      ? `$${Math.round(Math.min(...prices) / 1000)}k $${Math.round(Math.max(...prices) / 1000)}k`
      : " ";
  }
}
  const resultsCount = document.getElementById("results-count");
  if (resultsCount) resultsCount.textContent = String(homeTotal);

  const heroListingTotal = document.querySelector(
    "[data-nanaimo-hero-count]"
  );

  if (heroListingTotal) {
    const previousCount = Number(
      heroListingTotal.dataset.count ||
      heroListingTotal.textContent ||
      0
    );

    const nextCount = Math.max(0, Number(homeTotal) || 0);
    const width = Math.max(
      2,
      String(previousCount).length,
      String(nextCount).length
    );

    const previousDigits = String(previousCount).padStart(width, "0");
    const nextDigits = String(nextCount).padStart(width, "0");
    const direction = nextCount >= previousCount ? 1 : -1;

    const digitNodes = Array.from(
      heroListingTotal.querySelectorAll("[data-flip-digit]")
    );

    if (digitNodes.length === nextDigits.length) {
      digitNodes.forEach((digitNode, index) => {
        const from = Number(previousDigits[index]);
        const to = Number(nextDigits[index]);

        if (from === to) {
          digitNode.textContent = String(to);
          return;
        }

        const steps =
          direction > 0
            ? (to - from + 10) % 10
            : (from - to + 10) % 10;

        let value = from;
        let step = 0;

        const flipNext = () => {
          digitNode.classList.remove("is-flipping");
          void digitNode.offsetWidth;
          digitNode.classList.add("is-flipping");

          window.setTimeout(() => {
            value = (value + direction + 10) % 10;
            digitNode.textContent = String(value);
            step += 1;

            if (step < steps) {
              window.setTimeout(flipNext, 26);
            } else {
              digitNode.classList.remove("is-flipping");
            }
          }, 70);
        };

        flipNext();
      });
    }

    heroListingTotal.dataset.count = String(nextCount);
    heroListingTotal.setAttribute(
      "aria-label",
      `${nextCount} mobile homes for sale`
    );
  }

  const navListingTotal = document.querySelector(
    "[data-nanaimo-listing-total]"
  );

  if (navListingTotal) {
    navListingTotal.textContent = String(homeTotal).padStart(2, "0");
  }
  applySavedHomeDecisions();
  window.dispatchEvent(new CustomEvent("intent:cards-updated"));
  } catch (error) {
    console.error("Could not load homepage listings:", error);
  } finally {
    homeLoading = false;
    updateLoadMoreBtn();
    /* sync-home-search-after-fetch-v1 */
    window.requestAnimationFrame(() => {
      if (typeof syncHomeSearchComplete === "function") {
        syncHomeSearchComplete();
      }

      const areaExpansionWasUsed = Array.from(
        document.querySelectorAll(
          "#home-listings-grid .home-results-expansion-divider"
        )
      ).some((divider) =>
        /within\s+1\s*km/i.test(divider.textContent || "")
      );

      if (!areaExpansionWasUsed) return;

      const footer = document.getElementById(
        "home-search-complete"
      );
      const nearbyButton = document.getElementById(
        "home-change-neighbourhood-btn"
      );
      const budgetButton = document.getElementById(
        "home-more-budget-btn"
      );

      if (nearbyButton instanceof HTMLElement) {
        nearbyButton.hidden = true;
      }

    });
  }
}
window.ensureHomeListingCard = async (id) => {
  const grid = document.getElementById("home-listings-grid");
  if (!grid || !id) return null;
  let card = Array.from(grid.querySelectorAll(".card")).find(
    (candidate) => String(candidate.dataset.listingId || "") === String(id)
  );
  if (card) return card;

  try {
    const response = await fetch(`/api/home-listings?city=${encodeURIComponent(city)}&id=${encodeURIComponent(id)}&limit=1`);
    if (!response.ok) return null;
    const payload = await response.json();
    const listing = payload.listings?.[0];
    if (!listing) return null;
    grid.insertAdjacentHTML("beforeend", cardHtml(listing));
    card = grid.lastElementChild;
    if (card) card.hidden = true;
    return card;
  } catch (error) {
    console.error("Could not load map listing:", error);
    return null;
  }
};
const HOME_INTENT_COLLECTIONS = JSON.parse(
  document.getElementById("home-intent-collections-json")?.textContent || "[]"
);function renderHomeIntentCards() {
  const wrap = document.getElementById("intent-collections-grid");
  if (!wrap) return;

  let wanted = HOME_INTENT_COLLECTIONS;

  const selectedType = String(form?.elements?.type?.value || "").toLowerCase();

  if (selectedType) {
    wanted = HOME_INTENT_COLLECTIONS.filter((card) => card.type === selectedType);
  }

  wrap.innerHTML = wanted.slice(0, 8).map((card) => `
    <a href="${esc(card.href)}" class="intent-card" data-rendered-card="true">
      <span class="intent-type">${esc(card.type)}</span>
      <h3>${esc(card.title)}</h3>
      <p>${esc(card.description)}</p>
      <span class="intent-link">View search  </span>
    </a>
  `).join("");
}

const refineSearchBtn = document.getElementById("refine-search-btn");
const homepageRefinePanel = document.getElementById("homepage-refine-panel");
const homepageSaveSearchBtn =
  document.getElementById("save-search-btn");
const heroSaveSearchBtn =
  document.getElementById("hero-save-search-btn");

function syncSaveSearchPrompts() {
  if (!form) return;

  const currentAreas = String(form.elements.storyAreas?.value || "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);

  const currentArea = String(form.elements.area?.value || "").trim();
  const currentType = String(form.elements.type?.value || "").trim();
  const currentMinPrice =
    Number(form.elements.minPrice?.value || 0);

  const currentPriceSelection =
    String(form.elements.maxPrice?.value || "");

  const currentOverPriceMatch =
    currentPriceSelection.match(/^over-(\d+)$/);

  const currentMaxPrice = currentOverPriceMatch
    ? 0
    : Number(currentPriceSelection || 0);

  const currentBeds = Number(form.elements.beds?.value || 0);
  const currentBaths = Number(form.elements.baths?.value || 0);

  const hasCuratedSearch =
    currentAreas.length > 0 ||
    Boolean(currentArea) ||
    Boolean(currentType) ||
    currentMinPrice > 0 ||
    currentMaxPrice > 0 ||
    Boolean(currentPriceSelection) ||
    currentBeds > 0 ||
    currentBaths > 0 || /* save-prompt-advanced-v1 */ ["minSqft", "minLotSqft", "minYear", "viewType", "waterfrontType", "oceanViews", "primaryOnMain", "threeSameFloor", "fourSameFloor", "age55", "otherPark", "petsAllowed"].some((k) => { const v = String(form.elements[k]?.value || "").trim().toLowerCase(); return v !== "" && v !== "0" && v !== "false"; });

  document
    .querySelectorAll("[data-save-search-prompt]")
    .forEach((prompt) => {
      if (prompt instanceof HTMLElement) {
        prompt.hidden = !hasCuratedSearch;        /* save-prompt-slot-open-v1 */ prompt.closest(".homepage-save-nudge-slot")?.classList.toggle("is-open", hasCuratedSearch);
      }
    });
}

syncSaveSearchPrompts(); /* save-prompt-resync-v1 */ ["change", "submit"].forEach((ev) => document.addEventListener(ev, (e) => { const t = e.target; if (t && t.closest && t.closest("#home-hero-search, #home-filter-form")) { setTimeout(syncSaveSearchPrompts, 0); setTimeout(syncSaveSearchPrompts, 400); } })); /* save-prompt-resync-v1 */ ["change", "submit"].forEach((ev) => document.addEventListener(ev, (e) => { const t = e.target; if (t && t.closest && t.closest("#home-hero-search, #home-filter-form")) { setTimeout(syncSaveSearchPrompts, 0); setTimeout(syncSaveSearchPrompts, 400); } }));

heroSaveSearchBtn?.addEventListener("click", () => {
  homepageSaveSearchBtn?.click();
});

/* prospect-save-search-deeplink */
const saveSearchDeepLink =
  new URLSearchParams(window.location.search)
    .get("save_search");

if (saveSearchDeepLink === "open") {
  window.setTimeout(() => {
    heroSaveSearchBtn?.click();

    document
      .querySelector(".homepage-save-search-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
  }, 450);
}

homepageSaveSearchBtn?.addEventListener("click", () => {
  const saveRoot = document.querySelector(
    ".homepage-save-search-form [data-slug-save-search]"
  );

  const openButton = saveRoot?.querySelector(
    "[data-slug-save-open]"
  );

  if (
    openButton instanceof HTMLButtonElement &&
    openButton.getAttribute("aria-expanded") !== "true"
  ) {
    openButton.click();
  }

  window.setTimeout(() => {
    saveRoot?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 40);
});

refineSearchBtn?.addEventListener("click", () => {
  if (!homepageRefinePanel) return;
  homepageRefinePanel.hidden = !homepageRefinePanel.hidden;
});

let hasScrolledToListingsAfterRefine = false;

homepageRefinePanel?.querySelectorAll("[data-refine]").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    fetchHomeListings({ append: false });
const note = document.getElementById("refine-update-note");

if (note) {
  note.hidden = false;
  note.textContent = "Showing updated matches above  ";

  note.onclick = () => {
    document.querySelector(".results-heading")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  window.clearTimeout(window.homeResultsUpdateTimer);

  window.homeResultsUpdateTimer = window.setTimeout(() => {
    note.hidden = true;
  }, 2800);
}
    if (!hasScrolledToListingsAfterRefine) {
      hasScrolledToListingsAfterRefine = true;

      document.querySelector(".results-heading")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

renderHomeIntentCards();

window.addEventListener("intent:cards-updated", () => {
  renderHomeIntentCards();
});

window.addEventListener("resize", () => {
  renderHomeIntentCards();
});
   form?.addEventListener("change", () => {
  const areaText =
    form.elements.area?.selectedOptions?.[0]?.text || "Nanaimo";

  const typeValue = String(form.elements.type?.value || "").toLowerCase();

  const typeText =
    !typeValue
      ? "Homes"
      : typeValue === "house"
      ? "Homes"
      : typeValue === "condo"
      ? "Condos"
      : typeValue === "townhouse"
      ? "Townhomes"
      : `${typeValue.charAt(0).toUpperCase()}${typeValue.slice(1)}s`;

  const priceValue = form.elements.maxPrice?.value || "";

  let priceText = "";
const bedsValue = form.elements.beds?.value || "";
let bedsText = "";

if (bedsValue) {
  const selectedBedsLabel =
    form.elements.beds?.selectedOptions?.[0]?.textContent?.trim() || "";
  bedsText = selectedBedsLabel ? ` ${selectedBedsLabel}` : "";
}
  if (priceValue) {
    const selectedPriceOption =
      form.elements.maxPrice?.selectedOptions?.[0];

    const selectedPriceLabel =
      selectedPriceOption?.textContent?.trim() || "";

    priceText = selectedPriceLabel
      ? ` ${selectedPriceLabel}`
      : "";
  }

  if (resultsHeading) {
    resultsHeading.textContent =
      `${areaText} ${typeText}${bedsText}${priceText}`;
  }

 fetchHomeListings({ resetVisible: true });
});

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      fetchHomeListings({ append: false });
    });

   function getHomeDecisionKey(card) {
  return card?.dataset?.listingId || card?.dataset?.cardId || card?.dataset?.itemId || "";
}

function saveHomeDecision(card) {
  const key = getHomeDecisionKey(card);
  if (!key) return;

  const badge = card.querySelector(".card-decision-badge");
  const text = String(badge?.textContent || "").trim();

  const decision =
    card.dataset.decision ||
    (badge?.classList.contains("is-love") ? "love" : "") ||
    (badge?.classList.contains("is-maybe") ? "maybe" : "") ||
    (badge?.classList.contains("is-pass") ? "pass" : "");

  if (!decision && !text) return;

  sessionStorage.setItem(
    `home_listing_decision_${key}`,
    JSON.stringify({
      decision,
      text,
      badgeClass: badge?.className || "",
      isPassed: card.classList.contains("is-passed"),
    })
  );
}

function applySavedHomeDecisions() {
  document.querySelectorAll(".grid > .card").forEach((card) => {
    const key = getHomeDecisionKey(card);
    if (!key) return;

    const raw = sessionStorage.getItem(`home_listing_decision_${key}`);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      const badge = card.querySelector(".card-decision-badge");

      card.dataset.decision = saved.decision || "";
      card.classList.toggle("is-passed", !!saved.isPassed || saved.decision === "pass");

      if (badge && saved.text) {
        badge.hidden = false;
        badge.textContent = saved.text;
        badge.className = saved.badgeClass || "card-decision-badge";
      }
    } catch {}
  });
}

const decisionObserver = new MutationObserver(() => {
  document.querySelectorAll(".grid > .card").forEach(saveHomeDecision);
});

const homeGrid = document.querySelector(".grid");
if (homeGrid) {
  decisionObserver.observe(homeGrid, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true,
    attributeFilter: ["class", "hidden", "data-decision"],
  });
}

applySavedHomeDecisions();
document.documentElement.style.visibility = "";
  })();
