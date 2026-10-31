
  (() => {
const steps = ["buyer", "type", "budget", "beds", "area", "features"];
    let currentStepIndex = 0;

    const state = {
      buyer: "",
      type: "",
      budget: "",
beds: "",
area: [],
      features: [],
    };

    const city = document.querySelector("[data-city]")?.dataset.city || "nanaimo";

    const labels = {
      buyer: "I'm...",
      type: "Looking for a...",
     budget: "Around...",
beds: "With...",
area: "In...",
      features: "What matters most?",
    };

    const options = {
buyer: [
  ["a first-time buyer", "a first-time buyer"],
  ["moving up", "moving up"],
  ["downsizing", "downsizing"],
  ["an investor", "an investor"],
  ["relocating", "relocating"],
  ["looking for a vacation home", "looking for a vacation home"],
  ["just browsing", "just browsing"],
],
      type: [
        ["House", "house"],
        ["Condo", "condo"],
        ["Townhome", "townhouse"],
        ["Mobile Home", "mobile"],
        ["Land", "land"],
        ["No preference", ""],
      ],
   budget: [
  ["around $500k", "500"],
  ["around $800k", "800"],
  ["around $1.2M", "1200"],
  ["above $1.2M", "1200plus"],
  ["flexible", ""],
],
beds: [
  ["Any beds", ""],
  ["1+ bed", "1"],
  ["2+ beds", "2"],
  ["3+ beds", "3"],
  ["4+ beds", "4"],
  ["5+ beds", "5"],
],
      area: [
        ["No preference", ""],
      ],
     features: [],
    };

    const panel = document.getElementById("home-story-panel");
    const optionsWrap = document.getElementById("home-story-options");
    const question = document.getElementById("home-story-question");
    const progress = document.getElementById("home-story-progress");
    const nextBtn = document.getElementById("home-story-next");
    const backBtn = document.getElementById("home-story-back");
    const startBtn = document.getElementById("home-story-start");
    const skipBtn = document.getElementById("home-story-skip");

    function titleCase(value) {
      return String(value || "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function getAreaOptions() {
      const select = document.querySelector('select[name="area"]');
      const fromSelect = Array.from(select?.options || [])
        .filter((option) => option.value)
        .slice(0, 10)
        .map((option) => [option.textContent.trim(), option.value]);

      return [["No preference", ""], ...fromSelect];
    }

    function labelFor(step, value) {
if (step === "area") {
  if (Array.isArray(value)) {
    if (!value.length) return "";
    return value.map(titleCase).join(", ");
  }
 return value ? titleCase(value) : "";
}
      const found = (options[step] || []).find((item) => item[1] === value);
      return found?.[0] || value || "";
    }

    function updateSentence() {
  document.querySelectorAll(".story-blank").forEach((blank) => {
    const step = blank.dataset.storyStep;

    let label = "";

    if (step === "features") {
      label = state.features.length
        ? state.features.map((feature) => labelFor("features", feature)).join(", ")
        : "";
    } else {
      label = labelFor(step, state[step]);
    }

 if (label && label !== "No preference" && label !== "flexible" && label !== "Any beds" && label !== "All areas") {
  blank.dataset.label = label;
  blank.classList.add("is-filled");
} else {
  delete blank.dataset.label;
  blank.classList.remove("is-filled");
}
  });


}
function positionStoryPanel(step) {
  if (!panel) return;

  panel.classList.add("is-popover");
  panel.dataset.step = step;

  panel.style.position = "fixed";
  panel.style.left = "50%";
  panel.style.top = "50%";
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.transform = "translate(-50%, -50%)";
}


function getFeatureOptions() {
  const type = String(state.type || "").toLowerCase();

  if (type === "condo") {
    return [
      ["Ocean views", "views"],
      ["Walkability", "walkability"],
      ["Secure parking", "parking"],
      ["Elevator", "elevator"],
      ["Low-maintenance", "low-maintenance"],
      ["Updated interiors", "updated"],
      ["Close to shopping", "shopping"],
      ["Close to downtown", "downtown"],
      ["Storage", "storage"],
      ["Rental potential", "rental"],
    ];
  }

  if (type === "townhouse") {
    return [
      ["Low-maintenance", "low-maintenance"],
      ["Garage", "garage"],
      ["Private patio", "patio"],
      ["Family-friendly", "family"],
      ["Updated interiors", "updated"],
      ["Walkability", "walkability"],
      ["Close to schools", "schools"],
      ["Pet-friendly", "pet-friendly"],
      ["Storage", "storage"],
      ["Quiet setting", "quiet"],
    ];
  }

  if (type === "mobile") {
    return [
      ["Affordable", "affordable"],
      ["Low pad fee", "pad-fee"],
      ["Updated interiors", "updated"],
      ["Quiet park", "quiet"],
      ["Pet-friendly", "pet-friendly"],
      ["Small yard", "yard"],
      ["Parking", "parking"],
      ["55+ community", "55-plus"],
      ["Move-in ready", "move-in-ready"],
      ["Storage", "storage"],
    ];
  }

  if (type === "land") {
    return [
      ["Ocean views", "views"],
      ["Build-ready", "build-ready"],
      ["Privacy", "privacy"],
      ["Acreage", "acreage"],
      ["Services nearby", "services"],
      ["Good sun exposure", "sun"],
      ["Quiet setting", "quiet"],
      ["Investment potential", "investment"],
      ["Close to town", "town"],
      ["Waterfront", "waterfront"],
    ];
  }

  return [
    ["Ocean views", "views"],
    ["Waterfront", "waterfront"],
    ["Walkability", "walkability"],
    ["Beach access", "beach"],
    ["Quiet streets", "quiet"],
    ["Large yard", "yard"],
    ["Garage", "garage"],
    ["Income suite", "suite"],
    ["Updated interiors", "updated"],
    ["Investment potential", "investment"],
  ];
}
    function openStep(step) {
      currentStepIndex = Math.max(0, steps.indexOf(step));

      if (!panel || !optionsWrap || !question || !progress) return;

      const current = steps[currentStepIndex];

   if (current === "area") {
  options.area = getAreaOptions();
}



if (current === "features") {
  options.features = getFeatureOptions();
}

      question.textContent = labels[current];
      progress.textContent = `Step ${currentStepIndex + 1} of ${steps.length}`;
      optionsWrap.innerHTML = "";

      (options[current] || []).forEach(([label, value]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "home-story-option";
        button.textContent = label;
        button.dataset.value = value;

 const selected =
  current === "features"
    ? state.features.includes(value)
    : current === "area"
    ? Array.isArray(state.area) && state.area.includes(value)
    : state[current] === value;

        button.classList.toggle("is-selected", selected);

      button.addEventListener("click", () => {
 if (current === "area") {
  if (!value) {
    state.area = [];
    optionsWrap.querySelectorAll(".home-story-option").forEach((el) => {
      el.classList.remove("is-selected");
    });
    button.classList.add("is-selected");
    updateSentence();

    window.setTimeout(() => {
      if (currentStepIndex < steps.length - 1) {
        openStep(steps[currentStepIndex + 1]);
      }
    }, 180);

    return;
  }

  state.area = Array.isArray(state.area) ? state.area : [];

  state.area = state.area.includes(value)
    ? state.area.filter((item) => item !== value)
    : [...state.area, value];

  optionsWrap.querySelectorAll('.home-story-option[data-value=""]').forEach((el) => {
    el.classList.remove("is-selected");
  });

  button.classList.toggle("is-selected", state.area.includes(value));

  updateSentence();
  return;
}

  if (current === "features") {
            if (state.features.includes(value)) {
              state.features = state.features.filter((item) => item !== value);
            } else {
              state.features.push(value);
            }

            button.classList.toggle("is-selected");
          } else {
            state[current] = value;

            optionsWrap.querySelectorAll(".home-story-option").forEach((el) => {
              el.classList.remove("is-selected");
            });

            button.classList.add("is-selected");

            window.setTimeout(() => {
              if (currentStepIndex < steps.length - 1) {
                openStep(steps[currentStepIndex + 1]);
              }
            }, 220);
          }

          updateSentence();
        });

        optionsWrap.appendChild(button);
      });

      panel.hidden = false;
      panel.dataset.step = current;
      positionStoryPanel(current);
    }

    function updateSearchSummary() {
  const summary = document.getElementById("home-search-summary");
  if (!summary) return;

  const typeLabel = labelFor("type", state.type) || "home";
  const budgetLabel = labelFor("budget", state.budget) || "a flexible budget";
  const areaLabel = state.area ? titleCase(state.area) : "all areas";
  const featuresLabel = state.features.length
    ? state.features.map((feature) => labelFor("features", feature)).join(", ")
    : "your selected priorities";

  const cards = Array.from(document.querySelectorAll(".grid .card"));
const visibleCards = cards.filter((card) => !card.hidden);
const matchCount = document.getElementById("results-count")?.textContent || visibleCards.length;

  const prices = visibleCards
    .map((card) => Number(card.dataset.rawPrice || 0))
    .filter((price) => price > 0)
    .sort((a, b) => a - b);

  const areas = new Set(
    visibleCards
      .map((card) => String(card.dataset.area || "").trim())
      .filter(Boolean)
  );

  document.getElementById("home-search-summary-title").textContent =
    `${titleCase(areaLabel)} ${titleCase(typeLabel)} Search`;

  document.getElementById("home-search-summary-copy").textContent =
    `Based on what you told us, we're showing ${typeLabel.toLowerCase()} options around ${budgetLabel.toLowerCase()} in ${areaLabel}, with attention to ${featuresLabel.toLowerCase()}.`;

document.getElementById("summary-match-count").textContent =
    String(matchCount);

const summaryPriceRange = document.getElementById("summary-price-range");

if (summaryPriceRange) {
  if (state.budget && state.budget !== "1200plus") {
    const min = Math.round(Number(state.budget) * 0.85);
    const max = Math.round(Number(state.budget) * 1.15);
    summaryPriceRange.textContent = `$${min}k $${max}k`;
  } else if (state.budget === "1200plus") {
    summaryPriceRange.textContent = "$1.2M+";
  } else {
    summaryPriceRange.textContent = prices.length
      ? `$${Math.round(prices[0] / 1000)}k $${Math.round(prices[prices.length - 1] / 1000)}k`
      : " ";
  }
}

  document.getElementById("summary-area-count").textContent =
    areas.size ? String(areas.size) : " ";

  summary.hidden = false;
}

    function applyStoryToHomepage() {
      const form = document.getElementById("home-filter-form");
      if (!form) return;

      if (state.type && form.elements.type) {
        form.elements.type.value = state.type;
      }

 if (form.elements.minPrice) {
  form.elements.minPrice.value = "";
}

if (form.elements.maxPrice) {
  form.elements.maxPrice.value = "";
}

if (form.elements.storyMaxPrice) {
  form.elements.storyMaxPrice.value = "";
}

if (state.budget && state.budget !== "1200plus") {
  if (form.elements.storyMaxPrice) {
    form.elements.storyMaxPrice.value = String(state.budget);
  }
}

if (state.budget === "1200plus" && form.elements.minPrice) {
  form.elements.minPrice.value = "1200";
}
const areaVal = String(form?.elements?.area?.value || "").trim().toLowerCase();

if (state.beds && form.elements.beds) {
  form.elements.beds.value = state.beds;
}

  if (form.elements.area) {
  form.elements.area.value = "";
}

if (form.elements.storyAreas) {
  form.elements.storyAreas.value = Array.isArray(state.area)
    ? state.area.join("|")
    : "";
}

      const featureMap = {
        views: "views",
        garage: "garage",
        yard: "yard",
        suite: "suite",
        updated: "updated",
        walkability: "walkability",
      };

      Object.entries(featureMap).forEach(([feature, refine]) => {
        const button = document.querySelector(`#homepage-refine-panel [data-refine="${refine}"]`);
        if (button && state.features.includes(feature)) {
          button.classList.add("active");
        }
      });

   panel.hidden = true;

document.querySelector(".homepage-neighbourhoods")?.setAttribute("hidden", "");

form.dispatchEvent(new Event("change", { bubbles: true }));

window.setTimeout(updateSearchSummary, 50);

      document.querySelector(".results-heading")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    document.querySelectorAll(".story-blank").forEach((blank) => {
      blank.addEventListener("click", () => {
        openStep(blank.dataset.storyStep);
      });
    });

    startBtn?.addEventListener("click", () => openStep("buyer"));

    skipBtn?.addEventListener("click", () => {
      document.querySelector(".results-heading")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    nextBtn?.addEventListener("click", () => {
      if (currentStepIndex >= steps.length - 1) {
        applyStoryToHomepage();
        return;
      }

      openStep(steps[currentStepIndex + 1]);
    });

    backBtn?.addEventListener("click", () => {
      if (currentStepIndex <= 0) {
        panel.hidden = true;
        return;
      }

      openStep(steps[currentStepIndex - 1]);
    });

    updateSentence();
  })();
