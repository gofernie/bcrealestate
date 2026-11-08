// Listing views -> Fathom pageviews.
// Main path: the modal sets /<city>/listing/<id> in the URL (card open + Prev/Next), so track URL changes.
// Fallback: modals that don't change the URL get /listing/<id>-<address> via the openSheet hook.
(function () {
  if (window.trackListingView) return;
  var lastPath = location.pathname;
  function send(id, url) {
    var now = Date.now(), last = window.__lvLast;
    if (last && last.id === id && now - last.t < 3000) return;
    window.__lvLast = { id: id, t: now };
    if (window.fathom && window.fathom.trackPageview) window.fathom.trackPageview({ url: url });
    else console.debug("[listing-views] not sent (no Fathom here):", url);
  }
  function fromUrl() {
    try {
      var p = location.pathname;
      if (p === lastPath) return;
      lastPath = p;
      var m = p.match(/\/listing\/([^\/?#]+)/);
      if (m) send(decodeURIComponent(m[1]), location.origin + p);
    } catch (e) {}
  }
  window.trackListingView = function (card) {
    try {
      var d = (card && card.dataset) || {};
      var id = d.mls || d.mlsNumber || d.listingId || d.cardId || d.id;
      if (!id) return;
      var slug = String(d.address || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      send(String(id), location.origin + "/listing/" + encodeURIComponent(id) + (slug ? "-" + slug : ""));
    } catch (e) {}
  };
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var r = orig.apply(this, arguments); setTimeout(fromUrl, 0); return r; };
  });
  window.addEventListener("popstate", function () { setTimeout(fromUrl, 0); });
  function hook() {
    var o = window.openSheet;
    if (typeof o !== "function" || o.__lvHook) return;
    var w = function (card) { var r = o.apply(this, arguments); setTimeout(function () { window.trackListingView(card); }, 300); return r; };
    w.__lvHook = true;
    if (o.__arrangeHook) w.__arrangeHook = true;
    window.openSheet = w;
  }
  window.addEventListener("load", hook);
  document.addEventListener("astro:page-load", hook);
})();