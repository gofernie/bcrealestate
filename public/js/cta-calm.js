(() => {
  if (window.__ctaCalm) return;
  window.__ctaCalm = true;
  const style = document.createElement("style");
  style.textContent = [
    ".cta-calm-card :is(a,button).cta-calm-link{background:none!important;border:0!important;box-shadow:none!important;color:var(--accent,#c4643c)!important;padding:4px 6px!important;margin:2px 4px!important;min-height:0!important;width:auto!important;font-weight:700!important;text-decoration:underline!important;text-underline-offset:3px;}",
    ".cta-calm-card .cta-calm-nb button,.cta-calm-card button.cta-calm-chip{background:transparent!important;border:1px solid var(--accent,#c4643c)!important;color:var(--accent,#c4643c)!important;border-radius:999px!important;padding:6px 12px!important;margin:0!important;box-shadow:none!important;font-size:.82rem!important;font-weight:700!important;cursor:pointer;align-self:center;width:auto!important;text-decoration:none!important;}",
    "body.cta-calm-on .homepage-save-nudge--inline[data-save-search-prompt]{display:none!important;}",
    ".cta-calm-hide{display:none!important;}", ".cta-calm-card button.cta-calm-chip{display:inline-flex!important;justify-self:center;align-self:center;margin:6px auto 0!important;max-width:max-content;}", ".cta-calm-more:empty{display:none!important;}", ".cta-calm-primary-row{flex-basis:100%;width:100%;display:flex;justify-content:center;margin-bottom:4px;}",
    ".cta-calm-card{box-sizing:border-box;width:min(820px,100%)!important;max-width:820px!important;margin-left:auto!important;margin-right:auto!important;padding:34px 28px!important;}",
    ".cta-calm-card :is(a,button).cta-calm-primary{display:inline-flex!important;align-items:center;justify-content:center;min-height:40px;padding:10px 22px!important;border-radius:4px!important;font-family:inherit!important;font-size:.9rem!important;font-weight:700!important;line-height:1.2!important;margin:16px auto 6px!important;cursor:pointer;}",
    ".cta-calm-more{flex-basis:100%;width:100%;margin-top:18px;padding-top:16px;border-top:1px solid rgba(23,35,44,.08);display:grid;gap:10px;}",
    ".cta-calm-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;}",
    ".cta-calm-row > span{font-size:.8rem;color:#6b7280;margin-right:4px;}",
    ".cta-calm-card a.cta-calm-chip{display:inline-flex;align-items:center;padding:5px 12px;border:1px solid var(--accent,#2f6f73);border-radius:999px;color:var(--accent,#2f6f73);font-size:.8rem;font-weight:700;text-decoration:none;}",
    ".cta-calm-card a.cta-calm-chip:hover{background:var(--accent,#2f6f73);color:#fff;}", ".cta-calm-card :is(a,button).cta-calm-primary{background:#17232c!important;border:1px solid #17232c!important;color:#fff!important;box-shadow:0 6px 18px rgba(23,35,44,.18)!important;letter-spacing:.01em;padding-left:22px!important;padding-right:22px!important;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease!important;}", ".cta-calm-card :is(a,button).cta-calm-primary:hover,.cta-calm-card :is(a,button).cta-calm-primary:focus-visible{background:var(--accent,#1f5c5e)!important;border-color:var(--accent,#1f5c5e)!important;box-shadow:0 8px 22px rgba(23,35,44,.24)!important;transform:none!important;}", ".cta-calm-card :is(a,button).cta-calm-link:hover,.cta-calm-card :is(a,button).cta-calm-link:focus-visible,.cta-calm-card :is(a,button).cta-calm-link:active{background:none!important;border:0!important;box-shadow:none!important;transform:none!important;color:var(--accent,#c4643c)!important;text-decoration-thickness:2px!important;}", ".cta-calm-card .cta-calm-nb button:hover,.cta-calm-card button.cta-calm-chip:hover{background:var(--accent,#c4643c)!important;color:#fff!important;transform:none!important;}"
  ].join("");
  document.head.appendChild(style);

  const typeWord = () => { const p = new URLSearchParams(location.search).get("type") || ""; const seg = location.pathname.split("/").filter(Boolean)[1] || ""; const s = (p || (/^(homes|townhomes|condos|mobile-homes|mobile|land|lots|lot-land|lots-land)$/i.test(seg) ? seg : "")).toLowerCase(); if (/town/.test(s)) return "townhomes"; if (/condo/.test(s)) return "condos"; if (/mobile|manufactured/.test(s)) return "mobile homes"; if (/land|lot/.test(s)) return "lots"; if (/house|home/.test(s)) return "homes"; return "listings"; };
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
    const btns = [...card.querySelectorAll("button, a[href]")].filter((b) => !(nb && nb.contains(b)) && !b.dataset.ctaCalmChip && !b.closest(".cta-calm-more"));
    let primary = btns.find((b) => /alert|notify|save this search|get new/i.test(b.textContent || ""));
    if (!primary && !card.querySelector("[data-cta-calm-alert]")) {
      const trig = document.querySelector("#save-search-btn, #hero-save-search-btn, .bc-save-search__button, .slug-save-search__open");
      if (trig) {
        const b = document.createElement("button");
        b.type = "button"; b.dataset.ctaCalmAlert = "1"; b.className = "interrupt-btn interrupt-primary";
        b.textContent = "Alert me to new " + typeWord();
        b.addEventListener("click", () => { trig.click(); const box = trig.closest(".slug-save-search, .bc-save-search, .homepage-save-nudge-slot, section") || trig; setTimeout(() => box.scrollIntoView({ behavior: "smooth", block: "center" }), 60); });
        const anchor = btns.find((x) => !x.hidden && x.getClientRects().length);
        if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(b, anchor); else card.appendChild(b);
        btns.unshift(b); primary = b;
      }
    }
    btns.forEach((b) => b.classList.toggle("cta-calm-link", b !== primary)); if (primary) primary.classList.add("cta-calm-primary");
    const firstOther = btns.find((b) => b !== primary && !b.hidden); if (primary && firstOther && (firstOther.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING)) firstOther.parentElement.insertBefore(primary, firstOther); if (primary && primary.parentElement && !primary.parentElement.classList.contains("cta-calm-primary-row")) { const pr = document.createElement("div"); pr.className = "cta-calm-primary-row"; primary.parentElement.insertBefore(pr, primary); pr.appendChild(primary); }

    textEls(/Like these results/i).forEach((el) => {
      if (card.contains(el)) return;
      const bar = climb(el, (n) => n.querySelector("button"), 4);
      if (!bar || bar.contains(card) || bar.querySelector("#save-search-btn, #hero-save-search-btn, .bc-save-search__button, .slug-save-search__open")) return;
      bar.classList.add("cta-calm-hide");
    });

    if (!nb && !card.querySelector("[data-cta-calm-more]")) {
      const sp = new URLSearchParams(location.search);
      const widen = [];
      const drop = (keys, label) => { if (keys.some((k) => sp.get(k))) { const u = new URL(location.href); keys.forEach((k) => u.searchParams.delete(k)); u.hash = ""; widen.push([label, u.pathname + u.search]); } };
      drop(["beds"], "Any beds"); drop(["baths"], "Any baths");
      const here = location.pathname.replace(/\/$/, "");
      const seen = new Set();
      const navA = [...document.querySelectorAll("header a[href], nav a[href]")];
      const types = navA.filter((a) => { const txt = (a.textContent || "").trim(); if (!/^(homes|townhomes|condos|mobile homes|lot \/ land)$/i.test(txt) || seen.has(txt.toLowerCase())) return false; seen.add(txt.toLowerCase()); return new URL(a.href).pathname.replace(/\/$/, "") !== here; });
      const areas = navA.find((a) => /^areas$/i.test((a.textContent || "").trim()));
      const typeItems = types.map((a) => [a.textContent.trim(), a.getAttribute("href")]).concat(areas ? [["Browse areas", areas.getAttribute("href")]] : []);
      if (widen.length || typeItems.length) {
        const box = document.createElement("div"); box.dataset.ctaCalmMore = "1"; box.className = "cta-calm-more";
        const row = (label, items) => { if (!items.length) return; const r = document.createElement("div"); r.className = "cta-calm-row"; const s = document.createElement("span"); s.textContent = label; r.appendChild(s); items.forEach(([txt, href]) => { const a = document.createElement("a"); a.className = "cta-calm-chip"; a.href = href; a.textContent = txt; r.appendChild(a); }); box.appendChild(r); };
        row("Widen your search:", widen);
        
        const pm = /^(\d+)-(\d+)$/.exec(sp.get("price") || ""); const segs = location.pathname.split("/").filter(Boolean);
        if (pm && segs.length >= 2) {
          const lo = +pm[1], hi = +pm[2], nhi = hi + Math.max(50, hi - lo);
          const tmap = { homes: "house", townhomes: "townhouse", condos: "condo", "mobile-homes": "mobile", land: "land", lots: "land", "lot-land": "land", "lots-land": "land" };
          const q = new URLSearchParams({ city: segs[0], minPrice: String(hi), maxPrice: String(nhi), offset: "0", limit: "1" });
          const ty = sp.get("type") || tmap[segs[1]]; if (ty) q.set("type", ty);
          ["beds", "baths"].forEach((k) => { if (sp.get(k)) q.set(k, sp.get(k)); });
          fetch("/api/home-listings?" + q).then((r) => r.json()).then((j) => {
            const n = Number(j.total || 0); if (!n) return;
            const fmt = (v) => v >= 1000 ? "$" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "M" : "$" + v + "k";
            const u = new URL(location.href); u.searchParams.set("price", hi + "-" + nhi); u.hash = "";
            let r = [...box.querySelectorAll(".cta-calm-row")].find((x) => /widen/i.test(x.textContent));
            if (!r) { r = document.createElement("div"); r.className = "cta-calm-row"; const s = document.createElement("span"); s.textContent = "Widen your search:"; r.appendChild(s); box.insertBefore(r, box.firstChild); }
            const a = document.createElement("a"); a.className = "cta-calm-chip"; a.href = u.pathname + u.search;
            a.textContent = n + " more " + typeWord() + " " + fmt(hi) + "\u2013" + fmt(nhi);
            r.insertBefore(a, r.children[1] || null);
          }).catch(() => {});
        }
        card.appendChild(box);
      }
    }

    textEls(/\bis nearby\b/i).forEach((el) => {
      if (card.contains(el)) return;
      const bar = climb(el, (n) => ctrlCount(n) >= 1, 4);
      if (!bar || bar.contains(card) || ctrlCount(bar) !== 1) return;
      const ctrl = bar.querySelector("button, a[href]");
      bar.classList.add("cta-calm-hide");
      const m0 = (ctrl.textContent || "").match(/\bin\s+(.+)$/i); const nm = (m0 ? m0[1] : "").trim().toLowerCase(); if (nm && [...card.querySelectorAll("button, a[href]")].some((b) => !b.dataset.ctaCalmChip && (b.textContent || "").trim().toLowerCase().startsWith(nm))) { const ex = card.querySelector("[data-cta-calm-chip]"); if (ex) ex.remove(); return; } const host = nb && !nb.hidden ? nb : card;
      const existing = card.querySelector("[data-cta-calm-chip]");
      if (existing) { if (existing.parentElement !== host) host.appendChild(existing); return; }
      const m = (ctrl.textContent || "").match(/\bin\s+(.+)$/i);
      const chip = document.createElement("button");
      chip.type = "button"; chip.className = "cta-calm-chip"; chip.dataset.ctaCalmChip = "1"; chip.style.cssText = "display:flex!important;width:max-content!important;max-width:100%!important;flex:0 0 auto!important;align-items:center!important;margin:8px auto 0!important;padding:6px 14px!important;border-radius:999px!important;font-size:.8rem!important;font-weight:600!important;line-height:1.2!important;min-height:0!important;cursor:pointer!important;";
      chip.textContent = (m ? m[1] : el.textContent.replace(/\s*is nearby.*$/i, "")).trim();
      chip.addEventListener("click", () => ctrl.click());
      host.appendChild(chip);
    });
  }

  /* cta-calm-chip-css-v1 */ if (!document.getElementById("cta-calm-chip-css")) { const st = document.createElement("style"); st.id = "cta-calm-chip-css"; st.textContent = "button.cta-calm-chip[data-cta-calm-chip]{display:flex!important;width:max-content!important;max-width:100%!important;flex:0 0 auto!important;align-items:center!important;margin:6px auto 0!important;padding:6px 14px!important;border-radius:999px!important;font-size:.8rem!important;font-weight:600!important;line-height:1.2!important;min-height:0!important;cursor:pointer!important;}"; document.head.appendChild(st); }
  let t; const sched = () => { clearTimeout(t); t = setTimeout(run, 120); };
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();