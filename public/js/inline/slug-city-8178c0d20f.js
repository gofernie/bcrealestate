

        function getViewedIntentListingKeys() {
  try {
    return JSON.parse(localStorage.getItem("viewed_intent_listing_keys") || "[]");
  } catch {
    return [];
  }
}

function saveViewedIntentListingKey(card) {
  const key = String(
    card?.dataset?.listingId ||
    card?.dataset?.mls ||
    card?.dataset?.itemId ||
    card?.dataset?.address ||
    ""
  ).trim().toLowerCase();

  if (!key) return;

  const keys = new Set(getViewedIntentListingKeys());
  keys.add(key);

  localStorage.setItem(
    "viewed_intent_listing_keys",
    JSON.stringify(Array.from(keys))
  );
}
        function getViewedIntentAddresses() {
  try {
    return JSON.parse(localStorage.getItem("viewed_intent_addresses") || "[]");
  } catch {
    return [];
  }
}

function saveViewedIntentAddress(address) {
  const normalized = String(address || "").trim().toLowerCase();
  if (!normalized) return;

  const addresses = new Set(getViewedIntentAddresses());
  addresses.add(normalized);

  localStorage.setItem(
    "viewed_intent_addresses",
    JSON.stringify(Array.from(addresses))
  );
}

function getIntentCardKey(card) {
  return String(
    card?.dataset?.listingId ||
    card?.dataset?.mls ||
    card?.dataset?.itemId ||
    card?.dataset?.address ||
    ""
  ).trim().toLowerCase();
}

function applyDecisionBadge(card, decision) {
  if (!card) return;

  const badge = card.querySelector(".card-decision-badge");
  if (!badge) return;

  card.dataset.decision = decision || "";

  badge.className = "card-decision-badge";
  card.classList.remove("is-passed");
card.style.opacity = "";
card.style.filter = "";

  if (decision === "love") {
    badge.textContent = "Loved";
    badge.classList.add("is-love");
    badge.hidden = false;
    return;
  }

  if (decision === "maybe") {
    badge.textContent = "Kinda liked";
    badge.classList.add("is-maybe");
    badge.hidden = false;
    return;
  }

 if (decision === "pass") {
  badge.textContent = "Not for me";
  badge.classList.add("is-pass");
  badge.hidden = false;

  card.classList.add("is-passed");
  card.style.opacity = "0.32";
  card.style.filter = "grayscale(0.55)";

  return;
}

  badge.textContent = "";
  badge.hidden = true;
}

function updateViewedBadges() {
  document.querySelectorAll(".card:not(.listing-load-hidden)").forEach((card) => {
    const key = getIntentCardKey(card);
    const savedDecision =
      localStorage.getItem(`intent_decision_${key}`) ||
      card.dataset.decision ||
      "";

    applyDecisionBadge(card, savedDecision);
  });
}
window.addEventListener("DOMContentLoaded", () => {
  updateViewedBadges();
});

window.addEventListener("pageshow", () => {
  updateViewedBadges();
});
document.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (card) {
    window.__activeIntentCard = card;
    saveViewedIntentListingKey(card);
    saveViewedIntentAddress(card.dataset.address || "");
    return;
  }

  const button = event.target.closest("button");
  if (!button || !window.__activeIntentCard) return;

  const label = String(button.textContent || "").trim().toLowerCase();

  let decision = "";

  if (label.includes("love")) decision = "love";
  if (label.includes("kinda")) decision = "maybe";
  if (label.includes("not for me")) decision = "pass";

  if (!decision) return;

  const activeCard = window.__activeIntentCard;
  const key = getIntentCardKey(activeCard);

  if (key) {
    localStorage.setItem(`intent_decision_${key}`, decision);
  }

  document.querySelectorAll(".card").forEach((card) => {
    if (getIntentCardKey(card) === key) {
      applyDecisionBadge(card, decision);
    }
  });
});
        function getIntentSessionId() {
  const key = "intent_session_id";
  let value = localStorage.getItem(key);

  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }

  return value;
}
      const chips = document.querySelectorAll(".refine-chip");

      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          runIntentRefine(chip);
        });
      });

      function getOriginalCards() {
        return Array.from(document.querySelectorAll(".original-card"));
      }

   function getVisibleCards() {
  return getOriginalCards().filter((card) => !card.hidden);
}

      function getVisibleMaxPrice() {
        const prices = getVisibleCards().map((card) => {
          const raw = String(card.dataset.price || "")
            .replace(/\$/g, "")
            .replace(/,/g, "");

          return Number(raw || 0);
        });

        return Math.max(...prices, 0);
      }

function createRefinedListingCard(listing, index = 0) {
function __tcAddr6(s) { return String(s || "").replace(/\b[A-Z][A-Z'-]+\b/g, (w) => /^(NE|NW|SE|SW)$/.test(w) ? w : w.toLowerCase().replace(/(^|[-'])([a-z])/g, (m, p, c) => p + c.toUpperCase())); }
function fmtAddr(v) { return __tcAddr6(__rawAddr6(v)); }
function __rawAddr6(v) {
  if (!v) return "";
  let o = v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t.startsWith("{")) return t;
    try { o = JSON.parse(t); } catch { return ""; }
  }
  if (typeof o !== "object" || Array.isArray(o)) return "";
  return [o.streetNumber, o.streetName || o.streetAddress, o.streetSuffix, o.unitNumber ? `#${o.unitNumber}` : ""].filter(Boolean).join(" ").trim();
}
const normalizePhotoUrl = (url) => {
          const value = String(url || "").trim();

          if (!value) return "";
          if (value.startsWith("http://") || value.startsWith("https://")) return value;
          if (value.startsWith("/")) return `https://cdn.repliers.io${value}`;

          return `https://cdn.repliers.io/${value}`;
        };

        const image = normalizePhotoUrl(
          listing.image ||
          listing.image_url ||
          ""
        ) || "https://placehold.co/800x600?text=Photos+coming+soon";

        const images = [
          image,
          ...(Array.isArray(listing.images) ? listing.images : []),
        ]
          .map((value) => normalizePhotoUrl(
            value?.highRes || value?.mediumRes || value?.lowRes || value?.url || value
          ))
          .filter(Boolean);

     const viewedAddresses = new Set(getViewedIntentAddresses());
const viewedKeys = new Set(getViewedIntentListingKeys());

const listingKey = String(
  listing.id ||
  listing.mls_number ||
  listing.address ||
  ""
).trim().toLowerCase();

const alreadyViewed =
  viewedAddresses.has(String(listing.address || "").trim().toLowerCase()) ||
  viewedKeys.has(listingKey);

const savedDecision =
  localStorage.getItem(`intent_decision_${listingKey}`) ||
  listing.decision ||
  "";

const decisionLabel =
  savedDecision === "love"
    ? "Loved"
    : savedDecision === "maybe"
      ? "Kinda liked"
      : "";

const decisionClass =
  savedDecision === "love"
    ? "is-love"
    : savedDecision === "maybe"
      ? "is-maybe"
      : "";

const refinedPrice = listing.price
  ? `$${Number(listing.price).toLocaleString()}`
  : listing.price_text || "";

const refinedCityRaw =
  listing.normalized_city ||
  listing.city ||
  document.querySelector("[data-city]")?.dataset.city ||
  "nanaimo";

const refinedCity = String(refinedCityRaw)
  .split(" ")
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ");

        return `
          <article
class="card refined-card" style="border-radius:6px;overflow:hidden;transition:transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.28s cubic-bezier(0.25,0.46,0.45,0.94),border-color 0.28s cubic-bezier(0.25,0.46,0.45,0.94);"
            data-item-id="${listing.id || listing.mls_number || ""}"
            data-card-id="${listing.id || listing.mls_number || ""}"
            data-listing-id="${listing.id || listing.mls_number || ""}"
            data-mls="${listing.mls_number || listing.id || ""}"
data-listing-url="/${String(listing.normalized_city || listing.city || 'nanaimo').toLowerCase().replace(/\s+/g, '-')}/listing/${encodeURIComponent(String(listing.mls_number || listing.id || ''))}"
            data-image="${image}"
            data-images='${JSON.stringify([...new Set(images)])}'
            data-price="${refinedPrice}"
            data-original-price="${listing.original_price || ""}" data-waterfront="${listing.waterfront === true || listing.waterfront === "true"}" data-ocean-view="${listing.ocean_view === true || listing.ocean_view === "true"}" data-year-built="${listing.year_built || ""}" data-lot-acres="${listing.lot_size_acres || ""}" data-back-on-market="${listing.back_on_market_at || ""}" data-raw-price="${String(listing.price || listing.raw_price || listing.price_text || "").replace(/[^0-9]/g, "")}"
data-sort-index="${index}"
data-listed-at="${listing.listed_at || listing.created_at || listing.updated_at || ""}"
data-address="${fmtAddr(listing.address)}"            data-meta="${listing.beds || "-"} bed | ${listing.baths || "-"} bath"
            data-beds="${listing.beds || "-"}"
            data-baths="${listing.baths || "-"}"
            data-sqft="${listing.sqft || ""}"
data-lot-size="${formatLotSizeClient(listing)}"
data-type="${listing.normalized_type || listing.property_type || listing.type || document.querySelector('.stat-card:nth-child(2) .stat-value')?.textContent || "Home"}"            data-year="${listing.year_built || ""}"
            data-dom="${listing.days_on_market || listing.dom || ""}"
            data-description="${String(listing.description || "").replace(/"/g, "&quot;")}"
            data-liked-tags="[]"
            data-is-favourite="false"
            data-decision=""
            data-lat="${listing.lat || ""}"
            data-lng="${listing.lng || ""}"
data-city="${listing.normalized_city || listing.city || document.querySelector('[data-city]')?.dataset.city || 'nanaimo'}"            data-area="${String(listing.normalized_area || listing.area || "").toLowerCase()}"
          >
                        <div class="card-image-wrap">
              <img src="${window.__optCardImg ? window.__optCardImg(image) : image}" alt="${listing.address || "Listing"}" />
            </div>

         <div class="card-body">
  <div class="price">${refinedPrice}</div>

 <div
  class="card-decision-badge ${decisionClass}"
  ${decisionLabel ? "" : "hidden"}
style="position:absolute;top:16px;right:14px;display:inline-flex;align-items:center;width:fit-content;margin:0;padding:5px 9px;border-radius:999px;font-size:0.66rem;font-weight:900;line-height:1;letter-spacing:0.05em;text-transform:uppercase;"
>${decisionLabel}</div>

  <div class="address">${fmtAddr(listing.address)}</div>
              <div class="card-city">${refinedCity}, BC</div>

         <div class="meta listing-meta"><span>${listing.beds || "-"} bd</span><span>${listing.baths || "-"} ba</span>${listing.sqft ? `<span>${Number(listing.sqft).toLocaleString()} sq ft</span>` : ""}${formatLotSizeClient(listing) ? `<span>Lot ${formatLotSizeClient(listing)}</span>` : ""}</div>
            </div>
          </article>
        `;
      }

      function updateGeneratedRefineChips(chips) {
  if (!Array.isArray(chips) || !chips.length) return;

const containers = document.querySelectorAll(
  ".generated-chip-target, .refine-options"
);
  containers.forEach((container) => {
    if (!container) return;

  const uniqueChips = Array.from(
  new Map(chips.map((chip) => [chip.refine_label || chip.label, chip])).values()
);

container.innerHTML = uniqueChips
  .map((chip) => {
       return `
  <button
    type="button"
    class="refine-chip generated-refine-chip"
    data-refine-label="${chip.refine_label || ""}"
  >
    ${chip.label || ""}
  </button>
`;
      })
      .join(" ");
  });

  document.querySelectorAll(".refine-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      runIntentRefine(chip);
    });
  });
}
async function refreshBehaviourChips() {
  try {
    const response = await fetch("/api/intent-refine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
     body: JSON.stringify({
  session_id: getIntentSessionId(),
city: document.querySelector("[data-city]")?.dataset.city,
  slug: document.querySelector("[data-slug]")?.dataset.slug,
  refine_label: "behaviour refresh",
  visible_max_price: getVisibleMaxPrice(),
  visible_listings: getVisibleCards().map((card) => ({
    address: card.dataset.address || "",
    price: card.dataset.price || "",
    area: card.dataset.area || "",
  })),
  map_bounds:
    document.body.classList.contains("is-map-mode") && currentIntentMapBounds
      ? currentIntentMapBounds
      : null,
  limit: 0,
}),
    });

    const json = await response.json();
   const generatedChips = json.generated_chips || [];

console.log("GENERATED BEHAVIOUR CHIPS", generatedChips);

updateGeneratedRefineChips(generatedChips);
  } catch (error) {
    console.error("Could not refresh behaviour chips:", error);
  }
}

function getPositiveIntentReactions() {
  return Array.from(document.querySelectorAll(".original-card, .refined-card"))
    .filter((card) => card.dataset.decision === "love" || card.dataset.decision === "maybe")
    .map((card) => {
      let likedTags = [];

      try {
        likedTags = JSON.parse(card.dataset.likedTags || "[]");
      } catch {
        likedTags = [];
      }

      return {
        listing_id: card.dataset.listingId || card.dataset.itemId || "",
        mls_number: card.dataset.mls || "",
        address: card.dataset.address || "",
        price: card.dataset.rawPrice || card.dataset.price || "",
        area: card.dataset.area || "",
        type: card.dataset.type || "",
        decision: card.dataset.decision || "",
        liked_tags: likedTags,
      };
    });
}

window.runIntentRefine = async function runIntentRefine(chip, options = {}) {        const interruptCard = document.getElementById("intent-interrupt-card");
        const refinedResults = document.getElementById("refined-results");

        if (!interruptCard || !refinedResults) return;

        const label = chip.textContent.trim();
        refinedLeafletMap = null;
        refinedMarkers.forEach((m) => m.remove());
        refinedMarkers = [];

        document
          .querySelectorAll(".original-card.is-hidden-by-refine")
          .forEach((card) => {
            card.classList.remove("is-hidden-by-refine");
            card.style.display = "";
          });

        document
          .querySelectorAll(".refine-chip")
          .forEach((el) => el.classList.remove("active"));

       chip.classList.add("active");
        chip.classList.add("is-loading");
        interruptCard.classList.add("is-refining");
        interruptCard.querySelector(".card-body").innerHTML = `<div style="padding:8px 0;color:var(--muted);font-size:0.85rem;">Finding better matches...</div>`;

        const visibleCards = getVisibleCards();

        const cardsAfterInterrupt = visibleCards.filter((card) => {
          return interruptCard.compareDocumentPosition(card)
            & Node.DOCUMENT_POSITION_FOLLOWING;
        });

        const visibleListings = visibleCards.map((card) => ({
          address: card.dataset.address || "",
          price: card.dataset.price || "",
          area: card.dataset.area || "",
        }));

        try {
          const response = await fetch("/api/intent-refine", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          body: JSON.stringify({
  session_id: getIntentSessionId(),
city: document.querySelector("[data-city]")?.dataset.city,
  slug: document.querySelector("[data-slug]")?.dataset.slug,
  refine_label: label,
  visible_max_price: getVisibleMaxPrice(),
  visible_listings: visibleListings,
   positive_reactions: getPositiveIntentReactions(),
  price_band_rule: {
    percent: 0.2,
    max_delta: 100000,
  },
  required_type:
    getPositiveIntentReactions()[0]?.type ||
    document.querySelector(".original-card")?.dataset.type ||
    "",
  map_bounds:
    document.body.classList.contains("is-map-mode") && currentIntentMapBounds
      ? currentIntentMapBounds
      : null,
}),
          });

     const json = await response.json();

let listings = json.listings || [];
const positiveReactions = getPositiveIntentReactions();

function normalizePropertyType(value = "") {
  const type = String(value || "").toLowerCase().trim();

  if (["home", "homes", "house", "houses"].includes(type)) return "house";
  if (["condo", "condos", "apartment", "apartments"].includes(type)) return "condo";
  if (["townhome", "townhomes", "townhouse", "townhouses"].includes(type)) return "townhouse";
  if (["mobile", "mobiles", "manufactured"].includes(type)) return "mobile";

  return type;
}

const lovedTypes = positiveReactions
  .map((r) => normalizePropertyType(r.type))
  .filter(Boolean);

const requiredType =
  lovedTypes[0] ||
  normalizePropertyType(document.querySelector(".original-card")?.dataset.type || "");

const positivePrices = positiveReactions
  .map((r) => Number(String(r.price || "").replace(/[^0-9]/g, "")))
  .filter((price) => Number.isFinite(price) && price > 0);

// Do not hard-filter type on the frontend.
// Price range is the first safety net.
// Type should be scored by the backend, not used to delete all results.

if (positivePrices.length) {
  const avg =
    positivePrices.reduce((sum, price) => sum + price, 0) /
    positivePrices.length;

  const delta = Math.min(avg * 0.35, 200000);
  const minPrice = avg - delta;
  const maxPrice = avg + delta;

  listings = listings.filter((listing) => {
    const price = Number(listing.price || listing.raw_price || 0);
    return price >= minPrice * 0.85 && price <= maxPrice * 1.15;
  });
}
function normalizeSeenValue(value) {
  return String(value || "")
    .replace(/^#\d+\s+/i, "")
    .replace(/\bunit\s+#?\d+\b/i, "")
    .replace(/\bapt\s+#?\d+\b/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getListingSeenKeys(item = {}) {
  return [
    item.dataset?.listingId,
    item.dataset?.mls,
    item.dataset?.itemId,
    item.dataset?.address,
    item.id,
    item.mls_number,
    item.listing_id,
    item.address,
  ]
    .map(normalizeSeenValue)
    .filter(Boolean);
}

const viewedCards = Array.from(
  document.querySelectorAll(".original-card, .refined-card")
).filter((card) => card.dataset.viewed === "true");

const seenKeys = new Set([
  ...getViewedIntentListingKeys().map(normalizeSeenValue),
  ...getViewedIntentAddresses().map(normalizeSeenValue),
  ...viewedCards.flatMap((card) => getListingSeenKeys(card)),
]);

const unseenListings = listings.filter((listing) => {
  const listingKeys = getListingSeenKeys(listing);

  return !listingKeys.some((key) => seenKeys.has(key));
});

listings = unseenListings;

console.log("REFINE FILTER", {
  returned: json.listings?.length || 0,
  unseen: unseenListings.length,
  showing: listings.length,
});
const generatedChips = json.generated_chips || [];

// Area is now handled by backend scoring.
// Do not hard-filter refined results here,
// or multi-area chips can collapse to zero results.



console.log("REFINED LISTINGS FROM API", listings);

const hasMore = Boolean(json.has_more);
const nextOffset = Number(json.next_offset || 24);

updateGeneratedRefineChips(generatedChips);

          cardsAfterInterrupt.forEach((card) => {
  card.classList.add("is-hidden-by-refine");
  card.style.display = "none";
});

interruptCard.innerHTML = `
  <div class="interrupt-card__inner">
    <div class="interrupt-card__icon" aria-hidden="true">
    </div>

    <div>
      <p class="interrupt-card__kicker">
        Help me narrow this search
      </p>

      <h3 class="interrupt-card__title">
        Not seeing the right home?
      </h3>

      <p class="interrupt-card__description">
        A few quick choices can surface better matches.
      </p>
    </div>

    <div
      class="interrupt-options generated-chip-target"
      aria-label="Search preferences"
    ></div>

    <button
      type="button"
      class="cta-button interrupt-card__button"
      onclick="saveIntentPreferences()"
    >
      Show me better matches
    </button>
  </div>
`;
interruptCard.style.display = "";

document.querySelectorAll(".refined-card").forEach(el => el.remove());

const gridEl2 = document.querySelector(".grid");
const fragment = document.createDocumentFragment();
listings.forEach((listing, i) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = createRefinedListingCard(listing, i);
  fragment.appendChild(tmp.firstElementChild);
});
interruptCard.after(fragment);

refinedResults.innerHTML = "";

    if (leafletMap && intentMapEl && !intentMapEl.hidden) {
  initLeafletMap();
}
updateViewedBadges();
if (options.openFirstResult) {
  window.setTimeout(() => {
    const firstRefinedCard = document.querySelector(".refined-card");

    if (firstRefinedCard) {
      firstRefinedCard.click();
    }
  }, 250);
}
        } catch (error) {
          console.error(error);

          refinedResults.innerHTML = `
            <div class="refined-section-copy">
              Could not load refined matches.
            </div>
          `;

        }

               chip.classList.remove("is-loading");
        interruptCard.classList.remove("is-refining");
      }

console.log("INTENT REFINE EXPOSED", typeof window.runIntentRefine);

document.addEventListener("click", async (event) => {
  const loadMoreBtn = event.target.closest("#load-more-refined");

  if (!loadMoreBtn) return;

  const refinedResults = document.getElementById("refined-results");
  const grid = refinedResults?.querySelector(".refined-results-grid");

  if (!refinedResults || !grid) return;

  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Loading...";

  try {
    const response = await fetch("/api/intent-refine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    body: JSON.stringify({
  session_id: getIntentSessionId(),
city: document.querySelector("[data-city]")?.dataset.city,
  slug: document.querySelector("[data-slug]")?.dataset.slug,
  refine_label: loadMoreBtn.dataset.refineLabel || "",
        visible_max_price: getVisibleMaxPrice(),
            visible_listings: getVisibleCards().map((card) => ({
          address: card.dataset.address || "",
          price: card.dataset.price || "",
          area: card.dataset.area || "",
        })),
        positive_reactions: getPositiveIntentReactions(),
               price_band_rule: {
          percent: 0.2,
          max_delta: 100000,
        },
        required_type:
          getPositiveIntentReactions()[0]?.type ||
          document.querySelector(".original-card")?.dataset.type ||
          "",
        offset: Number(loadMoreBtn.dataset.nextOffset || 24),
        limit: 24,
      }),
    });

    const json = await response.json();

    const moreListings = json.listings || [];
    const hasMoreAgain = Boolean(json.has_more);
    const nextOffsetAgain = Number(json.next_offset || 0);

    if (moreListings.length) {
      grid.insertAdjacentHTML(
        "beforeend",
moreListings.map((listing, index) => createRefinedListingCard(listing, index)).join(" ")      );
updateViewedBadges();
    }

    if (hasMoreAgain) {
      loadMoreBtn.dataset.nextOffset = String(nextOffsetAgain);
      loadMoreBtn.disabled = false;
loadMoreBtn.textContent = "Load 12 more like this";    } else {
      loadMoreBtn.remove();
    }
  } catch (error) {
    console.error(error);
    loadMoreBtn.disabled = false;
loadMoreBtn.textContent = "Load 12 more like this";  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest(
    "#refined-list-btn, #refined-map-btn, #refined-all-map-btn"
  );

  if (!button) return;

  const refinedResults = document.getElementById("refined-results");
  const refinedGrid = refinedResults?.querySelector(".refined-results-grid");

  if (!refinedResults || !refinedGrid) return;

  refinedResults
    .querySelectorAll(".refined-view-toggle .view-btn")
    .forEach((btn) => btn.classList.remove("active"));

  button.classList.add("active");

  const refinedMapEl = document.getElementById("refined-intent-map");

if (button.id === "refined-list-btn") {
  if (refinedMapEl) {
    refinedMapEl.hidden = true;
    refinedMapEl.style.display = "none";
  }

  intentMapEl.hidden = true;
  gridEl?.classList.remove("map-hidden");
  refinedGrid.style.display = "";

  listViewBtn?.classList.add("active");
  mapViewBtn?.classList.remove("active");
  return;
}

intentMapEl.hidden = true;
gridEl?.classList.remove("map-hidden");
refinedGrid.style.display = "none";

if (refinedMapEl) {
  refinedMapEl.hidden = false;
  refinedMapEl.style.display = "block";
}

listViewBtn?.classList.remove("active");
mapViewBtn?.classList.remove("active");

window.setTimeout(() => {
  window.__initRefinedLeafletMap?.();
}, 80);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-refined-sort]");

  if (!button) return;

  const sort = button.dataset.refinedSort || "newest";
  const refinedResults = document.getElementById("refined-results");
  const grid = refinedResults?.querySelector(".refined-results-grid");

  if (!grid) return;

  refinedResults.querySelectorAll("[data-refined-sort]").forEach((btn) => {
    btn.classList.toggle("active", btn === button);
  });

  const cards = Array.from(grid.querySelectorAll(".refined-card"));

  cards.sort((a, b) => {
    if (sort === "price-asc") {
      return Number(a.dataset.rawPrice || 0) - Number(b.dataset.rawPrice || 0);
    }

    if (sort === "price-desc") {
      return Number(b.dataset.rawPrice || 0) - Number(a.dataset.rawPrice || 0);
    }

   return (
  new Date(b.dataset.listedAt || 0).getTime() -
    new Date(a.dataset.listedAt || 0).getTime() ||
  Number(a.dataset.sortIndex || 0) - Number(b.dataset.sortIndex || 0)
);
  });

  cards.forEach((card) => grid.appendChild(card));

 if (refinedLeafletMap) {
    window.__initRefinedLeafletMap?.();
  }
});
/* ROTATING TEXT-ONLY INTERRUPTOR SYSTEM */
const interruptorCardState = {
  applying: false,
  chipLabels: [],
};

function getInterruptorCard() {
  return document.getElementById("intent-interrupt-card");
}

function rememberInterruptorChips(card) {
  if (!(card instanceof HTMLElement)) return;

  const labels = Array.from(
    card.querySelectorAll(
      ".generated-refine-chip, .refine-chip"
    )
  )
    .map((chip) =>
      String(chip.textContent || "").trim()
    )
    .filter(Boolean);

  if (labels.length) {
    interruptorCardState.chipLabels = [
      ...new Set(labels),
    ].slice(0, 3);
  }
}

function findClickableByText(pattern) {
  return Array.from(
    document.querySelectorAll(
      'button, a[href], [role="button"]'
    )
  ).find((element) =>
    pattern.test(
      String(element.textContent || "").trim()
    )
  );
}

function openSaveSearchFromInterruptor() {
  const saveRoot =
    document.querySelector("[data-slug-save-search]");

  const openButton =
    saveRoot?.querySelector("[data-slug-save-open]");

  if (!(saveRoot instanceof HTMLElement)) return;

  if (
    openButton instanceof HTMLButtonElement &&
    openButton.getAttribute("aria-expanded") !== "true"
  ) {
    openButton.click();
  }

  window.setTimeout(() => {
    saveRoot.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const nameInput =
      saveRoot.querySelector('input[name="searchName"]');

    if (nameInput instanceof HTMLInputElement) {
      nameInput.focus({ preventScroll: true });
    }
  }, 40);
}

function openSimilarSearchesFromInterruptor() {
  const headings = Array.from(
    document.querySelectorAll("h2, h3")
  );

  const heading = headings.find((element) =>
    /explore similar searches|similar searches|next searches/i.test(
      String(element.textContent || "")
    )
  );

  const section =
    heading?.closest("section") ||
    heading?.parentElement;

  if (section instanceof HTMLElement) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    return;
  }

  const relatedLink =
    document.querySelector(
      [
        ".related-intent-card a",
        ".related-intent-cards a",
        "[data-related-intent] a",
      ].join(",")
    );

  if (relatedLink instanceof HTMLAnchorElement) {
    relatedLink.click();
  }
}

function openQuestionFromInterruptor() {
  const directTrigger =
    document.querySelector(
      [
        "[data-intent-action='question']",
        "[data-open-question]",
        "[data-question-trigger]",
        ".ask-question-button",
        ".contact-agent-button",
      ].join(",")
    );

  const textTrigger =
    findClickableByText(
      /ask (a )?question|ask the agent|contact|request (a )?showing|book (a )?tour/i
    );

  const trigger =
    directTrigger || textTrigger;

  if (
    trigger instanceof HTMLElement &&
    trigger.id !== "intent-interrupt-action"
  ) {
    trigger.click();
    return;
  }

  const contactSection =
    document.querySelector(
      [
        "#contact",
        "#ask-question",
        ".contact-section",
        ".intent-contact",
      ].join(",")
    );

  contactSection?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function getInterruptorVariant() {
  const variants = [
    "fact",
    "fact",
    "fact",
    "fact",
    "save",
  ];

  const storageKey =
    `listing-interruptor:${window.location.pathname}`;

  let previousIndex = -1;

  try {
    previousIndex = Number(
      sessionStorage.getItem(storageKey) || "-1"
    );
  } catch {
    previousIndex = -1;
  }

  const nextIndex =
    (previousIndex + 1) % variants.length;

  try {
    sessionStorage.setItem(
      storageKey,
      String(nextIndex)
    );
  } catch {
    // Storage may be unavailable.
  }

  return variants[nextIndex];
}

const selectedInterruptorVariant =
  getInterruptorVariant();

/* EDUCATION_FIRST_DISCOVERY_CLIENT_V1 */
function getDidYouKnowConfig() {
  const card = getInterruptorCard();

  let facts = [];

  if (card instanceof HTMLElement) {
    try {
      const parsedFacts = JSON.parse(
        card.dataset.discoveryFacts || "[]"
      );

      if (Array.isArray(parsedFacts)) {
        facts = parsedFacts.filter(
          (fact) =>
            fact &&
            typeof fact.title === "string" &&
            fact.title.trim()
        );
      }
    } catch (error) {
      console.warn(
        "Could not parse discovery facts:",
        error
      );
    }
  }

  if (!facts.length) {
    facts = [
      {
        kicker: "Did you know?",
        title:
          "This search updates as local inventory changes.",
        description:
          "New listings, price adjustments, accepted offers, and removals can reshape the results throughout the week.",
      },
    ];
  }

  const storageKey =
    `discovery-fact-index:${window.location.pathname}`;

  let previousIndex = -1;

  try {
    previousIndex = Number(
      sessionStorage.getItem(storageKey) || "-1"
    );
  } catch {
    previousIndex = -1;
  }

  const nextIndex =
    (previousIndex + 1) % facts.length;

  try {
    sessionStorage.setItem(
      storageKey,
      String(nextIndex)
    );
  } catch {
    // Ignore storage failures.
  }

  const fact = facts[nextIndex];

  return {
    kicker:
      fact.kicker || "Did you know?",
    title: fact.title,
    description:
      fact.description || "",
    buttonLabel: "",
    action: null,
    showChips: false,
  };
}
function getInterruptorConfig(variant) {
  const cityName =
    document.body.dataset.cityLabel ||
    document
      .querySelector("[data-city-label]")
      ?.getAttribute("data-city-label") ||
    "";

  const pageHeading =
    document.querySelector("h1")
      ?.textContent
      ?.replace(/\s+/g, " ")
      .trim() ||
    "this search";

  const configs = {
    fact: getDidYouKnowConfig(),

    save: {
      kicker: "Never miss one",
      title: "Want new matches sent to you?",
      description:
        `Save ${pageHeading.toLowerCase()} and get notified when relevant listings reach the market.`,
      buttonLabel: "Save this search",
      action: openSaveSearchFromInterruptor,
      showChips: false,
    },

    similar: {
      kicker: "Explore alternatives",
      title: "There may be another search worth seeing.",
      description:
        `Compare related ${cityName || "local"} searches without losing your place here.`,
      buttonLabel: "Explore similar searches",
      action: openSimilarSearchesFromInterruptor,
      showChips: false,
    },

    question: {
      kicker: "Local help",
      title: "Have a question about one of these homes?",
      description:
        "Ask about location, waterfront details, viewing times, or anything the listing does not explain.",
      buttonLabel: "Ask a question",
      action: openQuestionFromInterruptor,
      showChips: false,
    },
  };

  return configs[variant] || configs.fact;
}

function escapeInterruptorHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyInterruptorCard() {
  const card = getInterruptorCard();

  if (
    !(card instanceof HTMLElement) ||
    interruptorCardState.applying
  ) {
    return;
  }

  interruptorCardState.applying = true;

  rememberInterruptorChips(card);

  const config =
    getInterruptorConfig(
      selectedInterruptorVariant
    );

  const chips = config.showChips
    ? interruptorCardState.chipLabels
        .slice(0, 3)
        .map(
          (label) => `
            <button
              type="button"
              class="refine-chip generated-refine-chip interruptor-choice"
            >
              ${escapeInterruptorHtml(label)}
            </button>
          `
        )
        .join("")
    : "";

  card.className =
    `card interrupt-card interrupt-card--${selectedInterruptorVariant}`;

  card.setAttribute(
    "data-interruptor-variant",
    selectedInterruptorVariant
  );

  card.innerHTML = `
    <div class="interrupt-card__inner">
      <p class="interrupt-card__kicker">
        ${escapeInterruptorHtml(config.kicker)}
      </p>

      <h3 class="interrupt-card__title">
        ${escapeInterruptorHtml(config.title)}
      </h3>

      <p class="interrupt-card__description">
        ${escapeInterruptorHtml(
          config.description
        )}
      </p>

      ${
        chips
          ? `
            <div
              class="interrupt-options generated-chip-target"
              aria-label="Search preferences"
            >
              ${chips}
            </div>
          `
          : ""
      }      ${
        config.buttonLabel
          ? `
            <button
              type="button"
              class="interrupt-card__button"
              id="intent-interrupt-action"
            >
              ${escapeInterruptorHtml(
                config.buttonLabel
              )}
              <span aria-hidden="true">&rarr;</span>
            </button>
          `
          : ""
      }
    </div>
  `;

  const actionButton =
    card.querySelector(
      "#intent-interrupt-action"
    );

  if (
    actionButton &&
    typeof config.action === "function"
  ) {
    actionButton.addEventListener(
      "click",
      config.action
    );
  }

  card.style.visibility = "visible";
  interruptorCardState.applying = false;
}

function watchInterruptorCard() {
  const card = getInterruptorCard();

  if (!(card instanceof HTMLElement)) {
    return;
  }

  applyInterruptorCard();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    watchInterruptorCard,
    { once: true }
  );
} else {
  watchInterruptorCard();
}

window.resetRefine = function () {
  document.querySelectorAll(".refined-card").forEach(el => el.remove());
  document.querySelectorAll(".original-card.is-hidden-by-refine").forEach(card => {
    card.classList.remove("is-hidden-by-refine");
    card.style.display = "";
  });
  const interruptCard = document.getElementById("intent-interrupt-card");
  if (interruptCard) {
    interruptCard.innerHTML = `
  <div class="interrupt-card__inner">
    <div class="interrupt-card__icon" aria-hidden="true">
    </div>

    <div>
      <p class="interrupt-card__kicker">
        Help me narrow this search
      </p>

      <h3 class="interrupt-card__title">
        Not seeing the right home?
      </h3>

      <p class="interrupt-card__description">
        A few quick choices can surface better matches.
      </p>
    </div>

    <div
      class="interrupt-options generated-chip-target"
      aria-label="Search preferences"
    ></div>

    <button
      type="button"
      class="cta-button interrupt-card__button"
      onclick="saveIntentPreferences()"
    >
      Show me better matches
    </button>
  </div>
`;
  }
  document.getElementById("refined-results").innerHTML = "";
};
      window.saveIntentPreferences = function () {
        const selectedLabels = Array.from(
          document.querySelectorAll(".refine-chip.active")
        ).map((chip) => chip.textContent.trim());

        const resultsBar = document.querySelector(".results-bar");

        if (resultsBar) {
          if (selectedLabels.length) {
            resultsBar.textContent =
              `Preferences saved: ${selectedLabels.join(" ")}`;
          } else {
            resultsBar.textContent =
              `Select preferences to help improve future matches.`;
          }
        }

        window.scrollTo({
          top: document.querySelector(".section-head")?.offsetTop - 20,
          behavior: "smooth",
        });

        fetch("/api/intent-listing-reaction", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    session_id: getIntentSessionId(),
    site_id:
      document.body.dataset.siteId || null,
 intent_page_id: document.querySelector("[data-intent-page-id]")?.dataset.intentPageId,
    city: document.querySelector("[data-city]")?.dataset.city,
    slug: document.querySelector("[data-slug]")?.dataset.slug,

    listing_id: activeCard.dataset.listingId || activeCard.dataset.itemId || "",
    mls_number: activeCard.dataset.mls || "",
    address: activeCard.dataset.address || "",
    price: activeCard.dataset.price || "",
    beds: activeCard.dataset.beds || "",
    baths: activeCard.dataset.baths || "",
    sqft: activeCard.dataset.sqft || "",
    area: activeCard.dataset.area || "",

    decision,
    liked_tags: [],
  }),
}).catch((error) => {
  console.error("Failed to save intent listing reaction:", error);
});
      };
    