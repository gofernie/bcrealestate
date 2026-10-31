
const areaSelect = document.querySelector(".area-filter-select");
const priceSelect = document.querySelector(".price-filter-select");

/* Restore the price bands if client navigation leaves only Any Price. */
if (priceSelect instanceof HTMLSelectElement && priceSelect.options.length < 2) {
  const requestedPrice = new URLSearchParams(window.location.search).get("price") || "all";
  const priceChoices = [
    ["all", "Any Price"],
    ["under-450", "Under $450k"],
    ["450-650", "$450k - $650k"],
    ["650-850", "$650k - $850k"],
    ["850-1100", "$850k - $1.1M"],
    ["1100-plus", "$1.1M+"],
  ];

  priceSelect.replaceChildren(
    ...priceChoices.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    })
  );

  priceSelect.value = priceChoices.some(([value]) => value === requestedPrice)
    ? requestedPrice
    : "all";
}
const typeSelect = document.querySelector(".type-filter-select");

/* Keep the complete Type menu after a type has been selected. */
if (typeSelect instanceof HTMLSelectElement && typeSelect.options.length < 3) {
  const requestedType = new URLSearchParams(window.location.search).get("type") || "all";
  const typeChoices = [
    ["all", "Any type"],
    ["house", "Homes"],
    ["condo", "Condos"],
    ["townhouse", "Townhomes"],
    ["mobile", "Mobile homes"],
    ["land", "Lots and land"],
  ];

  typeSelect.replaceChildren(
    ...typeChoices.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    })
  );

  typeSelect.value = typeChoices.some(([value]) => value === requestedType)
    ? requestedType
    : "all";
}
const sortSelect = document.querySelector(".sort-filter-select");
const bedsSelect = document.querySelector(".beds-filter-select");
const bathsSelect = document.querySelector(".baths-filter-select");

/* Keep the primary filter order consistent: Type, Price, Beds, Baths. */
if (
  typeSelect instanceof HTMLElement &&
  priceSelect instanceof HTMLElement &&
  typeSelect.parentElement === priceSelect.parentElement
) {
  typeSelect.insertAdjacentElement("afterend", priceSelect);
}

const minSqftSelect =
  document.querySelector(".min-sqft-filter-select");

const minLotSqftSelect =
  document.querySelector(".min-lot-sqft-filter-select");

const minYearSelect =
  document.querySelector(".min-year-filter-select");

const primaryMainFilter =
  document.querySelector(".primary-main-filter");

const threeFloorFilter =
  document.querySelector(".three-floor-filter");

const fourFloorFilter =
  document.querySelector(".four-floor-filter");

const viewTypeSelect =
  document.querySelector(".view-type-filter-select");

const waterfrontTypeSelect =
  document.querySelector(".waterfront-type-filter-select");

const moreFiltersToggle =
  document.querySelector("[data-type-more-toggle]");

const moreFiltersPanel =
  document.querySelector("[data-type-more-panel]");

const moreFiltersCount =
  document.querySelector("[data-type-more-count]");
const initialParams = new URLSearchParams(window.location.search);

function getAdvancedFilterCount() {
  let count = 0;

  if (minSqftSelect?.value) count++;
  if (minLotSqftSelect?.value) count++;
  if (minYearSelect?.value) count++;
  if (primaryMainFilter?.checked) count++;
  if (threeFloorFilter?.checked) count++;
  if (fourFloorFilter?.checked) count++;
  if (viewTypeSelect?.value) count++;
  if (waterfrontTypeSelect?.value) count++;

  return count;
}

function updateMoreFiltersState() {
  const count = getAdvancedFilterCount();

  if (moreFiltersCount) {
    moreFiltersCount.textContent = String(count);
    moreFiltersCount.hidden = count === 0;
  }
}

function setMoreFiltersOpen(open) {
  if (!moreFiltersPanel || !moreFiltersToggle) return;

  moreFiltersPanel.hidden = !open;

  moreFiltersToggle.setAttribute(
    "aria-expanded",
    open ? "true" : "false"
  );

  moreFiltersToggle.classList.toggle(
    "is-open",
    open
  );
}

const hasInitialAdvancedFilters =
  initialParams.has("minSqft") ||
  initialParams.has("minLotSqft") ||
  initialParams.has("minYear") ||
  initialParams.get("primaryOnMain") === "true" ||
  initialParams.get("threeSameFloor") === "true" ||
  initialParams.get("fourSameFloor") === "true" ||
  initialParams.has("viewType") ||
  initialParams.has("waterfrontType");

setMoreFiltersOpen(hasInitialAdvancedFilters);
updateMoreFiltersState();

moreFiltersToggle?.addEventListener("click", () => {
  const isOpen =
    moreFiltersToggle.getAttribute("aria-expanded") === "true";

  setMoreFiltersOpen(!isOpen);
});


if (areaSelect) {
  const initialAreas = initialParams
    .getAll("area")
    .map((area) => String(area).trim().toLowerCase());

  Array.from(areaSelect.options).forEach((option) => {
    option.selected =
      option.value !== "all" &&
      initialAreas.includes(
        String(option.value).trim().toLowerCase()
      );
  });
}
if (priceSelect && initialParams.get("price")) {
  priceSelect.value = initialParams.get("price");
}

if (typeSelect && initialParams.get("type")) {
  typeSelect.value =
    String(initialParams.get("type") || "all").toLowerCase();
}

if (bedsSelect && initialParams.get("beds")) {
  bedsSelect.value = initialParams.get("beds");
}

if (bathsSelect && initialParams.get("baths")) {
  bathsSelect.value = initialParams.get("baths");
}

if (sortSelect && initialParams.get("sort")) {
  sortSelect.value = initialParams.get("sort");
}
const savedFilterViewMode = sessionStorage.getItem("listingFilterViewMode");

if (savedFilterViewMode === "map") {
  sessionStorage.removeItem("listingFilterViewMode");

  document.body.classList.add("is-map-mode");

  if (intentMapEl) {
    intentMapEl.hidden = false;
  }

  gridEl?.classList.add("map-hidden");
  mapViewBtn?.classList.add("active");
  listViewBtn?.classList.remove("active");

  requestAnimationFrame(() => {
    initLeafletMap();

    window.setTimeout(() => {
      leafletMap?.invalidateSize();
    }, 100);
  });
} else {
  sessionStorage.removeItem("listingFilterViewMode");
}

sessionStorage.removeItem("listingFilterScrollY");
let activePriceFilter = "all";

function jsTitleCase(value = "") {
  return String(value)
    .replace(/^pq\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

  function getCardPrice(card) {
    return Number(card.dataset.rawPrice || "0");
  }
function getCurrentFilters() {
  return {
        area: String(areaSelect?.value || "all").toLowerCase(),
price: priceSelect?.value || "all",
    type: String(typeSelect?.value || "all").toLowerCase(),
    beds: String(bedsSelect?.value || "all").toLowerCase(),
    baths: String(bathsSelect?.value || "all").toLowerCase(),
  };
}

function updateResultsHeading(filters, resultCount) {
  const heading =
    document.getElementById("dynamic-results-heading");

  if (!heading) return;

  const cityLabel = jsTitleCase(
    document.querySelector("[data-city]")
      ?.dataset.city || "Nanaimo"
  );

  const fixedTypeLabel = String(
    heading.dataset.fixedTypeLabel || ""
  ).trim();

  const pageArea = String(
    heading.dataset.pageArea || ""
  ).trim();

  const selectedAreaLabels =
    areaSelect instanceof HTMLSelectElement
      ? Array.from(areaSelect.selectedOptions)
          .filter((option) => option.value !== "all")
          .map((option) =>
            String(option.textContent || "").trim()
          )
          .filter(Boolean)
      : [];

  const locationLabel =
    selectedAreaLabels.length === 1
      ? selectedAreaLabels[0]
      : selectedAreaLabels.length > 1
        ? `${selectedAreaLabels.length} selected areas`
        : pageArea
          ? jsTitleCase(pageArea)
          : cityLabel;

  let pluralTypeLabel;

  if (fixedTypeLabel) {
    pluralTypeLabel = fixedTypeLabel.toLowerCase();
  } else {
    pluralTypeLabel =
      filters.type === "condo"
        ? "condos"
        : filters.type === "townhouse"
          ? "townhomes"
          : filters.type === "mobile"
            ? "mobile homes"
            : filters.type === "land"
              ? "properties"
              : filters.type === "house"
                ? "homes"
                : "listings";
  }

  const singularTypeLabel =
    pluralTypeLabel === "listings"
      ? "listing"
      : pluralTypeLabel === "condos"
        ? "condo"
      : pluralTypeLabel === "townhomes"
        ? "townhome"
        : pluralTypeLabel === "mobile homes"
          ? "mobile home"
          : pluralTypeLabel === "properties" ||
            pluralTypeLabel === "land"
            ? "property"
            : "home";

  const typeLabel =
    Number(resultCount) === 1
      ? singularTypeLabel
      : pluralTypeLabel;

  heading.textContent =
    `${resultCount} ${typeLabel} for sale in ${locationLabel}`;
}
function submitFilters() {
  const filters = getCurrentFilters();

  const resultsBar =
    document.querySelector(".results-bar");

  const resultCount = Number(
    resultsBar?.dataset.totalListings || 0
  );

  if (resultsBar) {
    resultsBar.textContent =
      `${resultCount} listings found`;
  }

  updateResultsHeading(
    filters,
    resultCount
  );

  window.dispatchEvent(
    new CustomEvent(
      "listing-filters-updated"
    )
  );
}
function applySort() {
    const sort = sortSelect?.value || "newest";
    const grid = document.querySelector(".grid");
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll(".original-card"));

    cards.sort((a, b) => {
   if (sort === "price-asc") return getCardPrice(a) - getCardPrice(b);
if (sort === "price-desc") return getCardPrice(b) - getCardPrice(a);
if (sort === "beds-desc") return Number(b.dataset.beds || 0) - Number(a.dataset.beds || 0);
if (sort === "sqft-desc") return Number(b.dataset.sqft || 0) - Number(a.dataset.sqft || 0);

      return (
        new Date(b.dataset.listedAt || 0).getTime() -
          new Date(a.dataset.listedAt || 0).getTime() ||
        Number(a.dataset.sortIndex || 0) - Number(b.dataset.sortIndex || 0)
      );
    });

const sortFragment = document.createDocumentFragment();
 cards.forEach((card) => sortFragment.appendChild(card));
 grid.appendChild(sortFragment);

    const interruptCard = document.getElementById("intent-interrupt-card");
    if (interruptCard && cards[8]) {
      cards[8].after(interruptCard);
    }

    submitFilters();
  }
function showFilterLoadingState() {
  const controls = document.querySelector(".intent-controls");
  const resultsBar = document.querySelector(".results-bar");
  const grid = document.querySelector(".grid");

  controls?.classList.add("is-filter-loading");
  grid?.classList.add("is-filter-loading");
  intentMapEl?.classList.add("is-filter-loading");

  if (resultsBar) {
    resultsBar.textContent = "Updating listings...";
  }
}
function updateSearchFromFilters() {
  const params = new URLSearchParams(window.location.search);
  const filters = getCurrentFilters();

  const setOrDelete = (key, value) => {
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  };

  params.delete("area");

  if (areaSelect instanceof HTMLSelectElement) {
    Array.from(areaSelect.selectedOptions)
      .filter((option) => option.value !== "all")
      .forEach((option) => {
        params.append("area", option.value);
      });
  }
  setOrDelete("type", filters.type);
  setOrDelete("beds", filters.beds);
  setOrDelete("price", filters.price);

  setOrDelete(
    "minSqft",
    minSqftSelect?.value || ""
  );

  setOrDelete(
    "minLotSqft",
    minLotSqftSelect?.value || ""
  );

  setOrDelete(
    "baths",
    bathsSelect?.value || ""
  );

  setOrDelete(
    "minYear",
    minYearSelect?.value || ""
  );

  if (primaryMainFilter?.checked) {
    params.set("primaryOnMain", "true");
  } else {
    params.delete("primaryOnMain");
  }

  if (threeFloorFilter?.checked) {
    params.set("threeSameFloor", "true");
  } else {
    params.delete("threeSameFloor");
  }

  if (fourFloorFilter?.checked) {
    params.set("fourSameFloor", "true");
  } else {
    params.delete("fourSameFloor");
  }

  setOrDelete(
    "viewType",
    viewTypeSelect?.value || ""
  );

  setOrDelete(
    "waterfrontType",
    waterfrontTypeSelect?.value || ""
  );

  if (sortSelect?.value && sortSelect.value !== "newest") {
    params.set("sort", sortSelect.value);
  } else {
    params.delete("sort");
  }

  sessionStorage.setItem(
    "listingFilterViewMode",
    document.body.classList.contains("is-map-mode") ? "map" : "list"
  );

showFilterLoadingState();
const nextSearch = params.toString();

  const fastData = document.getElementById("remaining-listings-data");

  /* Area and dedicated type pages intentionally behave like the homepage:
     update the URL and results in place instead of asking Astro to re-render
     the entire page for every filter change. */
  if (fastData?.dataset.fastListings === "true") {
    const apiParams = new URLSearchParams({
      city: fastData.dataset.city || "nanaimo",
      offset: "0",
      limit: "24",
      sort:
        sortSelect?.value === "price-asc"
          ? "price-low"
          : sortSelect?.value === "price-desc"
            ? "price-high"
            : sortSelect?.value === "beds-desc"
              ? "beds-high"
              : sortSelect?.value === "sqft-desc"
                ? "sqft-high"
                : "newest",
    });

    const selectedAreas = areaSelect instanceof HTMLSelectElement
      ? Array.from(areaSelect.selectedOptions)
          .map((option) => String(option.value || "").trim())
          .filter((value) => value && value !== "all")
      : [];

    if (selectedAreas.length) {
      apiParams.set("areas", selectedAreas.join("|"));
    } else if (fastData.dataset.area) {
      apiParams.set("area", fastData.dataset.area);
    }

    const selectedType = String(typeSelect?.value || fastData.dataset.type || "")
      .trim()
      .toLowerCase();
    (window.__pageStyles ??= new URLSearchParams(window.location.search).getAll("style")).forEach((s) => apiParams.append("style", s));
      if (selectedType && selectedType !== "all") apiParams.set("type", selectedType);

    if (bedsSelect?.value && bedsSelect.value !== "all") {
      apiParams.set("beds", bedsSelect.value); apiParams.set("bedsMode", "exact");
    }
    if (bathsSelect?.value && bathsSelect.value !== "all") {
      apiParams.set("baths", bathsSelect.value);
    }
    if (minSqftSelect?.value) apiParams.set("minSqft", minSqftSelect.value);
    if (minLotSqftSelect?.value) apiParams.set("minLotSqft", minLotSqftSelect.value);
    if (minYearSelect?.value) apiParams.set("minYear", minYearSelect.value);
    if (viewTypeSelect?.value) apiParams.set("viewType", viewTypeSelect.value);
    if (waterfrontTypeSelect?.value) {
      apiParams.set("waterfrontType", waterfrontTypeSelect.value);
    }
    if (primaryMainFilter?.checked) apiParams.set("primaryOnMain", "true");
    if (threeFloorFilter?.checked) apiParams.set("threeSameFloor", "true");
    if (fourFloorFilter?.checked) apiParams.set("fourSameFloor", "true");

    const price = String(priceSelect?.value || "");
    const under = price.match(/^under-(\d+)$/);
    const range = price.match(/^(\d+)-(\d+)$/);
    const plus = price.match(/^(\d+)-plus$/);
    const over = price.match(/^over-(\d+)$/);

    if (under) apiParams.set("maxPrice", String(Number(under[1]) * 1000));
    if (range) {
      apiParams.set("minPrice", String(Number(range[1]) * 1000));
      apiParams.set("maxPrice", String(Number(range[2]) * 1000));
    }
    if (plus || over) apiParams.set("minPrice", String(Number((plus || over)[1]) * 1000));

    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}#listing-results-anchor`
    );

    { const pagePriceSelect = document.querySelector(".price-filter-select"); if (pagePriceSelect && !apiParams.has("minPrice") && !apiParams.has("maxPrice")) { if (pagePriceSelect.dataset.pageMin) apiParams.set("minPrice", pagePriceSelect.dataset.pageMin); if (pagePriceSelect.dataset.pageMax) apiParams.set("maxPrice", pagePriceSelect.dataset.pageMax); } }
    fetch(`/api/home-listings?${apiParams.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Listing request failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        const pageListings = Array.isArray(payload.listings) ? payload.listings : [];
        const grid = document.querySelector(".grid");
        const makeCard = window.__homepageListingCard;

        if (grid && typeof makeCard === "function") {
          grid.replaceChildren(...pageListings.map((listing) => makeCard(listing)));
        }

        const visibleIds = new Set(
          pageListings.map((listing) => String(listing.id || listing.mls || listing.mls_number || ""))
        );
        fastData.textContent = JSON.stringify(
          (Array.isArray(payload.markers) ? payload.markers : []).filter(
            (marker) => !visibleIds.has(String(marker.id || marker.mls || marker.mls_number || ""))
          )
        );

        fastData.dataset.area = selectedAreas.length ? "" : (fastData.dataset.area || "");
        fastData.dataset.type = selectedType === "all" ? "" : selectedType;
        fastData.dataset.beds = bedsSelect?.value === "all" ? "" : (bedsSelect?.value || "");
        fastData.dataset.baths = bathsSelect?.value === "all" ? "" : (bathsSelect?.value || "");
        fastData.dataset.price = price === "all" ? "" : price;
        fastData.dataset.minSqft = minSqftSelect?.value || "";
        fastData.dataset.minLotSqft = minLotSqftSelect?.value || "";
        fastData.dataset.minYear = minYearSelect?.value || "";
        fastData.dataset.viewType = viewTypeSelect?.value || "";
        fastData.dataset.waterfrontType = waterfrontTypeSelect?.value || "";
        fastData.dataset.sort = sortSelect?.value || "newest";

        const total = Number(payload.total || 0);
        const resultsBar = document.querySelector(".results-bar");
        if (resultsBar) {
          resultsBar.dataset.totalListings = String(total);
          resultsBar.textContent = `${total} listings found`;
        }



        document.dispatchEvent(new CustomEvent("homepage-fast-results-replaced", {
          detail: { total, visible: pageListings.length },
        }));

        updateResultsHeading(getCurrentFilters(), total);
        document.querySelector(".intent-controls")?.classList.remove("is-filter-loading");
        grid?.classList.remove("is-filter-loading");
        intentMapEl?.classList.remove("is-filter-loading");

        // Keep the viewer at their current position. The results change in
        // place, so a filter adjustment should not pull them to the first
        // card or replay the page's results anchor.

        if (typeof updateViewedBadges === "function") updateViewedBadges();
        window.dispatchEvent(new CustomEvent("listing-filters-updated"));
      })
      .catch((error) => {
        console.warn("Could not update listings:", error);
        document.querySelector(".intent-controls")?.classList.remove("is-filter-loading");
        document.querySelector(".grid")?.classList.remove("is-filter-loading");
        intentMapEl?.classList.remove("is-filter-loading");
      });

    return;
  }

  window.location.assign(
    `${window.location.pathname}${
      nextSearch ? `?${nextSearch}` : ""
    }#listing-results-anchor`
  );
}

areaSelect?.addEventListener("change", updateSearchFromFilters);
priceSelect?.addEventListener("change", updateSearchFromFilters);

typeSelect?.addEventListener(
  "change",
  updateSearchFromFilters
);

sortSelect?.addEventListener("change", updateSearchFromFilters);
bedsSelect?.addEventListener("change", updateSearchFromFilters);
bathsSelect?.addEventListener("change", updateSearchFromFilters);

minSqftSelect?.addEventListener(
  "change",
  updateSearchFromFilters
);

minLotSqftSelect?.addEventListener(
  "change",
  updateSearchFromFilters
);

minYearSelect?.addEventListener(
  "change",
  updateSearchFromFilters
);

primaryMainFilter?.addEventListener(
  "change",
  updateSearchFromFilters
);

threeFloorFilter?.addEventListener(
  "change",
  updateSearchFromFilters
);

fourFloorFilter?.addEventListener(
  "change",
  updateSearchFromFilters
);

viewTypeSelect?.addEventListener(
  "change",
  updateSearchFromFilters
);

waterfrontTypeSelect?.addEventListener(
  "change",
  updateSearchFromFilters
);

document
  .querySelectorAll(".property-type-pill")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const selectedType =
        button.dataset.propertyType || "all";

      const wasActive =
        button.classList.contains("active");

      if (!typeSelect) return;

      typeSelect.value =
        wasActive ? "all" : selectedType;

      updateSearchFromFilters();
    });
  });

  /* reapply-area-sort-after-fast-results-v1 */
  document.addEventListener(
    "homepage-fast-results-replaced",
    () => requestAnimationFrame(() => applySort())
  );

  applySort();
