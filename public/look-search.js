// Search this look: drag a box over anything in a listing photo, get "similar" product searches.
(() => {
  if (window.__lookSearch) return;
  window.__lookSearch = true;

  const ENDPOINT = '/api/look-search';
  const Z = 2147483647;

  const css = `
  .ls-btn{position:fixed;z-index:${Z};display:none;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:0;
    font:600 13px/1 "DM Sans",system-ui,sans-serif;background:rgba(20,20,20,.72);color:#fff;cursor:pointer;
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.25)}
  .ls-btn.on{background:var(--accent,#2f5d50)}
  .ls-btn{white-space:nowrap}.ls-btn svg{width:15px;height:15px}
  .ls-layer{position:fixed;z-index:${Z};display:none;cursor:crosshair;touch-action:none;overflow:hidden}
  .ls-layer.on{display:block}
  .ls-hint{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;
    font:500 13px/1.2 "DM Sans",system-ui,sans-serif;padding:7px 12px;border-radius:999px;pointer-events:none;white-space:nowrap}
  .ls-box{position:absolute;border:2px solid #fff;border-radius:4px;box-shadow:0 0 0 9999px rgba(0,0,0,.38);pointer-events:none;display:none}
  .ls-panel{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);width:min(560px,100vw);max-height:58vh;overflow:auto;
    z-index:${Z};background:#faf7f0;color:#1f1f1f;border-radius:16px 16px 0 0;box-shadow:0 -10px 34px rgba(0,0,0,.28);
    transition:transform .25s ease;font:14px/1.45 "DM Sans",system-ui,sans-serif;padding:16px 16px 20px;box-sizing:border-box}
  .ls-panel.open{transform:translate(-50%,0)}
  .ls-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .ls-kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a7266;font-weight:600}
  .ls-head h3{margin:2px 0 0;font:400 22px/1.15 "Instrument Serif",Georgia,serif}
  .ls-x{border:0;background:#ece6da;color:#333;width:30px;height:30px;border-radius:50%;font-size:18px;line-height:1;cursor:pointer;flex:none}
  .ls-desc{margin:8px 0 10px;color:#4a453e}
  .ls-chip{display:inline-block;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--accent,#2f5d50) 14%,#fff);
    color:var(--accent,#2f5d50);font-size:12px;font-weight:600;margin-bottom:12px}
  .ls-q{border-top:1px solid #e6dfd2;padding:10px 0}
  .ls-qt{font-weight:600;margin-bottom:7px}
  .ls-links{display:flex;flex-wrap:wrap;gap:6px}
  .ls-links a{padding:6px 11px;border-radius:999px;border:1px solid #d8d0c1;color:#1f1f1f;text-decoration:none;font-size:13px;background:#fff}
  .ls-links a:hover{border-color:var(--accent,#2f5d50);color:var(--accent,#2f5d50)}
  .ls-conf{font-weight:500;font-size:12px;color:#857d70;margin-left:6px}.ls-links a.ls-guess{background:#1f1f1f;color:#fff;border-color:#1f1f1f}.ls-note{margin:12px 0 0;font-size:12px;color:#857d70}
  .ls-load{display:flex;align-items:center;gap:10px;color:#4a453e}
  .ls-spin{width:18px;height:18px;border-radius:50%;border:2px solid #d8d0c1;border-top-color:var(--accent,#2f5d50);animation:lsspin .8s linear infinite}
  @keyframes lsspin{to{transform:rotate(360deg)}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ls-btn';
  btn.innerHTML = icon + '<span>Search this look</span>';
  document.body.appendChild(btn);

  const layer = document.createElement('div');
  layer.className = 'ls-layer';
  layer.innerHTML = '<div class="ls-hint">Drag a box around anything you like</div><div class="ls-box"></div>';
  document.body.appendChild(layer);
  const boxEl = layer.querySelector('.ls-box');

  const panel = document.createElement('div');
  panel.className = 'ls-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Search this look');
  document.body.appendChild(panel);

  let photo = null;
  let active = false;
  let drag = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function inFixed(el) {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === 'fixed') return true;
    }
    return false;
  }

  // The modal photo = largest visible <img> inside a fixed-position overlay.
  function findPhoto() {
    let best = null, bestA = 0;
    for (const img of document.images) {
      if (!img.complete || !img.naturalWidth) continue;
      const r = img.getBoundingClientRect();
      if (r.width < 280 || r.height < 180 || r.bottom < 0 || r.top > innerHeight) continue;
      const a = r.width * r.height;
      if (a <= bestA || !inFixed(img)) continue;
      best = img; bestA = a;
    }
    return best;
  }

  // Keep our UI in the same top layer as the photo (dialog/popover) and last in DOM order.
  function mount(img) {
    let host = img.closest('dialog[open]');
    if (!host) { try { host = img.closest(':popover-open'); } catch (e) {} }
    host = host || document.body;
    if (host.lastElementChild !== panel) host.append(layer, btn, panel);
  }

  // Copy the look of the lightbox's Share button so ours matches.
  function skin(el) {
    const P = ['backgroundColor', 'border', 'borderRadius', 'padding', 'fontFamily', 'fontSize', 'fontWeight', 'color', 'height', 'boxShadow', 'backdropFilter'];
    const cs = el ? getComputedStyle(el) : null;
    for (const p of P) btn.style[p] = cs && !(active && p === 'backgroundColor') ? cs[p] : '';
  }

  // Visible "Share" button near the top of this photo, if any.
  function shareBtn(r) {
    for (const el of document.querySelectorAll('button,a')) {
      if (el.textContent.trim() !== 'Share') continue;
      const s = el.getBoundingClientRect();
      if (!s.width || s.top < r.top - 80 || s.top > r.top + 160 || s.right < r.left || s.left > r.right + 80) continue;
      const hit = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
      if (hit && (hit === el || el.contains(hit))) return { el, left: s.left, right: s.right, top: s.top, bottom: s.bottom, height: s.height };
    }
    return null;
  }

  function place() {
    if (drag) return;
    const img = findPhoto();
    if (img !== photo) { photo = img; closePanel(); if (!img) setActive(false); }
    if (photo) mount(photo);
    if (!photo) { btn.style.display = 'none'; layer.classList.remove('on'); return; }
    const r = photo.getBoundingClientRect();
    btn.style.display = 'inline-flex';
    // Big lightbox: sit beside Share. Small modal: bottom-right of the photo.
    const sh = r.width > innerWidth * 0.7 ? shareBtn(r) : null;
    skin(sh && sh.el);
    btn.style.left = (sh ? sh.left - btn.offsetWidth - 8 : r.right - btn.offsetWidth - 14) + 'px';
    btn.style.top = (sh ? sh.top + (sh.height - btn.offsetHeight) / 2 : Math.max(8, r.bottom - btn.offsetHeight - 14)) + 'px';
    Object.assign(layer.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    layer.classList.toggle('on', active);
  }

  function setActive(on) {
    active = on;
    btn.classList.toggle('on', on);
    btn.querySelector('span').textContent = on ? 'Done' : 'Search this look';
    layer.classList.toggle('on', on && !!photo);
    if (!on) boxEl.style.display = 'none';
  }

  // Convert a box in element pixels to fractions of the natural image (handles object-fit cover/contain).
  function toNatural(img, x, y, w, h) {
    const r = img.getBoundingClientRect();
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const fit = getComputedStyle(img).objectFit;
    let sx = r.width / nw, sy = r.height / nh, ox = 0, oy = 0;
    if (fit === 'cover' || fit === 'contain') {
      const s = fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
      sx = sy = s;
      ox = (r.width - nw * s) / 2;
      oy = (r.height - nh * s) / 2;
    }
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const x1 = clamp((x - ox) / (nw * sx)), y1 = clamp((y - oy) / (nh * sy));
    const x2 = clamp((x + w - ox) / (nw * sx)), y2 = clamp((y + h - oy) / (nh * sy));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  layer.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = layer.getBoundingClientRect();
    drag = { r, x0: e.clientX - r.left, y0: e.clientY - r.top, x: 0, y: 0, w: 0, h: 0 };
    layer.setPointerCapture(e.pointerId);
    boxEl.style.display = 'none';
  });
  layer.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const cx = Math.min(Math.max(e.clientX - drag.r.left, 0), drag.r.width);
    const cy = Math.min(Math.max(e.clientY - drag.r.top, 0), drag.r.height);
    drag.x = Math.min(drag.x0, cx); drag.y = Math.min(drag.y0, cy);
    drag.w = Math.abs(cx - drag.x0); drag.h = Math.abs(cy - drag.y0);
    Object.assign(boxEl.style, { display: 'block', left: drag.x + 'px', top: drag.y + 'px', width: drag.w + 'px', height: drag.h + 'px' });
  });
  layer.addEventListener('pointerup', () => {
    const d = drag; drag = null;
    if (!d || d.w < 18 || d.h < 18 || !photo) { boxEl.style.display = 'none'; return; }
    const box = toNatural(photo, d.x, d.y, d.w, d.h);
    if (box.w < 0.02 || box.h < 0.02) return;
    search(photo, box);
  });
  ['click', 'mousedown', 'touchstart'].forEach((t) => layer.addEventListener(t, (e) => e.stopPropagation()));

  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setActive(!active); if (!active) closePanel(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (active || panel.classList.contains('open'))) { e.stopPropagation(); closePanel(); setActive(false); } }, true);

  function openPanel(html) { panel.innerHTML = html; panel.classList.add('open'); }
  function closePanel() { panel.classList.remove('open'); boxEl.style.display = 'none'; }
  panel.addEventListener('click', (e) => { if (e.target.closest('.ls-x')) closePanel(); e.stopPropagation(); });

  async function search(img, box) {
    openPanel('<div class="ls-head"><div class="ls-load"><div class="ls-spin"></div>Finding similar pieces&hellip;</div><button class="ls-x" aria-label="Close">&times;</button></div>');
    const holder = img.closest('[data-listing-id]');
    const body = {
      photoUrl: img.currentSrc || img.src,
      box,
      listingId: holder ? holder.dataset.listingId : null,
      buyerId: window.__buyerId || null,
    };
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Search failed (' + r.status + '), try again.');
      render(d);
    } catch (err) {
      openPanel(`<div class="ls-head"><p class="ls-desc">${esc(err.message)}</p><button class="ls-x" aria-label="Close">&times;</button></div>`);
    }
  }

  function guessHtml(d) {
    if (!d.guess || d.confidence === 'low') return '';
    const u = 'https://www.google.com/search?q=' + encodeURIComponent(d.guess);
    return `<div class="ls-q"><div class="ls-qt">Best guess at the original <span class="ls-conf">${esc(d.confidence || 'low')} confidence</span></div><div class="ls-links"><a class="ls-guess" href="${esc(u)}" target="_blank" rel="noopener">${esc(d.guess)} &rarr;</a></div></div>`;
  }

  // Path of a site page (homes, condos, ...), taken from the site's own nav links so it works
  // on bc.realestate (/nanaimo/homes) and agent sites with other URL shapes alike.
  function pagePath(page) {
    for (const a of document.querySelectorAll('a[href]')) {
      try {
        const u = new URL(a.href, location.href);
        const p = u.pathname.replace(/\/+$/, '');
        if (u.origin === location.origin && p.endsWith('/' + page)) return p;
      } catch (e) {}
    }
    const seg = location.pathname.split('/').filter(Boolean)[0] || '';
    return (seg ? '/' + seg : '') + '/' + page;
  }
  window.__lsPagePath = pagePath;

  const STYLE_PAGE = { 'Manufactured / mobile': 'mobile-homes', 'Condo / apartment': 'condos', 'Townhouse': 'townhomes' };

  function homesHtml(d) {
    const path = pagePath(STYLE_PAGE[d.home_style] || 'homes');
    const citySeg = path.split('/').filter(Boolean).slice(-2, -1)[0] || '';
    const city = citySeg ? citySeg.charAt(0).toUpperCase() + citySeg.slice(1).replace(/-/g, ' ') : '';
    const href = STYLE_PAGE[d.home_style] ? path : path + '?style=' + encodeURIComponent(d.home_style);
    return `<div class="ls-head"><div><div class="ls-kicker">Home style</div><h3>${esc(d.home_style)}</h3></div><button class="ls-x" aria-label="Close">&times;</button></div>
      <p class="ls-desc">${esc(d.description || d.item || '')}</p>
      <div class="ls-links"><a class="ls-guess" href="${esc(href)}">See ${esc(d.home_style)} homes${city ? ' in ' + esc(city) : ''} &rarr;</a></div>`;
  }

  function render(d) {
    if (d.home_style) { openPanel(homesHtml(d)); return; }
    if (!d.shoppable || !d.results || !d.results.length) {
      openPanel(`<div class="ls-head"><div><div class="ls-kicker">Hmm</div><h3>${esc(d.item || 'Nothing to shop there')}</h3></div><button class="ls-x" aria-label="Close">&times;</button></div>
        <p class="ls-desc">Try drawing a tighter box around one piece, like a chair, light or rug.</p>`);
      return;
    }
    const rows = d.results.map((q) => `<div class="ls-q"><div class="ls-qt">${esc(q.phrase)}</div><div class="ls-links">${
      q.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="sponsored noopener">${esc(l.name)}</a>`).join('')}</div></div>`).join('');
    openPanel(`<div class="ls-head"><div><div class="ls-kicker">Looks like</div><h3>${esc(d.item)}</h3></div><button class="ls-x" aria-label="Close">&times;</button></div>
      <p class="ls-desc">${esc(d.description)}</p>${d.style ? `<span class="ls-chip">${esc(d.style)}</span>` : ''}${rows}${guessHtml(d)}
      <p class="ls-note">Similar items, not the exact piece in this home. We may earn a commission on purchases.</p>`);
  }

  setInterval(place, 600);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
})();


// Style filter chip on the homes page ("Style: Rancher x")
(() => {
  const styles = (window.__pageStyles && window.__pageStyles.length) ? window.__pageStyles : new URLSearchParams(location.search).getAll('style');
  if (!styles.length) return;
  const mount = () => {
    if (document.querySelector('.ls-style-chip')) return true;
    const anchor = document.getElementById('listing-results-anchor');
    if (!anchor) return false;
    const bar = document.createElement('div');
    bar.className = 'ls-style-chip';
    bar.style.cssText = 'display:flex;justify-content:flex-start;margin:12px 0';
    bar.innerHTML = '<span style="display:inline-flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;border-radius:999px;background:color-mix(in srgb,var(--accent,#2f5d50) 14%,#fff);color:var(--accent,#2f5d50);font:500 14px/1 \'DM Sans\',system-ui,sans-serif">Style: <strong></strong><button type="button" aria-label="Clear style filter" style="border:0;background:var(--accent,#2f5d50);color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:15px;line-height:1">&times;</button></span>';
    bar.querySelector('strong').textContent = styles.join(', ');
    bar.querySelector('button').addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.delete('style');
      location.href = u.pathname + u.search;
    });
    anchor.after(bar);
    return true;
  };
  if (!mount()) { let n = 0; const t = setInterval(() => { if (mount() || ++n > 20) clearInterval(t); }, 500); }
})();
