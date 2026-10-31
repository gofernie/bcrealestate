
  (() => {
    const select =
      document.querySelector(".area-filter-select");

    if (!(select instanceof HTMLSelectElement)) return;

    select.hidden = true;

    const wrapper = document.createElement("div");
    wrapper.className = "type-area-multi";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "type-area-multi__trigger";
    trigger.setAttribute("aria-expanded", "false");

    const fieldLabel = document.createElement("span");
    fieldLabel.className = "type-area-multi__label";
    fieldLabel.textContent = "Area";

    const value = document.createElement("span");
    value.className = "type-area-multi__value";

    const chevron = document.createElement("span");
    chevron.style.gridArea = "arrow";
    chevron.textContent = "\u2304";
    chevron.setAttribute("aria-hidden", "true");

    trigger.append(fieldLabel, value, chevron);

    const menu = document.createElement("div");
    menu.className = "type-area-multi__menu";
    menu.hidden = true;

    const head = document.createElement("div");
    head.className = "type-area-multi__head";

    const title = document.createElement("strong");
    title.textContent = "Choose one or more areas";

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "type-area-multi__option type-area-multi__all";
    const clearLabel = document.createElement("span");
    clearLabel.textContent = "All neighbourhoods";
    const clearCheck = document.createElement("span");
    clearCheck.className = "type-area-multi__check";
    clear.append(clearLabel, clearCheck);

    head.append(title);


    const optionsList = document.createElement("div");
    optionsList.className = "type-area-multi__options";
    menu.appendChild(optionsList);
    optionsList.appendChild(clear);

    const footer = document.createElement("div");
    footer.className = "type-area-multi__footer";

    const done = document.createElement("button");
    done.type = "button";
    done.className = "type-area-multi__done";
    done.textContent = "Done";

    footer.appendChild(done);

    // The custom menu supports several neighbourhoods; keep the hidden
    // native select in the same multi-select mode.
    select.multiple = true;

    const areaOptions = Array.from(select.options)
      .filter((option) => option.value !== "all");

    const sortSelectedAreasFirst = () => {
      const buttons = Array.from(
        menu.querySelectorAll(".type-area-multi__option[data-value]")
      );

      buttons
        .sort((a, b) => {
          const aOption = areaOptions.find(
            (option) => option.value === a.dataset.value
          );

          const bOption = areaOptions.find(
            (option) => option.value === b.dataset.value
          );

          // Keep the buyer's current choices immediately visible whenever
          // this multi-select reopens. Sort the remaining choices by their
          // available-listing count as before.
          const selectedDifference =
            Number(Boolean(bOption?.selected)) -
            Number(Boolean(aOption?.selected));

          if (selectedDifference) return selectedDifference;

          return String(aOption?.textContent || "").localeCompare(
            String(bOption?.textContent || "")
          );
        })
        .forEach((button) => {
          optionsList.appendChild(button);
          optionsList.prepend(clear);
        });
    };
    const sync = () => {
      const selected = areaOptions.filter(
        (option) => option.selected
      );

      value.textContent =
        selected.length === 0
          ? "All Neighbourhoods"
          : selected.length === 1
            ? selected[0].textContent
            : `${selected.length} areas`;

      wrapper.classList.toggle(
        "is-all-selected",
        selected.length === areaOptions.length && areaOptions.length > 0
      );

      clear.classList.toggle("is-selected", selected.length === 0);
      clearCheck.textContent = selected.length === 0 ? "\u2713" : "";

      menu
        .querySelectorAll(".type-area-multi__option[data-value]")
        .forEach((button) => {
          const option = areaOptions.find(
            (item) => item.value === button.dataset.value
          );

          const isSelected = Boolean(option?.selected);

          button.classList.toggle(
            "is-selected",
            isSelected
          );

          button.querySelector(
            ".type-area-multi__check"
          ).textContent = isSelected ? "\u2713" : "";
        });
    };

    areaOptions.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "type-area-multi__option";
      button.dataset.value = option.value;

      const label = document.createElement("span");
      label.textContent = option.textContent;

      const count = document.createElement("span");
      count.className = "type-area-multi__count";
      count.textContent = option.dataset.count || "0";

      const check = document.createElement("span");
      check.className = "type-area-multi__check";

      button.append(label, count, check);

      button.addEventListener("click", () => {
        option.selected = !option.selected;
        sync();
        scheduleAreaApply();
      });

      optionsList.appendChild(button);
    });

    let automaticAreaTimer;
    let areaSelectionDirty = false;

    const applyAreas = () => {
      areaSelectionDirty = false;
      window.clearTimeout(automaticAreaTimer);

      /* Fast Type pages use the same in-place results request as Price and
         Beds. The hidden native select is the single source of truth. */
      if (
        document.getElementById("remaining-listings-data")?.dataset.fastListings === "true"
      ) {
        select.dispatchEvent(
          new Event("change", { bubbles: true })
        );
        return;
      }

      const nextUrl = new URL(window.location.href);

      nextUrl.searchParams.delete("area");

      areaOptions
        .filter((option) => option.selected)
        .forEach((option) => {
          nextUrl.searchParams.append(
            "area",
            option.value
          );
        });

      nextUrl.hash =
        "listing-results-anchor";

      window.location.assign(
        nextUrl.pathname +
        nextUrl.search +
        nextUrl.hash
      );
    };

    const scheduleAreaApply = () => {
      areaSelectionDirty = true;
    };

    const finishPendingAreaSelection = () => {
      if (!areaSelectionDirty) return;

      window.clearTimeout(automaticAreaTimer);
      applyAreas();
    };

    clear.addEventListener("click", () => {
      areaOptions.forEach((option) => {
        option.selected = false;
      });

      sync();
      scheduleAreaApply();
    });

    done.addEventListener("click", () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      finishPendingAreaSelection();
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();

      const opening = menu.hidden;

      if (opening) {
        sortSelectedAreasFirst();
      }

      menu.hidden = !opening;
      trigger.setAttribute(
        "aria-expanded",
        String(opening)
      );

      if (opening) {
        // Reset only after the browser has made the list visible; otherwise
        // it restores the old scroll position when `hidden` is removed.
        requestAnimationFrame(() => {
          optionsList.scrollTop = 0;
        });
      }

      if (!opening) {
        finishPendingAreaSelection();
      }
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener(
      "click",
      (event) => {
        if (
          menu.hidden ||
          wrapper.contains(event.target)
        ) {
          return;
        }

        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");

        if (areaSelectionDirty) {
          event.preventDefault();
          event.stopImmediatePropagation();
          finishPendingAreaSelection();
        }
      },
      true
    );

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || menu.hidden) return;

      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      finishPendingAreaSelection();
    });


    menu.appendChild(footer);

    // Make the three regions explicit in inline styles. This protects the
    // dropdown from older page-level overflow rules: only the middle list
    // may scroll; the header and Done action always remain at the edges.
    menu.style.setProperty(
      "grid-template-rows",
      "auto minmax(0, 1fr) auto",
      "important"
    );
    menu.style.setProperty(
      "height",
      "auto",
      "important"
    );
    menu.style.setProperty(
      "max-height",
      "min(430px, calc(100dvh - 140px))",
      "important"
    );
    menu.style.setProperty("overflow", "hidden", "important");

    head.style.setProperty("grid-row", "1", "important");
    optionsList.style.setProperty("grid-row", "2", "important");
    optionsList.style.setProperty("min-height", "0", "important");
    optionsList.style.setProperty("overflow-y", "auto", "important");
    footer.style.setProperty("grid-row", "3", "important");
    footer.style.setProperty("position", "static", "important");

    wrapper.append(trigger, menu);
    select.insertAdjacentElement("afterend", wrapper);

    sync();
  })();
