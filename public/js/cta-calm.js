(() => {
  if (window.__ctaCalm) return;
  window.__ctaCalm = true;
  const style = document.createElement("style");
  style.textContent = [
    ".cta-calm-card :is(a,button).cta-calm-link{background:none!important;border:0!important;box-shadow:none!important;color:var(--accent,#c4643c)!important;padding:4px 6px!important;margin:2px 4px!important;min-height:0!important;width:auto!important;font-weight:700!important;text-decoration:underline!important;text-underline-offset:3px;}",
    ".cta-calm-card .cta-calm-nb button,.cta-calm-card button.cta-calm-chip{background:transparent!important;border:1px solid var(--accent,#c4643c)!important;color:var(--accent,#c4643c)!important;border-radius:999px!important;padding:6px 12px!important;margin:0!important;box-shadow:none!important;font-size:.82rem!important;font-weight:700!important;cursor:pointer;align-self:center;width:auto!important;text-decoration:none!important;}",
    "body.cta-calm-on .homepage-save-nudge--inline[data-save-search-prompt]{display:none!important;}",
    ".cta-calm-hide{display:none!important;}", ".cta-calm-card :is(a,button).cta-calm-primary{background:#17232c!important;border:1px solid #17232c!important;color:#fff!important;box-shadow:0 6px 18px rgba(23,35,44,.18)!important;letter-spacing:.01em;padding-left:22px!important;padding-right:22px!important;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease!important;}", ".cta-calm-card :is(a,button).cta-calm-primary:hover,.cta-calm-card :is(a,button).cta-calm-primary:focus-visible{background:var(--accent,#1f5c5e)!important;border-color:var(--accent,#1f5c5e)!important;box-shadow:0 8px 22px rgba(23,35,44,.24)!important;transform:none!important;}", ".cta-calm-card :is(a,button).cta-calm-link:hover,.cta-calm-card :is(a,button).cta-calm-link:focus-visible,.cta-calm-card :is(a,button).cta-calm-link:active{background:none!important;border:0!important;box-shadow:none!important;transform:none!important;color:var(--accent,#c4643c)!important;text-decoration-thickness:2px!important;}", ".cta-calm-card .cta-calm-nb button:hover,.cta-calm-card button.cta-calm-chip:hover{background:var(--accent,#c4643c)!important;color:#fff!important;transform:none!important;}"
  ].join("");
  document.head.appendChild(style);

  const visible = (el) => !!el && el.getClientRects().length > 0;
  const climb = (el, test, max) => { let n = el; for (let i = 0; n && n !== document.body && i < max; i++, n = n.parentElement) { if (test(n)) return n; } return null; };
  const textEls = (re) => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const p = n.parentElement; if (p && re.test(n.nodeValue) && !p.closest("script,style,template")) out.push(p); }
    return out;
  };
  const ctrlCount = (n) => n.querySelectorAll("button, a[href]").length;

  function run() {
    let card = null;
    for (const el of textEls(/\bseen (every|all)\b/i)) {
      if (!visible(el)) continue;
      card = climb(el, (n) => n.querySelectorAll("button, a[href]").length >= 2, 6);
      if (card) break;
    }
    document.body.classList.toggle("cta-calm-on", !!card);
    if (!card) { document.querySelectorAll(".cta-calm-hide").forEach((e) => e.classList.remove("cta-calm-hide")); return; }
    card.classList.add("cta-calm-card");

    const nbLabel = textEls(/neighbouring area/i).find((e) => card.contains(e)); let nb = card.querySelector("#neighbour-areas") || (nbLabel && nbLabel.parentElement); if (nb === card) nb = null; if (nb) nb.classList.add("cta-calm-nb");
    const btns = [...card.querySelectorAll("button, a[href]")].filter((b) => !(nb && nb.contains(b)) && !b.dataset.ctaCalmChip);
    const primary = btns.find((b) => /alert|notify|save this search|get new/i.test(b.textContent || ""));
    btns.forEach((b) => b.classList.toggle("cta-calm-link", b !== primary)); if (primary) primary.classList.add("cta-calm-primary");
    const firstOther = btns.find((b) => b !== primary && !b.hidden); if (primary && firstOther && (firstOther.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING)) firstOther.parentElement.insertBefore(primary, firstOther);

    textEls(/Like these results/i).forEach((el) => {
      if (card.contains(el)) return;
      const bar = climb(el, (n) => n.querySelector("button"), 4);
      if (!bar || bar.contains(card) || bar.querySelector("#save-search-btn, #hero-save-search-btn")) return;
      bar.classList.add("cta-calm-hide");
    });

    textEls(/\bis nearby\b/i).forEach((el) => {
      if (card.contains(el)) return;
      const bar = climb(el, (n) => ctrlCount(n) >= 1, 4);
      if (!bar || bar.contains(card) || ctrlCount(bar) !== 1) return;
      const ctrl = bar.querySelector("button, a[href]");
      bar.classList.add("cta-calm-hide");
      const m0 = (ctrl.textContent || "").match(/\bin\s+(.+)$/i); const nm = (m0 ? m0[1] : "").trim().toLowerCase(); if (nm && nb && [...nb.querySelectorAll("button")].some((b) => !b.dataset.ctaCalmChip && (b.textContent || "").trim().toLowerCase().startsWith(nm))) { const ex = card.querySelector("[data-cta-calm-chip]"); if (ex) ex.remove(); return; } const host = nb && !nb.hidden ? nb : card;
      const existing = card.querySelector("[data-cta-calm-chip]");
      if (existing) { if (existing.parentElement !== host) host.appendChild(existing); return; }
      const m = (ctrl.textContent || "").match(/\bin\s+(.+)$/i);
      const chip = document.createElement("button");
      chip.type = "button"; chip.className = "cta-calm-chip"; chip.dataset.ctaCalmChip = "1";
      chip.textContent = (m ? m[1] : el.textContent.replace(/\s*is nearby.*$/i, "")).trim();
      chip.addEventListener("click", () => ctrl.click());
      host.appendChild(chip);
    });
  }

  let t; const sched = () => { clearTimeout(t); t = setTimeout(run, 120); };
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();