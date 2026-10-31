
  /* home-market-live-count-v1 */
  (() => {
    const output = document.querySelector("[data-home-live-total]");
    if (!(output instanceof HTMLElement)) return;

    const cityFromPage = document.querySelector("[data-city]")?.dataset.city;
    const cityFromPath = window.location.pathname
      .split("/")
      .filter(Boolean)[0];

    const city = String(cityFromPage || cityFromPath || "nanaimo")
      .trim()
      .toLowerCase();

    fetch(
      `/api/home-listings?${new URLSearchParams({
        city,
        countOnly: "1",
      })}`
    )
      .then((response) => {
        if (!response.ok) throw new Error("Count request failed");
        return response.json();
      })
      .then((payload) => {
        const total = Number(payload?.total);

        if (Number.isFinite(total) && total >= 0) {
          output.textContent = total.toLocaleString();

          /* home-live-type-counts-v1 */
          const typeCounts =
            payload?.typeCounts &&
            typeof payload.typeCounts === "object"
              ? payload.typeCounts
              : {};

          document
            .querySelectorAll(
              '#home-hero-search select[name="type"] option'
            )
            .forEach((nativeOption) => {
              if (
                !(nativeOption instanceof HTMLOptionElement) ||
                !nativeOption.value
              ) {
                return;
              }

              const count = Math.max(
                0,
                Number(typeCounts[nativeOption.value] || 0)
              );

              nativeOption.dataset.count = String(count);

              document
                .querySelectorAll(
                  '#home-hero-search [data-single-option]'
                )
                .forEach((customOption) => {
                  if (
                    !(customOption instanceof HTMLElement) ||
                    customOption.dataset.value !== nativeOption.value ||
                    customOption.children.length !== 3
                  ) {
                    return;
                  }

                  const countElement = customOption.children[1];

                  if (countElement instanceof HTMLElement) {
                    countElement.textContent = String(count);
                  }
                });
            });
        }
      })
      .catch(() => {
        output.textContent = " ";
      });
  })();
