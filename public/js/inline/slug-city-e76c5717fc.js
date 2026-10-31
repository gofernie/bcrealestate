
  const placeFilterMatchCount = () => {
    const count = document.getElementById("filter-match-count");
    const button = document.querySelector(
      ".slug-save-search [data-slug-save-open]"
    );
    const sortSelect = document.querySelector(".sort-filter-select");

    if (!count || !button || button.parentElement?.classList.contains("filter-save-row")) return;

    const row = document.createElement("div");
    row.className = "filter-save-row";
    row.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;";
    button.before(row);
    row.append(count, button);

    if (sortSelect instanceof HTMLSelectElement) {
      const sortPill = document.createElement("label");
      sortPill.className = "filter-sort-pill";
      sortPill.style.cssText =
        "display:inline-flex;align-items:center;gap:7px;height:40px;" +
        "padding:0 11px 0 13px;border:1px solid #d8dfdd;border-radius:999px;" +
        "background:#fff;color:#355c64;font-size:.85rem;font-weight:700;" +
        "white-space:nowrap;box-sizing:border-box;";

      const sortLabel = document.createElement("span");
      sortLabel.textContent = "Sort";

      const chevron = document.createElement("span");
      chevron.textContent = "âŒ„";
      chevron.setAttribute("aria-hidden", "true");
      chevron.style.cssText = "font-size:1rem;line-height:1;";

      sortSelect.style.cssText =
        "appearance:none;border:0;outline:0;background:transparent;" +
        "padding:0;min-width:0;color:#355c64;font:inherit;cursor:pointer;";

      sortPill.append(sortLabel, sortSelect, chevron);
      row.insertBefore(sortPill, button);
    }

    count.style.cssText =
      "display:inline-flex;align-items:center;width:max-content;margin:0;" +
      "padding:8px 13px;border:1px solid #cfe3df;border-radius:999px;" +
      "background:#edf6f3;color:#2f6f73;font-size:.85rem;font-weight:700;" +
      "font-variant-numeric:tabular-nums;white-space:nowrap;box-sizing:border-box;";
    count.style.height = `${button.getBoundingClientRect().height}px`;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", placeFilterMatchCount, { once: true });
  } else {
    placeFilterMatchCount();
  }
