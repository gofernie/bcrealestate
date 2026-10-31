
  /* polish-desktop-nearby-buttons-v1 */
  (() => {
    const polish = () => {
      const desktop = window.matchMedia("(min-width: 901px)").matches;
      const toolbar = document.querySelector(".area-map-toolbar--overlay");
      const select = toolbar?.querySelector(".map-nearby-select");
      const buttons = toolbar?.querySelector(".map-nearby-buttons");

      if (!toolbar || !select || !buttons) return;

      select.style.display = desktop ? "none" : "";

      if (!desktop) {
        buttons.style.display = "none";
        return;
      }

      buttons.style.display = "inline-flex";
      buttons.style.alignItems = "center";
      buttons.style.gap = "3px";
      buttons.style.padding = "4px";
      buttons.style.border = "1px solid rgba(20, 28, 38, .15)";
      buttons.style.borderRadius = "10px";
      buttons.style.background = "rgba(255, 255, 255, .94)";
      buttons.style.boxShadow = "0 4px 14px rgba(20, 28, 38, .10)";
      buttons.style.backdropFilter = "blur(8px)";

      buttons.querySelectorAll("button").forEach((button) => {
        button.style.minHeight = "32px";
        button.style.padding = "0 10px";
        button.style.border = "0";
        button.style.borderRadius = "7px";
        button.style.background = "transparent";
        button.style.color = "#40505b";
        button.style.font = "inherit";
        button.style.fontSize = ".76rem";
        button.style.fontWeight = "750";
        button.style.whiteSpace = "nowrap";
        button.style.cursor = "pointer";

        const active = button.classList.contains("is-active");

        if (active) {
          button.style.background = "var(--accent)";
          button.style.color = "#fff";
          button.style.boxShadow = "0 2px 5px rgba(20, 28, 38, .16)";
        }
      });
    };

    const start = () => {
      polish();
      window.addEventListener("resize", polish, { passive: true });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  })();
