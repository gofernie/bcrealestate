// Listing views -> Fathom virtual pageviews at /listing/<id>-<address-slug>
(function () {
  if (window.trackListingView) return;
  window.trackListingView = function (card) {
    try {
      var d = (card && card.dataset) || {};
      var id = d.mls || d.mlsNumber || d.listingId || d.cardId || d.id;
      if (!id) return;
      var now = Date.now(), last = window.__lvLast;
      if (last && last.id === id && now - last.t < 3000) return;
      window.__lvLast = { id: id, t: now };
      var slug = String(d.address || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      var url = location.origin + "/listing/" + encodeURIComponent(id) + (slug ? "-" + slug : "");
      if (window.fathom && window.fathom.trackPageview) window.fathom.trackPageview({ url: url });
      else console.debug("[listing-views] not sent (no Fathom here):", url);
    } catch (e) {}
  };
  function hook() {
    var o = window.openSheet;
    if (typeof o !== "function" || o.__lvHook) return;
    var w = function (card) { window.trackListingView(card); return o.apply(this, arguments); };
    w.__lvHook = true;
    if (o.__arrangeHook) w.__arrangeHook = true;
    window.openSheet = w;
  }
  window.addEventListener("load", hook);
  document.addEventListener("astro:page-load", hook);
})();