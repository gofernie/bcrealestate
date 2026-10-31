
(function () {
  const configs = [
    {
      selector: ".price-filter-select",
      label: "Price",
      title: "Select price",
      className: "filter-dd--price"
    },
    {
      selector: ".type-filter-select",
      label: "Type",
      title: "Select property type",
      className: "filter-dd--type"
    },
    {
      selector: ".beds-filter-select",
      label: "Beds",
      title: "Select beds",
      className: "filter-dd--beds"
    },
    {
      selector: ".baths-filter-select",
      label: "Baths",
      title: "Select baths",
      className: "filter-dd--baths"
    },
    {
      selector: ".sort-filter-select",
      label: "Sort",
      title: "Sort listings",
      className: "filter-dd--sort"
    }
  ];

  function closeAll(except = null) {
    document.querySelectorAll(".filter-dd.is-open").forEach((dd) => {
      if (dd !== except) dd.classList.remove("is-open");
    });
  }

  configs.forEach((config) => {
    const select = document.querySelector(config.selector);
    if (!select || select.dataset.customDropdownReady === "true") return;

    select.dataset.customDropdownReady = "true";

    const dd = document.createElement("div");
    dd.className = `filter-dd ${config.className}`;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "filter-dd__trigger";

    const label = document.createElement("span");
    label.className = "filter-dd__label";
    label.textContent = config.label;

    const value = document.createElement("span");
    value.className = "filter-dd__value";

    trigger.append(label, value);

    const menu = document.createElement("div");
    menu.className = "filter-dd__menu";
    menu.style.setProperty("margin-top", "-5px", "important");


    Array.from(select.options).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-dd__option";
      button.dataset.value = option.value;

      const text = document.createElement("span");
      text.textContent = option.textContent;

      const check = document.createElement("span");
      check.className = "filter-dd__check";
      check.textContent = "\u2713";

      button.append(text, check);

      button.addEventListener("click", () => {
        select.value = option.value;

        select.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        sync();
        dd.classList.remove("is-open");
      });

      menu.appendChild(button);
    });

    function sync() {
      const selected =
        select.options[select.selectedIndex] ||
        select.options[0];

      value.textContent = selected?.textContent || "";

      menu.querySelectorAll(".filter-dd__option").forEach((button) => {
        button.classList.toggle(
          "is-selected",
          button.dataset.value === select.value
        );
      });
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();

      const opening = !dd.classList.contains("is-open");

      closeAll(dd);

      dd.classList.toggle("is-open", opening);
    });


    select.addEventListener("change", sync);

    dd.append(trigger, menu);

    select.insertAdjacentElement("afterend", dd);

    sync();
  });

  document.addEventListener("click", () => closeAll());
})();
