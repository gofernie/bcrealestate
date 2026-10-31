
  const listViewBtn = document.getElementById("list-view-btn");
  const mapViewBtn = document.getElementById("map-view-btn");
  const intentMapEl = document.getElementById("intent-map");
  const gridEl = document.querySelector(".grid");

  let leafletMap = null;
  let leafletMarkerLayer = null;
  let leafletMarkers = [];
  let mapRenderVersion = 0;
  window.currentHomeMapListings = [];


  function loadMapScript(src, ready) {
    if (ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);

      if (existing) {
        const wait = setInterval(() => {
          if (ready()) {
            clearInterval(wait);
            resolve();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(wait);
          if (ready()) resolve();
          else reject(new Error(`Map script failed to initialize: ${src}`));
        }, 10000);

        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadMapStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  async function loadLeaflet() {
    const leafletCss =
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

    const clusterCss =
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";

    const clusterDefaultCss =
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";

    loadMapStylesheet(leafletCss);
loadMapStylesheet(clusterCss);
    loadMapStylesheet(clusterDefaultCss);

    await loadMapScript(
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      () => Boolean(window.L)
    );
await loadMapScript(
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
      () => Boolean(window.L?.markerClusterGroup)
    );
  }

  async function initIntentGoogleMap() {
    if (!intentMapEl) return;
    const thisRenderVersion = ++mapRenderVersion;

    let mapListings = Array.isArray(window.currentHomeMapListings)
      ? window.currentHomeMapListings
      : [];
    const hasActiveFilters = (() => {
      const form = document.getElementById("home-filter-form");
      if (!form) return false;
      return (form.elements.area?.value || "") !== "" ||
             (form.elements.storyAreas?.value || "") !== "" ||
             (form.elements.type?.value || "") !== "" ||
             (form.elements.maxPrice?.value || "") !== "" ||
             (form.elements.beds?.value || "") !== "" ||
      (form.elements.baths?.value || "") !== "" ||
             // waterfront-map-active-filter-v1
      Boolean(
        new URLSearchParams(
          window.location.search
        ).get("waterfrontType")
      ) ||
      Array.from(
        document.querySelectorAll(
          "#homepage-refine-panel [data-refine].active"
        )
      ).length > 0;
    })();

    // Keep the initial document light. The full marker collection is only
    // requested when someone explicitly opens the map.
    if (!hasActiveFilters && !mapListings.length) {
      try {
        const form = document.getElementById("home-filter-form");
        const params = new URLSearchParams(window.location.search);
        const cityValue = String(form?.elements?.city?.value || "").trim();
        const sortValue = String(form?.elements?.sort?.value || "newest").trim();

        if (cityValue) params.set("city", cityValue);
        params.set("offset", "0");
        params.set("limit", "1");
        params.set("sort", sortValue || "newest");

        const response = await fetch(
          `/api/home-listings?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Map request failed (${response.status})`);
        }

        const payload = await response.json();
        mapListings = Array.isArray(payload.markers)
          ? payload.markers
          : [];
        window.currentHomeMapListings = mapListings;
      } catch (error) {
        console.warn("Could not load initial map markers:", error);
      }
    }

    if (hasActiveFilters && !mapListings.length) {
      // Only show markers for cards matching current filters (ignore hidden/pagination)
      mapListings = Array.from(document.querySelectorAll(".grid .card")).map((card) => ({
        lat: card.dataset.lat,
        lng: card.dataset.lng,
        price: card.dataset.price,
        address: card.dataset.address,
        id: card.dataset.listingId,
        image: card.dataset.image,
        beds: card.dataset.beds,
        baths: card.dataset.baths,
        id: card.dataset.listingId,
        image: card.dataset.image,
        beds: card.dataset.beds,
        baths: card.dataset.baths,
        _hidden: card.hidden,
      })).filter((l) => l.lat && l.lng && !l._hidden);
      // But we want ALL matching cards, not just the paginated 8   unhide logic runs separately
      // so read all cards and check filter match directly
      const form = document.getElementById("home-filter-form");
      const areaVal = String(form?.elements?.area?.value || "").trim().toLowerCase();
      const typeVal = String(form?.elements?.type?.value || "").trim().toLowerCase();
const rawPriceSelection =
  String(form?.elements?.maxPrice?.value || "");

const overPriceMatch =
  rawPriceSelection.match(/^over-(\d+)$/);

const rawMinPriceVal = overPriceMatch
  ? Number(overPriceMatch[1])
  : Number(form?.elements?.minPrice?.value || 0);

const rawMaxPriceVal = overPriceMatch
  ? 0
  : Number(rawPriceSelection || 0);
const storyMaxPriceVal = Number(form?.elements?.storyMaxPrice?.value || 0);

const minPriceVal = storyMaxPriceVal
  ? Math.round(storyMaxPriceVal * 1000 * 0.85)
  : rawMinPriceVal * 1000;

const maxPriceVal = storyMaxPriceVal
  ? Math.round(storyMaxPriceVal * 1000 * 1.15)
  : rawMaxPriceVal * 1000;
      const bedsVal = Number(form?.elements?.beds?.value || 0);
      mapListings = Array.from(document.querySelectorAll(".grid .card"))
        .filter((card) => {
          const cardArea = String(card.dataset.area || "").toLowerCase();
          const cardType = String(card.dataset.type || "").toLowerCase();
          const cardPrice = Number(card.dataset.rawPrice || 0);
          const cardBeds = Number(card.dataset.beds || 0);
          const cardDesc = String(card.dataset.description || "").toLowerCase();
const cardViewType = String(card.dataset.viewType || "").toLowerCase();
const cardWaterfront = String(card.dataset.waterfront || "").toLowerCase();
          return (!areaVal || cardArea.includes(areaVal)) &&
                 (!typeVal || cardType === typeVal) &&
                 (!minPriceVal || cardPrice >= minPriceVal) &&
(!maxPriceVal || cardPrice <= maxPriceVal) &&
                 (!bedsVal || cardBeds >= bedsVal);
        })
        .map((card) => ({
          lat: card.dataset.lat,
          lng: card.dataset.lng,
          price: card.dataset.price,
          address: card.dataset.address,
        id: card.dataset.listingId,
        image: card.dataset.image,
        beds: card.dataset.beds,
        baths: card.dataset.baths,
          id: card.dataset.listingId,
          image: card.dataset.image,
          beds: card.dataset.beds,
          baths: card.dataset.baths,
        }))
        .filter((l) => l.lat && l.lng);

      // Keep map markers exactly synchronized with filtered results.
      mapListings = Array.from(
        document.querySelectorAll(".grid .card")
      )
        .filter((card) =>
          card.dataset.matchesFilters === "true"
        )
        .map((card) => ({
          lat: card.dataset.lat,
          lng: card.dataset.lng,
          price: card.dataset.price,
          address: card.dataset.address,
          id: card.dataset.listingId,
          image: card.dataset.image,
          beds: card.dataset.beds,
          baths: card.dataset.baths,
        }))
        .filter((listing) =>
          listing.lat && listing.lng
        );
    }

    if (!mapListings.length) {
      mapListings = Array.from(document.querySelectorAll(".grid .card")).map((card) => ({
        lat: card.dataset.lat,
        lng: card.dataset.lng,
        price: card.dataset.price,
        address: card.dataset.address,
        id: card.dataset.listingId,
        image: card.dataset.image,
        beds: card.dataset.beds,
        baths: card.dataset.baths,
        id: card.dataset.listingId,
        image: card.dataset.image,
        beds: card.dataset.beds,
        baths: card.dataset.baths,
      })).filter((l) => l.lat && l.lng);
    }

    const points = mapListings
      .map((l) => ({ listing: l, lat: Number(l.lat || 0), lng: Number(l.lng || 0) }))
      .filter((p) => p.lat && p.lng);

    if (!points.length) {
      if (leafletMarkerLayer) {
        leafletMarkerLayer.clearLayers();
      }

      leafletMarkers = [];

      if (!leafletMap) {
        intentMapEl.innerHTML =
          "<p style='padding:16px;color:#6b6560;'>No map locations available.</p>";
      }

      return;
    }

    await loadLeaflet();
    if (thisRenderVersion !== mapRenderVersion) {
      return;
    }

    if (!leafletMap) {
      leafletMap = L.map(intentMapEl, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer(window.__JAWG_TILE_URL__, { maxZoom: 19, attribution: window.__JAWG_ATTRIBUTION__ }).addTo(leafletMap);
}


    const shouldCluster = points.length > 120;

    if (
      !leafletMarkerLayer ||
      Boolean(leafletMarkerLayer.__homeUsesClusters) !== shouldCluster
    ) {
      if (leafletMarkerLayer) {
        leafletMap.removeLayer(leafletMarkerLayer);
      }

      if (shouldCluster) {
        leafletMarkerLayer = L.markerClusterGroup({
          maxClusterRadius: 44,
          disableClusteringAtZoom: 15,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          zoomToBoundsOnClick: true,
          removeOutsideVisibleBounds: true,

          iconCreateFunction(cluster) {
            const count = cluster.getChildCount();
            const size =
              count >= 100 ? 48 :
              count >= 25 ? 43 :
              38;

            return L.divIcon({
              className: "",
              iconSize: [size, size],
              html: `
                <div style="
                  width:${size}px;
                  height:${size}px;
                  display:grid;
                  place-items:center;
                  border:4px solid #fff;
                  border-radius:50%;
                  background:color-mix(in srgb, var(--accent, #633a98) 78%, white);
                  color:#fff;
                  box-shadow:0 3px 10px rgba(55,31,82,.28);
                  font:800 12px/1 'DM Sans',system-ui,sans-serif;
                ">
                  ${count}
                </div>
              `,
            });
          },
        });
      } else {
        leafletMarkerLayer = L.layerGroup();
      }

      leafletMarkerLayer.__homeUsesClusters =
        shouldCluster;

      leafletMarkerLayer.addTo(leafletMap);
    }

    leafletMarkerLayer.clearLayers();
    leafletMarkers = [];

    const accentColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || "#633a98";

    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:20px;
          height:20px;
          display:grid;
          place-items:center;
          border:4px solid #fff;
          border-radius:50%;
          background:color-mix(in srgb, var(--accent, #633a98) 78%, white);
          box-shadow:0 2px 7px rgba(55,31,82,.32);
        ">
          <span style="
            width:5px;
            height:5px;
            border-radius:50%;
            background:#fff;
          "></span>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -8],
    });
    const escapePopupHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const latlngs = [];
    points.forEach(({ listing, lat, lng }) => {
      const marker = L.marker([lat, lng], { icon });
      leafletMarkerLayer.addLayer(marker);      const popupImage = escapePopupHtml(listing.image || "");
      const popupPrice = escapePopupHtml(listing.price || "Price on request");
      const popupAddress = escapePopupHtml(listing.address || "Address available");
      const popupBeds = escapePopupHtml(listing.beds || "-");
      const popupBaths = escapePopupHtml(listing.baths || "-");
      const popupId = escapePopupHtml(listing.id || "");

      marker.bindPopup(
        `
          <article style="
            width:240px;
            overflow:hidden;
            border-radius:9px;
            background:#fff;
            font-family:'DM Sans',system-ui,sans-serif;
          ">
            ${
              popupImage
                ? `<img
                    src="${popupImage}"
                    alt="${popupAddress}"
                    style="
                      display:block;
                      width:100%;
                      height:132px;
                      object-fit:cover;
                    "
                  />`
                : ""
            }

            <div style="padding:10px 12px 12px;">
              <strong style="
                display:block;
                margin-bottom:4px;
                color:#102b40;
                font-size:16px;
              ">${popupPrice}</strong>

              <div style="
                margin-bottom:5px;
                color:#655f59;
                font-size:12px;
                line-height:1.35;
              ">${popupAddress}</div>

              <div style="
                margin-bottom:9px;
                color:#817a73;
                font-size:12px;
              ">${popupBeds} bd &nbsp;|&nbsp; ${popupBaths} ba</div>

              <button
                type="button"
                data-map-listing-id="${popupId}"
                style="
                  border:0;
                  border-radius:7px;
                  padding:8px 12px;
                  background:var(--accent, #633a98);
                  color:#fff;
                  font:700 12px/1 'DM Sans',system-ui,sans-serif;
                  cursor:pointer;
                "
              >
                View listing
              </button>
            </div>
          </article>
        `,
        {
          closeButton: false,
          className: "locus-listing-popup",
          maxWidth: 260,
          minWidth: 240,
          offset: [0, -8],
        }
      );

      marker.on("popupopen", (event) => {
        const button = event.popup
          .getElement()
          ?.querySelector("[data-map-listing-id]");

        button?.addEventListener("click", async () => {
          const id = String(button.dataset.mapListingId || "");
          let cards = Array.from(document.querySelectorAll(".grid .card"));
          let card = cards.find(
            (candidate) => String(candidate.dataset.listingId || "") === id
          );
          if (!card && typeof window.ensureHomeListingCard === "function") {
            card = await window.ensureHomeListingCard(id);
          }
          if (
            card &&
            typeof window.openSheet === "function"
          ) {
            leafletMap?.closePopup();
            window.openSheet(card);
          }
        });
      });
      leafletMarkers.push(marker);
      latlngs.push([lat, lng]);
    });
    // home-selected-area-overlay-safe-v3
    // This runs after markers are made, so it cannot interrupt them.
    try {
      const boundaryData = document.getElementById(
        "home-area-boundaries-json"
      );

      const normaliseArea = (value) =>
        String(value || "")
          .replace(/-/g, " ")
          .toLowerCase()
          .trim();

      const mapForm = document.getElementById("home-filter-form");
      const selectedAreas = [
        ...String(mapForm?.elements?.storyAreas?.value || "")
          .split("|")
          .map(normaliseArea)
          .filter(Boolean),
        normaliseArea(mapForm?.elements?.area?.value || ""),
      ].filter(Boolean);

      window.__homeSelectedAreaLayer?.remove();
      window.__homeAreaGlowLayer?.remove();
      window.__homeSelectedAreaLayer = null;
      window.__homeAreaGlowLayer = null;

      if (boundaryData && selectedAreas.length) {
        const boundaries = JSON.parse(boundaryData.textContent || "[]");

        const features = (Array.isArray(boundaries) ? boundaries : [])
          .filter((boundary) =>
            selectedAreas.includes(normaliseArea(boundary.slug))
          )
          .map((boundary) => ({
            type: "Feature",
            properties: { slug: boundary.slug },
            geometry:
              boundary.geometry?.type === "Feature"
                ? boundary.geometry.geometry
                : boundary.geometry,
          }))
          .filter((feature) => feature.geometry);

        if (features.length) {
          const collection = {
            type: "FeatureCollection",
            features,
          };

          const accent =
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent")
              .trim() || "#1f78b4";

          if (
            Number(window.__homeAreaBufferKm || 0) > 0
          ) {
            // home-true-1km-buffer-v2
            // Build one smooth geographic buffer, rather than overlapping circles.
            const getTurf = () => {
              if (window.turf?.buffer) {
                return Promise.resolve(window.turf);
              }

              return new Promise((resolve, reject) => {
                const existing = document.querySelector(
                  'script[data-home-turf-buffer]'
                );

                if (existing) {
                  existing.addEventListener(
                    "load",
                    () => resolve(window.turf),
                    { once: true }
                  );
                  existing.addEventListener(
                    "error",
                    () => reject(new Error("Turf failed to load.")),
                    { once: true }
                  );
                  return;
                }

                const script = document.createElement("script");
                script.src =
                  "https://cdn.jsdelivr.net/npm/@turf/turf@7.3.5/turf.min.js";
                script.dataset.homeTurfBuffer = "true";
                script.onload = () => resolve(window.turf);
                script.onerror = () =>
                  reject(new Error("Turf failed to load."));
                document.head.appendChild(script);
              });
            };

            try {
              const turf = await getTurf();
              const oneKilometreBuffer = turf.buffer(collection, 1, {
                units: "kilometers",
                steps: 24,
              });

              window.__homeAreaGlowLayer = L.geoJSON(
                oneKilometreBuffer,
                {
                  interactive: false,
                  style: {
                    color: accent,
                    weight: 2,
                    opacity: 0.35,
                    dashArray: "5 7",
                    fillColor: accent,
                    fillOpacity: 0.11,
                  },
                }
              ).addTo(leafletMap);
            } catch (error) {
              console.warn(
                "Could not draw the 1 km nearby-search buffer:",
                error
              );
            }
          }
          window.__homeSelectedAreaLayer = L.geoJSON(collection, {
            interactive: false,
            style: {
              color: accent,
              weight: 3,
              opacity: 0.95,
              fillColor: accent,
              fillOpacity: 0.04,
            },
          }).addTo(leafletMap);
        }
      }
    } catch (error) {
      console.warn("Could not draw selected-area overlay:", error);
    }

    if (latlngs.length) leafletMap.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    setTimeout(() => leafletMap.invalidateSize(), 100);
  }

  window.initIntentGoogleMap = initIntentGoogleMap;

  listViewBtn?.addEventListener("click", () => {
    if (intentMapEl) intentMapEl.hidden = true;
    gridEl?.classList.remove("map-hidden");

    listViewBtn.classList.add("active");
    mapViewBtn?.classList.remove("active");
  });

  mapViewBtn?.addEventListener("click", () => {
    if (intentMapEl) intentMapEl.hidden = false;
    gridEl?.classList.add("map-hidden");

    mapViewBtn.classList.add("active");
    listViewBtn?.classList.remove("active");

    requestAnimationFrame(() => {
      initIntentGoogleMap();
    });
  });
