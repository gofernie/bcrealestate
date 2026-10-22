function initIntentReviewModal() {
        const sheet = document.getElementById("preview-sheet");
        const overlay = document.getElementById("sheet-overlay");

        if (!sheet || !overlay) return;
// modal-astro-lifecycle-v1
const previous = window.__intentModalLifecycle;
if (previous?.sheet === sheet) return;

previous?.dispose();
document.body.style.overflow = "";
document.body.classList.remove("is-landscape-gallery-open");

const controller = new AbortController();
const observers = [];

const listenerOptions = (options) => ({
  ...(typeof options === "boolean"
    ? { capture: options }
    : (options || {})),
  signal: controller.signal
});

const listenModalWindow = (type, handler, options) => {
  window.addEventListener(type, handler, listenerOptions(options));
};

const listenModalDocument = (type, handler, options) => {
  document.addEventListener(type, handler, listenerOptions(options));
};

const createModalObserver = (callback) => {
  const observer = new MutationObserver(callback);
  observers.push(observer);
  return observer;
};

window.__intentModalLifecycle = {
  sheet,
  dispose() {
    controller.abort();
    observers.forEach((observer) => observer.disconnect());
  }
};


        const sheetImage = document.getElementById("sheet-image");
        const sheetPrice = document.getElementById("sheet-price");
        const sheetAddress = document.getElementById("sheet-address");
        const sheetMeta = document.getElementById("sheet-meta");
        let sheetDescription = document.getElementById("sheet-description");
        const sheetListingBrokerage =
          document.getElementById("sheet-listing-brokerage");
        const sheetRealtorCaBadge =
          document.getElementById("sheet-realtor-ca-badge");
        const sheetRealtorCaLink =
          document.getElementById("sheet-realtor-ca-link");
        const sheetPosition = document.getElementById("sheet-position");
        const sheetProgressBar = document.getElementById("sheet-progress-bar");
        const closeBtn = document.getElementById("sheet-close-btn");
const sheetMapBtn = document.getElementById("sheet-map-btn");

// modal-header-listing-nav-inline-v2
const sheetPrevTopBtn = document.getElementById(
  "sheet-prev-top-btn"
);
const sheetNextTopBtn = document.getElementById(
  "sheet-next-top-btn"
);

[sheetPrevTopBtn, sheetNextTopBtn].forEach((button) => {
  if (!(button instanceof HTMLElement)) return;

  button.style.setProperty(
    "background",
    "#f5f8fa",
    "important"
  );
  button.style.setProperty(
    "border",
    "1px solid #cbd6de",
    "important"
  );
  button.style.setProperty(
    "color",
    "#29485d",
    "important"
  );
  button.style.setProperty(
    "box-shadow",
    "none",
    "important"
  );
});

if (sheetPrevTopBtn instanceof HTMLElement) {
  sheetPrevTopBtn.style.setProperty(
    "margin-left",
    "14px",
    "important"
  );
}
const sheetFloorplanBtn = document.getElementById("sheet-floorplan-btn");
const sheetFloorplanDownloadBtn =
  document.getElementById("sheet-floorplan-download-btn");
const sheetPhotoShareBtn =
  document.getElementById("sheet-photo-share-btn");
const sheetShareBtn = document.getElementById("sheet-share-btn");
const sheetBrochureBtn = document.getElementById("sheet-brochure-btn");
// move-share-outside-description
const listingReactionActions =
  document.querySelector(".listing-reaction-actions");

const sheetRooms =
  document.getElementById("sheet-rooms");
const sheetMiniMap = document.getElementById("sheet-mini-map");
const sheetMiniMapWrap = document.getElementById("sheet-mini-map-wrap");
const sheetMapExpandBtn = document.getElementById("sheet-map-expand-btn");
const sheetImageStage = document.querySelector(".panel__image-stage");

// Keep whichever primary media is open above the reaction buttons.
if (
  sheetImageStage &&
  sheetMiniMapWrap
) {
  sheetImageStage.insertAdjacentElement(
    "afterend",
    sheetMiniMapWrap
  );
}

// redesign-listing-utilities
const redesignListingUtilities = () => {
  const openContent =
    Array.from(
      document.querySelectorAll(".panel__content")
    ).find((element) =>
      element.classList.contains("open")
    );

  const visibleBody =
    openContent?.querySelector(
      ":scope > .panel__body"
    );

  if (!visibleBody) return;

  const canonicalActions =
    document
      .getElementById("decision-love-btn")
      ?.closest(".listing-reaction-actions") ||
    document.querySelector(
      ".listing-reaction-actions"
    );

  // Hide any cloned/duplicate reaction groups.
  document
    .querySelectorAll(".listing-reaction-actions")
    .forEach((group) => {
      const keep = group === canonicalActions;

      group.hidden = !keep;
      group.style.setProperty(
        "display",
        keep ? "flex" : "none",
        "important"
      );
    });

  // Share becomes the fourth action.
  if (
    sheetShareBtn &&
    canonicalActions &&
    sheetShareBtn.parentElement !== canonicalActions
  ) {
    canonicalActions.appendChild(sheetShareBtn);
  }

  // Keep one action row followed by Rooms.
  if (
    canonicalActions &&
    canonicalActions.parentElement !== visibleBody
  ) {
    visibleBody.appendChild(canonicalActions);
  }

  if (
    sheetRooms &&
    sheetRooms.parentElement !== visibleBody
  ) {
    visibleBody.appendChild(sheetRooms);
  }

  // Ensure order remains actions, then rooms.
  if (canonicalActions && sheetRooms) {
    canonicalActions.after(sheetRooms);
  }
};

document
  .querySelectorAll(".panel__content")
  .forEach((contentElement) => {
    createModalObserver(() => {
      if (contentElement.classList.contains("open")) {
        window.setTimeout(
          redesignListingUtilities,
          0
        );
      }
    }).observe(contentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });

if (sheetRooms) {
  createModalObserver(() => {
    window.setTimeout(
      redesignListingUtilities,
      0
    );
  }).observe(sheetRooms, {
    attributes: true,
    childList: true,
    subtree: true,
  });
}

listenModalWindow("resize", () => {
  window.setTimeout(
    redesignListingUtilities,
    0
  );
});

// sync-listing-sections-to-open-panel
const syncListingSectionsToOpenPanel = () => {
  const openPanelContent =
    Array.from(
      document.querySelectorAll(".panel__content")
    ).find((content) =>
      content.classList.contains("open")
    );

  const targetBody =
    openPanelContent?.querySelector(
      ":scope > .panel__body"
    );

  if (!targetBody) return;

  const descriptionWrap =
    targetBody.querySelector(".panel__desc-wrap");

  const engage =
    document.getElementById("sheet-engage");

  const decisionActions =
    targetBody.querySelector(".decision-actions");

  /*
   * Put Ask / Book immediately beneath the description.
   * This runs once through the existing modal-open observer.
   */
  if (descriptionWrap && engage) {
    descriptionWrap.insertAdjacentElement(
      "afterend",
      engage
    );
  }

  /*
   * Preserve or create the Share wrapper, then centre it
   * beneath Love / Like / Nope.
   */
  let shareRow =
    targetBody.querySelector(".panel__share-row") ||
    document.querySelector(".panel__share-row");

  if (!shareRow) {
    shareRow = document.createElement("div");
    shareRow.className = "panel__share-row";
  }

  if (sheetShareBtn) {
    shareRow.appendChild(sheetShareBtn);
    sheetShareBtn.hidden = false;
    sheetShareBtn.style.removeProperty("display");
  }

  if (decisionActions) {
    decisionActions.insertAdjacentElement(
      "afterend",
      shareRow
    );
  } else if (engage) {
    engage.insertAdjacentElement(
      "afterend",
      shareRow
    );
  } else {
    targetBody.appendChild(shareRow);
  }

  if (sheetRooms) {
    shareRow.insertAdjacentElement(
      "afterend",
      sheetRooms
    );
  }
};

document
  .querySelectorAll(".panel__content")
  .forEach((panelContent) => {
    createModalObserver(() => {
      if (panelContent.classList.contains("open")) {
        requestAnimationFrame(() => {
          syncListingSectionsToOpenPanel();
        });
      }
    }).observe(panelContent, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });

listenModalWindow("resize", () => {
  requestAnimationFrame(() => {
    syncListingSectionsToOpenPanel();
  });
});
// dedicated-floorplan-pdf-overlay
const sheetFloorplanPdfOverlayBtn =
  document.createElement("button");

sheetFloorplanPdfOverlayBtn.type = "button";
sheetFloorplanPdfOverlayBtn.textContent =
  "Download PDF";
sheetFloorplanPdfOverlayBtn.hidden = true;
sheetFloorplanPdfOverlayBtn.setAttribute(
  "aria-label",
  "Download floorplan PDF"
);

sheetImageStage?.appendChild(
  sheetFloorplanPdfOverlayBtn
);

const syncDedicatedFloorplanPdfOverlay = () => {
  const hasFloorplans =
    getCurrentFloorplanUrls().length > 0;

  const showOverlay =
    Boolean(isFloorplanMode && hasFloorplans);

  // The original control owns the PDF click handler,
  // but it must never appear in the modal header.
  if (sheetFloorplanDownloadBtn) {
    if (!sheetFloorplanDownloadBtn.hidden) {
      sheetFloorplanDownloadBtn.hidden = true;
    }

    if (
      sheetFloorplanDownloadBtn.style
        .getPropertyValue("display") !== "none" ||
      sheetFloorplanDownloadBtn.style
        .getPropertyPriority("display") !== "important"
    ) {
      sheetFloorplanDownloadBtn.style.setProperty(
        "display",
        "none",
        "important"
      );
    }
  }

  sheetFloorplanPdfOverlayBtn.hidden =
    !showOverlay;

  const style =
    sheetFloorplanPdfOverlayBtn.style;

  style.setProperty(
    "display",
    showOverlay ? "inline-flex" : "none",
    "important"
  );

  if (!showOverlay) return;

  sheetFloorplanPdfOverlayBtn.disabled =
    Boolean(sheetFloorplanDownloadBtn?.disabled);

  sheetFloorplanPdfOverlayBtn.textContent =
    sheetFloorplanDownloadBtn?.disabled
      ? "Building PDF..."
      : "Download PDF";

  style.setProperty(
    "position",
    "absolute",
    "important"
  );
  style.setProperty(
    "top",
    "auto",
    "important"
  );
  style.setProperty(
    "right",
    "18px",
    "important"
  );
  style.setProperty(
    "bottom",
    "18px",
    "important"
  );
  style.setProperty(
    "left",
    "auto",
    "important"
  );
  style.setProperty(
    "z-index",
    "60",
    "important"
  );
  style.setProperty(
    "align-items",
    "center",
    "important"
  );
  style.setProperty(
    "justify-content",
    "center",
    "important"
  );
  style.setProperty(
    "width",
    "auto",
    "important"
  );
  style.setProperty(
    "min-width",
    "126px",
    "important"
  );
  style.setProperty(
    "height",
    "38px",
    "important"
  );
  style.setProperty(
    "padding",
    "0 15px",
    "important"
  );
  style.setProperty(
    "margin",
    "0",
    "important"
  );
  style.setProperty(
    "border",
    "1px solid rgba(16,35,49,.24)",
    "important"
  );
  style.setProperty(
    "border-radius",
    "7px",
    "important"
  );
  style.setProperty(
    "background",
    "rgba(255,255,255,.94)",
    "important"
  );
  style.setProperty(
    "color",
    "#102331",
    "important"
  );
  style.setProperty(
    "box-shadow",
    "0 5px 16px rgba(0,0,0,.16)",
    "important"
  );
  style.setProperty(
    "font-size",
    ".82rem",
    "important"
  );
  style.setProperty(
    "font-weight",
    "750",
    "important"
  );
  style.setProperty(
    "white-space",
    "nowrap",
    "important"
  );
  style.setProperty(
    "cursor",
    "pointer",
    "important"
  );
  style.setProperty(
    "transform",
    "none",
    "important"
  );
};

sheetFloorplanPdfOverlayBtn.addEventListener(
  "click",
  (event) => {
    event.stopPropagation();

    if (
      isFloorplanMode &&
      getCurrentFloorplanUrls().length
    ) {
      sheetFloorplanDownloadBtn?.click();
    }
  }
);

if (sheetFloorplanDownloadBtn) {
  createModalObserver(() => {
    syncDedicatedFloorplanPdfOverlay();
  }).observe(sheetFloorplanDownloadBtn, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

createModalObserver(() => {
  syncDedicatedFloorplanPdfOverlay();
}).observe(sheetImageStage, {
  attributes: true,
  attributeFilter: ["class"]
});

queueMicrotask(() => {
  syncDedicatedFloorplanPdfOverlay();
  syncMobileMediaCounts();
});

function getCurrentFloorplanUrls() {
  try {
    const urls = JSON.parse(activeCard?.dataset?.floorplans || "[]");
    return Array.isArray(urls) ? urls : [];
  } catch {
    return [];
  }
}

function normalizeGalleryUrl(url) {
  return String(url || "")
    .replace(/[?&]class=[^&]+/g, "")
    .replace(/\?$/, "")
    .trim();
}

function setFloorplanButtonDefault() {
  if (!sheetFloorplanBtn) return;

  const floorplans = getCurrentFloorplanUrls();

  if (!floorplans.length) return;

  sheetFloorplanBtn.textContent =
    floorplans.length > 1
          ? `Floorplans (${floorplans.length})`
          : "Floorplan";
}

function refreshFloorplanButtonVisibility() {
  if (!sheetFloorplanBtn) return;

  const visibleMapButton = Array.from(
    document.querySelectorAll("#sheet-map-btn")
  ).find((button) => {
    const rect = button.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight
    );
  });

  if (
    visibleMapButton?.parentElement &&
    sheetFloorplanBtn.parentElement !==
      visibleMapButton.parentElement
  ) {
    visibleMapButton.parentElement.insertBefore(
      sheetFloorplanBtn,
      visibleMapButton
    );
  }
  // Keep Download PDF inside the image rather than in the header.
  if (
    sheetImageStage &&
    sheetFloorplanDownloadBtn &&
    sheetFloorplanDownloadBtn.parentElement !== sheetImageStage
  ) {
    sheetImageStage.appendChild(sheetFloorplanDownloadBtn);
  }

  const floorplans = getCurrentFloorplanUrls();
  const hasFloorplans = floorplans.length > 0;

  const showTopFloorplanButton =
    hasFloorplans &&
    !window.matchMedia("(max-width: 600px)").matches;

  sheetFloorplanBtn.hidden =
    !showTopFloorplanButton;

  sheetFloorplanBtn.style.setProperty(
    "display",
    showTopFloorplanButton
      ? "inline-flex"
      : "none",
    "important"
  );

  if (hasFloorplans) {
    setFloorplanButtonDefault();
  }
}

function rememberRegularPhotoPosition() {
  const floorplans = getCurrentFloorplanUrls()
    .map(normalizeGalleryUrl);

  const currentUrl =
    activePhotoUrls[activePhotoIndex] || "";

  const isFloorplan =
    floorplans.includes(normalizeGalleryUrl(currentUrl));

  if (!isFloorplan) {
    lastRegularPhotoIndex = activePhotoIndex;
  }
}
function returnToRegularPhotos() {
  isFloorplanMode = false;
  const floorplans = getCurrentFloorplanUrls()
    .map(normalizeGalleryUrl);

  const rememberedUrl =
    activePhotoUrls[lastRegularPhotoIndex] || "";

  const rememberedIsRegular =
    rememberedUrl &&
    !floorplans.includes(normalizeGalleryUrl(rememberedUrl));

  if (
    rememberedIsRegular &&
    lastRegularPhotoIndex >= 0 &&
    lastRegularPhotoIndex < activePhotoUrls.length
  ) {
    activePhotoIndex = lastRegularPhotoIndex;
  } else {
    const regularPhotoIndex = activePhotoUrls.findIndex(
      (url) => !floorplans.includes(normalizeGalleryUrl(url))
    );

    activePhotoIndex =
      regularPhotoIndex >= 0 ? regularPhotoIndex : 0;
  }

  showActivePhoto();
  hidePhotoOverlayTemporarily();
}

let mapBaseHeight = 0;
let mapIsExpanded = false;
let firstPhotoStageHeight = 0;

let sheetMiniMapInstance = null;
let sheetMiniMapMarker = null;
let cachedImageStageHeight = 0;
function addSmallInfoWindow(marker, label) {
  marker.bindPopup(`<div style="font-family:'DM Sans',system-ui,sans-serif;font-size:0.82rem;font-weight:600;padding:2px 4px;">${label}</div>`, {
    closeButton: false,
    offset: [0, -8],
  });
  marker.on("click", () => marker.openPopup());
}

function getCardLatLng(card) {
  const lat = parseFloat(card?.dataset?.lat || "");
  const lng = parseFloat(card?.dataset?.lng || "");
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) return resolve();
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = resolve;
      document.head.appendChild(script);
    } else {
      const wait = setInterval(() => { if (window.L) { clearInterval(wait); resolve(); } }, 50);
    }
  });
}
        const nextBtn = document.getElementById("sheet-next-btn");
        const prevBtn = document.getElementById("sheet-prev-btn");
        const nextTopBtn = document.getElementById("sheet-next-top-btn");
        const prevTopBtn = document.getElementById("sheet-prev-top-btn");

        const loveBtn = document.getElementById("decision-love-btn");
        const maybeBtn = document.getElementById("decision-maybe-btn");
        const passBtn = document.getElementById("decision-pass-btn");
       function popDecisionEmojisFromButton(button, emojiList = ["\u2764\uFE0F"], count = 8) {
  if (!button) return;

  const rect = button.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const emoji = document.createElement("span");

    emoji.textContent = emojiList[i % emojiList.length];
    emoji.style.position = "fixed";
    emoji.style.left = `${startX}px`;
    emoji.style.top = `${startY}px`;
    emoji.style.zIndex = "2147483647";
    emoji.style.pointerEvents = "none";
    emoji.style.fontSize = i === 0 ? "34px" : "26px";
    emoji.style.lineHeight = "1";
    emoji.style.transform = "translate(-50%, -50%) scale(0.6)";
    emoji.style.opacity = "1";
    emoji.style.filter = "drop-shadow(0 6px 10px rgba(0,0,0,0.22))";

    document.body.appendChild(emoji);

    const driftX = (Math.random() - 0.5) * 150;
    const driftY = -80 - Math.random() * 80;
    const rotate = (Math.random() - 0.5) * 45;

    emoji.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
        { transform: "translate(-50%, -70%) scale(1.15)", opacity: 1, offset: 0.18 },
        {
          transform: `translate(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px)) scale(1.45) rotate(${rotate}deg)`,
          opacity: 0
        }
      ],
      {
        duration: 1100,
        delay: i * 35,
        easing: "ease-out",
        fill: "forwards"
      }
    );

    window.setTimeout(() => emoji.remove(), 1500);
  }
}
        const feedback = document.getElementById("sheet-feedback");
const sheetEngage = document.getElementById("sheet-engage");
const askQuestionBtn = document.getElementById("ask-question-btn");
const bookShowingBtn = document.getElementById("book-showing-btn");

if (askQuestionBtn) {
  askQuestionBtn.style.setProperty("height", "40px", "important");
  askQuestionBtn.style.setProperty("min-height", "40px", "important");
  askQuestionBtn.style.setProperty("max-height", "40px", "important");
  askQuestionBtn.style.setProperty("padding-top", "0", "important");
  askQuestionBtn.style.setProperty("padding-bottom", "0", "important");
  askQuestionBtn.style.setProperty("box-sizing", "border-box", "important");
}

if (bookShowingBtn) {
  bookShowingBtn.style.setProperty("height", "40px", "important");
  bookShowingBtn.style.setProperty("min-height", "40px", "important");
  bookShowingBtn.style.setProperty("max-height", "40px", "important");
  bookShowingBtn.style.setProperty("padding-top", "0", "important");
  bookShowingBtn.style.setProperty("padding-bottom", "0", "important");
  bookShowingBtn.style.setProperty("box-sizing", "border-box", "important");
}
let likeTagsEl = document.getElementById("intent-like-tags");
function getLikeTagsForType(propertyType = "") {
  const type = String(propertyType || "").toLowerCase();

  if (type.includes("condo") || type.includes("apartment")) {
    return [
      ["area", "Location"],
      ["layout", "Layout"],
      ["views", "Views"],
      ["building", "Building"],
      ["amenities", "Amenities"],
      ["walkability", "Walkability"],
      ["modern", "Modern"],
      ["value", "Value"],
      
    ];
  }

  if (type.includes("town")) {
    return [
    ["area", "Area"],  
    ["layout", "Layout"],
      ["garage", "Garage"],
      ["yard", "Yard"],
      ["storage", "Storage"],
      ["modern", "Modern"],
      ["value", "Value"],
      
    ];
  }

if (type.includes("mobile") || type.includes("manufactured")) {
  return [
    ["area", "Location"],
    ["value", "Affordable"],
    ["modern", "Updated"],
    ["community", "Community"],
    ["views", "Views"],
    ["layout", "Layout"],
    ["parking", "Parking"],
    ["yard", "Yard"],
  ];
}

  return [
  ["area", "Area"],  
  ["layout", "Layout"],
    ["yard", "Yard"],
    ["garage", "Garage"],
    ["suite", "Suite potential"],
    ["views", "Views"],
    ["privacy", "Privacy"],
    ["modern", "Modern"],
    
  ];
}

if (!likeTagsEl) {
  likeTagsEl = document.createElement("div");
  likeTagsEl.id = "intent-like-tags";
  likeTagsEl.className = "intent-like-tags";
  likeTagsEl.hidden = true;

 document
  .querySelector("#preview-sheet .listing-reaction-actions")
  ?.insertAdjacentElement("beforebegin", likeTagsEl);
}
        const sheetContent = document.getElementById("sheet-content");
        const sheetSummary = document.getElementById("sheet-summary");
const sheetPhotoCount = document.getElementById("sheet-photo-count");
const photoPrevBtn = document.getElementById("photo-prev-btn");
const photoNextBtn = document.getElementById("photo-next-btn");
const sheetImageOverlay = document.getElementById("sheet-image-overlay");
const fullscreenPhotoThumbs = document.getElementById(
  "fullscreen-photo-thumbs"
);

function renderFullscreenPhotoRail() {
  if (!fullscreenPhotoThumbs) return;

  const isFullscreenGallery =
    sheet?.classList.contains("is-landscape-gallery");

  fullscreenPhotoThumbs.hidden =
    !isFullscreenGallery || activePhotoUrls.length < 2;

  if (fullscreenPhotoThumbs.hidden) return;

  fullscreenPhotoThumbs.replaceChildren();

  activePhotoUrls.forEach((url, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fullscreen-photo-thumb";
    button.setAttribute(
      "aria-label",
      `Show photo ${index + 1} of ${activePhotoUrls.length}`
    );
    button.setAttribute(
      "aria-current",
      String(index === activePhotoIndex)
    );

    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.loading = index < 8 ? "eager" : "lazy";

    button.appendChild(image);

    button.addEventListener("click", (event) => {
      event.stopPropagation();

      if (index === activePhotoIndex) return;

      activePhotoIndex = index;
      showActivePhoto();
    });

    fullscreenPhotoThumbs.appendChild(button);
  });

  fullscreenPhotoThumbs
    .querySelector('[aria-current="true"]')
    ?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
}

let photoOverlayTimer = null;
let manualPhotoFullscreen = false;


/* =========================================================
   MOBILE LANDSCAPE GALLERY
   ========================================================= */

const landscapeMediaQuery = window.matchMedia("(orientation: landscape)");

function isPhoneLikeDevice() {
  const hasTouch =
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

  const coarsePointer =
    window.matchMedia("(pointer: coarse)").matches;

  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const longSide = Math.max(window.innerWidth, window.innerHeight);

  return (
    hasTouch &&
    coarsePointer &&
    shortSide <= 600 &&
    longSide <= 1000
  );
}

function shouldUseLandscapeGallery() {
  return (
    sheet?.classList.contains("open") &&
    activePhotoUrls.length > 0 &&
    (
      manualPhotoFullscreen ||
      (
        landscapeMediaQuery.matches &&
        isPhoneLikeDevice()
      )
    )
  );
}
function syncLandscapeViewport() {
  if (!sheet?.classList.contains("is-landscape-gallery")) return;

  const viewport = window.visualViewport;

  const width = Math.round(
    viewport?.width || window.innerWidth
  );

  const height = Math.round(
    viewport?.height || window.innerHeight
  );

  document.documentElement.style.setProperty(
    "--landscape-vw",
    `${width}px`
  );

  document.documentElement.style.setProperty(
    "--landscape-vh",
    `${height}px`
  );

  // Reset stale zoom/pan geometry after browser wake.
  photoZoom = 1;
  pinchStartDistance = 0;
  photoPanX = 0;
  photoPanY = 0;
  panStartX = 0;
  panStartY = 0;

  if (sheetImage) {
    sheetImage.style.transform =
      "translate(0px, 0px) scale(1)";
    sheetImage.style.transformOrigin =
      "center center";
  }
}
function ensureLandscapeFullscreen() {
  if (!shouldUseLandscapeGallery()) return;
  if (document.fullscreenElement) return;

  const target = sheetImageStage || sheet;

  if (target.requestFullscreen) {
    target
      .requestFullscreen({ navigationUI: "hide" })
      .catch(() => {});
  }
}

function restoreFullscreenAfterWake() {
  landscapeFullscreenNeedsRefresh = false;
}

function updateLandscapeGalleryMode() {
  if (!sheet || !overlay) return;

  const shouldBeGallery = shouldUseLandscapeGallery();

  sheet.classList.toggle(
    "is-landscape-gallery",
    shouldBeGallery
  );

  overlay.classList.toggle(
    "is-landscape-gallery",
    shouldBeGallery
  );

  document.body.classList.toggle(
    "is-landscape-gallery-open",
    shouldBeGallery
  );

  if (shouldBeGallery) {
    syncLandscapeViewport();
    renderFullscreenPhotoRail();
    if (sheetMiniMap) {
      sheetMiniMap.hidden = true;
      sheetMiniMap.style.display = "none";
    }

    if (sheetImageStage) {
      sheetImageStage.classList.remove("is-hidden");
    sheetImageStage.hidden = false;
    sheetImageStage.style.removeProperty("display");

      if (
        sheetImage &&
        sheetImage.style.opacity !== "0"
      ) {
        sheetImageStage.style.visibility = "visible";
      }
    }

    if (sheetMapBtn) {
      sheetMapBtn.textContent = "Map";
    }

    if (photoOverlayTimer) {
      clearTimeout(photoOverlayTimer);
      photoOverlayTimer = null;
    }

    sheetImageOverlay?.classList.remove(
  "is-hidden-while-browsing"
);

} else {
  document.documentElement.style.removeProperty("--landscape-vw");
  document.documentElement.style.removeProperty("--landscape-vh");

  if (
    document.fullscreenElement &&
    document.exitFullscreen
  ) {
    document.exitFullscreen()
  .then(() => {
    requestAnimationFrame(() => {
      updateLandscapeGalleryMode();

      // Force Chrome to recalculate portrait geometry/repaint.
      void sheet.offsetHeight;

      window.dispatchEvent(new Event("resize"));

      requestAnimationFrame(() => {
        void sheet.offsetHeight;
      });
    });
  })
  .catch(() => {});
  }

  photoZoom = 1;
  pinchStartDistance = 0;

  photoPanX = 0;
  photoPanY = 0;

  panStartX = 0;
  panStartY = 0;

  if (sheetImage) {
    sheetImage.style.transform =
      "translate(0px, 0px) scale(1)";

    sheetImage.style.transformOrigin =
      "center center";
  }
}
}

let portraitRecoveryTimer = null;
let portraitExitInProgress = false;

function browserReportsPortrait() {
  const orientationType = screen.orientation?.type || "";

  if (orientationType.startsWith("portrait")) return true;
  if (orientationType.startsWith("landscape")) return false;

  return window.matchMedia("(orientation: portrait)").matches;
}

function restorePortraitGalleryLayout() {
  if (!sheet?.classList.contains("open")) return;
  if (!browserReportsPortrait()) return;

  sheet.classList.remove("is-landscape-gallery");
  overlay?.classList.remove("is-landscape-gallery");

  document.body.classList.remove(
    "is-landscape-gallery-open"
  );

  document.documentElement.style.removeProperty(
    "--landscape-vw"
  );

  document.documentElement.style.removeProperty(
    "--landscape-vh"
  );

  photoZoom = 1;
  pinchStartDistance = 0;
  photoPanX = 0;
  photoPanY = 0;
  panStartX = 0;
  panStartY = 0;

  if (sheetImage) {
    sheetImage.style.transform =
      "translate(0px, 0px) scale(1)";
    sheetImage.style.transformOrigin =
      "center center";
  }

  if (mobileMediaNav) {
    mobileMediaNav.style.removeProperty("display");
    mobileMediaNav.style.removeProperty("visibility");
    mobileMediaNav.style.removeProperty("pointer-events");
  }

  if (
    document.fullscreenElement &&
    document.exitFullscreen &&
    !portraitExitInProgress
  ) {
    portraitExitInProgress = true;

    document.exitFullscreen()
      .catch(() => {})
      .finally(() => {
        portraitExitInProgress = false;
      });
  }

  requestAnimationFrame(() => {
    if (sheet) {
      void sheet.offsetHeight;
    }
  });
}

function scheduleOrientationRecovery() {
  if (portraitRecoveryTimer) {
    clearTimeout(portraitRecoveryTimer);
  }

  if (browserReportsPortrait()) {
    restorePortraitGalleryLayout();

    portraitRecoveryTimer = window.setTimeout(() => {
      portraitRecoveryTimer = null;
      restorePortraitGalleryLayout();
    }, 250);

    return;
  }

  portraitRecoveryTimer = window.setTimeout(() => {
    portraitRecoveryTimer = null;
    updateLandscapeGalleryMode();
    syncLandscapeViewport();
  }, 120);
}

function setBrowserThemeColor(color) {
  let themeMeta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.setAttribute("name", "theme-color");
    document.head.appendChild(themeMeta);
  }

  themeMeta.setAttribute("content", color);
}

listenModalDocument("fullscreenchange", () => {
  if (document.fullscreenElement) {
    setBrowserThemeColor("#000000");
    syncLandscapeViewport();
    return;
  }

  // Force Chrome/Android to process a genuine colour
  // transition when restoring its system status bar.
  setBrowserThemeColor("#fefefe");

  requestAnimationFrame(() => {
    setBrowserThemeColor("#ffffff");
  });

  window.setTimeout(() => {
    setBrowserThemeColor("#ffffff");
  }, 150);

  if (browserReportsPortrait()) {
    restorePortraitGalleryLayout();
  }
});
landscapeMediaQuery.addEventListener?.(
  "change",
  scheduleOrientationRecovery
);

listenModalWindow(
  "orientationchange",
  scheduleOrientationRecovery
);

screen.orientation?.addEventListener?.(
  "change",
  scheduleOrientationRecovery
);

function hidePhotoOverlayTemporarily() {
  if (window.innerWidth > 768 || !sheetImageOverlay) return;

  sheetImageOverlay.classList.add("is-hidden-while-browsing");

  if (photoOverlayTimer) {
    clearTimeout(photoOverlayTimer);
  }

  photoOverlayTimer = window.setTimeout(() => {
    sheetImageOverlay.classList.remove("is-hidden-while-browsing");
    photoOverlayTimer = null;
  }, 2000);
}

function updateSheetScrollHint() {
  if (!sheetContent) return;

  const canScroll = sheetContent.scrollHeight > sheetContent.clientHeight + 80;
  const nearBottom =
    sheetContent.scrollTop + sheetContent.clientHeight >= sheetContent.scrollHeight - 90;

  sheetContent.classList.toggle("no-scroll-hint", !canScroll);
  sheetContent.classList.toggle("is-near-bottom", nearBottom);
}

function scrollSheetToTop() {
  sheetContent?.scrollTo({
    top: 0,
    behavior: "smooth",
  });

  sheet?.scrollTo({
    top: 0,
    behavior: "smooth",
  });

  sheet
    ?.querySelector(".panel__view")
    ?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
}

sheetContent?.addEventListener("scroll", updateSheetScrollHint);
listenModalWindow("resize", updateSheetScrollHint);

        let activePhotoUrls = [];
        let activePhotoIndex = 0;
let lastRegularPhotoIndex = 0;
       let photoSwipeStartX = 0;
let photoSwipeStartY = 0;

let photoZoom = 1;
let pinchStartDistance = 0;

let photoPanX = 0;
let photoPanY = 0;

let panStartX = 0;
let panStartY = 0;

let lastPhotoTapTime = 0;

let landscapeFullscreenNeedsRefresh = false;

let activeCard = null;
let isFloorplanMode = false;
const mobileMediaNav =
  document.getElementById("mobile-media-nav");

const mobileMediaMap =
  document.getElementById("mobile-media-map");

const mobileMediaFloorplan =
  document.getElementById("mobile-media-floorplan");

const mobileMediaPhotos =
  document.getElementById("mobile-media-photos");

function syncMobileMediaCounts() {
  const floorplanCount =
    typeof getCurrentFloorplanUrls === "function"
      ? getCurrentFloorplanUrls().length
      : 0;

  let photoCount = 0;

  try {
    const images = JSON.parse(
      activeCard?.dataset?.images || "[]"
    );

    if (Array.isArray(images)) {
      photoCount = images.length;
    }
  } catch {}

  if (mobileMediaFloorplan) {
    mobileMediaFloorplan.textContent =
      floorplanCount > 0
        ? `Floorplan (${floorplanCount})`
        : "Floorplan";
  }

  if (mobileMediaPhotos) {
    mobileMediaPhotos.textContent =
      photoCount > 0
        ? `Pics (${photoCount})`
        : "Pics";
  }
}

if (
  mobileMediaNav &&
  mobileMediaNav.parentElement !== document.body
) {
  document.body.appendChild(mobileMediaNav);
}

const setMobileMediaMode = (mode) => {
  mobileMediaNav
    ?.querySelectorAll("[data-media-mode]")
    .forEach((button) => {
      const active =
        button.dataset.mediaMode === mode;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });
};

const syncMobileMediaNav = () => {

  // landscape-mobile-nav-hard-stop
  if (
    document.body.classList.contains(
      "is-landscape-gallery-open"
    )
  ) {
    mobileMediaNav?.style.setProperty(
      "display",
      "none",
      "important"
    );

    return;
  }

  mobileMediaNav?.style.removeProperty(
    "display"
  );
  const hasFloorplans =
    getCurrentFloorplanUrls().length > 0;

  // centred-mobile-nav-inline
  if (mobileMediaNav) {
    mobileMediaNav.style.setProperty(
      "grid-template-columns",
      `repeat(
        ${hasFloorplans ? 3 : 2},
        minmax(0, 108px)
      )`,
      "important"
    );

    mobileMediaNav.style.setProperty(
      "justify-content",
      "center",
      "important"
    );

    mobileMediaNav.style.setProperty(
      "padding-top",
      "0",
      "important"
    );

    mobileMediaNav.style.setProperty(
      "border-top",
      "1px solid rgba(16, 35, 49, 0.14)",
      "important"
    );
  }

  if (mobileMediaFloorplan) {
    mobileMediaFloorplan.hidden =
      !hasFloorplans;
  }

  const mapIsOpen =
    Boolean(
      sheetMiniMap &&
      !sheetMiniMap.hidden &&
      sheetMiniMap.style.display !== "none"
    );

    // remove-map-to-nav-gap
  if (mobileMediaNav) {
    mobileMediaNav.style.setProperty(
      "padding-top",
      "9px",
      "important"
    );
  }
if (mobileMediaMap) {
    mobileMediaMap.textContent = "Map";
  }

  if (mapIsOpen) {
    setMobileMediaMode("map");
  } else if (isFloorplanMode) {
    setMobileMediaMode("floorplan");
  } else {
    setMobileMediaMode("photos");
  }
};

mobileMediaMap?.addEventListener(
  "click",
  () => {
    const mapIsOpen =
      Boolean(
        sheetMiniMapWrap &&
        !sheetMiniMapWrap.hidden &&
        getComputedStyle(
          sheetMiniMapWrap
        ).display !== "none"
      );

    if (mapIsOpen) {
      setMobileMediaMode("map");
      return;
    }

    sheetMapBtn?.click();

    window.setTimeout(
      syncMobileMediaNav,
      250
    );
  }
);

mobileMediaFloorplan?.addEventListener(
  "click",
  () => {
    if (
      getCurrentFloorplanUrls().length === 0
    ) {
      return;
    }

    const mapIsOpen =
      Boolean(
        sheetMiniMapWrap &&
        !sheetMiniMapWrap.hidden &&
        getComputedStyle(
          sheetMiniMapWrap
        ).display !== "none"
      );

    if (mapIsExpanded) {
      sheetMapExpandBtn?.click();
    }

    if (mapIsOpen) {
      sheetMapBtn?.click();
    }

    sheetFloorplanBtn?.click();

    window.setTimeout(
      syncMobileMediaNav,
      50
    );
  }
);

mobileMediaPhotos?.addEventListener(
  "click",
  () => {
    const mapIsOpen =
      Boolean(
        sheetMiniMap &&
        !sheetMiniMap.hidden &&
        sheetMiniMap.style.display !== "none"
      );

    if (mapIsOpen) {
      sheetMapBtn?.click();
    }

    if (isFloorplanMode) {
      returnToRegularPhotos();
    }

    setMobileMediaMode("photos");
    scrollSheetToTop();
  }
);

if (sheetImage) {
  createModalObserver(
    syncMobileMediaNav
  ).observe(sheetImage, {
    attributes: true,
    attributeFilter: ["src", "class"],
  });
}

if (sheetMiniMapWrap) {
  createModalObserver(
    syncMobileMediaNav
  ).observe(sheetMiniMapWrap, {
    attributes: true,
    attributeFilter: [
      "hidden",
      "style",
      "class",
    ],
  });
}

/* mobile-floorplan-state-observer */
if (sheetFloorplanBtn) {
  createModalObserver(() => {
    window.setTimeout(
      syncMobileMediaNav,
      0
    );
  }).observe(sheetFloorplanBtn, {
    attributes: true,
    attributeFilter: [
      "hidden",
      "style",
      "class",
    ],
  });
}

queueMicrotask(syncMobileMediaNav);
let modalHistoryPushed = false;
let modalReturnUrl = window.location.href;

function getListingUrl(card) {
  if (!card) return "";

  const city = String(
    card.dataset.city ||
    document.body.dataset.city ||
    "nanaimo"
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  const listingId = String(
    card.dataset.mls ||
    card.dataset.listingId ||
    card.dataset.itemId ||
    ""
  ).trim();

  return listingId
    ? `/${city}/listing/${encodeURIComponent(listingId)}`
    : "";
}

function getPhotoShareUrl() {
  if (!activeCard) return "";

  const listingId = String(
    activeCard.dataset.listingId ||
    activeCard.dataset.itemId ||
    activeCard.dataset.mls ||
    ""
  ).trim();

  if (!listingId) return "";

  const shareUrl = new URL(
    window.location.pathname,
    window.location.origin
  );

  shareUrl.searchParams.set("listing_id", listingId);
  shareUrl.searchParams.set(
    "photo",
    String(Math.max(1, activePhotoIndex + 1))
  );

  return shareUrl.toString();
}

function showPhotoShareCopied() {
  const buttons = [
    sheetPhotoShareBtn,
    desktopPhotoOverlay?.querySelector(
      '[data-desktop-photo-action="share"]'
    ),
  ];

  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;

    button.dataset.shareState = "copied";
    button.setAttribute("aria-label", "Photo link copied");
    button.setAttribute("title", "Photo link copied");

    window.setTimeout(() => {
      button.removeAttribute("data-share-state");
      button.setAttribute("aria-label", "Share this photo");
      button.setAttribute("title", "Share this photo");
    }, 1600);
  });
}

/* photo-share-dialog-v1 */
let photoShareDialog = null;
let photoShareDialogReturnFocus = null;
let photoShareCopyResetTimer = 0;

function getPhotoShareDetails() {
  const shareUrl = getPhotoShareUrl();
  const address = activeCard?.dataset?.address || "this property";
  const photoNumber = Math.max(1, activePhotoIndex + 1);

  return {
    address,
    photoNumber,
    shareUrl,
    subject: `${address} - photo ${photoNumber}`,
    message: `Take a look at photo ${photoNumber} of ${address}: ${shareUrl}`,
  };
}

function closePhotoShareDialog(restoreFocus = true) {
  if (!photoShareDialog) return;

  photoShareDialog.style.removeProperty("display");
  photoShareDialog.hidden = true;

  const trigger = photoShareDialogReturnFocus;
  photoShareDialogReturnFocus = null;

  if (
    restoreFocus &&
    trigger instanceof HTMLElement &&
    trigger.isConnected
  ) {
    window.setTimeout(() => trigger.focus(), 0);
  }
}

async function copyPhotoShareText(text) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try the selection fallback below.
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.setAttribute("aria-hidden", "true");
  helper.style.cssText =
    "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";

  document.body.appendChild(helper);
  helper.focus({ preventScroll: true });
  helper.select();
  helper.setSelectionRange(0, helper.value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  helper.remove();
  return copied;
}

function ensurePhotoShareDialog() {
  if (photoShareDialog) return photoShareDialog;

  const dialog = document.createElement("div");
  dialog.id = "photo-share-dialog";
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "photo-share-dialog-title");
  dialog.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:flex;" +
    "align-items:center;justify-content:center;padding:20px;" +
    "background:rgba(6,12,18,.54);backdrop-filter:blur(7px);" +
    "-webkit-backdrop-filter:blur(7px);";

  const panel = document.createElement("section");
  panel.style.cssText =
    "width:min(100%,360px);box-sizing:border-box;padding:22px;" +
    "border:1px solid rgba(255,255,255,.18);border-radius:18px;" +
    "background:#fff;color:#172330;box-shadow:0 20px 60px rgba(0,0,0,.32);" +
    "font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;";

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;";

  const headingWrap = document.createElement("div");

  const title = document.createElement("h2");
  title.id = "photo-share-dialog-title";
  title.style.cssText = "margin:0;font-size:19px;line-height:1.2;";

  const subtitle = document.createElement("p");
  subtitle.dataset.photoShareSubtitle = "true";
  subtitle.style.cssText =
    "margin:5px 0 0;color:#61717f;font-size:13px;line-height:1.35;";

  headingWrap.append(title, subtitle);

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "\u00d7";
  close.setAttribute("aria-label", "Close share options");
  close.style.cssText =
    "flex:0 0 auto;width:34px;height:34px;padding:0;border:0;border-radius:9px;" +
    "background:#eef2f5;color:#334657;font-size:25px;line-height:1;cursor:pointer;";
  close.addEventListener("click", () => closePhotoShareDialog());

  header.append(headingWrap, close);

  const actions = document.createElement("div");
  actions.style.cssText =
    "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px;";

  const actionStyle =
    "display:flex;align-items:center;justify-content:center;min-height:46px;" +
    "box-sizing:border-box;padding:10px 12px;border:1px solid #ced9e1;" +
    "border-radius:10px;background:#fff;color:#173348;font:700 14px/1 system-ui,sans-serif;" +
    "text-decoration:none;cursor:pointer;";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy link";
  copy.dataset.photoShareCopy = "true";
  copy.style.cssText =
    actionStyle + "grid-column:1 / -1;background:#173348;color:#fff;border-color:#173348;";

  const sms = document.createElement("a");
  sms.textContent = "Send SMS";
  sms.dataset.photoShareSms = "true";
  sms.style.cssText = actionStyle;

  const email = document.createElement("a");
  email.textContent = "Email";
  email.dataset.photoShareEmail = "true";
  email.style.cssText = actionStyle;

  const whatsapp = document.createElement("a");
  whatsapp.textContent = "WhatsApp";
  whatsapp.dataset.photoShareWhatsapp = "true";
  whatsapp.target = "_blank";
  whatsapp.rel = "noopener noreferrer";
  whatsapp.style.cssText = actionStyle + "grid-column:1 / -1;";

  actions.append(copy, sms, email, whatsapp);

  const status = document.createElement("p");
  status.dataset.photoShareStatus = "true";
  status.setAttribute("aria-live", "polite");
  status.style.cssText =
    "min-height:18px;margin:14px 0 0;color:#476071;font-size:13px;line-height:1.35;";

  const manualCopy = document.createElement("input");
  manualCopy.type = "text";
  manualCopy.readOnly = true;
  manualCopy.hidden = true;
  manualCopy.dataset.photoShareManualCopy = "true";
  manualCopy.style.cssText =
    "width:100%;box-sizing:border-box;margin-top:10px;padding:10px;" +
    "border:1px solid #b9c8d2;border-radius:8px;color:#173348;background:#f8fafb;";

  panel.append(header, actions, status, manualCopy);
  dialog.appendChild(panel);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePhotoShareDialog();
  });

  copy.addEventListener("click", async () => {
    const shareUrl = dialog.dataset.shareUrl || "";
    const manualInput = dialog.querySelector("[data-photo-share-manual-copy]");
    const statusLine = dialog.querySelector("[data-photo-share-status]");

    if (!shareUrl || !(manualInput instanceof HTMLInputElement)) return;

    copy.disabled = true;
    copy.textContent = "Copying...";

    const copied = await copyPhotoShareText(shareUrl);

    copy.disabled = false;

    if (copied) {
      manualInput.hidden = true;
      if (statusLine) statusLine.textContent = "Link copied.";
      copy.textContent = "Copied";
      showPhotoShareCopied();

      window.clearTimeout(photoShareCopyResetTimer);
      photoShareCopyResetTimer = window.setTimeout(() => {
        copy.textContent = "Copy link";
      }, 1600);
      return;
    }

    manualInput.hidden = false;
    manualInput.value = shareUrl;
    manualInput.focus({ preventScroll: true });
    manualInput.select();

    if (statusLine) {
      statusLine.textContent = "Your browser blocked copying. Press Ctrl+C to copy the selected link.";
    }

    copy.textContent = "Copy link";
  });

  [sms, email, whatsapp].forEach((link) => {
    link.addEventListener("click", () => {
      window.setTimeout(() => closePhotoShareDialog(false), 0);
    });
  });

  document.body.appendChild(dialog);
  photoShareDialog = dialog;
  return dialog;
}

function openPhotoShareDialog(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const { address, photoNumber, shareUrl, subject, message } =
    getPhotoShareDetails();

  if (!shareUrl) return;

  const dialog = ensurePhotoShareDialog();
  const title = dialog.querySelector("#photo-share-dialog-title");
  const subtitle = dialog.querySelector("[data-photo-share-subtitle]");
  const statusLine = dialog.querySelector("[data-photo-share-status]");
  const copy = dialog.querySelector("[data-photo-share-copy]");
  const sms = dialog.querySelector("[data-photo-share-sms]");
  const email = dialog.querySelector("[data-photo-share-email]");
  const whatsapp = dialog.querySelector("[data-photo-share-whatsapp]");
  const manualInput = dialog.querySelector("[data-photo-share-manual-copy]");

  if (
    !(copy instanceof HTMLButtonElement) ||
    !(sms instanceof HTMLAnchorElement) ||
    !(email instanceof HTMLAnchorElement) ||
    !(whatsapp instanceof HTMLAnchorElement) ||
    !(manualInput instanceof HTMLInputElement)
  ) {
    return;
  }

  photoShareDialogReturnFocus =
    event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  dialog.dataset.shareUrl = shareUrl;
  if (title) title.textContent = `Share photo ${photoNumber}`;
  if (subtitle) subtitle.textContent = address;
  if (statusLine) statusLine.textContent = "";

  copy.disabled = false;
  copy.textContent = "Copy link";
  manualInput.hidden = true;
  manualInput.value = "";

  const encodedMessage = encodeURIComponent(message);
  const encodedSubject = encodeURIComponent(subject);
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);

  sms.href = isAppleMobile
    ? `sms:&body=${encodedMessage}`
    : `sms:?body=${encodedMessage}`;
  email.href = `mailto:?subject=${encodedSubject}&body=${encodedMessage}`;
  whatsapp.href = `https://wa.me/?text=${encodedMessage}`;

  dialog.hidden = false;
  dialog.style.display = "flex";

  window.setTimeout(() => copy.focus(), 0);
}

/* photo-share-picker-v4 */
function shareActivePhoto(event) {
  event?.preventDefault();
  event?.stopPropagation();

  const escapeHtml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]
    );

  const copyText = async (text) => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Use the fallback below.
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.setAttribute("aria-hidden", "true");
    helper.style.cssText =
      "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(helper);
    helper.focus({ preventScroll: true });
    helper.select();
    helper.setSelectionRange(0, helper.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    helper.remove();
    return copied;
  };

  const getListingId = () =>
    String(
      activeCard?.dataset?.listingId ||
        activeCard?.dataset?.itemId ||
        activeCard?.dataset?.mls ||
        ""
    ).trim();

  const getCleanShareUrl = (photoNumber = null) => {
    const listingId = getListingId();
    if (!listingId) return "";

    const marketPath = window.location.pathname.replace(
      /\/listing\/[^/]+\/?$/i,
      "/"
    );
    const shareUrl = new URL(marketPath || "/", window.location.origin);
    shareUrl.searchParams.set("listing_id", listingId);

    if (photoNumber !== null) {
      shareUrl.searchParams.set("photo", String(photoNumber));
    }

    return shareUrl.toString();
  };

  const getDetails = (mode = "photo") => {
    const address = activeCard?.dataset?.address || "this property";

    if (mode === "listing") {
      const shareUrl = getCleanShareUrl();

      return {
        mode,
        shareUrl,
        subtitle: address,
        copyLabel: "Copy listing link",
        copiedMessage: "Listing link copied.",
        subject: address,
        message: `Take a look at ${address}: ${shareUrl}`,
      };
    }

    const photoNumber = Math.max(1, activePhotoIndex + 1);
    const totalPhotos = Math.max(
      photoNumber,
      Array.isArray(activePhotoUrls) ? activePhotoUrls.length : 0
    );
    const photoPosition =
      totalPhotos > 1
        ? `Photo ${photoNumber} of ${totalPhotos}`
        : `Photo ${photoNumber}`;

    const shareUrl = getCleanShareUrl(photoNumber);

    return {
      mode,
      shareUrl,
      subtitle: `${photoPosition} · ${address}`,
      copyLabel: "Copy photo link",
      copiedMessage: "Photo link copied.",
      subject: `${address} · photo ${photoNumber}`,
      message: `Take a look at photo ${photoNumber} of ${address}: ${shareUrl}`,
    };
  };

  if (!getDetails().shareUrl) return;

  const existingDialog = document.getElementById("photo-share-dialog");
  if (existingDialog instanceof HTMLElement) {
    if (typeof existingDialog.__closePhotoShareDialog === "function") {
      existingDialog.__closePhotoShareDialog(false);
    } else {
      existingDialog.remove();
    }
  }

  const returnFocus =
    event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

  let mode = "photo";

  const dialog = document.createElement("div");
  dialog.id = "photo-share-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "photo-share-dialog-title");
  dialog.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:flex;" +
    "align-items:center;justify-content:center;padding:20px;" +
    "background:rgba(6,12,18,.54);backdrop-filter:blur(7px);" +
    "-webkit-backdrop-filter:blur(7px);";

  const close = (restoreFocus = true) => {
    window.removeEventListener("keydown", onKeyDown, true);
    dialog.__closePhotoShareDialog = null;
    dialog.remove();

    if (
      restoreFocus &&
      returnFocus instanceof HTMLElement &&
      returnFocus.isConnected
    ) {
      window.setTimeout(() => returnFocus.focus(), 0);
    }
  };

  const render = () => {
    const details = getDetails(mode);
    if (!details.shareUrl) {
      close(false);
      return;
    }

    const encodedMessage = encodeURIComponent(details.message);
    const encodedSubject = encodeURIComponent(details.subject);
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const smsHref = isAppleMobile
      ? `sms:&body=${encodedMessage}`
      : `sms:?body=${encodedMessage}`;

    dialog.dataset.shareMode = mode;
    dialog.dataset.shareUrl = details.shareUrl;

    dialog.innerHTML = `
      <style>
        #photo-share-dialog .photo-share-panel { width:min(100%,390px); box-sizing:border-box; padding:22px; border:1px solid rgba(255,255,255,.18); border-radius:18px; background:#fff; color:#172330; box-shadow:0 20px 60px rgba(0,0,0,.32); font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        #photo-share-dialog .photo-share-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        #photo-share-dialog h2 { margin:0; font-size:19px; line-height:1.2; }
        #photo-share-dialog .photo-share-subtitle { margin:5px 0 0; color:#61717f; font-size:13px; line-height:1.35; }
        #photo-share-dialog .photo-share-close { flex:0 0 auto; width:34px; height:34px; padding:0; border:0; border-radius:9px; background:#eef2f5; color:#334657; font-size:25px; line-height:1; cursor:pointer; }
        #photo-share-dialog .photo-share-targets { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:19px; }
        #photo-share-dialog .photo-share-target { min-height:68px; box-sizing:border-box; padding:11px 10px; border:1px solid #cbd8e0; border-radius:11px; background:#f8fafb; color:#173348; text-align:left; font:inherit; cursor:pointer; }
        #photo-share-dialog .photo-share-target strong { display:block; font-size:13px; line-height:1.2; }
        #photo-share-dialog .photo-share-target small { display:block; margin-top:5px; color:#61717f; font-size:11px; line-height:1.25; }
        #photo-share-dialog .photo-share-target.is-selected { border-color:#173348; background:#173348; color:#fff; box-shadow:0 5px 14px rgba(23,51,72,.2); }
        #photo-share-dialog .photo-share-target.is-selected small { color:rgba(255,255,255,.78); }
        #photo-share-dialog .photo-share-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px; }
        #photo-share-dialog .photo-share-action { display:flex; align-items:center; justify-content:center; min-height:46px; box-sizing:border-box; padding:10px 12px; border:1px solid #ced9e1; border-radius:10px; background:#fff; color:#173348; font:700 14px/1 system-ui,sans-serif; text-decoration:none; cursor:pointer; }
        #photo-share-dialog .photo-share-copy { grid-column:1 / -1; background:#173348; color:#fff; border-color:#173348; }
        #photo-share-dialog .photo-share-whatsapp { grid-column:1 / -1; }
        #photo-share-dialog .photo-share-status { min-height:18px; margin:14px 0 0; color:#476071; font-size:13px; line-height:1.35; }
        #photo-share-dialog .photo-share-manual { width:100%; box-sizing:border-box; margin-top:10px; padding:10px; border:1px solid #b9c8d2; border-radius:8px; color:#173348; background:#f8fafb; }
      </style>
      <section class="photo-share-panel" role="document">
        <header class="photo-share-header">
          <div>
            <h2 id="photo-share-dialog-title">Share</h2>
            <p class="photo-share-subtitle">${escapeHtml(details.subtitle)}</p>
          </div>
          <button class="photo-share-close" type="button" data-photo-share-action="close" aria-label="Close share options">&times;</button>
        </header>
        <div class="photo-share-targets" role="group" aria-label="Choose what to share">
          <button class="photo-share-target${mode === "photo" ? " is-selected" : ""}" type="button" data-photo-share-action="mode" data-share-mode="photo" aria-pressed="${mode === "photo"}">
            <strong>Share this photo</strong>
            <small>Exact photo link</small>
          </button>
          <button class="photo-share-target${mode === "listing" ? " is-selected" : ""}" type="button" data-photo-share-action="mode" data-share-mode="listing" aria-pressed="${mode === "listing"}">
            <strong>Share full listing</strong>
            <small>Photos, details and map</small>
          </button>
        </div>
        <div class="photo-share-actions">
          <button class="photo-share-action photo-share-copy" type="button" data-photo-share-action="copy">${escapeHtml(details.copyLabel)}</button>
          <a class="photo-share-action" data-photo-share-action="sms" href="${escapeHtml(smsHref)}">Send SMS</a>
          <a class="photo-share-action" data-photo-share-action="email" href="mailto:?subject=${encodedSubject}&amp;body=${encodedMessage}">Email</a>
          <a class="photo-share-action photo-share-whatsapp" data-photo-share-action="whatsapp" href="https://wa.me/?text=${encodedMessage}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
        <p class="photo-share-status" data-photo-share-status aria-live="polite"></p>
        <input class="photo-share-manual" data-photo-share-manual type="text" readonly hidden />
      </section>`;

    dialog.querySelector("[data-photo-share-action=copy]")?.focus();
  };

  const onKeyDown = (keyboardEvent) => {
    if (keyboardEvent.key !== "Escape") return;
    keyboardEvent.preventDefault();
    keyboardEvent.stopImmediatePropagation();
    close();
  };

  dialog.addEventListener("click", async (clickEvent) => {
    const target =
      clickEvent.target instanceof Element ? clickEvent.target : null;

    if (target === dialog) {
      close();
      return;
    }

    const action = target
      ?.closest("[data-photo-share-action]")
      ?.getAttribute("data-photo-share-action");

    if (!action) return;

    if (action === "close") {
      clickEvent.preventDefault();
      close();
      return;
    }

    if (action === "mode") {
      clickEvent.preventDefault();
      const requestedMode = target
        ?.closest("[data-share-mode]")
        ?.getAttribute("data-share-mode");

      if (requestedMode === "photo" || requestedMode === "listing") {
        mode = requestedMode;
        render();
      }
      return;
    }

    if (action === "sms" || action === "email" || action === "whatsapp") {
      window.setTimeout(() => close(false), 0);
      return;
    }

    if (action !== "copy") return;
    clickEvent.preventDefault();

    const details = getDetails(mode);
    const copyButton = target.closest("button");
    const status = dialog.querySelector("[data-photo-share-status]");
    const manualInput = dialog.querySelector("[data-photo-share-manual]");

    if (
      !details.shareUrl ||
      !(copyButton instanceof HTMLButtonElement) ||
      !(manualInput instanceof HTMLInputElement)
    ) {
      return;
    }

    copyButton.disabled = true;
    copyButton.textContent = "Copying...";

    const copied = await copyText(details.shareUrl);
    copyButton.disabled = false;

    if (copied) {
      manualInput.hidden = true;
      if (status) status.textContent = details.copiedMessage;
      copyButton.textContent = "Copied";

      if (mode === "photo" && typeof showPhotoShareCopied === "function") {
        showPhotoShareCopied();
      }

      window.setTimeout(() => {
        if (dialog.isConnected && dialog.dataset.shareMode === mode) {
          copyButton.textContent = details.copyLabel;
        }
      }, 1600);
      return;
    }

    manualInput.hidden = false;
    manualInput.value = details.shareUrl;
    manualInput.focus({ preventScroll: true });
    manualInput.select();

    if (status) {
      status.textContent =
        "Your browser blocked copying. Press Ctrl+C to copy the selected link.";
    }

    copyButton.textContent = details.copyLabel;
  });

  window.addEventListener("keydown", onKeyDown, true);
  dialog.__closePhotoShareDialog = close;
  document.body.appendChild(dialog);
  render();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && photoShareDialog && !photoShareDialog.hidden) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closePhotoShareDialog();
  }
});

function syncListingUrl(card, mode = "replace") {
  const listingUrl = getListingUrl(card);
  if (!listingUrl) return;

  const state = {
    ...(history.state || {}),
    intentModalOpen: true,
    listingId:
      card.dataset.mls ||
      card.dataset.listingId ||
      "",
    modalReturnUrl,
  };

  if (mode === "push") {
    history.pushState(state, "", listingUrl);
  } else {
    history.replaceState(state, "", listingUrl);
  }
}
let totalIntentReactions = 0;
let positiveIntentReactions = 0;
let hasShownIntentSummary = false;
let refinedBrowseCount = 0;
let hasShownSaveSearchCTA = false;
let saveSearchDismissedAtCardKey = null;
let isExitSaveSearchPrompt = false;
let hasDismissedSaveSearchCTA = false;

const SAVE_SEARCH_RESHOW_AFTER = 10;

    function cardIsInsideCurrentMap(card) {
  if (!document.body.classList.contains("is-map-mode")) return true;

  const bounds = window.currentIntentMapBounds;

  if (!bounds) return true;
  const lat = Number(card.dataset.lat || "");
  const lng = Number(card.dataset.lng || "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  return (
    lat >= Number(bounds.south) &&
    lat <= Number(bounds.north) &&
    lng >= Number(bounds.west) &&
    lng <= Number(bounds.east)
  );
}

const HIGHLIGHT_RULES = [
  { keywords: ["ocean view", "peek-a-boo ocean", "water view", "sea view", "ocean views"], label: "Ocean views" },
  { keywords: ["legal suite", "in-law suite", "carriage house", "mortgage helper", "self-contained suite"], label: "Suite potential" },
  { keywords: ["r14 zoning", "r14", "fourplex", "four-plex", "duplex zoning"], label: "R14 zoning" },
  { keywords: ["rental income", "income property", "investor alert", "income generator", "revenue property"], label: "Investor opportunity" },
  { keywords: ["double garage", "triple garage", "detached garage", "oversized garage"], label: "Garage" },
  { keywords: ["viu", "vancouver island university"], label: "Near VIU" },
  { keywords: ["old city", "downtown nanaimo", "bowen park", "departure bay"], label: "Central location" },
  { keywords: ["fully renovated", "completely updated", "newly renovated", "new kitchen", "new roof", "new windows"], label: "Updated" },
  { keywords: ["heat pump installed", "new heat pump", "ductless heat pump", "mini split"], label: "Heat pump" },
  { keywords: ["septic system", "drilled well", "well water", "water well"], label: "Rural services" },
  { keywords: ["swimming pool", "hot tub", "inground pool"], label: "Pool / hot tub" },
{ keywords: ["waterfront home", "waterfront property", "waterfront lot", "beachfront", "lakefront", "oceanfront", "on the water", "steps to the water", "direct water access"], label: "Waterfront" },  { keywords: ["acreage", "hobby farm", "farm land"], label: "Acreage" },
  { keywords: ["new build", "new home", "brand new construction", "newly built"], label: "New build" },
];

function getOwnershipChip(description = "") {
  const text = String(description || "");

  if (/\bfractional\b|\b1\s*\/\s*(?:4|8)\s*(?:ownership|interest|share)\b|\b(?:quarter|one[-\s]?quarter|half|one[-\s]?half|eighth|one[-\s]?eighth)[-\s]+(?:ownership|interest|share)\b/i.test(text)) {
    return "Fractional Ownership";
  }

  if (/\btime[-\s]?share\b|\bweek\s+\d+\b/i.test(text)) {
    return "Timeshare";
  }

  if (/\bphase\s*(?:ii|2)\b/i.test(text)) {
    return "Hotel Phase II";
  }

  if (/\bhotel\b/i.test(text)) {
    return "Hotel Suite";
  }

  return "";
}

function getHighlightChips(description = "") {
  const ownershipChip = getOwnershipChip(description);

  const highlightChips = HIGHLIGHT_RULES
    .filter(rule => rule.keywords.some(kw => description.toLowerCase().includes(kw)))
    .map(rule => rule.label)
    .slice(0, ownershipChip ? 2 : 3);

  return ownershipChip
    ? [ownershipChip, ...highlightChips]
    : highlightChips;
}

function getCards() {
  return Array.from(
    document.querySelectorAll(".original-card:not(.is-hidden-by-refine), .refined-card")
  ).filter((card) => {
    const wrapper = card.closest(".listing-card-wrap");

    return (
      !card.hidden &&
      card.style.display !== "none" &&
      (!wrapper || !wrapper.hidden) &&
      cardIsInsideCurrentMap(card)
    );
  });
}

        function currentIndex() {
  return getCards().indexOf(activeCard);
}

function getCardKey(card) {
  return String(
    card?.dataset?.listingId ||
    card?.dataset?.mls ||
    card?.dataset?.itemId ||
    card?.dataset?.address ||
    ""
  ).trim().toLowerCase();
}

async function fetchListingDetailIfNeeded(card) {
  if (!card) return false;

  let images = [];
let rooms = [];

try {
  images = JSON.parse(card.dataset.images || "[]");
} catch {
  images = [];
}

try {
  rooms = JSON.parse(card.dataset.rooms || "[]");
} catch {
  rooms = [];
}

// Homepage cards can already have images while still lacking
// full detail data such as room measurements.
const hasDescription = String(
  card.dataset.description || ""
).trim().length > 0;

if (
  card.dataset.detailHydrated === "true" &&
hasDescription &&
card.dataset.floorplansHydrated === "true"
) return false;

  const listingId = card.dataset.listingId || card.dataset.mls;
  if (!listingId) return false;

  try {
    const listingMls =
    card.dataset.mls || "";

    const detailParams =
      new URLSearchParams({
        id: listingId,
      });

    if (listingMls) {
      detailParams.set("mls", listingMls);
    }

    const res = await fetch(
      `/api/listing-detail?${detailParams.toString()}`
    );
    const data = await res.json();
    const detailListing = data?.listing || {};

  // modal-floorplan-hydration-v1
  const detailFloorplans = Array.isArray(data?.floorplans)
    ? data.floorplans.filter(
        (url) => typeof url === "string" && url.trim()
      )
    : [];

  if (activeCard && detailFloorplans.length) {
    activeCard.dataset.floorplans = JSON.stringify(
      detailFloorplans
    );
    refreshFloorplanButtonVisibility();
    syncDedicatedFloorplanPdfOverlay();
  }
    const detailDescription = [
      detailListing.description,
      detailListing.public_remarks,
      detailListing.remarks,
      detailListing.broker_remarks,
      detailListing.description_text,
    ].find(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0
    );

    if (detailDescription) {
      card.dataset.description =
        detailDescription.trim();
    }
    if (Array.isArray(data.images) && data.images.length > 0) {
      card.dataset.images = JSON.stringify(data.images);
    }

    const hydratedFloorplans = Array.isArray(data.floorplans)
  ? data.floorplans.filter(Boolean)
  : [];

card.dataset.floorplans = JSON.stringify(hydratedFloorplans);

/* floorplan-modal-hydration-fallback-v1 */
if (activeCard === card && sheetFloorplanBtn) {
  const showTopFloorplanButton =
    hydratedFloorplans.length > 0 &&
    !window.matchMedia("(max-width: 600px)").matches;

  sheetFloorplanBtn.hidden = !showTopFloorplanButton;
  sheetFloorplanBtn.style.setProperty(
    "display",
    showTopFloorplanButton ? "inline-flex" : "none",
    "important"
  );

  if (showTopFloorplanButton) {
    sheetFloorplanBtn.textContent =
      hydratedFloorplans.length > 1
        ? `Floorplans (${hydratedFloorplans.length})`
        : "Floorplan";
  }
}

    card.dataset.rooms = JSON.stringify(
      Array.isArray(data.rooms) ? data.rooms : []
    );

    card.dataset.listingBrokerage = String(
      data?.listing?.listing_brokerage || ""
    ).trim();

    card.dataset.realtorCaUrl = String(
      data?.listing?.realtor_ca_url || ""
    ).trim();
    card.dataset.videoUrl = String(data?.listing?.video_url || '').trim();

    /* floorplan-hydration-state-v1 */
card.dataset.floorplansHydrated = "true";
card.dataset.detailHydrated = "true";

return true;
  } catch (error) {
    console.error("Could not load listing detail:", error);
    return false;
  }
}

   function hydrateRoomMeasurements(card) {
  if (!card || !sheetRooms) return;

  let rooms = [];

  try {
    rooms = JSON.parse(card.dataset.rooms || "[]");
  } catch {
    rooms = [];
  }


  const validRooms = Array.isArray(rooms)
    ? rooms.filter(
        (room) =>
          room &&
          room.label &&
          (room.level || room.length || room.width)
      )
    : [];

  if (!validRooms.length) {
    sheetRooms.hidden = true;
    sheetRooms.innerHTML = "";
    return;
  }

  const formatRoomDimension = (value) => {
    const raw = String(value || "").trim();
    if (!raw || !/\d/.test(raw)) return "";
    if (/^\d+$/.test(raw)) return `${raw}'`;
    return raw;
  };

  const roomLevelRank = (level = "") => {
    const value = String(level).toLowerCase().trim();

    if (value.includes("main")) return 0;
    if (
      value.includes("upper") ||
      value.includes("second") ||
      value.includes("2nd")
    ) return 1;
    if (
      value.includes("lower") ||
      value.includes("basement")
    ) return 2;

    return 3;
  };

  const byLevel = new Map();

  for (const room of validRooms) {
    const level = String(room.level || "Other").trim();

    if (!byLevel.has(level)) {
      byLevel.set(level, []);
    }

    byLevel.get(level).push(room);
  }

  const allRoomRows = Array.from(byLevel.entries())
    .sort(
      ([levelA], [levelB]) =>
        roomLevelRank(levelA) - roomLevelRank(levelB)
    )
    .flatMap(([level, levelRooms]) =>
      levelRooms.map((room) => ({
        level,
        ...room,
      }))
    );

  const initialVisibleCount = 5;

  function renderRooms(expanded = false) {
    const visibleRooms = expanded
      ? allRoomRows
      : allRoomRows.slice(0, initialVisibleCount);

    const visibleByLevel = new Map();

    for (const room of visibleRooms) {
      if (!visibleByLevel.has(room.level)) {
        visibleByLevel.set(room.level, []);
      }

      visibleByLevel.get(room.level).push(room);
    }

   const rowsHtml = Array.from(visibleByLevel.entries())
      .map(([level, levelRooms]) => `
        <div class="panel__room-level">
          <div class="panel__room-level-title">
            ${level}
          </div>

          <div class="panel__room-grid">
            ${levelRooms.map((room) => {
              const length = formatRoomDimension(room.length);
              const width = formatRoomDimension(room.width);

              const size =
                length && width
                  ? `${length} \u00D7 ${width}`
                  : length || width || "";

              const isPieceCount = /piece/i.test(size);

              return `
                <div class="panel__room-row${isPieceCount ? " is-piece-count" : ""}">
                  <span class="panel__room-name">
                    ${room.label}
                  </span>
                  ${
                    size
                      ? `<span class="panel__room-size">${size}</span>`
                      : ""
                  }
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `)
      .join("");

    sheetRooms.innerHTML = `
      <div class="panel__rooms-title">Rooms</div>

      ${rowsHtml}

      ${
        allRoomRows.length > initialVisibleCount
          ? `
            <button
              type="button"
              class="panel__rooms-toggle"
              id="sheet-rooms-toggle"
            >
              ${
                expanded
                  ? "Show fewer"
                  : `Show all ${allRoomRows.length} rooms`
              }
            </button>
          `
          : ""
      }
    `;

    document
      .getElementById("sheet-rooms-toggle")
      ?.addEventListener("click", () => {
        renderRooms(!expanded);
      });
  }

  renderRooms(false);
  sheetRooms.hidden = false;
}

function syncRealtorCaBadge(card) {
  const listingBrokerage = String(
    card?.dataset?.listingBrokerage || ""
  ).trim();

  if (sheetListingBrokerage) {
    sheetListingBrokerage.textContent =
      listingBrokerage
        ? `Listing courtesy of ${listingBrokerage}`
        : "";

    sheetListingBrokerage.hidden = !listingBrokerage;
  }

  if (!sheetRealtorCaBadge || !sheetRealtorCaLink) return;

  const rawRealtorCaUrl = String(
    card?.dataset?.realtorCaUrl || ""
  ).trim();

  let safeRealtorCaUrl = "";

  try {
    const parsedRealtorCaUrl = new URL(rawRealtorCaUrl);

    if (
      parsedRealtorCaUrl.protocol === "https:" &&
      (
        parsedRealtorCaUrl.hostname === "realtor.ca" ||
        parsedRealtorCaUrl.hostname.endsWith(".realtor.ca")
      )
    ) {
      safeRealtorCaUrl = parsedRealtorCaUrl.href;
    }
  } catch {
    safeRealtorCaUrl = "";
  }

  sheetRealtorCaBadge.hidden = !safeRealtorCaUrl;

  if (safeRealtorCaUrl) {
    sheetRealtorCaLink.href = safeRealtorCaUrl;
  } else {
    sheetRealtorCaLink.removeAttribute("href");
  }
}
function openSheet(card, options = {}) {
  /* exact-photo-url-open-v4 */
  const sharedPhotoNumber = Number.parseInt(
    new URLSearchParams(window.location.search).get("photo") || "",
    10
  );

  if (Number.isFinite(sharedPhotoNumber) && sharedPhotoNumber > 0) {
    // URL uses photo 1, 2, 3; the gallery uses 0, 1, 2.
    card.dataset.openAtPhotoIndex = String(sharedPhotoNumber - 1);
  }
  const wasOpen = sheet.classList.contains("open");
  // Save the actual results position before locking page scrolling.
  if (!wasOpen) {
    window.history.replaceState(
      {
        ...(window.history.state || {}),
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      "",
      window.location.href
    );
  }
  activeCard = card;
  card.dataset.viewed = "true";

 

  // cache image stage height while it's visible
  const stageEl = document.querySelector(".panel__image-stage");
  if (stageEl && !stageEl.classList.contains("is-hidden")) {
    const h = stageEl.offsetHeight || stageEl.getBoundingClientRect().height;
    if (h > 50) cachedImageStageHeight = h;
  }
window.saveViewedIntentAddress?.(card.dataset.address || "");
window.saveViewedIntentListingKey?.(card);
window.updateViewedBadges?.();
  renderCard(card);
syncMobileMediaCounts();

sheetContent?.classList.add("open");
syncListingSectionsToOpenPanel();
sheetSummary?.classList.remove("open");
sheetSummary?.setAttribute("hidden", "");

 sheet.classList.add("open");
sheet.style.pointerEvents = "auto";


if (mobileMediaNav) {
  mobileMediaNav.hidden = false;
}
overlay.classList.add("open");
overlay.style.pointerEvents = "auto";

requestAnimationFrame(() => {
  const panelView = sheet?.querySelector(".panel__view");

  panelView?.scrollTo({
    top: 0,
    left: 0,
    behavior: "instant",
  });

  if (sheetContent) {
    sheetContent.scrollTop = 0;
  }

  sheet.scrollTop = 0;
});
sheet.setAttribute("aria-hidden", "false");
sheet.removeAttribute("inert");
document.body.style.overflow = "hidden";

// Give a card opened from the results its own Back-button step. The popstate
// listener below closes the sheet, leaving the visitor exactly where they were.
if (!options.skipHistory && !wasOpen && !modalHistoryPushed) {
  modalReturnUrl = window.location.href;
  window.history.pushState(
    { ...(window.history.state || {}), modalListingOpen: true },
    "",
    window.location.href
  );
  modalHistoryPushed = true;
}

window.requestAnimationFrame(() => {
  updateLandscapeGalleryMode();
});

fetchListingDetailIfNeeded(card).then((wasUpdated) => {
  if (!wasUpdated || activeCard !== card) return;

  // Refresh the sheet now that the full listing detail is available.
  renderCard(card);

if (sheetDescription) {
  sheetDescription.textContent = card.dataset.description || "";
}

const descriptionToggle = document.getElementById("sheet-desc-toggle");
if (descriptionToggle) {
  descriptionToggle.hidden = !(card.dataset.description || "").trim();
}

syncMobileMediaCounts(); // intentionally disabled

  hydrateRoomMeasurements(card);

  syncRealtorCaBadge(card);
  refreshFloorplanButtonVisibility();
syncMobileMediaCounts();

  const hydratedUrls = getCardPhotoUrls(card);

  if (hydratedUrls.length) {
    const currentSrc =
      sheetImage?.src || "";

    activePhotoUrls = hydratedUrls;

    const currentIndex =
      currentSrc
        ? activePhotoUrls.findIndex(
            (url) =>
              String(currentSrc).includes(String(url)) ||
              String(url).includes(String(currentSrc))
          )
        : -1;

    activePhotoIndex =
      currentIndex >= 0
        ? currentIndex
        : 0;
    /* exact-photo-hydration-v4 */
    const sharedPhotoIndex = Number.parseInt(
      card.dataset.openAtPhotoIndex || "",
      10
    );

    if (Number.isFinite(sharedPhotoIndex)) {
      activePhotoIndex = Math.max(
        0,
        Math.min(sharedPhotoIndex, activePhotoUrls.length - 1)
      );
    }

    updatePhotoCounter();

    if (photoPrevBtn) {
      photoPrevBtn.disabled =
        activePhotoIndex === 0;
    }

    if (photoNextBtn) {
      photoNextBtn.disabled =
        activePhotoIndex >=
        activePhotoUrls.length - 1;
    }
  }

  requestAnimationFrame(() => {
    sheet?.querySelector(".panel__view")?.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  });
});
        }
   window.openSheet = openSheet;
window.openSheet = openSheet;
      

window.openHomepageContact = () => {
  if (!sheet || !overlay || !sheetContent || !sheetSummary) return;

  // This is a general contact request, not a listing-specific question.
  activeCard = null;

  if (mobileMediaNav) {
    mobileMediaNav.hidden = true;
  }

  sheet.classList.add("open");
  overlay.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
  sheet.removeAttribute("inert");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    sheet?.querySelector(".panel__view")?.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });

    sheet.scrollTop = 0;
  });

  showLeadCaptureForm({
    kicker: "Get in touch",
    title: "How can we help?",
    body: "Leave your details and question, and your local agent will follow up directly.",
    button: "Send message",
    note: "Homepage contact request.",
  });
};

/* Open listing modal from ?listing_id=MLS&photo=15 */
async function openListingDeepLink() {
  const query = new URLSearchParams(window.location.search);
  const requestedId = String(query.get("listing_id") || "").trim();
  const requestedPhoto = Number.parseInt(query.get("photo") || "", 10);
  const requestedPhotoIndex =
    Number.isFinite(requestedPhoto) && requestedPhoto > 0
      ? requestedPhoto - 1
      : null;

  if (!requestedId) return;

  /* photo-deep-link-index-persistence-v1 */
  const openDeepLinkedListing = (card) => {
    // Keep this value through async detail hydration. The gallery reads it
    // again after the complete image list arrives.
    if (requestedPhotoIndex !== null) {
      card.dataset.openAtPhotoIndex = String(requestedPhotoIndex);
    }

    openSheet(card, { skipHistory: true });
  };
  const existingCard = getCards().find((candidate) =>
    [
      candidate.dataset.listingId,
      candidate.dataset.mls,
      candidate.dataset.itemId
    ]
      .filter(Boolean)
      .some((value) => String(value).trim() === requestedId)
  );

  if (existingCard) {
    openDeepLinkedListing(existingCard);
    return;
  }

  try {
    const response = await fetch(
      `/api/listing-detail?id=${encodeURIComponent(requestedId)}&mls=${encodeURIComponent(requestedId)}`
    );

    if (!response.ok) return;

    const data = await response.json();
    const listing = data?.listing;

    if (!listing) return;

    const listingId = String(
      listing.id ||
      listing.mls_number ||
      requestedId
    ).trim();

    const mls = String(
      listing.mls_number ||
      listing.id ||
      requestedId
    ).trim();

    const rawImages = Array.isArray(data.images)
      ? data.images
      : [];

    const images = rawImages
      .map((image) => {
        if (typeof image === "string") return image;

        return (
          image?.highRes ||
          image?.mediumRes ||
          image?.lowRes ||
          image?.url ||
          ""
        );
      })
      .filter(Boolean);

    if (!images.length && listing.image_url) {
      images.push(listing.image_url);
    }

    const priceNumber = Number(listing.price || 0);

    const price = priceNumber
      ? priceNumber.toLocaleString("en-CA", {
          style: "currency",
          currency: "CAD",
          maximumFractionDigits: 0,
        })
      : "";

    const address = String(
      listing.address || "Listing"
    ).trim();

    const city = String(
      listing.normalized_city ||
      listing.city ||
      document.body.dataset.city ||
      "nanaimo"
    ).trim();

    const card = document.createElement("article");

    card.className = "card original-card";
    card.dataset.itemId = listingId;
    card.dataset.cardId = listingId;
    card.dataset.listingId = listingId;
    card.dataset.mls = mls;

    card.dataset.price = price;
    card.dataset.rawPrice = String(
      listing.price || 0
    );

    card.dataset.listedAt = String(
      listing.listed_at ||
      listing.created_at ||
      ""
    );

    card.dataset.address = address;

    card.dataset.beds = String(
      listing.beds ?? "-"
    );

    card.dataset.baths = String(
      listing.baths ?? "-"
    );

    card.dataset.sqft = String(
      listing.sqft || ""
    );

    card.dataset.meta =
      `${card.dataset.beds} bed | ${card.dataset.baths} bath`;

    card.dataset.image = images[0] || "";
    card.dataset.images = JSON.stringify(images);

    const hydratedFloorplans = Array.isArray(data.floorplans)
  ? data.floorplans.filter(Boolean)
  : [];

card.dataset.floorplans = JSON.stringify(hydratedFloorplans);

/* floorplan-modal-hydration-fallback-v1 */
if (activeCard === card && sheetFloorplanBtn) {
  const showTopFloorplanButton =
    hydratedFloorplans.length > 0 &&
    !window.matchMedia("(max-width: 600px)").matches;

  sheetFloorplanBtn.hidden = !showTopFloorplanButton;
  sheetFloorplanBtn.style.setProperty(
    "display",
    showTopFloorplanButton ? "inline-flex" : "none",
    "important"
  );

  if (showTopFloorplanButton) {
    sheetFloorplanBtn.textContent =
      hydratedFloorplans.length > 1
        ? `Floorplans (${hydratedFloorplans.length})`
        : "Floorplan";
  }
}

    card.dataset.rooms = JSON.stringify(
      Array.isArray(data.rooms)
        ? data.rooms
        : []
    );

    card.dataset.description = String(
      listing.description || ""
    );

    card.dataset.listingBrokerage = String(
      listing.listing_brokerage || ""
    ).trim();

    card.dataset.realtorCaUrl = String(
      listing.realtor_ca_url || ""
    ).trim();
    card.dataset.videoUrl = String(listing.video_url || '').trim();

    card.dataset.propertyType = String(
      listing.property_type ||
      listing.normalized_type ||
      "Home"
    );

    card.dataset.type = String(
      listing.normalized_type ||
      listing.property_type ||
      "Home"
    );

    card.dataset.year = String(
      listing.year_built || ""
    );

    const lotSqft =
      Number(listing.lot_size_sqft || 0) ||
      Math.round(Number(listing.lot_size_acres || 0) * 43560);

    card.dataset.lotSize = !lotSqft
      ? ""
      : lotSqft > 10890
        ? `${(lotSqft / 43560).toLocaleString("en-CA", {
            maximumFractionDigits: 2,
          })} acres`
        : `${lotSqft.toLocaleString("en-CA")} sq ft`;

    card.dataset.area = String(
      listing.normalized_area ||
      listing.area ||
      ""
    );

    card.dataset.oceanView = String(
      listing.ocean_view || ""
    );

    card.dataset.viewType = String(
      listing.view_type || ""
    );

    card.dataset.waterfront = String(
      listing.waterfront || ""
    );

    card.dataset.waterfrontType = String(
      listing.waterfront_type || ""
    );

    card.dataset.lat = String(
      listing.lat || ""
    );

    card.dataset.lng = String(
      listing.lng || ""
    );

    card.dataset.city = city;
    card.dataset.likedTags = "[]";
    card.dataset.isFavourite = "false";
    card.dataset.decision = "";
    // Summary cards must fetch full detail when opened. In particular,
    // floorplans are not included in this lightweight result payload.

    card.innerHTML = `
      <div class="card-image-wrap">
        <img
          src="${images[0] || ""}"
          alt=""
        />
      </div>

      <div class="card-body">
        <div class="price"></div>
        <div class="address"></div>
        <div class="meta"></div>
        <div
          class="card-decision-badge"
          hidden
        ></div>
      </div>
    `;

    /*
     * Keep the synthetic card in the DOM because some
     * modal features expect activeCard to be attached.
     * It is not visually displayed in the listing grid.
     */
    card.style.position = "absolute";
    card.style.width = "1px";
    card.style.height = "1px";
    card.style.overflow = "hidden";
    card.style.opacity = "0";
    card.style.pointerEvents = "none";

    document.body.appendChild(card);

    openDeepLinkedListing(card);
  } catch (error) {
    console.error(
      "Could not open listing deep link:",
      error
    );
  }
}

window.setTimeout(openListingDeepLink, 300);

function resetExpandedSheetMap() {
  mapIsExpanded = false;

  if (sheetMiniMap && mapBaseHeight) {
    sheetMiniMap.style.height = `${mapBaseHeight}px`;
    sheetMiniMap.style.minHeight = `${mapBaseHeight}px`;
  }

  sheetMiniMapWrap?.style.removeProperty("margin-bottom");

  if (sheetMapExpandBtn) {
    sheetMapExpandBtn.setAttribute("aria-expanded", "false");
    sheetMapExpandBtn.innerHTML = "<span>Expand map</span>";

    sheetMiniMapWrap?.appendChild(sheetMapExpandBtn);

    sheetMapExpandBtn.style.removeProperty("position");
    sheetMapExpandBtn.style.removeProperty("top");
    sheetMapExpandBtn.style.removeProperty("left");
    sheetMapExpandBtn.style.removeProperty("bottom");
    sheetMapExpandBtn.style.removeProperty("z-index");
  }
}
function closeSheet(options = {}) {
  sheet.classList.remove("is-engagement-mode");
  const currentCardKey = getCardKey(activeCard);

  if (
    !options.force &&
    hasDismissedSaveSearchCTA &&
    saveSearchDismissedAtCardKey &&
    currentCardKey &&
    currentCardKey !== saveSearchDismissedAtCardKey
  ) {
    showSaveSearchCTA({
      kicker: "Before you go",
      title: "Want to save this search direction?",
      body: "You can keep browsing later, and we\u2019ll help your agent spot better matches.",
      isExitPrompt: true,
    });

    return;
  }

resetExpandedSheetMap();

sheet.style.transition = "transform 180ms ease";
overlay.style.transition = "opacity 180ms ease";

sheet.classList.remove(
  "open",
  "is-landscape-gallery"
);

overlay.classList.remove(
  "open",
  "is-landscape-gallery"
);
sheet.style.pointerEvents = "none";
overlay.style.pointerEvents = "none";

document.body.classList.remove(
  "is-landscape-gallery-open"
);

sheet.setAttribute("aria-hidden", "true");
sheet.setAttribute("inert", "");
document.body.style.overflow = "";
  
if (mobileMediaNav) {
  mobileMediaNav.hidden = true;
  setMobileMediaMode("photos");
}

/* Keep the listing sheet stable between repeated opens.
   Browser history will be reintroduced after the modal flow is stable. */
modalHistoryPushed = false;
}
const requestedImageUrls = new Set();
const loadedImageUrls = new Set();

function preloadImages(urls = []) {
  // mobile-next-photo-preload-v1
  const isMobilePhotoView =
    window.matchMedia("(max-width: 1024px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;

  if (isMobilePhotoView) {
    const nextPhotos = activePhotoUrls.slice(
      activePhotoIndex + 1,
      activePhotoIndex + 4
    );
    urls = nextPhotos;
  }
  urls
    .filter(Boolean)
    .forEach((src) => {
      if (requestedImageUrls.has(src)) return;

      requestedImageUrls.add(src);

      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";

      img.onload = async () => {
        try {
          await img.decode();
        } catch {
          // The browser may already have decoded the image.
        }

        loadedImageUrls.add(src);
      };

      img.onerror = () => {
        requestedImageUrls.delete(src);
        loadedImageUrls.delete(src);
      };

      img.src = src;
    });
}

function preloadPhotoWindow(
  currentIndex = activePhotoIndex,
  behind = 2,
  ahead = 12
) {
  if (!activePhotoUrls.length) return;

  const safeIndex = Math.max(
    0,
    Math.min(currentIndex, activePhotoUrls.length - 1)
  );

  const start = Math.max(0, safeIndex - behind);
  const end = Math.min(
    activePhotoUrls.length,
    safeIndex + ahead + 1
  );

  preloadImages(activePhotoUrls.slice(start, end));
}
function getCardPhotoUrls(card) {
  if (!card) return [];

  const normalizePhotoUrl = (url) => {
    const value = String(url || "").trim();

    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.startsWith("/")) return `https://cdn.repliers.io${value}`;

    return `https://cdn.repliers.io/${value}`;
  };

  let rawImages = [];

  try {
    rawImages = JSON.parse(card.dataset.images || "[]");
  } catch {
    rawImages = [];
  }

const addSize = (url) => {
  if (!url) return url;
  if (url.includes("placehold.co")) return url;
  if (url.includes("class=")) {
  return url.replace(
    /([?&]class=)[^&]*/i,
    "$1large"
  );
}
return url.includes("?")
  ? `${url}&class=large`
  : `${url}?class=large`;
};

  const urls = rawImages
    .map((img) => {
      if (typeof img === "string") return normalizePhotoUrl(addSize(img));

      return normalizePhotoUrl(addSize(
        img.highRes ||
        img.mediumRes ||
        img.lowRes ||
        img.url ||
        ""
      ));
    })
    .filter(Boolean);

  return urls.length
    ? urls
    : [card.dataset.image || "https://placehold.co/800x600?text=Photos+coming+soon"];
}

function preloadNearbyListingPhotos(currentCard) {
  // mobile-photo-memory-guard
  if (
    window.matchMedia("(max-width: 1024px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  ) return;
  const cards = getCards();
  const index = cards.indexOf(currentCard);

  const nextCards = cards.slice(index + 1, index + 4);
  const prevCard = cards[index - 1];

  const urls = [
    ...nextCards.flatMap((card) => getCardPhotoUrls(card).slice(0, 3)),
    ...getCardPhotoUrls(prevCard).slice(0, 2),
  ];

  preloadImages(urls);
}
function renderCard(card) {
  sheetDescription = document.getElementById("sheet-description");
  isFloorplanMode = false;
  // floorplan-state-reset
  sheetImage?.classList.remove("is-floorplan");
  sheetImageStage?.classList.remove("is-floorplan");
  if (sheetFloorplanDownloadBtn) {
    sheetFloorplanDownloadBtn.hidden = true;
    sheetFloorplanDownloadBtn.style.display = "none";
    sheetFloorplanDownloadBtn.dataset.url = "";
  }
  sheet.classList.remove("is-engagement-mode");
  if (chipAdvanceTimer) { clearTimeout(chipAdvanceTimer); chipAdvanceTimer = null; }
resetChipProgressBar();
  // Always hide the previous listing image while the new one is prepared.
  if (sheetImageStage) {
    sheetImageStage.style.visibility = "hidden";
  }

  if (sheetImage) {
    sheetImage.style.transition = "none";
    sheetImage.style.opacity = "0";
  }
          const cards = getCards();
          const index = cards.indexOf(card);
          const total = cards.length;

          const normalizePhotoUrl = (url) => {
            const value = String(url || "").trim();

            if (!value) return "";
            if (value.startsWith("http://") || value.startsWith("https://")) return value;
            if (value.startsWith("/")) return `https://cdn.repliers.io${value}`;

            return `https://cdn.repliers.io/${value}`;
          };

          let rawImages = [];

          try {
            rawImages = JSON.parse(card.dataset.images || "[]");
          } catch {
            rawImages = [];
          }

const addSize = (url) => {
  if (!url) return url;
  if (url.includes("placehold.co")) return url;
  if (url.includes("class=")) {
  return url.replace(
    /([?&]class=)[^&]*/i,
    "$1large"
  );
}
return url.includes("?")
  ? `${url}&class=large`
  : `${url}?class=large`;
};

          activePhotoUrls = rawImages
            .map((img) => {
              if (typeof img === "string") return normalizePhotoUrl(addSize(img));

              return normalizePhotoUrl(addSize(
                img.highRes ||
        img.mediumRes ||
                img.lowRes ||
                img.url ||
                ""
              ));
            })
            .filter(Boolean);

          if (!activePhotoUrls.length) {
            activePhotoUrls = [card.dataset.image || "https://placehold.co/800x600?text=Photos+coming+soon"];
          }

firstPhotoStageHeight = 0;

const requestedPhotoIndex = Number.parseInt(
  card.dataset.openAtPhotoIndex || "",
  10
);
activePhotoIndex = Number.isFinite(requestedPhotoIndex)
  ? Math.min(
      Math.max(requestedPhotoIndex, 0),
      Math.max(activePhotoUrls.length - 1, 0)
    )
  : 0;
lastRegularPhotoIndex = activePhotoIndex;
          console.log("openAtPhotoIndex", card.dataset.openAtPhotoIndex, "->", activePhotoIndex);

         function renderActivePhoto() {
            if (!sheetImage || !activePhotoUrls.length) return;

            const targetSrc = activePhotoUrls[activePhotoIndex];
            sheetImage.alt = card.dataset.address || "";

           updatePhotoCounter();

            if (photoPrevBtn) photoPrevBtn.disabled = activePhotoIndex === 0;
            if (photoNextBtn) photoNextBtn.disabled = activePhotoIndex >= activePhotoUrls.length - 1;

            sheetImage.style.transition = "none";
            sheetImage.style.opacity = "0";

            const loader = new Image();
        loader.onload = () => {
  sheetImage.src = targetSrc;
  sheetImage.style.opacity = "1";

  if (sheetImageStage) {
    sheetImageStage.style.visibility = "visible";

    // Capture the FIRST picture's displayed stage height.
    // The map will always open at this exact height.
    if (activePhotoIndex === 0 && firstPhotoStageHeight <= 50) {
      requestAnimationFrame(() => {
        const h =
          sheetImageStage.offsetHeight ||
          sheetImageStage.getBoundingClientRect().height;

        if (h > 50) {
          firstPhotoStageHeight = h;
          cachedImageStageHeight = h;
        }
      });
    }
  }
};
            loader.onerror = () => {
              sheetImage.src = targetSrc;
              sheetImage.style.opacity = "1";
              if (sheetImageStage) sheetImageStage.style.visibility = "visible";
            };
            loader.src = targetSrc;
          }

        renderActivePhoto();
preloadPhotoWindow();

preloadNearbyListingPhotos(card);

     card.dataset.viewed = "true";
window.saveViewedIntentAddress?.(card.dataset.address || "");
window.saveViewedIntentListingKey?.(card);
window.updateViewedBadges?.();

if (sheetPrice) sheetPrice.textContent = card.dataset.price || "-";
if (sheetAddress) sheetAddress.textContent = card.dataset.address || "Address";

    if (sheetMeta) {
  sheetMeta.innerHTML = [
    `${card.dataset.beds || "-"} bd`,
    `${card.dataset.baths || "-"} ba`,
    card.dataset.sqft
      ? `${Number(card.dataset.sqft).toLocaleString()} sq ft`
      : "",
    card.dataset.lotSize
      ? `Lot ${card.dataset.lotSize}`
      : "",
  ]
    .filter(Boolean)
    .join(" &bull; ");
}

   if (sheetDescription) {
  sheetDescription.textContent = card.dataset.description || "";

  const isMobile =
    window.matchMedia("(max-width: 768px)").matches;

  sheetDescription.classList.toggle(
    "is-collapsed",
    isMobile
  );
}

const videoContainer = document.getElementById("sheet-video");
if (videoContainer) {
  videoContainer.replaceChildren();
  videoContainer.hidden = true;

  try {
    const sourceUrl = new URL(card.dataset.videoUrl || "");

    if (sourceUrl.protocol === "https:") {
      const host = sourceUrl.hostname.toLowerCase();
      let embedUrl = null;
      let title = "Virtual tour";

      if (host === "youtu.be" ||
          ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
        const youtubeId = host === "youtu.be"
          ? sourceUrl.pathname.split("/")[1]
          : sourceUrl.pathname.startsWith("/shorts/")
            ? sourceUrl.pathname.split("/")[2]
            : sourceUrl.pathname.startsWith("/embed/")
              ? sourceUrl.pathname.split("/")[2]
              : sourceUrl.searchParams.get("v");

        if (youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
          embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}`;
          title = "Property video";
        }
      } else if (
        host === "my.matterport.com" &&
        sourceUrl.pathname === "/show/"
      ) {
        const modelId = sourceUrl.searchParams.get("m");
        if (modelId && /^[A-Za-z0-9_-]+$/.test(modelId)) {
          embedUrl = `https://my.matterport.com/show/?m=${modelId}`;
        }
      } else if (
        ["youriguide.com", "www.youriguide.com",
         "unbranded.youriguide.com"].includes(host)
      ) {
        embedUrl = sourceUrl.href;
      } else if (
        host === "realsee.ai" &&
        /^\/[A-Za-z0-9_-]+\/?$/.test(sourceUrl.pathname)
      ) {
        embedUrl = sourceUrl.origin + sourceUrl.pathname;
      } else if (host === "drive.google.com") {
        const driveMatch = sourceUrl.pathname.match(
          /^\/file\/d\/([A-Za-z0-9_-]+)\/(?:view|preview)\/?$/
        );
        if (driveMatch) {
          embedUrl =
            `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
          title = "Property video";
        }
      }

      const heading = document.createElement("h3");
      heading.textContent = title;
      videoContainer.appendChild(heading);

      if (embedUrl) {
        const frame = document.createElement("iframe");
        frame.src = embedUrl;
        frame.title = title;
        frame.loading = "lazy";
        frame.allow =
          "autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share";
        frame.allowFullscreen = true;
        frame.style.cssText =
          "display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px;";
        videoContainer.appendChild(frame);
      }

      const link = document.createElement("a");
      link.href = sourceUrl.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = embedUrl
        ? "Open full screen ↗"
        : "Open virtual tour ↗";
      videoContainer.appendChild(link);
      videoContainer.hidden = false;
    }
  } catch {
    // No valid media URL for this listing.
  }
}
syncRealtorCaBadge(card);

const chips = getHighlightChips(card.dataset.description || "");
let chipsEl = document.getElementById("sheet-highlight-chips");
if (!chipsEl) {
  chipsEl = document.createElement("div");
  chipsEl.id = "sheet-highlight-chips";
  chipsEl.className = "panel__highlight-chips";
  document.querySelector("#preview-sheet .panel__desc-wrap")?.before(chipsEl);
}
chipsEl.innerHTML = chips.map(label =>
  `<span class="panel__highlight-chip">${label}</span>`
).join("");
chipsEl.hidden = chips.length === 0; window.__lsStyleChip?.(chipsEl, card.dataset.listingId || card.dataset.id || card.dataset.mls || "");

const descToggle = document.getElementById("sheet-desc-toggle");

if (descToggle && sheetDescription) {
  const isMobile =
    window.matchMedia("(max-width: 768px)").matches;

  descToggle.hidden = false;
  descToggle.textContent =
    isMobile ? "Read more" : "Show less";

  descToggle.onclick = () => {
    const collapsed =
      sheetDescription.classList.toggle("is-collapsed");

    descToggle.textContent =
      collapsed ? "Read more" : "Show less";
  };
}

hydrateRoomMeasurements(card);

          if (sheetPosition) {
            sheetPosition.textContent = `${index + 1} of ${total}`;
          }

          if (sheetProgressBar) {
            sheetProgressBar.style.width = `${((index + 1) / Math.max(total, 1)) * 100}%`;
          }

          if (prevBtn) prevBtn.disabled = index <= 0;
          if (prevTopBtn) prevTopBtn.disabled = index <= 0;

         if (nextBtn) {
  nextBtn.innerHTML =
    index >= total - 1
      ? "Close"
      : 'Next listing <span aria-hidden="true">&rarr;</span>';
}

if (nextTopBtn) {
  nextTopBtn.innerHTML =
    index >= total - 1
      ? "Close"
      : 'Next <span aria-hidden="true">&rarr;</span>';
}
updateDecisionButtons(card);
renderLikeTags(card);

sheet.classList.remove("has-decision");

if (sheetEngage) {
  sheetEngage.hidden = false;
}
if (card.classList.contains("refined-card")) {
  refinedBrowseCount += 1;
}

if (sheetMiniMap) {
  sheetMiniMap.hidden = true;
  sheetMiniMap.style.display = "none";
}

if (sheetMiniMapWrap) {
  sheetMiniMapWrap.hidden = true;
  sheetMiniMapWrap.style.display = "none";
}

mapIsExpanded = false;

if (sheetMapExpandBtn) {
  sheetMapExpandBtn.setAttribute("aria-expanded", "false");
  sheetMapExpandBtn.innerHTML =
    '<span>Expand map</span>';
}

if (sheetImageStage) {
  sheetImageStage.classList.remove("is-hidden");
    sheetImageStage.hidden = false;
    sheetImageStage.style.removeProperty("display");
  const h = sheetImageStage.offsetHeight || sheetImageStage.getBoundingClientRect().height;
  if (h > 50) cachedImageStageHeight = h;
} else {
  const anyStage = document.querySelector(".panel__image-stage");
  if (anyStage) {
    const h = anyStage.offsetHeight || anyStage.getBoundingClientRect().height;
    if (h > 50) cachedImageStageHeight = h;
  }
}

if (sheetMapBtn) {
  sheetMapBtn.textContent = "Map";
}
let floorplanUrls = [];

try {
  floorplanUrls = JSON.parse(
    card.dataset.floorplans || "[]"
  );
} catch {
  floorplanUrls = [];
}

if (sheetFloorplanBtn) {
  const hasFloorplan =
    Array.isArray(floorplanUrls) &&
    floorplanUrls.length > 0;

  const showTopFloorplanButton =
    hasFloorplan &&
    !window.matchMedia("(max-width: 600px)").matches;

  sheetFloorplanBtn.hidden =
    !showTopFloorplanButton;

if (hasFloorplan) {
  const floorplanCount = floorplanUrls.length;

  sheetFloorplanBtn.textContent =
    floorplanCount > 1
          ? `Floorplans (${floorplanCount})`
          : "Floorplan";

  sheetFloorplanBtn.style.setProperty(
    "display",
    "inline-flex",
    "important"
  );
} else {
    sheetFloorplanBtn.style.setProperty(
      "display",
      "none",
      "important"
    );
  }
}

sheetContent.scrollTop = 0;
setTimeout(updateSheetScrollHint, 80);

// OSM amenities
const osmEl = document.querySelector("#preview-sheet #sheet-osm-amenities");
if (osmEl) {
  const lat = parseFloat(card.dataset.lat || "");
  const lng = parseFloat(card.dataset.lng || "");
const cardCity =
  card.dataset.city ||
  document.querySelector("[data-city]")?.dataset.city ||
  "nanaimo";

console.log("OSM DEBUG", {
  cardCity,
  lat,
  lng,
  address: card.dataset.address,
});

if (isFinite(lat) && isFinite(lng)) {
  osmEl.hidden = false;
  osmEl.innerHTML = `<div class="panel__osm-loading">Loading nearby amenities...</div>`;

  fetch(
    `/api/osm-amenities?city=${encodeURIComponent(cardCity)}&lat=${lat}&lng=${lng}&radius=8`
  )
      .then(r => r.json())
      .then(data => {
        const cats = data.categories || {};

        console.log("OSM RESULT DEBUG", {
          address: card.dataset.address,
          lat,
          lng,
          playground: cats.playground?.[0],
          park: cats.park?.[0],
        });
    const amenityIcon = (type) => {
      const paths = {
        school: '<path d="M3 10l9-5 9 5-9 5-9-5Zm4 3v4c3 2 7 2 10 0v-4M21 10v6"/>',
        grocery: '<path d="M3 4h2l2.2 10h9.8l2-7H6M9 19h.01M17 19h.01"/>',
        transit: '<rect x="5" y="3" width="14" height="15" rx="2"/><path d="M8 21l2-3m6 0 2 3M8 7h8M7 12h10"/>',
        park: '<path d="M12 22V8M7 12l5-8 5 8h-3l4 6H6l4-6H7Z"/>',
        restaurant: '<path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3v18M16 3c4 3 4 8 0 10"/>',
        medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
        childcare: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M9 12l3 3 3-3"/>',
        playground: '<path d="M5 21V8h10M8 8V4h7v4M15 8l5 13M4 15h12"/>',
        recreation: '<circle cx="12" cy="12" r="9"/><path d="M6 7c4 2 8 2 12 0M6 17c4-2 8-2 12 0M12 3c-2 5-2 13 0 18"/>',
        trail: '<path d="M4 20c3-6 5-2 8-8s5-2 8-8M6 6h.01M18 18h.01"/>',
        beach: '<path d="M3 17c3-2 6 2 9 0s6 2 9 0M3 21c3-2 6 2 9 0s6 2 9 0M12 3v10M7 8c2-4 8-4 10 0"/>',
        golf: '<path d="M6 22V3l11 4-11 4M3 22h8"/>',
        marina: '<path d="M12 3v18M5 8h14M5 14c1 5 13 5 14 0M8 21h8"/>',
        ev_charging: '<path d="M7 2h8v10H7zM9 5h4M11 12v9M15 6h2l2 2v7c0 2 2 2 2 0V9"/>'
      };

      return `<svg
        class="amenity-icon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >${paths[type] || paths.park}</svg>`;
    };

    const catMeta = {
      school:      { icon: amenityIcon("school"), label: "Schools" },
      grocery:     { icon: amenityIcon("grocery"), label: "Grocery" },
      transit:     { icon: amenityIcon("transit"), label: "Transit" },
      park:        { icon: amenityIcon("park"), label: "Parks" },
      restaurant:  { icon: amenityIcon("restaurant"), label: "Restaurants" },
      medical:     { icon: amenityIcon("medical"), label: "Medical" },
      childcare:   { icon: amenityIcon("childcare"), label: "Childcare" },
      playground:  { icon: amenityIcon("playground"), label: "Playgrounds" },
      recreation:  { icon: amenityIcon("recreation"), label: "Recreation" },
      trail:       { icon: amenityIcon("trail"), label: "Trails" },
      beach:       { icon: amenityIcon("beach"), label: "Beaches" },
      golf:        { icon: amenityIcon("golf"), label: "Golf" },
      marina:      { icon: amenityIcon("marina"), label: "Marinas" },
      ev_charging: { icon: amenityIcon("ev_charging"), label: "EV Charging" },
    };
     const cards = Object.entries(catMeta).map(([cat, meta]) => {
          const items = cats[cat] || [];
          if (!items.length) return "";
          const rows = items.slice(0, 3).map(item => {
            const dist = item.distKm < 1
              ? Math.round(item.distKm * 1000) + "m"
              : item.distKm.toFixed(1) + "km";
            const name = item.name || item.osm_type || "";
            return `<div class="panel__osm-row"><span class="panel__osm-name">${name}</span><span class="panel__osm-dist">${dist}</span></div>`;
          }).join("");
          const closestDist = items[0].distKm < 1
            ? Math.round(items[0].distKm * 1000) + "m"
            : items[0].distKm.toFixed(1) + "km";
          return `<div class="panel__osm-card">
            <div class="panel__osm-card-head">
              <span class="panel__osm-icon">${meta.icon}</span>
              <span class="panel__osm-cat">${meta.label}</span>
              <span class="panel__osm-closest">${closestDist}</span>
            </div>
            <div class="panel__osm-rows">${rows}</div>
          </div>`;
        }).filter(Boolean).join("");
        if (cards) {
          osmEl.innerHTML = `<div class="panel__osm-label">Nearby Amenities</div><div class="panel__osm-grid" id="osm-card-grid">${cards}</div>`;
          // attach click handlers after render
          osmEl.querySelectorAll(".panel__osm-card").forEach((cardEl, i) => {
            cardEl.style.cursor = "pointer";
const activeCats = Object.entries(catMeta).filter(([k]) => (cats[k]||[]).length).map(([k]) => k);
            const cat = activeCats[i];
            if (!cat) return;
            cardEl.addEventListener("click", () => {
              // activate map
              const mapBtn = document.getElementById("sheet-map-btn");
              const miniMap = document.getElementById("sheet-mini-map");
              const imageStage = document.querySelector(".panel__image-stage");
              if (!miniMap) return;

             // show map
              
// OSM cards must leave floorplan mode before opening the map.
if (isFloorplanMode) {
  returnToRegularPhotos();
}
// show map at exactly the same height as the listing images
const imgStageHeight = imageStage
  ? (imageStage.offsetHeight || imageStage.getBoundingClientRect().height)
  : 0;

const mapH =
  firstPhotoStageHeight > 50
    ? firstPhotoStageHeight
    : cachedImageStageHeight > 50
      ? cachedImageStageHeight
      : (imgStageHeight > 50 ? imgStageHeight : 480);

mapBaseHeight = mapH;
mapIsExpanded = false;

console.log(
  "mapH",
  mapH,
  "cached",
  cachedImageStageHeight,
  "live",
  imgStageHeight
);

if (imageStage) {
  imageStage.classList.add("is-hidden");
}

if (sheetMiniMapWrap) {
  sheetMiniMapWrap.hidden = false;
  sheetMiniMapWrap.style.display = "block";
}

miniMap.hidden = false;
miniMap.style.display = "block";
miniMap.style.height = mapBaseHeight + "px";
miniMap.style.minHeight = mapBaseHeight + "px";
miniMap.style.width = "100%";

if (sheetMapExpandBtn) {
  sheetMapExpandBtn.hidden = false;
  sheetMapExpandBtn.setAttribute("aria-expanded", "false");
  sheetMapExpandBtn.innerHTML =
    '<span>Expand map</span>';
}

if (mapBtn) {
  mapBtn.textContent = "Photos";
  setFloorplanButtonDefault();
}

              // highlight active card
         osmEl.querySelectorAll(".panel__osm-card").forEach(c => c.classList.remove("osm-card-active"));
              cardEl.classList.add("osm-card-active");
const content = document.getElementById("sheet-content");
const panelView = document.querySelector("#preview-sheet .panel__view");
const panel = document.getElementById("preview-sheet");

content?.scrollTo({ top: 0, behavior: "smooth" });
panelView?.scrollTo({ top: 0, behavior: "smooth" });
panel?.scrollTo({ top: 0, behavior: "smooth" });

loadLeaflet().then(() => {
  const point = getCardLatLng(activeCard);
miniMap.innerHTML = "";
miniMap.style.height = mapBaseHeight + "px";
miniMap.style.minHeight = mapBaseHeight + "px";
miniMap.style.display = "block";
miniMap.hidden = false;

if (sheetMiniMapWrap) {
  sheetMiniMapWrap.hidden = false;
  sheetMiniMapWrap.style.display = "block";
}

  if (sheetMiniMapInstance) {
    sheetMiniMapInstance.remove();
    sheetMiniMapInstance = null;
  }

  const center = point ? [point.lat, point.lng] : [49.1659, -123.9401];
  sheetMiniMapInstance = L.map(miniMap, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
  L.tileLayer(window.__JAWG_TILE_URL__, { maxZoom: 19, attribution: window.__JAWG_ATTRIBUTION__ }).addTo(sheetMiniMapInstance);

  if (!window._osmPoiMarkers) window._osmPoiMarkers = [];
  window._osmPoiMarkers.forEach(m => m.remove());
  window._osmPoiMarkers = [];

  const listingPoint = getCardLatLng(activeCard);
  const bounds = [];

  if (listingPoint) {
    const lp = [listingPoint.lat, listingPoint.lng];
    bounds.push(lp);
    L.circleMarker(lp, {
      radius: 9, color: "#fff", weight: 2,
      fillColor: "#ff3b30", fillOpacity: 1,
    }).addTo(sheetMiniMapInstance)
      .bindPopup(activeCard?.dataset?.address || "Listing", { closeButton: false });
  }

  const items = cats[cat] || [];
  items.forEach((item) => {
    if (!item.lat || !item.lng) return;
    const label = item.name || item.osm_type || "";
    const lp = [item.lat, item.lng];
    bounds.push(lp);
    const marker = L.circleMarker(lp, {
      radius: 7, color: "#fff", weight: 2,
      fillColor: "#2f6f73", fillOpacity: 0.95,
    }).addTo(sheetMiniMapInstance);
    addSmallInfoWindow(marker, label);
    window._osmPoiMarkers.push(marker);
  });

  setTimeout(() => {
    sheetMiniMapInstance.invalidateSize();

    // Keep Calgary focused on the listing instead of
    // zooming out to include every amenity in the 8 km result set.
    if (cardCity === "calgary" && listingPoint) {
      sheetMiniMapInstance.setView(
        [listingPoint.lat, listingPoint.lng],
        15
      );
    } else if (bounds.length > 1) {
      sheetMiniMapInstance.fitBounds(
        bounds,
        { padding: [30, 30] }
      );
    } else if (bounds.length === 1) {
      sheetMiniMapInstance.setView(
        bounds[0],
        15
      );
    }
  }, 150);
}).catch(console.error);
            });
          });
        } else {
          osmEl.hidden = true;
        }
      })
       .catch(() => { osmEl.hidden = true; });
} else {
  osmEl.hidden = true;
}
}

requestAnimationFrame(() => {
  updateLandscapeGalleryMode();

  requestAnimationFrame(() => {
    updateLandscapeGalleryMode();
  });
});
}
function updateCardDecisionBadge(card) {
  if (!card) return;

  let badge = card.querySelector(".card-decision-badge");

  if (!badge) {
    const cardBody = card.querySelector(".card-body");
    if (!cardBody) return;

    badge = document.createElement("div");
    badge.className = "card-decision-badge";
    badge.hidden = true;
    cardBody.appendChild(badge);
  }

  const decision = card.dataset.decision || "";

badge.classList.remove("is-love", "is-maybe", "is-pass");
  if (decision === "love") {
  badge.hidden = false;
  badge.textContent = "Loved";
  badge.classList.add("is-love");
} else if (decision === "maybe") {
  badge.hidden = false;
  badge.textContent = "Kinda liked";
  badge.classList.add("is-maybe");
} else if (decision === "pass") {
  badge.hidden = false;
  badge.textContent = "Not for me";
  badge.classList.add("is-pass");
} else {
  badge.hidden = true;
  badge.textContent = "";
}

  card.classList.toggle("is-passed", decision === "pass");
}
        function updateDecisionButtons(card) {
  const reactionRow =
    loveBtn?.closest(".decision-actions");

  if (reactionRow) {
    reactionRow.style.setProperty(
      "width",
      "calc(100% - 32px)",
      "important"
    );

    reactionRow.style.setProperty(
      "max-width",
      "340px",
      "important"
    );

    reactionRow.style.setProperty(
      "margin",
      "42px auto 6px",
      "important"
    );

    reactionRow.style.removeProperty("display");
  }

  [loveBtn, maybeBtn, passBtn].forEach((btn) => {
    if (!btn) return;

    btn.hidden = false;
    btn.removeAttribute("hidden");
    btn.classList.remove("is-selected");

    btn.style.setProperty(
      "display",
      "inline-flex",
      "important"
    );

    btn.style.setProperty(
      "visibility",
      "visible",
      "important"
    );

    btn.style.setProperty(
      "opacity",
      "1",
      "important"
    );
  });

  if (card?.dataset.decision === "love") {
    loveBtn?.classList.add("is-selected");
  }

  if (card?.dataset.decision === "maybe") {
    maybeBtn?.classList.add("is-selected");
  }

  if (card?.dataset.decision === "pass") {
    passBtn?.classList.add("is-selected");
  }
}
function getActiveLikedTags() {
  return Array.from(likeTagsEl?.querySelectorAll(".intent-like-tag.active") || [])
    .map((btn) => btn.dataset.likeTag)
    .filter(Boolean);
}

function getContextualLikeTags(card) {
  const text = [
    card?.dataset?.type,
    card?.dataset?.propertyType,
    card?.dataset?.description,
    card?.dataset?.address,
    card?.dataset?.area,
  ].join(" ").toLowerCase();

  if (
    text.includes("waterfront") ||
    text.includes("oceanfront") ||
    text.includes("beachfront") ||
    text.includes("water view") ||
    text.includes("ocean view")
  ) {
  return [
  ["waterfront", "Waterfront"],
  ["location", "Location"],
  ["views", "Views"],
];
  }

  if (
    text.includes("condo") ||
    text.includes("apartment") ||
    text.includes("strata")
  ) {
    return [
      ["walkability", "Walkability"],
      ["location", "Location"],
      ["updated", "Updated interior"],
    ];
  }

  if (
    text.includes("family") ||
    text.includes("yard") ||
    text.includes("garage") ||
    text.includes("bedroom")
  ) {
 return [
  ["location", "Location"],
  ["value", "Value"],
  ["layout", "Layout"],
];
  }

  return [
    ["location", "Location"],
["views", "Views"],
["layout", "Layout"],
  ];
}

function renderLikeTags() {
  if (!likeTagsEl) return;

  likeTagsEl.hidden = true;
  likeTagsEl.innerHTML = "";
  likeTagsEl.className = "intent-like-tags";
}
function getSharedIntentSessionId() {
  if (typeof window.getSharedIntentSessionId === "function") {
    return window.getSharedIntentSessionId();
  }

  const key = "intent_session_id";
  let value = window.localStorage.getItem(key);

  if (!value) {
    value =
      window.crypto?.randomUUID?.() ||
      `intent_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(key, value);
  }

  return value;
}
function saveCurrentReaction() {
  if (!activeCard) return;

  const likedTags = getActiveLikedTags();
  activeCard.dataset.likedTags = JSON.stringify(likedTags);

  fetch("/api/intent-listing-reaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: getSharedIntentSessionId(),
      site_id:
        document.body.dataset.siteId || null,

      intent_page_id: (() => {
        const id = document.body.dataset.intentPageId || "";
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        return isUuid ? id : null;
      })(),
     city:
  document.querySelector("[data-city]")?.dataset.city ||
  document.body.dataset.city ||
  "",

slug:
  document.querySelector("[data-slug]")?.dataset.slug ||
  document.body.dataset.slug ||
  "",

      listing_id:
        activeCard.dataset.listingId ||
        activeCard.dataset.itemId ||
        "",

      mls_number:
        activeCard.dataset.mls || "",

      address:
        activeCard.dataset.address || "",

      price:
        activeCard.dataset.price || "",

      beds:
        activeCard.dataset.beds || "",

      baths:
        activeCard.dataset.baths || "",

      sqft:
        activeCard.dataset.sqft || "",

     area:
        activeCard.dataset.area || "",

      normalized_type:
        activeCard.dataset.type || "",

      decision: activeCard.dataset.decision || "",
      liked_tags: likedTags,
    }),
  })
    .then(async (res) => {
      const json = await res.json();
    console.log("REACTION SAVED", json);
if (typeof refreshBehaviourChips === "function") {
  refreshBehaviourChips();
}
    })
    .catch((error) => {
      console.error("Failed to save intent listing reaction:", error);
    });
}

function showRefiningState(chips = []) {
  if (!sheetSummary) return;

  const chipHtml = chips.length
    ? chips
        .map((label) => `<span class="modal-intent-chip">${label}</span>`)
        .join("")
    : `
      <span class="modal-intent-chip">Better matches</span>
      <span class="modal-intent-chip">More homes like these</span>
    `;

  sheetSummary.innerHTML = `
    <div class="modal-intent-summary modal-intent-summary--refining">
      <div class="modal-intent-kicker">Refining your matches</div>

      <div class="intent-refining-orb" aria-hidden="true">
        <span></span>
      </div>

      <h2>Finding stronger matches...</h2>

      <p>
        We're adjusting the next batch around the homes, features,
        and areas you responded to most positively.
      </p>

      <div class="modal-intent-chip-row">
        ${chipHtml}
      </div>

      <div class="intent-refining-bar">
        <span></span>
      </div>
    </div>
  `;
}
function getIntentContext() {
  const el =
    document.querySelector("[data-intent-page-id]") ||
    document.body;

  return {
    session_id: getSharedIntentSessionId(),
    intent_page_id: (() => {
      const id = el.dataset.intentPageId || document.body.dataset.intentPageId || "";
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : null;
    })(),
    city: el.dataset.city || document.body.dataset.city || "",
    slug: el.dataset.slug || document.body.dataset.slug || "",
  };
}

function getActiveListingLeadData() {
  const ctx = getIntentContext();

  return {
    ...ctx,
    listing_id:
      activeCard?.dataset?.listingId ||
      activeCard?.dataset?.itemId ||
      "",

    mls_number: activeCard?.dataset?.mls || "",
    address: activeCard?.dataset?.address || "",
    price: activeCard?.dataset?.price || "",
    beds: activeCard?.dataset?.beds || "",
    baths: activeCard?.dataset?.baths || "",
    sqft: activeCard?.dataset?.sqft || "",
    area: activeCard?.dataset?.area || "",
    listing_url:
      activeCard?.dataset?.mls
        ? `${window.location.origin}${window.location.pathname}?mls=${encodeURIComponent(activeCard.dataset.mls)}`
        : window.location.href,
  };
}
function showLeadCaptureForm(options = {}) {
  if (!sheetContent || !sheetSummary) return;

sheetContent.classList.remove("open");
  sheetSummary.removeAttribute("hidden");
  sheetSummary.classList.add("open");
  sheet.querySelector(".panel__view")?.scrollTo({ top: 0, behavior: "instant" });
  sheet.scrollTo({ top: 0, behavior: "instant" });

  sheetSummary.innerHTML = `
    <div style="min-height:100%;padding:48px 36px 40px;background:#fff;display:flex;flex-direction:column;justify-content:center;">
      <div style="max-width:480px;margin:0 auto;width:100%;display:grid;gap:28px;">

        <div>
          <div style="display:inline-block;margin-bottom:14px;padding:5px 12px;border-radius:999px;background:#f3eadc;border:1px solid #e2cba8;font-size:0.7rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#8b6f47;">
            ${options.kicker || "Get in touch"}
          </div>
          <h2 style="margin:0 0 10px;font-size:1.9rem;line-height:1.05;letter-spacing:-0.04em;font-weight:700;color:#181614;">
            ${options.title || "Want new matches like these?"}
          </h2>
          <p style="margin:0;color:#6b6560;font-size:0.95rem;line-height:1.6;">
            ${options.body || "Leave your details and we'll follow up about this property."}
          </p>
        </div>

        <div style="display:grid;gap:12px;">
          <input id="lead-name-input" placeholder="Your name" style="width:100%;height:52px;padding:0 20px;border-radius:12px;border:1px solid #e3d8ca;font:inherit;font-size:0.95rem;outline:none;background:#faf7f2;box-sizing:border-box;" />
          <input id="lead-email-input" placeholder="Email address" style="width:100%;height:52px;padding:0 20px;border-radius:12px;border:1px solid #e3d8ca;font:inherit;font-size:0.95rem;outline:none;background:#faf7f2;box-sizing:border-box;" />
      <input id="lead-phone-input" placeholder="Phone (optional)" style="width:100%;height:52px;padding:0 20px;border-radius:12px;border:1px solid #e3d8ca;font:inherit;font-size:0.95rem;outline:none;background:#faf7f2;box-sizing:border-box;" />
        </div>

        ${options.kicker === "Ask a question" ? `
        <div style="display:grid;gap:8px;">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button type="button" class="lead-suggest-btn" data-q="Is this still available?" style="appearance:none;border:1px solid #e3d8ca;border-radius:999px;background:#faf7f2;color:#6b6560;padding:7px 14px;font:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;">Is this still available?</button>
            <button type="button" class="lead-suggest-btn" data-q="Can I book a showing?" style="appearance:none;border:1px solid #e3d8ca;border-radius:999px;background:#faf7f2;color:#6b6560;padding:7px 14px;font:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;">Can I book a showing?</button>
            <button type="button" class="lead-suggest-btn" data-q="What are the monthly costs?" style="appearance:none;border:1px solid #e3d8ca;border-radius:999px;background:#faf7f2;color:#6b6560;padding:7px 14px;font:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;">Monthly costs?</button>
            <button type="button" class="lead-suggest-btn" data-q="Has there been any recent work done on the property?" style="appearance:none;border:1px solid #e3d8ca;border-radius:999px;background:#faf7f2;color:#6b6560;padding:7px 14px;font:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;">Recent work done?</button>
          </div>
          <textarea id="lead-question-input" placeholder="Your question..." style="width:100%;min-height:90px;padding:14px 20px;border-radius:12px;border:1px solid #e3d8ca;font:inherit;font-size:0.95rem;outline:none;background:#faf7f2;box-sizing:border-box;resize:vertical;line-height:1.5;"></textarea>
        </div>
        ` : ""}

        <div style="display:grid;gap:10px;">
          <button type="button" id="lead-save-btn" style="appearance:none;border:0;border-radius:12px;background:#181614;color:#fff;height:52px;padding:0 24px;font:inherit;font-size:0.95rem;font-weight:800;cursor:pointer;letter-spacing:-0.01em;">
            ${options.button || "Send me better matches"}
          </button>
          <button type="button" id="lead-cancel-btn" style="appearance:none;border:1px solid #e3d8ca;border-radius:12px;background:#fff;color:#6b6560;height:46px;padding:0 22px;font:inherit;font-size:0.88rem;font-weight:600;cursor:pointer;">
            Keep browsing
          </button>
        </div>

      </div>
    </div>
  `;

 document.querySelectorAll(".lead-suggest-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = document.getElementById("lead-question-input");
      if (q) { q.value = btn.dataset.q; q.focus(); }
    });
  });

  document.getElementById("lead-save-btn")?.addEventListener("click", async () => {
const name = document.getElementById("lead-name-input")?.value || "";
    const email = document.getElementById("lead-email-input")?.value || "";
    const phone = document.getElementById("lead-phone-input")?.value || "";
    const question = document.getElementById("lead-question-input")?.value || "";
    const listingLeadData = getActiveListingLeadData();

    document.querySelectorAll(".lead-suggest-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const q = document.getElementById("lead-question-input");
        if (q) q.value = btn.dataset.q;
      });
    });

    await fetch("/api/intent-lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
     body: JSON.stringify({
  name,
  email,
  phone,
source: options.kicker || "Save refined search",
question,
message: [
  options.note || "",
  question ? `Question: ${question}` : "",
  activeCard?.dataset?.address ? `Property: ${activeCard.dataset.address}` : "",
  listingLeadData.listing_url ? `Listing: ${listingLeadData.listing_url}` : "",
  ].filter(Boolean).join("\n"),
  ...listingLeadData,
}),
    });

    const wasQuestion = options.kicker === "Ask a question";
    const wasShowing = options.kicker === "Book a showing";

    sheetSummary.innerHTML = `
      <div style="min-height:100%;padding:48px 36px 40px;background:#fff;display:flex;flex-direction:column;justify-content:center;">
        <div style="max-width:480px;margin:0 auto;width:100%;display:grid;gap:24px;">
          <div>
            <div style="display:inline-block;margin-bottom:14px;padding:5px 12px;border-radius:999px;background:#e8f6dd;border:1px solid #b5d79a;font-size:0.7rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#3a6b22;">
              ${wasQuestion ? "Question sent" : wasShowing ? "Request sent" : "Saved"}
            </div>
            <h2 style="margin:0 0 10px;font-size:1.9rem;line-height:1.05;letter-spacing:-0.04em;font-weight:700;color:#181614;">
              ${wasQuestion ? "Thanks, we'll follow up shortly." : wasShowing ? "We'll be in touch to confirm a time." : "You're all set."}
            </h2>
            <p style="margin:0;color:#6b6560;font-size:0.95rem;line-height:1.6;">
              ${wasQuestion ? "Your question has been sent. We'll be in touch as soon as possible - usually within a few hours." : wasShowing ? "We'll reach out to confirm a time that works for you. In the meantime, keep browsing." : "We'll use this search direction to help send better matches."}
            </p>
          </div>
          <div style="display:grid;gap:10px;">
            <button type="button" id="post-lead-keep-browsing" style="appearance:none;border:0;border-radius:12px;background:#181614;color:#fff;height:52px;padding:0 24px;font:inherit;font-size:0.95rem;font-weight:800;cursor:pointer;">
              Keep browsing
            </button>
            <button type="button" id="post-lead-close" style="appearance:none;border:1px solid #e3d8ca;border-radius:12px;background:#fff;color:#6b6560;height:46px;padding:0 22px;font:inherit;font-size:0.88rem;font-weight:600;cursor:pointer;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("post-lead-keep-browsing")?.addEventListener("click", () => {
      sheet.classList.remove("is-engagement-mode");
      sheetSummary.classList.remove("open");
      sheetContent?.classList.add("open");
syncListingSectionsToOpenPanel();
      goNext();
    });

    document.getElementById("post-lead-close")?.addEventListener("click", () => {
      closeSheet({ force: true });
    });
  });

  document.getElementById("lead-cancel-btn")?.addEventListener("click", () => {
    sheet.classList.remove("is-engagement-mode");
    sheetSummary.classList.remove("open");
    sheetContent.classList.add("open");
    goNext();
  });
}
function showSaveSearchCTA(options = {}) {
  if (!sheetContent || !sheetSummary) return;

  hasShownSaveSearchCTA = true;
  isExitSaveSearchPrompt = Boolean(options.isExitPrompt);

  sheetContent.classList.remove("open");
  sheetSummary.removeAttribute("hidden");
  sheetSummary.classList.add("open");
  sheet.querySelector(".panel__view")?.scrollTo({ top: 0, behavior: "instant" });
  sheet.scrollTo({ top: 0, behavior: "instant" });

  const isRefineAgain = options.primaryLabel === "Refine again";

  // Pull chips from the interrupt card or generated chip targets
  const refineChipLabels = Array.from(
    document.querySelectorAll(
      ".interrupt-groups .generated-refine-chip, .refine-options .generated-refine-chip"
    )
  )
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .slice(0, 6);

  const chipHtml = isRefineAgain && refineChipLabels.length
    ? `
      <div style="margin:20px 0 0;">
        <div style="font-size:0.72rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">
          What would make the next homes a better fit?
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;" id="rerefine-chip-row">
          ${refineChipLabels.map((label) => `
            <button
              type="button"
              class="modal-intent-secondary"
              data-rerefine-label="${label}"
              style="font-size:0.85rem;padding:9px 16px;"
            >${label}</button>
          `).join("")}
        </div>
      </div>
    `
    : "";

  sheetSummary.innerHTML = `
    <div class="modal-intent-summary modal-intent-summary--polished">
      <div class="modal-intent-kicker">
        ${options.kicker || "Your refined search is ready"}
      </div>

      <h2>${options.title || "Want to save this search?"}</h2>

      <p>
        ${options.body || "We can save this direction and send you better matches when similar homes appear."}
      </p>

      ${chipHtml}

      <div class="modal-intent-actions" style="margin-top:24px;">
        ${!isRefineAgain ? `
          <button type="button" class="modal-intent-primary" id="save-search-lead-btn">
            Save this search
          </button>
        ` : ""}

        <button type="button" class="modal-intent-secondary" id="save-search-keep-browsing-btn">
          ${isExitSaveSearchPrompt ? "Not right now" : (options.keepBrowsingLabel || "Keep browsing")}
        </button>
      </div>
    </div>
  `;

  // Chip click -> fire runIntentRefine and close modal
  document.getElementById("rerefine-chip-row")?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-rerefine-label]");
    if (!btn) return;

    btn.classList.add("is-selected");

    const label = btn.dataset.rerefineLabel;

    closeSheet({ force: true });

    let attempts = 0;
    while (typeof window.runIntentRefine !== "function" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    if (typeof window.runIntentRefine === "function") {
      const fakeChip = document.createElement("button");
      fakeChip.type = "button";
      fakeChip.className = "refine-chip generated-refine-chip";
      fakeChip.textContent = label;

      await window.runIntentRefine(fakeChip, { openFirstResult: true });

      document.getElementById("refined-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });

  document.getElementById("save-search-lead-btn")?.addEventListener("click", () => {
    saveSearchDismissedAtCardKey = null;
    hasDismissedSaveSearchCTA = false;
    isExitSaveSearchPrompt = false;
    hasShownSaveSearchCTA = true;
    showLeadCaptureForm();
  });

  document.getElementById("save-search-keep-browsing-btn")?.addEventListener("click", () => {
    if (isExitSaveSearchPrompt) {
      closeSheet({ force: true });

      const refinedAnchor =
        document.getElementById("refined-results") ||
        document.getElementById("refined-results-anchor");

      window.setTimeout(() => {
        refinedAnchor?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);

      return;
    }

    saveSearchDismissedAtCardKey = getCardKey(activeCard);
    hasDismissedSaveSearchCTA = true;
    hasShownSaveSearchCTA = false;
    refinedBrowseCount = 0;
    window.__keepBrowsingActive = true;
    window.__keepBrowsingCount = 0;

    sheetSummary.classList.remove("open");
    sheetContent.classList.add("open");

    goNext();
  });
}

function showIntentSummaryCard() {
  if (!sheetContent || !sheetSummary) return;

  hasShownIntentSummary = true;

  sheetContent.classList.remove("open");
  sheetSummary.removeAttribute("hidden");
  sheetSummary.classList.add("open");
  sheet.querySelector(".panel__view")?.scrollTo({ top: 0, behavior: "instant" });
  sheet.scrollTo({ top: 0, behavior: "instant" });

  const positiveCards = Array.from(document.querySelectorAll(".original-card"))
    .filter((c) => c.dataset.decision === "love" || c.dataset.decision === "maybe")
    .sort((a, b) => {
      const score = (card) => card.dataset.decision === "love" ? 2 : 1;
      return score(b) - score(a);
    });

  const displayCards = positiveCards.slice(0, 4);

  const prices = positiveCards
    .map((c) => Number(String(c.dataset.price || "").replace(/[^\d]/g, "")))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const medianPrice = prices.length
    ? Math.round(prices[Math.floor(prices.length / 2)] / 1000) * 1000
    : null;

  const thumbsHtml = displayCards.length ? `
    <div style="display:grid;grid-template-columns:repeat(${displayCards.length},1fr);gap:8px;margin:0 0 20px;">
      ${displayCards.map((c) => `
        <div style="border-radius:12px;overflow:hidden;aspect-ratio:4/3;background:#eee;">
          <img src="${c.dataset.image || ""}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
        </div>
      `).join("")}
    </div>
  ` : "";

  sheetSummary.innerHTML = `
    <div class="modal-intent-summary modal-intent-summary--polished">
      <div class="modal-intent-kicker">Help me narrow this down</div>

      <h2>You're starting to show a pattern.</h2>

      ${thumbsHtml}

      <p>
        Based on what you've liked so far, I can show more homes
        in similar areas and around ${
          medianPrice
            ? "$" + medianPrice.toLocaleString()
            : "the same price range"
        }.
      </p>

      <div class="modal-intent-actions">
        <button type="button" class="modal-intent-primary" id="summary-refine-btn">
          Show similar homes
        </button>

        <button type="button" class="modal-intent-secondary" id="summary-cheaper-btn">
          Show cheaper options
        </button>

        <button type="button" class="modal-intent-secondary" id="summary-keep-browsing-btn">
          Keep browsing newest
        </button>
      </div>
    </div>
  `;

  document.getElementById("summary-refine-btn")?.addEventListener("click", (event) => {
    event.currentTarget.classList.add("is-selected");
    showRefiningState(["Similar area", "Similar price", "Same property type"]);

    setTimeout(async () => {
      closeSheet({ force: true });

      if (typeof window.runIntentRefine === "function") {
        const chip = document.createElement("button");
chip.type = "button";
chip.className = "refine-chip generated-refine-chip";
chip.textContent = "Show similar homes";

await window.runIntentRefine(chip, { openFirstResult: true });
      }
    }, 900);
  });

  document.getElementById("summary-cheaper-btn")?.addEventListener("click", (event) => {
    event.currentTarget.classList.add("is-selected");
    showRefiningState(["Cheaper options", "Similar area", "Same property type"]);

    setTimeout(async () => {
      closeSheet({ force: true });

      if (typeof window.runIntentRefine === "function") {
        const chip = document.createElement("button");
chip.type = "button";
chip.className = "refine-chip generated-refine-chip";
chip.textContent = "Show cheaper options";

await window.runIntentRefine(chip, { openFirstResult: true });
      }
    }, 900);
  });

  document.getElementById("summary-keep-browsing-btn")?.addEventListener("click", (event) => {
    event.currentTarget.classList.add("is-selected");
    sheetSummary.classList.remove("open");
    sheetContent.classList.add("open");
    goNext();
  });
}
function showEndOfListCTA() {
  if (!sheetContent || !sheetSummary) return;

  sheetContent.classList.remove("open");
  sheetSummary.removeAttribute("hidden");
  sheetSummary.classList.add("open");
  sheet.querySelector(".panel__view")?.scrollTo({ top: 0, behavior: "instant" });
  sheet.scrollTo({ top: 0, behavior: "instant" });

  const positiveCount = Array.from(document.querySelectorAll(".card"))
    .filter((c) => c.dataset.decision === "love" || c.dataset.decision === "maybe").length;

  const refineChipLabels = Array.from(
    document.querySelectorAll(
      ".interrupt-groups .generated-refine-chip, .refine-options .generated-refine-chip"
    )
  )
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .slice(0, 5);

  const chipHtml = refineChipLabels.length ? `
    <div style="margin:20px 0 0;">
      <div style="font-size:0.72rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;">
        Try a different direction
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;" id="end-rerefine-chip-row">
        ${refineChipLabels.map((label) => `
          <button
            type="button"
            class="modal-intent-secondary"
            data-rerefine-label="${label}"
            style="font-size:0.85rem;padding:9px 16px;"
          >${label}</button>
        `).join("")}
      </div>
    </div>
  ` : "";

 const favoriteCards = Array.from(document.querySelectorAll(".card"))
  .filter((c) => c.dataset.decision === "love" || c.dataset.decision === "maybe")
  .slice(0, 4);

const favoritePicsHtml = favoriteCards.length
  ? `
    <div class="review-fave-strip">
      ${favoriteCards.map((c) => `
        <div class="review-fave-thumb">
          <img src="${c.dataset.image || ""}" alt="" />
        </div>
      `).join("")}
    </div>
  `
  : "";

const pageMoreButton = document.getElementById("show-more-listings-btn");
const pageNearbyButton = document.getElementById("show-nearby-area-listings-btn");
const resultsWrapper = document.getElementById("show-more-listings-wrap");

const moreAction =
  resultsWrapper && !resultsWrapper.hidden && pageMoreButton && !pageMoreButton.hidden
    ? pageMoreButton.dataset.action
    : "";

const canSearchNearby =
  resultsWrapper && !resultsWrapper.hidden &&
  pageNearbyButton && !pageNearbyButton.hidden;

const hasMoreMatches = moreAction === "load-more";
const hasPriceStep = moreAction === "next-price";
const hasSearchChoice = hasMoreMatches || hasPriceStep || canSearchNearby;

sheetSummary.innerHTML = `
  <div style="box-sizing:border-box;width:min(100%,680px);margin:28px auto;padding:clamp(20px,4vw,36px);">
    <div style="border:1px solid #b8d2d3;border-radius:18px;background:linear-gradient(135deg,#f0f6f5,#fff);padding:clamp(22px,4vw,36px);text-align:center;">
      <div style="color:#2f6f73;font-size:.73rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;">
        ${hasSearchChoice ? "Search complete" : "Shortlist reviewed"}
      </div>

      <h2 style="margin:12px 0 10px;color:#201d1b;font-size:clamp(1.65rem,4vw,2.25rem);line-height:1.12;letter-spacing:-.035em;">
        ${hasMoreMatches ? "Ready for more homes?" : hasSearchChoice ? "You’ve seen every match here" : "You’ve reviewed all the homes"}
      </h2>

      <p style="max-width:470px;margin:0 auto 22px;color:#5e6261;line-height:1.55;">
        ${hasMoreMatches
          ? "There are more homes matching this search."
          : hasSearchChoice
            ? "You can look just above your budget or widen the area."
            : "You can revisit your favourites or ask for help with the next step."}
      </p>

      <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:10px;">
        ${moreAction ? `
          <button type="button" data-end-action="page-more"
            style="min-height:46px;padding:11px 19px;border:1px solid #2f6f73;border-radius:999px;background:#2f6f73;color:white;font:inherit;font-size:.88rem;font-weight:800;cursor:pointer;">
          </button>` : ""}

        ${canSearchNearby ? `
          <button type="button" data-end-action="page-nearby"
            style="min-height:46px;padding:11px 19px;border:1px solid #2f6f73;border-radius:999px;background:white;color:#2f6f73;font:inherit;font-size:.88rem;font-weight:800;cursor:pointer;">
          </button>` : ""}
      </div>
    </div>

    ${favoritePicsHtml}

    <div style="margin-top:24px;text-align:center;">
      <p style="margin:0 0 12px;color:#615e5a;font-size:.85rem;">
        Want help with a home you liked?
      </p>
      <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:10px;">
        <button type="button" data-end-action="book-showings" class="modal-intent-secondary">Book showings</button>
        <button type="button" data-end-action="ask-question" class="modal-intent-secondary">Ask a question</button>
        <button type="button" class="modal-intent-secondary" id="end-close-btn">Close</button>
      </div>
    </div>
  </div>
`;

const modalMoreButton = sheetSummary.querySelector('[data-end-action="page-more"]');
const modalNearbyButton = sheetSummary.querySelector('[data-end-action="page-nearby"]');
if (modalMoreButton && pageMoreButton) {
  modalMoreButton.textContent = pageMoreButton.textContent.trim();
}
if (modalNearbyButton && pageNearbyButton) {
  modalNearbyButton.textContent = pageNearbyButton.textContent.trim();
}
document.querySelectorAll("[data-end-action]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const action = btn.dataset.endAction;

    if (action === "page-more" || action === "page-nearby") {
      const target = action === "page-more" ? pageMoreButton : pageNearbyButton;
      if (!target || target.hidden || target.disabled) return;

      closeSheet({ force: true });
      target.click();

      if (action === "page-more") {
        document.getElementById("show-more-listings-wrap")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      return;
    }
    if (action === "book-showings") {
      showLeadCaptureForm({
        kicker: "Book showings",
        title: "Want to view your favourites?",
        body: "Leave your details and I'll help set up showings for the homes you liked.",
        button: "Request showings",
        note: "Buyer reached the end of the shortlist and wants to book showings.",
      });
      return;
    }

    if (action === "ask-question") {
      showLeadCaptureForm({
        kicker: "Ask a question",
        title: "Have a question about any of these homes?",
        body: "Send your question and I'll follow up with answers and next steps.",
        button: "Send my question",
        note: "Buyer reached the end of the shortlist and has a question.",
      });
      return;
    }

    closeSheet({ force: true });

    let attempts = 0;
    while (typeof window.runIntentRefine !== "function" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    if (typeof window.runIntentRefine === "function") {
      const fakeChip = document.createElement("button");
      fakeChip.type = "button";
      fakeChip.className = "refine-chip generated-refine-chip";
      fakeChip.textContent = "Show higher-value homes";

      await window.runIntentRefine(fakeChip, { openFirstResult: true });

      document.getElementById("refined-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});



document.getElementById("end-close-btn")?.addEventListener("click", () => {
  closeSheet({ force: true });
});
}

        function goNext() {
          const cards = getCards();
          const index = currentIndex();

if (window.__keepBrowsingActive) {
  window.__keepBrowsingCount = (window.__keepBrowsingCount || 0) + 1;

  if (window.__keepBrowsingCount >= 6) {
    window.__keepBrowsingActive = false;
    window.__keepBrowsingCount = 0;
    showSaveSearchCTA({
      kicker: "Still searching?",
      title: "Not quite finding it?",
      body: "We can narrow this down further - tell us what's missing and we'll surface better fits.",
      primaryLabel: "Refine again",
      keepBrowsingLabel: "Keep going",
    });
    return;
  }
}

if (
  hasShownIntentSummary &&
  !hasShownSaveSearchCTA &&
  refinedBrowseCount >= 5 &&
  !hasDismissedSaveSearchCTA
) {
  showSaveSearchCTA();
  return;
}

if (
  hasShownIntentSummary &&
  !hasShownSaveSearchCTA &&
  hasDismissedSaveSearchCTA &&
  refinedBrowseCount >= SAVE_SEARCH_RESHOW_AFTER
) {
  showSaveSearchCTA({
    kicker: "Still seeing good matches?",
    title: "Want us to keep watching for homes like these?",
    body: "We can save this direction and send better matches when similar homes appear.",
  });

  return;
}
       if (
  !hasShownIntentSummary &&
  (
    (totalIntentReactions >= 6 && positiveIntentReactions >= 2) ||
    positiveIntentReactions >= 4
  )
) {
  showIntentSummaryCard();
  return;
}

if (
  !hasShownIntentSummary &&
  totalIntentReactions >= 10 &&
  positiveIntentReactions >= 2
) {
  showIntentSummaryCard();
  return;
}

if (
  !hasShownIntentSummary &&
  totalIntentReactions >= 10 &&
  positiveIntentReactions >= 2
) {
  showIntentSummaryCard();
  return;
}

if (index >= cards.length - 1) {
  showEndOfListCTA();
  return;
}

       activeCard = cards[index + 1];
syncListingUrl(activeCard, "replace");
renderCard(activeCard);
syncMobileMediaCounts();
const navigatedCard = activeCard;
fetchListingDetailIfNeeded(navigatedCard).then((wasUpdated) => {
  if (!wasUpdated || activeCard !== navigatedCard) return;
  renderCard(navigatedCard);

  hydrateRoomMeasurements(activeCard);
  refreshFloorplanButtonVisibility();
syncMobileMediaCounts();

  const hydratedUrls = getCardPhotoUrls(activeCard);

  if (hydratedUrls.length) {
    activePhotoUrls = hydratedUrls;
    updatePhotoCounter();

    if (photoPrevBtn) {
      photoPrevBtn.disabled = activePhotoIndex === 0;
    }

    if (photoNextBtn) {
      photoNextBtn.disabled =
        activePhotoIndex >= activePhotoUrls.length - 1;
    }

    preloadImages(activePhotoUrls.slice(1, 6));
  }
});


sheet
  ?.querySelector(".panel__view")
  ?.scrollTo({
    top: 0,
    behavior: "instant",
  });

sheet?.scrollTo({
  top: 0,
  behavior: "instant",
});

requestAnimationFrame(() => {
  updateLandscapeGalleryMode();
});
        }

        function goPrev() {
          const cards = getCards();
          const index = currentIndex();

          if (index <= 0) return;

       activeCard = cards[index - 1];
syncListingUrl(activeCard, "replace");
renderCard(activeCard);
syncMobileMediaCounts();
const navigatedCard = activeCard;
fetchListingDetailIfNeeded(navigatedCard).then((wasUpdated) => {
  if (!wasUpdated || activeCard !== navigatedCard) return;
  renderCard(navigatedCard);

  hydrateRoomMeasurements(activeCard);
  refreshFloorplanButtonVisibility();
syncMobileMediaCounts();

  const hydratedUrls = getCardPhotoUrls(activeCard);

  if (hydratedUrls.length) {
    activePhotoUrls = hydratedUrls;
    updatePhotoCounter();

    if (photoPrevBtn) {
      photoPrevBtn.disabled = activePhotoIndex === 0;
    }

    if (photoNextBtn) {
      photoNextBtn.disabled =
        activePhotoIndex >= activePhotoUrls.length - 1;
    }

    preloadImages(activePhotoUrls.slice(1, 6));
  }
});


sheet
  ?.querySelector(".panel__view")
  ?.scrollTo({
    top: 0,
    behavior: "instant",
  });

sheet?.scrollTo({
  top: 0,
  behavior: "instant",
});

requestAnimationFrame(() => {
  updateLandscapeGalleryMode();
});
        }

        function saveIntentDecision(decision) {
  if (!activeCard) return;

  activeCard.dataset.decision = decision;
updateCardDecisionBadge(activeCard);
  if (decision === "pass") {
    activeCard.dataset.likedTags = "[]";
  }

  updateDecisionButtons(activeCard);
likeTagsEl.hidden = true;
likeTagsEl.classList.remove("open");

window.setTimeout(() => {
  renderLikeTags(activeCard);
}, decision === "love" ? 300 : 150);

 sheet.classList.remove("has-decision");

if (sheetEngage) {
  sheetEngage.hidden = false;
}

  if (feedback) {
  feedback.textContent = "";
}

totalIntentReactions += 1;

if (decision === "love" || decision === "maybe") {
  positiveIntentReactions += 1;
}

saveCurrentReaction();

// keep modal position steady after decision
}

   const openCardSheetFromClick = (event) => {
  if (!(event.target instanceof Element)) return;

  const card = event.target.closest(
    ".original-card, .refined-card"
  );

  if (!card) return;

  const interactive = event.target.closest(
    "button, a, input, textarea, select"
  );

  if (interactive && interactive !== card) {
    const isPreviewTrigger =
      interactive.classList.contains("preview-btn") ||
      Boolean(event.target.closest(".card__image-wrap"));

    if (!isPreviewTrigger) return;
  }

  if (
    document.body.dataset.shortlistSendId &&
    document.body.dataset.agentView === "true"
  ) {
    return;
  }

  const open = window.openSheet;

  if (typeof open !== "function") {
    console.error("Listing modal is not ready.");
    return;
  }

  // Card clicks belong to the listing sheet. Capture them before any
  // older page/router handler can turn the click into navigation.
  event.preventDefault();
  event.stopImmediatePropagation();

  open(card);
};

listenModalDocument(
  "click",
  openCardSheetFromClick,
  true
);

        closeBtn?.addEventListener("click", closeSheet);
sheetPhotoShareBtn?.addEventListener("click", shareActivePhoto);
sheetShareBtn?.addEventListener("click", async (event) => {
  event.stopPropagation();

  if (!activeCard) return;

  const listingId =
    activeCard.dataset.listingId ||
    activeCard.dataset.itemId ||
    "";

  if (!listingId) {
    console.warn("No listing ID available to share");
    return;
  }

  const city =
    activeCard.dataset.city ||
    document.body.dataset.city ||
    "nanaimo";

  const type =
    activeCard.dataset.type || "house";

  const typePath =
    type === "condo"
      ? "condos"
      : type === "townhouse"
      ? "townhomes"
      : type === "mobile"
      ? "mobile-homes"
      : type === "land"
      ? "land"
      : "homes";

  const shareUrl = `${window.location.origin}${getListingUrl(activeCard)}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title:
          activeCard.dataset.address ||
          "Property listing",

        text:
          activeCard.dataset.address
            ? `Take a look at ${activeCard.dataset.address}`
            : "Take a look at this property",

        url: shareUrl,
      });

      return;
    }

    await navigator.clipboard.writeText(
      shareUrl
    );

    sheetShareBtn.textContent = "Copied";

    setTimeout(() => {
      sheetShareBtn.textContent = "Share";
    }, 1500);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(
        "Share failed:",
        error
      );
    }
  }
});
        sheetMapBtn?.addEventListener("click", async () => {
  rememberRegularPhotoPosition();
  if (!activeCard || !sheetMiniMap) return;
  scrollSheetToTop();
  sheet?.scrollTo({ top: 0, behavior: "instant" });

requestAnimationFrame(() => {
  sheet?.scrollTo({ top: 0, behavior: "instant" });
});

 sheet.scrollTop = 0;
  document.querySelector("#preview-sheet")?.scrollTo({ top: 0, behavior: "instant" });

  const mapIsOpen = !sheetMiniMap.hidden;

  if (mapIsOpen) {
   sheetMiniMap.hidden = true;
sheetMiniMap.style.display = "none";
sheetMiniMap.innerHTML = "";

if (sheetMiniMapWrap) {
  sheetMiniMapWrap.hidden = true;
  sheetMiniMapWrap.style.display = "none";
}

mapIsExpanded = false;

if (sheetMapExpandBtn) {
  sheetMapExpandBtn.setAttribute("aria-expanded", "false");
  sheetMapExpandBtn.innerHTML =
    '<span>Expand map</span>';
}

if (sheetImageStage) {
  sheetImageStage.classList.remove("is-hidden");
    sheetImageStage.hidden = false;
    sheetImageStage.style.removeProperty("display");
}

    if (sheetMapBtn) {
      sheetMapBtn.textContent = "Map";
    }

    returnToRegularPhotos();

    return;
  }

  // Map, Photos and Floorplan are mutually exclusive views.
  // Leave floorplan mode before opening the map.
  if (isFloorplanMode) {
    returnToRegularPhotos();
  }

  const point = getCardLatLng(activeCard);

  if (!point) {
    sheetMiniMap.hidden = false;
    sheetMiniMap.style.display = "block";
    sheetMiniMap.innerHTML =
      "<p style='padding:16px;color:#6b6560;'>No map location available for this listing.</p>";

    if (sheetMapBtn) {
      sheetMapBtn.textContent = "Photos";
  setFloorplanButtonDefault();
    }

    return;
  }

  if (sheetImageStage) {
    sheetImageStage.classList.add("is-hidden");
    sheetImageStage.hidden = true;
    sheetImageStage.style.setProperty("display", "none", "important");
  }

const mapBtnHeight =
  firstPhotoStageHeight > 50
    ? firstPhotoStageHeight
    : cachedImageStageHeight > 50
      ? cachedImageStageHeight
      : (document.querySelector(".panel__image-stage")?.offsetHeight || 480);

mapBaseHeight = mapBtnHeight;
mapIsExpanded = false;

if (sheetMiniMapWrap) {
  sheetMiniMapWrap.hidden = false;
  sheetMiniMapWrap.style.display = "block";
}

sheetMiniMap.hidden = false;
sheetMiniMap.style.display = "block";
sheetMiniMap.style.height = mapBaseHeight + "px";
sheetMiniMap.style.minHeight = mapBaseHeight + "px";
sheetMiniMap.style.width = "100%";

if (sheetMapExpandBtn) {
  sheetMapExpandBtn.hidden = false;
  sheetMapExpandBtn.setAttribute("aria-expanded", "false");
  sheetMapExpandBtn.innerHTML =
    '<span>Expand map</span>';
}

if (sheetMapBtn) {
  sheetMapBtn.textContent = "Photos";
  setFloorplanButtonDefault();
}

try {
  await loadLeaflet();

  if (sheetMiniMapInstance) { sheetMiniMapInstance.remove(); sheetMiniMapInstance = null; }

  sheetMiniMap.innerHTML = "";
  sheetMiniMapInstance = L.map(sheetMiniMap, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
  L.tileLayer(window.__JAWG_TILE_URL__, { maxZoom: 19, attribution: window.__JAWG_ATTRIBUTION__ }).addTo(sheetMiniMapInstance);

  sheetMiniMapMarker = L.circleMarker([point.lat, point.lng], {
    radius: 9, color: "#fff", weight: 2,
    fillColor: "#ff3b30", fillOpacity: 1,
  }).addTo(sheetMiniMapInstance)
    .bindPopup(activeCard.dataset.address || "Listing", { closeButton: false });

  const resizeModalMap = () => {
    if (!sheetMiniMapInstance) return;

    sheetMiniMapInstance.invalidateSize({
      animate: false,
      pan: false,
    });

    sheetMiniMapInstance.setView(
      [point.lat, point.lng],
      15,
      { animate: false }
    );
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(resizeModalMap);
  });

  [150, 350, 700].forEach((delay) => {
    setTimeout(resizeModalMap, delay);
  });
} catch (error) {
  console.error("Map failed to load:", error);
  sheetMiniMap.innerHTML = `<p style='padding:16px;color:#6b6560;font-size:12px;'>Map could not load: ${error?.message}</p>`;
}
});
sheetMapExpandBtn?.addEventListener("click", () => {
  if (!sheetMiniMap || !mapBaseHeight) return;

  mapIsExpanded = !mapIsExpanded;

  const mobileViewportHeight =
    window.visualViewport?.height || window.innerHeight;

  const mapTop =
    sheetMiniMapWrap?.getBoundingClientRect().top || 0;

  // Leave room for the mobile media navigation and browser safe area.
  const expandedMapHeight = Math.max(
    260,
    mobileViewportHeight - Math.max(0, mapTop) - 36
  );

  const nextHeight = mapIsExpanded
    ? expandedMapHeight
    : mapBaseHeight;

  sheetMiniMap.style.height = `${nextHeight}px`;
  sheetMiniMap.style.minHeight = `${nextHeight}px`;

  if (mapIsExpanded) {
    sheetMiniMapWrap?.style.setProperty(
      "margin-bottom",
      "-8px",
      "important"
    );
  } else {
    sheetMiniMapWrap?.style.removeProperty("margin-bottom");
  }

  sheetMapExpandBtn.setAttribute(
    "aria-expanded",
    String(mapIsExpanded)
  );

  sheetMapExpandBtn.innerHTML = mapIsExpanded
    ? '<span>Collapse map</span>'
    : '<span>Expand map</span>';

  if (mapIsExpanded) {
    document.body.appendChild(sheetMapExpandBtn);
    sheetMapExpandBtn.style.setProperty("position", "fixed", "important");
    sheetMapExpandBtn.style.setProperty("top", "auto", "important");
    sheetMapExpandBtn.style.setProperty("left", "50%", "important");
    sheetMapExpandBtn.style.setProperty(
      "bottom",
      "calc(56px + env(safe-area-inset-bottom))",
      "important"
    );
    sheetMapExpandBtn.style.setProperty("z-index", "2147483647", "important");
  } else {
    sheetMiniMapWrap?.appendChild(sheetMapExpandBtn);
    sheetMapExpandBtn.style.removeProperty("position");
    sheetMapExpandBtn.style.removeProperty("top");
    sheetMapExpandBtn.style.removeProperty("left");
    sheetMapExpandBtn.style.removeProperty("bottom");
    sheetMapExpandBtn.style.removeProperty("z-index");
  }

 setTimeout(() => {
  sheetMiniMapInstance?.invalidateSize();

  const center = sheetMiniMapInstance?.getCenter();
  const zoom = sheetMiniMapInstance?.getZoom();

  if (center && zoom != null) {
    sheetMiniMapInstance.setView(center, zoom, {
      animate: false,
    });
  }
}, 300);
});

/*
 * Restore the expanded-map button before Astro changes pages.
 */
listenModalDocument(
  "astro:before-swap",
  () => {
    mapIsExpanded = false;

    if (sheetMiniMap && mapBaseHeight) {
      sheetMiniMap.style.height = `${mapBaseHeight}px`;
      sheetMiniMap.style.minHeight = `${mapBaseHeight}px`;
    }

    sheetMiniMapWrap?.style.removeProperty("margin-bottom");

    if (sheetMapExpandBtn) {
      sheetMapExpandBtn.setAttribute("aria-expanded", "false");
      sheetMapExpandBtn.innerHTML = "<span>Expand map</span>";

      sheetMiniMapWrap?.appendChild(sheetMapExpandBtn);

      sheetMapExpandBtn.style.removeProperty("position");
      sheetMapExpandBtn.style.removeProperty("top");
      sheetMapExpandBtn.style.removeProperty("left");
      sheetMapExpandBtn.style.removeProperty("bottom");
      sheetMapExpandBtn.style.removeProperty("z-index");
    }
  },
  { once: true }
);
overlay?.addEventListener("click", closeSheet);

        // modal-back-capture-only-v1
listenModalWindow("popstate", (event) => {
  const ownsModalStep =
    modalHistoryPushed &&
    window.location.href === modalReturnUrl;

  if (ownsModalStep) {
    event.stopImmediatePropagation();
  }

  if (sheet.classList.contains("open")) {
    closeSheet({ force: true, fromPopState: true });
  }
}, { capture: true });

        nextBtn?.addEventListener("click", goNext);
        nextTopBtn?.addEventListener("click", goNext);
        prevBtn?.addEventListener("click", goPrev);
        prevTopBtn?.addEventListener("click", goPrev);

function scrollModalToBottom() {
  setTimeout(() => {
    const content = document.getElementById("sheet-content");
    const panelView = sheet.querySelector(".panel__view");

    content?.scrollTo({ top: content.scrollHeight, behavior: "smooth" });
    panelView?.scrollTo({ top: panelView.scrollHeight, behavior: "smooth" });
    sheet?.scrollTo({ top: sheet.scrollHeight, behavior: "smooth" });
  }, 250);
}

let idleAdvanceTimer = null;

function startIdleAdvance() {
  if (idleAdvanceTimer) clearTimeout(idleAdvanceTimer);
idleAdvanceTimer = setTimeout(() => {
    startChipProgressBar();
    chipAdvanceTimer = setTimeout(() => {
      const nextBtn = document.getElementById("sheet-next-btn");
      if (nextBtn) nextBtn.classList.add("is-pulsing");
      setTimeout(() => {
        if (nextBtn) nextBtn.classList.remove("is-pulsing");
        chipAdvanceTimer = null;
        goNext();
      }, 1000);
    }, 2500);
  }, 3000);
}

function cancelIdleAdvance() {
  if (idleAdvanceTimer) {
    clearTimeout(idleAdvanceTimer);
    idleAdvanceTimer = null;
  }
}

loveBtn?.addEventListener("click", () => {
popDecisionEmojisFromButton(loveBtn, ["\u2764\uFE0F", "\uD83D\uDC96", "\uD83D\uDE0D"], 8);
  saveIntentDecision("love");
  cancelIdleAdvance();
});

maybeBtn?.addEventListener("click", () => {
  popDecisionEmojisFromButton(maybeBtn, ["\uD83D\uDC4C", "\uD83D\uDC4D", "\u2728"], 6);
  saveIntentDecision("maybe");
  cancelIdleAdvance();
});

passBtn?.addEventListener("click", () => {
  popDecisionEmojisFromButton(passBtn, ["\u00D7"], 1);
  saveIntentDecision("pass");
  cancelIdleAdvance();
});

askQuestionBtn?.addEventListener("click", () => {
  sheet.classList.add("is-engagement-mode");

  showLeadCaptureForm({
 kicker: "Ask a question",
    title: "Want to ask about this home?",
    body: "Leave your details and we\u2019ll follow up about this property.", button: "Ask about this home",
    note: "I'm interested in this property and have a question.",
  });
});

bookShowingBtn?.addEventListener("click", () => {
  sheet.classList.add("is-engagement-mode");

  showLeadCaptureForm({
    kicker: "Book a showing",
    title: "Want to see this home?",
    body: "Leave your details and we\u2019ll help arrange a showing.",
    button: "Book a showing",
    note: "I'd like to arrange a showing for this property.",
  });
});

let chipAdvanceTimer = null;

function startChipProgressBar() {
  let wrap = document.getElementById("chip-advance-bar-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "chip-advance-bar-wrap";
    wrap.style.cssText = "position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(860px,100vw);height:3px;background:#e8e3dc;overflow:hidden;z-index:1000;";
    const bar = document.createElement("div");
    bar.id = "chip-advance-bar";
    bar.style.cssText = "height:100%;width:0%;background:var(--accent);transition:none;";
    wrap.appendChild(bar);
    sheet.appendChild(wrap);
  }
  const bar = document.getElementById("chip-advance-bar");
  bar.style.transition = "none";
  bar.style.width = "0%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
  bar.style.transition = "width 2.5s linear";
      bar.style.width = "100%";
    });
  });
}

function resetChipProgressBar() {
  const bar = document.getElementById("chip-advance-bar");
  if (bar) {
    bar.style.transition = "none";
    bar.style.width = "0%";
  }
  const wrap = document.getElementById("chip-advance-bar-wrap");
  if (wrap) wrap.remove();
}

likeTagsEl?.addEventListener("click", (event) => {
  const tagBtn = event.target.closest(".intent-like-tag");

  if (!tagBtn || !activeCard) return;

  tagBtn.classList.toggle("active");

  activeCard.dataset.likedTags = JSON.stringify(getActiveLikedTags());

  saveCurrentReaction();

  const nextBtn = document.getElementById("sheet-next-btn");

cancelIdleAdvance();
  if (chipAdvanceTimer) { clearTimeout(chipAdvanceTimer); chipAdvanceTimer = null; }

  resetChipProgressBar();
  startChipProgressBar();

chipAdvanceTimer = setTimeout(() => {
    if (nextBtn) nextBtn.classList.add("is-pulsing");
    setTimeout(() => {
      if (nextBtn) nextBtn.classList.remove("is-pulsing");
      chipAdvanceTimer = null;
      resetChipProgressBar();
      goNext();
    }, 1000);
  }, 2500);
});
sheetFloorplanBtn?.addEventListener("click", (event) => {
  event.stopPropagation();

  if (!activeCard) return;

  rememberRegularPhotoPosition();

  scrollSheetToTop();

  let floorplanUrls = [];

  try {
    floorplanUrls = JSON.parse(
      activeCard.dataset.floorplans || "[]"
    );
  } catch {
    floorplanUrls = [];
  }

  if (!Array.isArray(floorplanUrls) || !floorplanUrls.length) {
    return;
  }

  const normalizeForMatch = (url) =>
    String(url || "")
      .replace(/[?&]class=[^&]+/g, "")
      .replace(/\?$/, "")
      .trim();

  const normalizedFloorplans = floorplanUrls.map(normalizeForMatch);

  const currentUrl =
    activePhotoUrls[activePhotoIndex] || "";

  const currentlyViewingFloorplan =
    normalizedFloorplans.includes(normalizeForMatch(currentUrl));

  const mapCurrentlyOpen =
    !!sheetMiniMap &&
    !sheetMiniMap.hidden &&
    sheetMiniMap.style.display !== "none";
  
  if (currentlyViewingFloorplan && !mapCurrentlyOpen) {
    returnToRegularPhotos();
    return;
  }
  // Guarantee that every detected floorplan is in the active gallery.
  const floorplanGalleryIndexes = floorplanUrls.map(
    (floorplanUrl) => {
      const normalizedFloorplan =
        normalizeForMatch(floorplanUrl);

      let galleryIndex = activePhotoUrls.findIndex(
        (url) =>
          normalizeForMatch(url) ===
          normalizedFloorplan
      );

      if (galleryIndex < 0) {
        activePhotoUrls.push(floorplanUrl);
        galleryIndex = activePhotoUrls.length - 1;
      }

      return galleryIndex;
    }
  );

  isFloorplanMode = true;
  activePhotoIndex = floorplanGalleryIndexes[0];

  showActivePhoto();
  hidePhotoOverlayTemporarily();

  // floorplan-contained-navigation
  if (photoPrevBtn) {
    photoPrevBtn.disabled = true;
  }

  if (photoNextBtn) {
    photoNextBtn.disabled =
      floorplanUrls.length <= 1;
  }

  if (sheetMiniMap) {
    sheetMiniMap.hidden = true;
    sheetMiniMap.style.display = "none";

    if (sheetMiniMapWrap) {
      sheetMiniMapWrap.hidden = true;
      sheetMiniMapWrap.style.display = "none";
    }

    if (sheetMapExpandBtn) {
      sheetMapExpandBtn.hidden = true;
    }
  }

  if (sheetImageStage) {
    sheetImageStage.classList.remove("is-hidden");
    sheetImageStage.hidden = false;
    sheetImageStage.style.removeProperty("display");
  }

  if (sheetMapBtn) {
    sheetMapBtn.textContent = "Map";
  }
});
function getActiveFloorplanPosition() {
  const currentFloorplans =
    getCurrentFloorplanUrls();

  if (
    !currentFloorplans.length ||
    !activePhotoUrls.length
  ) {
    return -1;
  }

  const current =
    normalizeGalleryUrl(
      activePhotoUrls[activePhotoIndex] || ""
    );

  return currentFloorplans.findIndex(
    (url) =>
      normalizeGalleryUrl(url) === current
  );
}

function goToFloorplanPosition(position) {
  isFloorplanMode = true;
  const currentFloorplans =
    getCurrentFloorplanUrls();

  if (
    position < 0 ||
    position >= currentFloorplans.length
  ) {
    return false;
  }

  const targetUrl =
    currentFloorplans[position];

  const normalizedTarget =
    normalizeGalleryUrl(targetUrl);

  let galleryIndex =
    activePhotoUrls.findIndex(
      (url) =>
        normalizeGalleryUrl(url) ===
        normalizedTarget
    );

  if (galleryIndex < 0) {
    activePhotoUrls.push(targetUrl);
    galleryIndex =
      activePhotoUrls.length - 1;
  }

  activePhotoIndex = galleryIndex;

  showActivePhoto();
  hidePhotoOverlayTemporarily();

  if (photoPrevBtn) {
    photoPrevBtn.disabled = position <= 0;
  }

  if (photoNextBtn) {
    photoNextBtn.disabled =
      position >= currentFloorplans.length - 1;
  }


  return true;
}

function goToAdjacentRegularPhoto(direction) {
  const floorplans = getCurrentFloorplanUrls()
    .map(normalizeGalleryUrl);

  let candidateIndex =
    activePhotoIndex + direction;

  while (
    candidateIndex >= 0 &&
    candidateIndex < activePhotoUrls.length &&
    floorplans.includes(
      normalizeGalleryUrl(
        activePhotoUrls[candidateIndex]
      )
    )
  ) {
    candidateIndex += direction;
  }

  if (
    candidateIndex < 0 ||
    candidateIndex >= activePhotoUrls.length
  ) {
    return false;
  }

  isFloorplanMode = false;
  activePhotoIndex = candidateIndex;

  showActivePhoto();
  hidePhotoOverlayTemporarily();

  return true;
}

photoPrevBtn?.addEventListener("click", (event) => {
  event.stopPropagation();

  const floorplanPosition =
    getActiveFloorplanPosition();

  if (floorplanPosition >= 0) {
    if (floorplanPosition > 0) {
      goToFloorplanPosition(
        floorplanPosition - 1
      );
    } else if (!goToAdjacentRegularPhoto(-1)) {
      returnToRegularPhotos();
    }

    return;
  }
  if (activePhotoIndex <= 0) return;

  activePhotoIndex -= 1;

  if (sheetImage) {
    sheetImage.src = activePhotoUrls[activePhotoIndex];

    const nextPreload = activePhotoUrls[activePhotoIndex + 1];

    if (nextPreload) {
      const img = new Image();
      img.src = nextPreload;
    }
  }

 updatePhotoCounter();

  if (photoPrevBtn) photoPrevBtn.disabled = activePhotoIndex === 0;
  if (photoNextBtn) photoNextBtn.disabled = activePhotoIndex >= activePhotoUrls.length - 1;

  hidePhotoOverlayTemporarily();
});
function updatePhotoCounter() {
if (!sheetPhotoCount) return;

preloadPhotoWindow();
  const normalizeForMatch = (url) =>
    String(url || "")
      .replace(/[?&]class=[^&]+/g, "")
      .replace(/\?$/, "")
      .trim();
  let floorplanUrls = [];

  try {
    floorplanUrls = JSON.parse(
      activeCard?.dataset.floorplans || "[]"
    );
  } catch {
    floorplanUrls = [];
  }

  const currentUrl =
    activePhotoUrls[activePhotoIndex] || "";

  const normalizedCurrent =
    normalizeForMatch(currentUrl);

  const floorplanIndex =
    floorplanUrls.findIndex(
      (url) =>
        normalizeForMatch(url) ===
        normalizedCurrent
    );

  if (floorplanIndex >= 0) {
    sheetPhotoCount.textContent =
      `Floorplan ${floorplanIndex + 1} of ${floorplanUrls.length}`;

    if (sheetFloorplanBtn) {
      sheetFloorplanBtn.textContent = "Photos";
    }
  } else {
    sheetPhotoCount.textContent =
      `${activePhotoIndex + 1} / ${activePhotoUrls.length} photos`;

    if (sheetFloorplanBtn && floorplanUrls.length) {
      sheetFloorplanBtn.textContent =
        floorplanUrls.length > 1
          ? `Floorplans (${floorplanUrls.length})`
          : "Floorplan";
    }
  }
}
// property-brochure-download-handler
sheetBrochureBtn?.addEventListener("click", async () => {
  if (!activeCard || !sheetBrochureBtn) return;

  const originalHtml = sheetBrochureBtn.innerHTML;
  sheetBrochureBtn.disabled = true;
  sheetBrochureBtn.classList.add("is-building");
  sheetBrochureBtn.setAttribute("aria-busy", "true");
  sheetBrochureBtn.innerHTML = `
    <span>Building brochure</span>
    <span
      aria-hidden="true"
      style="display:inline-flex;align-items:center;gap:4px;min-width:24px;"
    >
      <i style="display:block;width:5px;height:5px;border-radius:999px;background:currentColor;"></i>
      <i style="display:block;width:5px;height:5px;border-radius:999px;background:currentColor;"></i>
      <i style="display:block;width:5px;height:5px;border-radius:999px;background:currentColor;"></i>
    </span>
  `;

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sheetBrochureBtn
      .querySelectorAll("i")
      .forEach((dot, index) => {
        dot.animate(
          [
            {
              transform: "translateY(0)",
              opacity: 0.4,
            },
            {
              transform: "translateY(-5px)",
              opacity: 1,
              offset: 0.35,
            },
            {
              transform: "translateY(0)",
              opacity: 0.4,
            },
          ],
          {
            duration: 800,
            delay: index * 120,
            iterations: Infinity,
            easing: "ease-in-out",
          }
        );
      });
  }

  const parseArray = (value) => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const listingId =
    activeCard.dataset.listingId ||
    activeCard.dataset.itemId ||
    activeCard.dataset.mls ||
    "";

  const listingCity =
    activeCard.dataset.city ||
    document.body.dataset.city ||
    "nanaimo";

  const listingType = String(activeCard.dataset.type || "homes").toLowerCase();
  const listingTypePath =
    listingType === "condo" ? "condos" :
    listingType === "townhouse" ? "townhomes" :
    listingType === "mobile" ? "mobile-homes" :
    listingType === "land" ? "land" :
    "homes";

  const listingUrl =
    `${window.location.origin}/${listingCity}/${listingTypePath}` +
    `?listing_id=${encodeURIComponent(listingId)}`;

  try {
    const response = await fetch("/api/property-brochure-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId:
          document.body.dataset.siteId ||
          document.querySelector("[data-site-id]")?.dataset.siteId ||
          "",
        accentColor:
          getComputedStyle(document.body)
            .getPropertyValue("--accent")
            .trim() ||
          getComputedStyle(document.documentElement)
            .getPropertyValue("--accent")
            .trim(),
        lat: activeCard.dataset.lat || "",
        lng: activeCard.dataset.lng || "",
        hostname: ["localhost", "127.0.0.1"].includes(window.location.hostname)
          ? "bc.realestate"
          : window.location.hostname,
        listingId,
        mls: activeCard.dataset.mls || listingId || "30166546",
        city: listingCity,
        area: activeCard.dataset.area || "",
        propertyType: activeCard.dataset.type || "Home",
        address: activeCard.dataset.address || "Featured property",
        price: activeCard.dataset.price || "",
        beds: activeCard.dataset.beds || "",
        baths: activeCard.dataset.baths || "",
        sqft: activeCard.dataset.sqft || "",
        year: activeCard.dataset.year || "",
        description: activeCard.dataset.description || "",
        images: (() => {
          const cardImages =
            getCardPhotoUrls(activeCard);

          if (cardImages.length) {
            return cardImages;
          }

          if (
            Array.isArray(activePhotoUrls) &&
            activePhotoUrls.length
          ) {
            return activePhotoUrls.filter(Boolean);
          }

          return sheetImage?.src
            ? [sheetImage.src]
            : [];
        })(),
        floorplans: parseArray(activeCard.dataset.floorplans),
        rooms: parseArray(activeCard.dataset.rooms),
        listingUrl,
      }),
    });

    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      throw new Error(failure.error || "Brochure creation failed");
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const addressSlug = String(activeCard.dataset.address || `mls-${listingId}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    link.href = downloadUrl;
    link.download = `${addressSlug || `mls-${listingId}`}-property-brochure.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  } catch (error) {
    console.error("Property brochure download failed:", error);
    window.alert(error?.message || "Could not build the property brochure.");
  } finally {
    sheetBrochureBtn.disabled = false;
    sheetBrochureBtn.classList.remove("is-building");
    sheetBrochureBtn.removeAttribute("aria-busy");
    sheetBrochureBtn.innerHTML = originalHtml;
  }
});

// floorplan-download-handler
sheetFloorplanDownloadBtn?.addEventListener("click", async () => {
  if (!activeCard || !sheetFloorplanDownloadBtn) return;

  const floorplans = getCurrentFloorplanUrls();
  if (!floorplans.length) return;

  const originalText = sheetFloorplanDownloadBtn.textContent;
  sheetFloorplanDownloadBtn.disabled = true;
  sheetFloorplanDownloadBtn.textContent = "Building PDF...";

  const listingId =
    activeCard.dataset.listingId ||
    activeCard.dataset.itemId ||
    activeCard.dataset.mls ||
    "";

  const listingCity =
    activeCard.dataset.city ||
    document.body.dataset.city ||
    "nanaimo";

  const listingType =
    String(activeCard.dataset.type || "house")
      .toLowerCase();

  const listingTypePath =
    listingType === "condo"
      ? "condos"
      : listingType === "townhouse" ||
        listingType === "townhome"
      ? "townhomes"
      : listingType === "mobile"
      ? "mobile-homes"
      : listingType === "land"
      ? "land"
      : "homes";

  const listingLink =
    `${window.location.origin}/${listingCity}/${listingTypePath}` +
    `?listing_id=${encodeURIComponent(listingId)}`;

  try {
    const response = await fetch("/api/floorplan-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floorplans,
        siteId:
          document.body.dataset.siteId ||
          document.querySelector("[data-site-id]")?.dataset.siteId ||
          "",
        lat: activeCard.dataset.lat || "",
        lng: activeCard.dataset.lng || "",
        hostname: ["localhost", "127.0.0.1"].includes(window.location.hostname)
          ? "bc.realestate"
          : window.location.hostname,
        city: activeCard.dataset.city || document.body.dataset.city || "",
        address: activeCard.dataset.address || "Property floorplan",
        price: activeCard.dataset.price || "",
        beds: activeCard.dataset.beds || "",
        baths: activeCard.dataset.baths || "",
        sqft: activeCard.dataset.sqft || "",
        mls: activeCard.dataset.mls || activeCard.dataset.listingId || "",
        listingUrl: new URL(listingLink, window.location.origin).href,
      }),
    });

    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      throw new Error(failure.error || "PDF creation failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const disposition = response.headers.get("content-disposition") || "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/i);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download =
      filenameMatch?.[1] ||
      "property-floorplans.pdf";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      60000
    );
  } catch (error) {
    console.error(error);
    window.alert(error instanceof Error ? error.message : "Could not create the PDF.");
  } finally {
    sheetFloorplanDownloadBtn.disabled = false;
    sheetFloorplanDownloadBtn.textContent = originalText || "Download PDF";
  }
});
function showActivePhoto() {
  if (!sheetImage || !activePhotoUrls.length) return;

  photoZoom = 1;
  pinchStartDistance = 0;
  photoPanX = 0;
  photoPanY = 0;

  sheetImage.style.transform =
    "translate(0px, 0px) scale(1)";
  sheetImage.style.transformOrigin =
    "center center";

  const targetSrc =
    activePhotoUrls[activePhotoIndex];

  const activeImageIsFloorplan =
    isFloorplanMode;

  sheetImage.classList.toggle(
    "is-floorplan",
    activeImageIsFloorplan
  );

  sheetImageStage?.classList.toggle(
    "is-floorplan",
    activeImageIsFloorplan
  );

  if (sheetFloorplanDownloadBtn) {
    sheetFloorplanDownloadBtn.hidden = !activeImageIsFloorplan;
    sheetFloorplanDownloadBtn.dataset.url =
      activeImageIsFloorplan ? targetSrc : "";

    const overlayStyle =
      sheetFloorplanDownloadBtn.style;

    overlayStyle.setProperty(
      "display",
      activeImageIsFloorplan ? "inline-flex" : "none",
      "important"
    );

    if (activeImageIsFloorplan) {
      sheetFloorplanDownloadBtn.textContent =
        "Download PDF";

      overlayStyle.setProperty(
        "position",
        "absolute",
        "important"
      );
      overlayStyle.setProperty(
        "top",
        "auto",
        "important"
      );
      overlayStyle.setProperty(
        "right",
        "18px",
        "important"
      );
      overlayStyle.setProperty(
        "bottom",
        "18px",
        "important"
      );
      overlayStyle.setProperty(
        "left",
        "auto",
        "important"
      );
      overlayStyle.setProperty(
        "z-index",
        "50",
        "important"
      );
      overlayStyle.setProperty(
        "width",
        "auto",
        "important"
      );
      overlayStyle.setProperty(
        "min-width",
        "126px",
        "important"
      );
      overlayStyle.setProperty(
        "height",
        "38px",
        "important"
      );
      overlayStyle.setProperty(
        "margin",
        "0",
        "important"
      );
      overlayStyle.setProperty(
        "padding",
        "0 15px",
        "important"
      );
      overlayStyle.setProperty(
        "transform",
        "none",
        "important"
      );
      overlayStyle.setProperty(
        "background",
        "rgba(255,255,255,.94)",
        "important"
      );
      overlayStyle.setProperty(
        "color",
        "#102331",
        "important"
      );
      overlayStyle.setProperty(
        "border",
        "1px solid rgba(15,35,49,.22)",
        "important"
      );
      overlayStyle.setProperty(
        "border-radius",
        "7px",
        "important"
      );
      overlayStyle.setProperty(
        "box-shadow",
        "0 5px 16px rgba(0,0,0,.16)",
        "important"
      );
      overlayStyle.setProperty(
        "align-items",
        "center",
        "important"
      );
      overlayStyle.setProperty(
        "justify-content",
        "center",
        "important"
      );
      overlayStyle.setProperty(
        "white-space",
        "nowrap",
        "important"
      );
    }
  }

  if (sheetImageStage) {
    // keep current photo visible while next photo loads
  }

  sheetImage.style.transition = "none";
  // keep current photo visible while next photo loads

  const revealTargetPhoto = () => {
  sheetImage.src = targetSrc;
  sheetImage.style.opacity = "1";

  if (sheetImageStage) {
    sheetImageStage.style.visibility = "visible";
  }
};

if (loadedImageUrls.has(targetSrc)) {
  revealTargetPhoto();
} else {
  const loader = new Image();
  loader.decoding = "async";

  loader.onload = async () => {
    try {
      await loader.decode();
    } catch {
      // Continue if explicit decoding is unavailable.
    }

    requestedImageUrls.add(targetSrc);
    loadedImageUrls.add(targetSrc);
    revealTargetPhoto();
  };

  loader.onerror = revealTargetPhoto;
  loader.src = targetSrc;
}

  updatePhotoCounter();
  renderFullscreenPhotoRail();

  if (photoPrevBtn) {
    photoPrevBtn.disabled = activePhotoIndex === 0;
  }

  if (photoNextBtn) {
    photoNextBtn.disabled =
      activePhotoIndex >= activePhotoUrls.length - 1;
  }
}
/* desktop-photo-overlay-v2 */
let desktopPhotoOverlay = null;
let desktopPhotoImage = null;
let desktopPhotoCount = null;
let desktopPhotoThumbs = null;

function closeDesktopPhotoOverlay() {
  if (!desktopPhotoOverlay) return;

  desktopPhotoOverlay.hidden = true;
  document.body.style.removeProperty("overflow");
}

function syncDesktopPhotoOverlay() {
  if (
    !desktopPhotoOverlay ||
    desktopPhotoOverlay.hidden ||
    !desktopPhotoImage
  ) return;

  const currentSource = sheetImage?.currentSrc || sheetImage?.src || "";

  if (currentSource) {
    desktopPhotoImage.src = currentSource;

    const backdrop = desktopPhotoOverlay?.querySelector(
      "[data-desktop-photo-backdrop]"
    );

    if (backdrop instanceof HTMLImageElement) {
      backdrop.src = currentSource;
    }
  }

  if (desktopPhotoCount) {
    desktopPhotoCount.textContent =
      `${activePhotoIndex + 1} / ${activePhotoUrls.length} photos`;
  }

  const previousButton = desktopPhotoOverlay.querySelector(
    '[data-desktop-photo-action="previous"]'
  );
  const nextButton = desktopPhotoOverlay.querySelector(
    '[data-desktop-photo-action="next"]'
  );

  [
    [previousButton, activePhotoIndex === 0],
    [nextButton, activePhotoIndex >= activePhotoUrls.length - 1],
  ].forEach(([button, disabled]) => {
    if (!(button instanceof HTMLButtonElement)) return;

    button.disabled = disabled;
    button.style.opacity = disabled ? ".28" : "1";
    button.style.cursor = disabled ? "default" : "pointer";
  });

  if (!desktopPhotoThumbs) return;

  desktopPhotoThumbs.replaceChildren();

  activePhotoUrls.forEach((url, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(
      "aria-label",
      `Show photo ${index + 1} of ${activePhotoUrls.length}`
    );
    button.style.cssText =
      "flex:0 0 124px;width:124px;height:88px;padding:0;overflow:hidden;" +
      "border:2px solid " + (index === activePhotoIndex ? "#fff" : "transparent") + ";" +
      "border-radius:7px;background:#101418;cursor:pointer;" +
      "opacity:" + (index === activePhotoIndex ? "1" : ".68") + ";";

    const thumb = document.createElement("img");
    thumb.src = url;
    thumb.alt = "";
    thumb.draggable = false;
    thumb.loading = "lazy";
    thumb.style.cssText =
      "display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;";

    thumb.addEventListener("error", () => {
      button.style.display = "none";
    });

    button.appendChild(thumb);

    button.addEventListener("click", () => {
      if (index === activePhotoIndex) return;

      activePhotoIndex = index;
      showActivePhoto();

      window.setTimeout(syncDesktopPhotoOverlay, 120);
    });

    desktopPhotoThumbs.appendChild(button);
  });

  desktopPhotoThumbs
    .querySelector("button:nth-child(" + (activePhotoIndex + 1) + ")")
    ?.scrollIntoView({ block: "nearest", inline: "center" });
}

function openDesktopPhotoOverlay() {
  if (!sheetImage || !activePhotoUrls.length) return;

  if (!desktopPhotoOverlay) {
    desktopPhotoOverlay = document.createElement("div");
    desktopPhotoOverlay.hidden = true;
    desktopPhotoOverlay.id = "desktop-photo-overlay";
    desktopPhotoOverlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;" +
      "align-items:center;justify-content:center;padding:22px 32px;" +
      "background:rgba(11,18,24,.48);backdrop-filter:blur(12px);" +
      "-webkit-backdrop-filter:blur(12px);";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "position:relative;display:grid;grid-template-rows:minmax(0,1fr) auto;" +
      "width:min(1500px,calc(100vw - 64px));height:min(920px,calc(100dvh - 44px));" +
      "overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:18px;" +
      "background:#06090c;box-shadow:0 28px 80px rgba(0,0,0,.52);";

    const backdrop = document.createElement("img");
    backdrop.alt = "";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.dataset.desktopPhotoBackdrop = "true";
    backdrop.style.cssText =
      "position:absolute;inset:0 0 108px;z-index:0;width:100%;height:calc(100% - 108px);" +
      "object-fit:cover;filter:blur(26px);transform:scale(1.08);opacity:.42;" +
      "pointer-events:none;";

    const image = document.createElement("img");
    image.alt = "Listing photo";
    image.style.cssText =
      "position:relative;z-index:1;display:block;width:100%;height:100%;min-height:0;" +
      "object-fit:contain;background:rgba(0,0,0,.18);";

    const count = document.createElement("div");
    count.style.cssText =
      "position:absolute;z-index:2;top:17px;left:19px;color:#fff;" +
      "font:700 12px system-ui,sans-serif;text-shadow:0 1px 3px #000;";

    const close = document.createElement("button");
    close.type = "button";
    close.innerHTML = "&times;";
    close.setAttribute("aria-label", "Return to listing");
    close.dataset.desktopPhotoAction = "close";
    close.style.cssText =
      "position:absolute;z-index:3;top:13px;right:14px;width:38px;height:38px;" +
      "border:1px solid rgba(255,255,255,.34);border-radius:10px;" +
      "background:rgba(8,12,16,.58);color:#fff;font-size:27px;line-height:1;cursor:pointer;";
    close.addEventListener("click", closeDesktopPhotoOverlay);

        /* photo-share-pills-v1 */
    const share = document.createElement("button");
    share.type = "button";
    share.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span data-photo-share-label>Share</span>';
    share.setAttribute("aria-label", "Share photo or listing");
    share.setAttribute("title", "Share photo or listing");
    share.dataset.desktopPhotoAction = "share";
    share.style.cssText =
      "position:absolute;z-index:3;top:13px;right:60px;min-width:88px;height:38px;" +
      "display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 11px;" +
      "border:1px solid rgba(255,255,255,.34);border-radius:10px;" +
      "background:rgba(8,12,16,.58);color:#fff;font:700 13px/1 system-ui,sans-serif;" +
      "white-space:nowrap;cursor:pointer;";
    share.querySelector("svg").style.cssText =
      "width:18px;height:18px;flex:0 0 auto;fill:none;stroke:currentColor;";
    share.addEventListener("click", shareActivePhoto);

    const previous = document.createElement("button");
    previous.type = "button";
    previous.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5 7 12l7.5 7.5"/></svg>';
    previous.setAttribute("aria-label", "Previous photo");
    previous.dataset.desktopPhotoAction = "previous";
    previous.style.cssText =
      "position:absolute;z-index:3;top:50%;left:20px;width:48px;height:66px;" +
      "display:grid;place-items:center;padding:0;" +
      "border:1px solid rgba(255,255,255,.34);border-radius:12px;" +
      "background:rgba(8,12,16,.64);color:#fff;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.22);" +
      "transform:translateY(-50%);cursor:pointer;";
    previous.querySelector("svg").style.cssText =
      "width:24px;height:24px;fill:none;stroke:currentColor;" +
      "stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round;";
    previous.addEventListener("click", () => {
      if (activePhotoIndex <= 0) return;

      activePhotoIndex -= 1;
      showActivePhoto();
      window.setTimeout(syncDesktopPhotoOverlay, 120);
    });

    const next = document.createElement("button");
    next.type = "button";
    next.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 4.5 7.5 7.5-7.5 7.5"/></svg>';
    next.setAttribute("aria-label", "Next photo");
    next.dataset.desktopPhotoAction = "next";
    next.style.cssText =
      "position:absolute;z-index:3;top:50%;right:20px;width:48px;height:66px;" +
      "display:grid;place-items:center;padding:0;" +
      "border:1px solid rgba(255,255,255,.34);border-radius:12px;" +
      "background:rgba(8,12,16,.64);color:#fff;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.22);" +
      "transform:translateY(-50%);cursor:pointer;";
    next.querySelector("svg").style.cssText =
      "width:24px;height:24px;fill:none;stroke:currentColor;" +
      "stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round;";
    next.addEventListener("click", () => {
      if (activePhotoIndex >= activePhotoUrls.length - 1) return;

      activePhotoIndex += 1;
      showActivePhoto();
      window.setTimeout(syncDesktopPhotoOverlay, 120);
    });

    const thumbs = document.createElement("div");
    thumbs.className = "desktop-photo-thumbs";
    thumbs.style.cursor = "grab";
    thumbs.style.userSelect = "none";

    let thumbDragPointerId = null;
    let thumbDragStartX = 0;
    let thumbDragStartLeft = 0;
    let thumbRailWasDragged = false;

    thumbs.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      thumbDragPointerId = event.pointerId;
      thumbDragStartX = event.clientX;
      thumbDragStartLeft = thumbs.scrollLeft;
      thumbRailWasDragged = false;
      thumbs.setPointerCapture?.(event.pointerId);
      thumbs.style.cursor = "grabbing";
    });

    thumbs.addEventListener("pointermove", (event) => {
      if (event.pointerId !== thumbDragPointerId) return;

      const distance = event.clientX - thumbDragStartX;

      if (Math.abs(distance) > 3) {
        thumbRailWasDragged = true;
        thumbs.scrollLeft = thumbDragStartLeft - distance;
      }
    });

    const finishThumbDrag = (event) => {
      if (event.pointerId !== thumbDragPointerId) return;

      const wasDragged = thumbRailWasDragged;

      thumbs.releasePointerCapture?.(event.pointerId);
      thumbDragPointerId = null;
      thumbs.style.cursor = "grab";
      thumbRailWasDragged = false;

      if (event.type !== "pointerup" || wasDragged) return;

      const target = document.elementFromPoint(
        event.clientX,
        event.clientY
      );

      const button = target?.closest(
        ".desktop-photo-thumbs button"
      );

      if (!button) return;

      const buttons = Array.from(
        thumbs.querySelectorAll("button")
      );

      const index = buttons.indexOf(button);

      if (index < 0 || index === activePhotoIndex) return;

      activePhotoIndex = index;
      showActivePhoto();
      window.setTimeout(syncDesktopPhotoOverlay, 120);
    };

    thumbs.addEventListener("pointerup", finishThumbDrag);
    thumbs.addEventListener("pointercancel", finishThumbDrag);

    thumbs.style.cssText =
      "display:flex;gap:8px;padding:10px 14px 12px;overflow-x:auto;" +
      "background:rgba(0,0,0,.86);scrollbar-color:#93a1aa transparent;";

    dialog.append(backdrop, count, close, share, previous, next, image, thumbs);
    desktopPhotoOverlay.appendChild(dialog);

    desktopPhotoOverlay.addEventListener("click", (event) => {
      const target =
        event.target instanceof Element ? event.target : null;

      const action =
        target?.closest("[data-desktop-photo-action]")
          ?.getAttribute("data-desktop-photo-action");

      if (action === "close") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDesktopPhotoOverlay();
        return;
      }

      if (event.target === desktopPhotoOverlay) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDesktopPhotoOverlay();
      }
    }, true);

    document.body.appendChild(desktopPhotoOverlay);

    desktopPhotoImage = image;
    desktopPhotoCount = count;
    desktopPhotoThumbs = thumbs;

    sheetImage.addEventListener("load", () => {
      window.setTimeout(syncDesktopPhotoOverlay, 0);
    });
  }

  desktopPhotoOverlay.hidden = false;
  desktopPhotoOverlay.style.setProperty("display", "flex", "important");
  document.body.style.setProperty("overflow", "hidden");
  syncDesktopPhotoOverlay();
}


listenModalDocument("keydown", (event) => {
  if (
    event.key === "Escape" &&
    desktopPhotoOverlay &&
    !desktopPhotoOverlay.hidden
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDesktopPhotoOverlay();
  }
}, true);
function openPhotoFullscreen() {
  if (window.matchMedia("(pointer: fine)").matches) {
    openDesktopPhotoOverlay();
    return;
  }

  ensureLandscapeFullscreen();
}

document
  .getElementById("landscape-expand-hint")
  ?.addEventListener("click", (event) => {
    event.stopPropagation();
    openPhotoFullscreen();
  });

sheetImage?.addEventListener("click", () => {
  if (!sheet?.classList.contains("open") || photoZoom > 1.02) return;

  if (window.matchMedia("(pointer: fine)").matches) {
    openPhotoFullscreen();
  } else {
    ensureLandscapeFullscreen();
  }
});

listenModalDocument("fullscreenchange", () => {
  if (!document.fullscreenElement && manualPhotoFullscreen) {
    manualPhotoFullscreen = false;
    updateLandscapeGalleryMode();
  }
});
sheetImage?.addEventListener("touchstart", (event) => {
  // Two fingers = start pinch zoom
  if (
    sheet.classList.contains("is-landscape-gallery") &&
    event.touches.length === 2
  ) {
    const a = event.touches[0];
    const b = event.touches[1];

    pinchStartDistance = Math.hypot(
      b.clientX - a.clientX,
      b.clientY - a.clientY
    );

    return;
  }

  // One finger = swipe start or pan start
  if (event.touches.length === 1) {
    const touch = event.touches[0];

    photoSwipeStartX = touch.screenX;
    photoSwipeStartY = touch.screenY;

    panStartX = touch.clientX;
    panStartY = touch.clientY;
  }

  hidePhotoOverlayTemporarily();
}, { passive: true });


sheetImage?.addEventListener("touchmove", (event) => {
  hidePhotoOverlayTemporarily();

  if (!sheet.classList.contains("is-landscape-gallery")) {
    return;
  }

  // Two fingers = pinch zoom
  if (
    event.touches.length === 2 &&
    pinchStartDistance
  ) {
    event.preventDefault();

    const a = event.touches[0];
    const b = event.touches[1];

    const currentDistance = Math.hypot(
      b.clientX - a.clientX,
      b.clientY - a.clientY
    );

    const scaleChange =
      currentDistance / pinchStartDistance;

    photoZoom = Math.max(
      1,
      Math.min(3, photoZoom * scaleChange)
    );

    if (photoZoom <= 1.02) {
      photoZoom = 1;
      photoPanX = 0;
      photoPanY = 0;
    }

    sheetImage.style.transform =
      `translate(${photoPanX}px, ${photoPanY}px) scale(${photoZoom})`;

    pinchStartDistance = currentDistance;
    return;
  }

  // One finger = pan when zoomed
  if (
    event.touches.length === 1 &&
    photoZoom > 1.02
  ) {
    event.preventDefault();

    const touch = event.touches[0];

    const dx = touch.clientX - panStartX;
    const dy = touch.clientY - panStartY;

    photoPanX += dx;
    photoPanY += dy;

    const maxPanX =
      (window.innerWidth * (photoZoom - 1)) / 2;

    const maxPanY =
      (window.innerHeight * (photoZoom - 1)) / 2;

    photoPanX = Math.max(
      -maxPanX,
      Math.min(maxPanX, photoPanX)
    );

    photoPanY = Math.max(
      -maxPanY,
      Math.min(maxPanY, photoPanY)
    );

    sheetImage.style.transform =
      `translate(${photoPanX}px, ${photoPanY}px) scale(${photoZoom})`;

    panStartX = touch.clientX;
    panStartY = touch.clientY;
  }
}, { passive: false });

sheetImage?.addEventListener("touchend", (event) => {
  // Coming out of a two-finger pinch with one finger
  // still touching: reset the pan anchor to that finger.
  if (
    photoZoom > 1.02 &&
    event.touches.length === 1
  ) {
    pinchStartDistance = 0;

    const remainingTouch = event.touches[0];

    panStartX = remainingTouch.clientX;
    panStartY = remainingTouch.clientY;

    return;
  }

  const wasPinching = pinchStartDistance > 0;

  pinchStartDistance = 0;

  // Both fingers released after a pinch.
  // Preserve the current zoom/pan and don't count
  // the release as a tap.
  if (
    photoZoom > 1.02 &&
    event.touches.length === 0 &&
    wasPinching
  ) {
    lastPhotoTapTime = 0;
    return;
  }

  const touch = event.changedTouches[0];
  if (!touch) return;

  const dx =
    touch.screenX - photoSwipeStartX;

  const dy =
    touch.screenY - photoSwipeStartY;

  const isTap =
    Math.abs(dx) < 12 &&
    Math.abs(dy) < 12;

  // Double tap while zoomed = reset to 100%
  if (
    sheet.classList.contains("is-landscape-gallery") &&
    photoZoom > 1.02 &&
    isTap
  ) {
    const now = Date.now();

    if (
      lastPhotoTapTime &&
      now - lastPhotoTapTime < 300
    ) {
      photoZoom = 1;

      photoPanX = 0;
      photoPanY = 0;

      panStartX = 0;
      panStartY = 0;

      sheetImage.style.transform =
        "translate(0px, 0px) scale(1)";

      sheetImage.style.transformOrigin =
        "center center";

      lastPhotoTapTime = 0;

      return;
    }

    lastPhotoTapTime = now;
    return;
  }

  // Any non-tap breaks the double-tap sequence.
  if (!isTap) {
    lastPhotoTapTime = 0;
  }

  // Don't change photos while zoomed.
  if (photoZoom > 1.02) {
    return;
  }

  if (
    Math.abs(dx) < 45 ||
    Math.abs(dx) < Math.abs(dy)
  ) {
    return;
  }

  if (dx < 0) {
  if (activePhotoIndex < activePhotoUrls.length - 1) {
    activePhotoIndex += 1;
    showActivePhoto();
    hidePhotoOverlayTemporarily();
  }
}

  if (dx > 0) {
  if (activePhotoIndex > 0) {
    activePhotoIndex -= 1;
    showActivePhoto();
    hidePhotoOverlayTemporarily();
  }
}
}, { passive: true });





      photoNextBtn?.addEventListener("click", (event) => {
  event.stopPropagation();

  const floorplanPosition =
    getActiveFloorplanPosition();

  if (floorplanPosition >= 0) {
    const floorplanCount =
      getCurrentFloorplanUrls().length;

    if (floorplanPosition < floorplanCount - 1) {
      goToFloorplanPosition(
        floorplanPosition + 1
      );
    } else if (!goToAdjacentRegularPhoto(1)) {
      returnToRegularPhotos();
    }

    return;
  }
  if (activePhotoIndex >= activePhotoUrls.length - 1) return;

  activePhotoIndex += 1;

  if (sheetImage) {
    sheetImage.src = activePhotoUrls[activePhotoIndex];
  }

 updatePhotoCounter();

  if (photoPrevBtn) photoPrevBtn.disabled = activePhotoIndex === 0;
  if (photoNextBtn) photoNextBtn.disabled = activePhotoIndex >= activePhotoUrls.length - 1;

  hidePhotoOverlayTemporarily();
});

        let sheetSwipeStartX = 0;
        let sheetSwipeStartY = 0;

       sheet?.addEventListener("touchstart", (event) => {
          if (event.target.closest(".panel__image-stage")) return;
          if (event.target.closest(".panel__mini-map")) return;

          sheetSwipeStartX = event.changedTouches[0].screenX;
          sheetSwipeStartY = event.changedTouches[0].screenY;
        }, { passive: true });

       sheet?.addEventListener("touchend", (event) => {
          if (event.target.closest(".panel__image-stage")) return;
          if (event.target.closest(".panel__mini-map")) return;

          const dx = event.changedTouches[0].screenX - sheetSwipeStartX;
          const dy = event.changedTouches[0].screenY - sheetSwipeStartY;

          if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;

          if (dx < 0) goNext();
          if (dx > 0) goPrev();
        }, { passive: true });
      }

   

     if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIntentReviewModal);
} else {
  initIntentReviewModal();
}
 document.addEventListener("astro:page-load", initIntentReviewModal);


;(()=>{if(window.__lookSearch||document.querySelector('script[src="/look-search.js"]'))return;const s=document.createElement('script');s.src='/look-search.js';s.defer=true;document.head.appendChild(s);})();



// Listing modal pills: tappable feature pills, style pill, and "More like this".
window.__lsStyleChip = (() => {
  const VIEW_OK = true;
  const cache = new Map();
  const PAGE = { 'Manufactured / mobile': 'mobile-homes', 'Condo / apartment': 'condos', 'Townhouse': 'townhomes' };
  const FEATURES = { 'waterfront': { waterfrontType: 'any' } };
  if (VIEW_OK) FEATURES['ocean views'] = { viewType: 'ocean' };

  const seg = () => location.pathname.split('/').filter(Boolean)[0] || '';
  const pagePath = (page) => {
    if (window.__lsPagePath) return window.__lsPagePath(page);
    for (const a of document.querySelectorAll('a[href]')) {
      try {
        const u = new URL(a.href, location.href);
        const p = u.pathname.replace(/\/+$/, '');
        if (u.origin === location.origin && p.endsWith('/' + page)) return p;
      } catch (e) {}
    }
    return (seg() ? '/' + seg() : '') + '/' + page;
  };
  const link = (page, params) => pagePath(page) + '?' + new URLSearchParams(params).toString();
  const cityKey = () =>
    document.querySelector('[data-city]')?.dataset.city ||
    pagePath('homes').split('/').filter(Boolean).slice(-2, -1)[0] ||
    seg() || 'nanaimo';

  // How many active listings match (null if the check fails).
  async function total(params) {
    const p = new URLSearchParams(params);
    p.set('city', cityKey());
    p.set('offset', '0');
    p.set('limit', '1');
    try {
      const r = await fetch('/api/home-listings?' + p.toString());
      if (!r.ok) return null;
      const d = await r.json();
      return Number(d.total || 0);
    } catch (e) { return null; }
  }

  function pill(text, href, cls, strong) {
    const a = document.createElement('a');
    a.className = 'panel__highlight-chip ' + cls;
    a.href = href;
    a.textContent = text;
    a.style.textDecoration = 'none';
    a.style.color = 'inherit';
    a.style.cursor = 'pointer';
    if (strong) { a.style.fontWeight = '600'; a.style.borderColor = 'currentColor'; }
    return a;
  }

  return async (el, id) => {
    if (!el) return;
    id = String(id || '').trim();
    el.dataset.lsStyleFor = id;
    el.querySelectorAll('.ls-home-style-chip').forEach((n) => n.remove());
    if (!id) return;

    let info = cache.get(id);
    if (info === undefined) {
      try {
        const r = await fetch('/api/listing-style?id=' + encodeURIComponent(id));
        info = r.ok ? await r.json() : {};
      } catch (e) { info = {}; }
      cache.set(id, info);
    }
    if (el.dataset.lsStyleFor !== id) return; // user moved to another listing meanwhile

    // Specific water type from MLS: lakefront / oceanfront / riverfront (else any waterfront).
    const wType = String(info.waterfrontType || '').toLowerCase();
    const waterParam = wType && wType !== 'waterfront' ? wType : 'any';
    const waterLabel = { oceanfront: 'Oceanfront', lakefront: 'Lakefront', riverfront: 'Riverfront' }[wType] || 'Waterfront';
    const waterLink = { waterfrontType: waterParam };

    // Water pill: prefer the city's intent page (e.g. /nanaimo/nanaimo-lakefront-homes, all types),
    // fall back to the filtered homes page if that page doesn't exist.
    const waterPill = (cls) => {
      const a = pill(waterLabel, link('homes', waterLink), cls, false);
      if (waterParam === 'any') return a;
      const dir = pagePath('homes').replace(/\/[^/]*$/, '');
      const intent = dir + '/' + String(cityKey()).toLowerCase().replace(/\s+/g, '-') + '-' + waterParam + '-homes';
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const label = a.textContent;
        a.textContent = 'Opening\u2026';
        let ok = false;
        try {
          const r = await fetch(intent);
          ok = r.ok && !(await r.text()).includes('This page has moved on');
        } catch (err) {}
        location.href = ok ? intent : a.href;
        setTimeout(() => { a.textContent = label; }, 4000);
      });
      return a;
    };

    // 1. Feature pills already shown (from the description) become filter links.
    const shown = new Set();
    el.querySelectorAll('span.panel__highlight-chip').forEach((span) => {
      const label = span.textContent.trim();
      const key = label.toLowerCase();
      const f = FEATURES[key];
      if (!f) return;
      shown.add(key);
      if (key === 'waterfront') span.replaceWith(waterPill('ls-feature-link'));
      else span.replaceWith(pill(label, link('homes', f), 'ls-feature-link', false));
    });

    const style = String(info.style || '');
    const useStyle = !!style && style !== 'Other';
    const water = shown.has('waterfront') || !!info.waterfront;
    const page = (useStyle && PAGE[style]) || 'homes';

    // MLS says waterfront but the description pills didn't: add the pill.
    if (water && !shown.has('waterfront')) {
      el.appendChild(waterPill('ls-home-style-chip'));
    }

    if (useStyle && water) {
      // 2. Style pill + combined "More like this" (falls back to waterfront-only if < 3 matches).
      el.appendChild(pill(style, link(page, { style }), 'ls-home-style-chip', false));
      const combo = { style, waterfrontType: waterParam };
      const more = pill('More like this \u2192', link(page, combo), 'ls-home-style-chip', true);
      more.addEventListener('click', async (e) => {
        e.preventDefault();
        const label = more.textContent;
        more.textContent = 'Finding\u2026';
        const n = await total(combo);
        location.href = n !== null && n < 3 ? link('homes', waterLink) : more.href;
        setTimeout(() => { more.textContent = label; }, 4000);
      });
      el.appendChild(more);
    } else if (useStyle) {
      // 3. Style only: one pill does both jobs.
      el.appendChild(pill(style + ' \u00b7 more like this \u2192', link(page, { style }), 'ls-home-style-chip', false));
    }

    el.hidden = el.children.length === 0;
  };
})();