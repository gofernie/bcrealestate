
  /* expansion-inline-maps-v1 */
  (() => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const loadExpansionLeaflet = () =>
      new Promise((resolve, reject) => {
        if (window.L) {
          resolve(window.L);
          return;
        }

        if (!document.getElementById("expansion-leaflet-css")) {
          const css = document.createElement("link");
          css.id = "expansion-leaflet-css";
          css.rel = "stylesheet";
          css.href =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(css);
        }

        const existing = document.querySelector(
          "script[data-expansion-leaflet]"
        );

        if (existing) {
          existing.addEventListener(
            "load",
            () => resolve(window.L),
            { once: true }
          );
          existing.addEventListener(
            "error",
            () => reject(new Error("Map failed to load.")),
            { once: true }
          );
          return;
        }

        const script = document.createElement("script");
        script.dataset.expansionLeaflet = "true";
        script.src =
          "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve(window.L);
        script.onerror = () =>
          reject(new Error("Map failed to load."));
        document.head.appendChild(script);
      });

    document.addEventListener(
      "click",
      async (event) => {
        const button =
          event.target instanceof Element
            ? event.target.closest("[data-expansion-map]")
            : null;

        if (!(button instanceof HTMLButtonElement)) return;

        // Prevent the earlier handler from opening the main map tab.
        event.preventDefault();
        event.stopImmediatePropagation();

        const divider = button.closest(
          ".home-results-expansion-divider"
        );

        if (!(divider instanceof HTMLElement)) return;

        const expansionId = divider.dataset.expansionId || "";
        const markers =
          window.__homeExpansionMarkers?.[expansionId] || [];

        let mapElement = divider.nextElementSibling;

        if (
          !(
            mapElement instanceof HTMLElement &&
            mapElement.matches("[data-expansion-map-canvas]")
          )
        ) {
          mapElement = document.createElement("div");
          mapElement.className = "home-results-expansion-map";
          mapElement.dataset.expansionMapCanvas = expansionId;
          divider.insertAdjacentElement("afterend", mapElement);
        }

        if (!mapElement.hidden && mapElement.__leafletMap) {
          mapElement.hidden = true;
          button.textContent = "Map these";
          return;
        }

        mapElement.hidden = false;
        button.textContent = "Hide map";

        if (!Array.isArray(markers) || !markers.length) {
          mapElement.innerHTML =
            "<p>No map locations are available for these new matches.</p>";
          return;
        }

        try {
          const L = await loadExpansionLeaflet();

          if (!mapElement.__leafletMap) {
            const map = L.map(mapElement, {
              zoomControl: true,
              attributionControl: false,
              scrollWheelZoom: false,
            });

            L.tileLayer(window.__JAWG_TILE_URL__, {
              maxZoom: 19,
              attribution: window.__JAWG_ATTRIBUTION__,
            }).addTo(map);

            mapElement.__leafletMap = map;
          }

          const map = mapElement.__leafletMap;

          if (mapElement.__markerLayer) {
            map.removeLayer(mapElement.__markerLayer);
          }

          const layer = L.layerGroup().addTo(map);
          mapElement.__markerLayer = layer;

          const bounds = [];

          markers.forEach((listing) => {
            const lat = Number(listing?.lat || 0);
            const lng = Number(listing?.lng || 0);

            if (!lat || !lng) return;

            const marker = L.circleMarker([lat, lng], {
              radius: 8,
              color: "#ffffff",
              weight: 3,
              fillColor:
                getComputedStyle(document.documentElement)
                  .getPropertyValue("--accent")
                  .trim() || "#633a98",
              fillOpacity: 1,
            }).addTo(layer);

            const address = escapeHtml(
              listing?.address || "Listing location"
            );
            const price = escapeHtml(
              listing?.price || "Price on request"
            );

            marker.bindPopup(
              `<strong>${price}</strong><br>${address}`
            );

            bounds.push([lat, lng]);
          });

          if (bounds.length === 1) {
            map.setView(bounds[0], 14);
          } else if (bounds.length > 1) {
            map.fitBounds(bounds, {
              padding: [30, 30],
              maxZoom: 14,
            });
          }

          window.setTimeout(() => map.invalidateSize(), 50);
        } catch {
          mapElement.innerHTML =
            "<p>The map could not be loaded. Please try again.</p>";
        }
      },
      true
    );
  })();
