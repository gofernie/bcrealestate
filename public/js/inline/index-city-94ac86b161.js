
  /* defer-home-area-counts-v1 */
  (() => {
    const city = String(
      document.querySelector(
        '#home-filter-form [name="city"]'
      )?.value ||
      document.querySelector("[data-city]")?.dataset.city ||
      "nanaimo"
    );

    const normalise = (value) =>
      String(value || "")
        .replace(/-/g, " ")
        .trim()
        .toLowerCase();

    const pointInRing = (point, ring) => {
      const [x, y] = point;
      let inside = false;

      for (
        let index = 0, previous = ring.length - 1;
        index < ring.length;
        previous = index++
      ) {
        const [xi, yi] = ring[index];
        const [xj, yj] = ring[previous];

        if (
          yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }

      return inside;
    };

    const containsPoint = (geojson, lat, lng) => {
      const geometry =
        geojson?.type === "Feature" ? geojson.geometry : geojson;

      if (!geometry || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return false;
      }

      const __bc = (window.__boundaryBoxCache ||= new WeakMap()); let __bb = __bc.get(geometry); if (!__bb) { __bb = [Infinity, Infinity, -Infinity, -Infinity]; const __scan = (n) => { if (typeof n?.[0] === "number") { if (n[0] < __bb[0]) __bb[0] = n[0]; if (n[1] < __bb[1]) __bb[1] = n[1]; if (n[0] > __bb[2]) __bb[2] = n[0]; if (n[1] > __bb[3]) __bb[3] = n[1]; } else if (Array.isArray(n)) n.forEach(__scan); }; __scan(geometry.coordinates); __bc.set(geometry, __bb); } if (lng < __bb[0] || lng > __bb[2] || lat < __bb[1] || lat > __bb[3]) return false; const point = [lng, lat];
      const polygons =
        geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.type === "MultiPolygon"
            ? geometry.coordinates
            : [];

      return polygons.some((polygon) =>
        polygon.some((ring) => pointInRing(point, ring))
      );
    };

    const hydrateCounts = async () => {
      const boundariesElement = document.getElementById(
        "home-area-boundaries-json"
      );

      if (!boundariesElement) return;

      let boundaries = [];

      try {
        boundaries = JSON.parse(boundariesElement.textContent || "[]");
      } catch {
        return;
      }

      if (!Array.isArray(boundaries) || !boundaries.length) return;

      try {
        const response = await fetch(
          `/api/home-listings?${new URLSearchParams({
            city,
            limit: "1",
          })}`
        );

        if (!response.ok) return;

        const payload = await response.json();
        const markers = Array.isArray(payload.markers)
          ? payload.markers
          : [];

        if (
          window.location.hostname
            .replace(/^www\./, "")
            .toLowerCase() === "nanaimomobiles.com"
        ) {
          return;
        }

        const resolvedCards = [];

        boundaries.forEach((boundary) => {
          const slug = normalise(boundary.slug);
          if (!slug) return;

          const count = markers.filter((marker) =>
            containsPoint(
              boundary.geometry,
              Number(marker.lat),
              Number(marker.lng)
            )
          ).length;

          resolvedCards.push({ slug, count });

          document
            .querySelectorAll("[data-area-option]")
            .forEach((option) => {
              const input = option.querySelector(
                'input[name="area"]'
              );

              if (
                input instanceof HTMLInputElement &&
                normalise(input.value) === slug
              ) {
                const countElement = option.querySelector(
                  ".area-multiselect__count"
                );

                if (countElement) {
                  countElement.textContent = String(count);
                }
              }
            });

          document
            .querySelectorAll(".site-nav__area-links a")
            .forEach((link) => {
              const label = link.querySelector(
                ".site-nav__area-label"
              );

              if (normalise(label?.textContent) !== slug) return;

              const countElement = link.querySelector(
                ".site-nav__area-count"
              );

              if (countElement) {
                countElement.textContent = `${count} listings`;
                countElement.classList.toggle(
                  "is-zero",
                  count === 0
                );
              }
            });
        });

        const neighbourhoodGrid = document.querySelector(
          "[data-home-neighbourhood-grid]"
        );
        const allAreasCard = neighbourhoodGrid?.querySelector(
          ".locus-home-neighbourhood-card--all"
        );

        if (neighbourhoodGrid && allAreasCard) {
          neighbourhoodGrid
            .querySelectorAll(
              ".locus-home-neighbourhood-card:not(.locus-home-neighbourhood-card--all)"
            )
            .forEach((card) => card.remove());

          resolvedCards
            .filter((card) => card.count > 0)
            .sort(
              (a, b) =>
                b.count - a.count || a.slug.localeCompare(b.slug)
            )
            .slice(0, 10)
            .forEach((card) => {
              const link = document.createElement("a");
              link.className = "locus-home-neighbourhood-card";
              link.href = `/${city}/${card.slug.replace(/\s+/g, "-")}`;

              const title = document.createElement("strong");
              title.textContent = card.slug
                .replace(/-/g, " ")
                .replace(/\b\w/g, (letter) => letter.toUpperCase())
                .replace(/^Pq\s+/i, "");

              const count = document.createElement("span");
              count.textContent = `${card.count} ${
                card.count === 1 ? "listing" : "listings"
              }`;

              const arrow = document.createElement("b");
              arrow.setAttribute("aria-hidden", "true");
              arrow.textContent = "\u2192";

              link.append(title, count, arrow);
              neighbourhoodGrid.insertBefore(link, allAreasCard);
            });
        }
      } catch {
        // Counts arrive after paint; search remains fully usable.
      }
    };

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(hydrateCounts, {
          timeout: 1200,
        });
      } else {
        window.setTimeout(hydrateCounts, 250);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", schedule, {
        once: true,
      });
    } else {
      schedule();
    }
  })();
