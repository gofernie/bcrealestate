
(() => {
  const mq = matchMedia("(max-width: 700px)");
    // FOUC fix: CSS moved into <style is:global> above
  const run = () => {
    if (!mq.matches) return;
    const set = (el, p, v) => el && el.style.setProperty(p, v, "important");
    const card = document.querySelector("a.locus-home-featured");
    let hero = card; while (hero && hero !== document.body && !hero.querySelector("h1")) hero = hero.parentElement;
    if (!hero || hero === document.body) return; if (!hero.querySelector("img:not(.locus-home-featured__image)")) console.warn("[mobile-hero] no hero img found");
    const img = [...hero.querySelectorAll("img")].find((i) => !i.closest(".locus-home-featured"));
    const heroImgEl = document.querySelector("img.locus-home-hero__image"); const src = (heroImgEl && (heroImgEl.currentSrc || heroImgEl.getAttribute("src") || (heroImgEl.getAttribute("srcset") || "").split(" ")[0])) || img && (img.currentSrc || img.getAttribute("src") || (img.getAttribute("srcset") || "").split(" ")[0]);
    let band = hero; while (band.parentElement && band.parentElement !== document.body && band.getBoundingClientRect().width < innerWidth - 2) band = band.parentElement; if (src) { hero = band;
      set(hero, "background-image", `linear-gradient(180deg, rgba(10,14,16,.58) 0%, rgba(10,14,16,.38) 45%, rgba(10,14,16,.78) 100%), url("${src}")`);
      set(hero, "background-size", "cover");
      set(hero, "background-position", "center");
    }
    const fimg = card.querySelector(".locus-home-featured__image");
    set(fimg, "transform", "none"); set(fimg, "border-radius", "3px");
    set(card.querySelector(".locus-home-featured__body"), "border-radius", "0");
    const h1 = hero.querySelector("h1");
    set(h1, "font-size", "34px"); set(h1, "line-height", "1.08");
    set(h1?.nextElementSibling?.tagName === "P" ? h1.nextElementSibling : hero.querySelector("h1 ~ p"), "font-size", "16px");
    const browse = [...hero.querySelectorAll("a, button")].find((e) => e.textContent.trim().startsWith("Browse neighbourhoods"));
    if (browse) {
      ["background", "border", "box-shadow", "backdrop-filter", "-webkit-backdrop-filter"].forEach((p) => set(browse, p, "none"));
      set(browse, "padding", "10px 0"); set(browse, "text-decoration", "underline"); set(browse, "text-underline-offset", "4px"); set(browse, "justify-content", "center");
    }
    const copy = h1?.parentElement;
    set(copy, "box-shadow", "none"); set(copy, "background", "transparent");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
  addEventListener("load", run);
  /* reload-guard-v1: hold the layout reload while a listing or fullscreen photo is open */ const __rgStart = mq.matches; const __rgBusy = () => !!document.fullscreenElement || !!document.querySelector("#preview-sheet.open") || document.body.classList.contains("is-landscape-gallery-open"); let __rgPending = false; mq.addEventListener("change", () => { if (__rgBusy()) { __rgPending = true; return; } if (mq.matches !== __rgStart) location.reload(); }); new MutationObserver(() => { if (!__rgPending || __rgBusy()) return; __rgPending = false; if (mq.matches !== __rgStart) location.reload(); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
})();
