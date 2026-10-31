
(() => {
  if (window.__locusSeenAllCopy) return;
  window.__locusSeenAllCopy = true;
  const TYPE_LABELS = { house: "homes", condo: "condos", townhouse: "townhomes", mobile: "mobile homes", land: "lots", "multi-family": "multi-family homes" };
  const vis = (el) => !!el && !el.hidden && getComputedStyle(el).display !== "none" && el.offsetParent !== null;
  const tc = (v) => String(v || "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const one = (label) => label.replace(/s$/, "");
  const apply = () => {
    const footer = document.getElementById("home-search-complete");
    if (!footer || footer.offsetParent === null) return;
    // "See more" budget/neighbourhood mode keeps its own copy and buttons, plus an alert button.
    const expandBtn = [document.getElementById("home-more-budget-btn"), document.getElementById("home-change-neighbourhood-btn")].find(vis);
    const mode = expandBtn ? "expand" : "seen-all";
    const existing = footer.querySelector("[data-seen-all-actions]");
    if (existing && existing.dataset.mode !== mode) existing.remove();
    const form = document.getElementById("home-filter-form");
    const type = String(form?.elements?.type?.value || "").toLowerCase();
    const typeLabel = TYPE_LABELS[type] || "homes";
    const areaSel = form?.elements?.area;
    const areaText = areaSel && areaSel.value ? areaSel.options[areaSel.selectedIndex]?.textContent : "";
    const area = tc(areaText) || tc(location.pathname.split("/").filter(Boolean)[0] || "");
    const n = Number(String(document.getElementById("results-count")?.textContent || "").replace(/\D/g, "")) || 0;
    const ret = document.querySelector(".gv-return-link");
    const parentName = ret ? String(ret.textContent || "").replace(/^[^A-Za-z]*All\s+/, "").trim() : "";
    const title = footer.querySelector("strong");
    const copy = document.getElementById("home-search-complete-copy");
    const t = n
      ? `You've seen all ${n} ${n === 1 ? one(typeLabel) : typeLabel} in ${area}.`
      : `You've seen every ${one(typeLabel)} in ${area}.`;
    const c = parentName
      ? `New ${typeLabel} get sent the day they list, or widen your search to ${parentName}.`
      : `New ${typeLabel} get sent the day they list. Looking for something that isn't on the market? Ask about off-market ${typeLabel}.`;
    if (!expandBtn) {
      if (title && title.textContent !== t) title.textContent = t;
      if (copy && copy.textContent !== c) copy.textContent = c;
    }
    if (footer.querySelector("[data-seen-all-actions]")) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-seen-all-actions", "");
    wrap.dataset.mode = mode;
    wrap.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;";
    const mk = (tag, label, primary) => {
      const el = document.createElement(tag);
      el.textContent = label;
      if (tag === "button") el.type = "button";
      el.style.cssText = `display:inline-flex;align-items:center;padding:10px 16px;border-radius:8px;font-weight:700;font-size:.85rem;text-decoration:none;cursor:pointer;border:1px solid ${primary ? "var(--accent,#1f6feb)" : "currentColor"};background:${primary ? "var(--accent,#1f6feb)" : "transparent"};color:${primary ? "#fff" : "inherit"};`;
      return el;
    };
    const alertBtn = mk("button", `Alert me to new ${typeLabel}`, true);
    alertBtn.addEventListener("click", () => {
      const ei = Element.prototype.scrollIntoView;
      const ws = window.scrollTo;
      const wb = window.scrollBy;
      const hf = HTMLElement.prototype.focus;
      Element.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
      window.scrollBy = function () {};
      HTMLElement.prototype.focus = function (o) { return hf.call(this, Object.assign({}, o || {}, { preventScroll: true })); };
      const restore = () => { Element.prototype.scrollIntoView = ei; window.scrollTo = ws; window.scrollBy = wb; HTMLElement.prototype.focus = hf; };
      const slot = document.querySelector(".homepage-save-nudge-slot");
      if (slot) {
        slot.classList.add("is-open");
        const nudge = slot.querySelector(".homepage-save-nudge");
        if (nudge) nudge.hidden = false;
        (slot.querySelector(".homepage-save-nudge button") || slot.querySelector("button"))?.click();
      }
      const saveForm = document.querySelector(".homepage-save-search-form");
      if (slot && footer.nextElementSibling !== slot) footer.after(slot);
      if (saveForm && !(slot && slot.contains(saveForm))) (slot || footer).after(saveForm);
      if (saveForm && (saveForm.hidden || getComputedStyle(saveForm).display === "none")) {
        saveForm.hidden = false;
        saveForm.style.display = "";
      }
      const target = saveForm || slot;
      if (!target) {
        restore();
        document.getElementById("homepage-agent-contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      requestAnimationFrame(() => {
        ei.call(target, { behavior: "smooth", block: "center" });
        target.querySelector('input[type="email"], input:not([type="hidden"])')?.focus();
      });
      setTimeout(restore, 900);
    });
    if (expandBtn) {
      alertBtn.style.background = "transparent";
      alertBtn.style.color = "inherit";
      alertBtn.style.borderColor = "currentColor";
      wrap.style.cssText = "display:contents;";
      wrap.appendChild(alertBtn);
      expandBtn.parentElement.appendChild(wrap);
      return;
    }
    wrap.appendChild(alertBtn);
    if (ret) {
      const u = new URL(ret.getAttribute("href") || "/", location.origin);
      const sd = new URLSearchParams(location.search).get("siteDomain");
      if (sd) u.searchParams.set("siteDomain", sd);
      if (type) u.searchParams.set("type", type);
      u.hash = "homepage-listings";
      const a = mk("a", `See all ${typeLabel} in ${parentName} \u2192`, false);
      a.href = u.pathname + u.search + u.hash;
      a.setAttribute("data-astro-reload", "");
      wrap.appendChild(a);
    }
    {
      const contact = document.getElementById("homepage-agent-contact");
      if (contact) {
        const a = mk("button", `Ask about off-market ${typeLabel}`, false); if (ret) { a.style.border = "none"; a.style.background = "none"; a.style.padding = "10px 4px"; a.style.textDecoration = "underline"; a.style.textUnderlineOffset = "3px"; a.style.fontWeight = "600"; }
        a.addEventListener("click", () => {
          const ei = Element.prototype.scrollIntoView;
          const ws = window.scrollTo;
          const wb = window.scrollBy;
          const hf = HTMLElement.prototype.focus;
          Element.prototype.scrollIntoView = function () {};
          window.scrollTo = function () {};
          window.scrollBy = function () {};
          HTMLElement.prototype.focus = function (o) { return hf.call(this, Object.assign({}, o || {}, { preventScroll: true })); };
          const restore = () => { Element.prototype.scrollIntoView = ei; window.scrollTo = ws; window.scrollBy = wb; HTMLElement.prototype.focus = hf; };
          contact.classList.add("is-open"); if (footer.nextElementSibling !== contact) footer.after(contact);
          const cform = contact.querySelector("form");
          const shown = () => !!cform && !cform.hidden && getComputedStyle(cform).display !== "none" && cform.offsetParent !== null;
          if (!shown()) {
            const opener = [...contact.querySelectorAll(".homepage-agent-nudge__actions button, .homepage-agent-nudge__actions a")]
              .find((b) => !b.matches("[data-homepage-contact-cancel]") && !(b.tagName === "A" && (b.getAttribute("href") || "#")[0] !== "#"));
            opener?.click();
          }
          if (cform && !shown()) { cform.hidden = false; cform.style.display = ""; }
          const tag = `Off-market ${typeLabel}${area ? " \u2013 " + area : ""}`;
          const msg = cform?.querySelector('textarea, [name="message"]');
          if (msg && !msg.value.trim()) {
            msg.value = `[${tag}]\nHi, I'm looking for ${typeLabel} in ${area || "the area"}. If anything off-market or coming soon comes up, please let me know.`;
            msg.dispatchEvent(new Event("input", { bubbles: true }));
          }
          let tagInput = cform?.querySelector('input[name="tag"]');
          if (cform && !tagInput) { tagInput = document.createElement("input"); tagInput.type = "hidden"; tagInput.name = "tag"; cform.appendChild(tagInput); }
          if (tagInput) tagInput.value = tag;
          requestAnimationFrame(() => {
            ei.call(cform || contact, { behavior: "smooth", block: "center" });
            cform?.querySelector('input[name="name"]')?.focus();
          });
          setTimeout(restore, 900);
        });
        wrap.appendChild(a);
      }
    }
    (copy?.parentElement || footer).appendChild(wrap);
  };
  const watch = () => {
    const f = document.getElementById("home-search-complete");
    if (!f || f.__seenAllObs) return;
    f.__seenAllObs = true;
    new MutationObserver(() => requestAnimationFrame(apply)).observe(f, { attributes: true, attributeFilter: ["hidden", "style"], childList: true, subtree: true, characterData: true });
    apply();
  };
  watch();
  document.addEventListener("DOMContentLoaded", watch);
  document.addEventListener("astro:page-load", watch);
})();
