
  /* desktop-nearby-layer-buttons-v1 */
  (() => {
    const mount = () => {
      const toolbar = document.querySelector(".area-map-toolbar--overlay");
      const hideListings = document.getElementById("toggle-listings-btn");

      if (!toolbar || !hideListings || toolbar.querySelector(".map-nearby-buttons")) {
        return;
      }

      const buttons = document.createElement("div");
      buttons.className = "map-nearby-buttons";
      buttons.setAttribute("aria-label", "Nearby places");

      const activeAmenity =
        document.querySelector(".area-flow__nearby-choice.active")
          ?.getAttribute("data-amenity") || "schools";

      [
        ["schools", "Schools"],
        ["restaurants", "Food & cafés"],
        ["grocery", "Grocery"],
        ["parks", "Parks"],
        ["medical", "Medical"],
      ].forEach(([amenity, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.amenity = amenity;
        button.classList.toggle("is-active", amenity === activeAmenity);

        button.addEventListener("click", () => {
          // Use the real amenity chip: it owns the list and map refresh.
          const nativeAmenityChip = document.querySelector(
            `.amenity-chip[data-amenity="${amenity}"]:not(#toggle-listings-btn)`
          );

          if (nativeAmenityChip instanceof HTMLElement) {
            nativeAmenityChip.click();
          } else if (typeof loadAreaAmenities === "function") {
            loadAreaAmenities(amenity);
          }

          buttons.querySelectorAll("button").forEach((item) => {
            item.classList.toggle(
              "is-active",
              item.dataset.amenity === amenity
            );
          });
        });

        buttons.appendChild(button);
      });

      toolbar.insertBefore(buttons, hideListings);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  })();
