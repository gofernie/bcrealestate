// Search this look: drag a box over anything in a listing photo, get "similar" product searches.
(() => {
  if (window.__lookSearch) return;
  window.__lookSearch = true;

  const ENDPOINT = '/api/look-search';
  // photo-kind-v1: only offer "Search this look" on interior photos with furniture/decor
  const KIND = new Map();
  function rawSrc(img) { let s = img.currentSrc || img.src || ''; try { const u = new URL(s, location.href); if (u.pathname === '/.netlify/images') s = u.searchParams.get('url') || s; } catch (e) {} return s.split('?')[0]; }
  function photoKind(img) {
    const src = rawSrc(img);
    if (!/^https:\/\/cdn\.repliers\.io\//.test(src)) return false;
    if (KIND.has(src)) return KIND.get(src);
    KIND.set(src, null);
    classify(src);
    prefetchSiblings(src);
    return null;
  }
  // Ask about one photo; when the answer is for the photo on screen, re-place the button.
  function classify(src) {
    return fetch('/api/photo-kind?url=' + encodeURIComponent(src))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { KIND.set(src, !!(d && d.interior)); if (photo && rawSrc(photo) === src) place(); })
      .catch(() => KIND.set(src, false));
  }
  // Check the rest of this listing's photos in the background (2 at a time, max 12) so swiping feels instant.
  const QUEUE = []; let running = 0;
  function pump() {
    while (running < 2 && QUEUE.length) {
      const s = QUEUE.shift(); running++;
      classify(s).finally(() => { running--; pump(); });
    }
  }
  function prefetchSiblings(src) {
    for (const el of document.querySelectorAll('[data-images]')) {
      let arr; try { arr = JSON.parse(el.dataset.images || '[]'); } catch (e) { continue; }
      if (!Array.isArray(arr)) continue; arr = arr.map((x) => String(x || '').split('?')[0]); if (!arr.includes(src)) continue;
      arr.slice(0, 12).forEach((s) => { if (/^https:\/\/cdn\.repliers\.io\//.test(s) && !KIND.has(s)) { KIND.set(s, null); QUEUE.push(s); } });
      pump();
      break;
    }
  }
  const Z = 2147483647;

  const css = `
  .ls-btn{position:fixed;z-index:${Z};display:none;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:0;
    font:600 13px/1 "DM Sans",system-ui,sans-serif;background:rgba(20,20,20,.72);color:#fff;cursor:pointer;
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.25)}
  .ls-btn.on{background:var(--accent,#2f5d50)}
  .ls-btn{white-space:nowrap}.ls-btn.ls-icon span{display:none}.ls-vh{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}.ls-btn.ls-icon svg{width:18px;height:18px}.ls-btn svg{width:15px;height:15px}
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
  .ls-conf{font-weight:500;font-size:12px;color:#857d70;margin-left:6px}.ls-links a.ls-guess{background:#1f1f1f;color:#fff;border-color:#1f1f1f}.ls-note{margin:12px 0 0;font-size:12px;color:#857d70}.ls-thumb{width:72px;height:72px;border-radius:10px;flex:none;background-repeat:no-repeat;background-color:#ece6da;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}.ls-head-main{display:flex;gap:12px;align-items:flex-start;min-width:0}.ls-shop{margin:12px 0 0;padding:12px 0 0;border-top:1px solid #e6dfd2}.ls-shop-t{font-size:14px;color:#4a453e;margin:0 0 8px}.ls-leaf{width:19px;height:16px;margin-left:6px;vertical-align:-3px;fill:#d52b1e;opacity:.85}.ls-shop-t a{color:#1f1f1f;font-weight:600;text-decoration:underline;text-underline-offset:3px}.ls-alts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:#857d70}.ls-alts a{padding:5px 10px;border-radius:999px;border:1px solid #d8d0c1;color:#1f1f1f;text-decoration:none;background:#fff}.ls-alts a:hover{border-color:#1f1f1f}
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

  // Make the modal's Share button an icon-only square to match ours (text kept for screen readers).
  function compactShare(el) {
    el.dataset.lsCompact = '1';
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const s = document.createElement('span');
        s.className = 'ls-vh';
        s.textContent = n.textContent;
        n.replaceWith(s);
      } else if (n.nodeType === 1 && !n.querySelector('svg') && n.tagName !== 'svg' && n.textContent.trim()) {
        n.classList.add('ls-vh');
      }
    }
    el.title = el.title || 'Share';
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Share');
    const h = getComputedStyle(el).height;
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('height', h, 'important');
    el.style.setProperty('width', h, 'important');
    el.style.setProperty('min-width', h, 'important');
    el.style.setProperty('justify-content', 'center', 'important');
    // Fainter glass look so the photo shows through.
    el.style.setProperty('background-color', 'rgba(17,17,17,.36)', 'important');
    el.style.setProperty('border-color', 'rgba(255,255,255,.28)', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('backdrop-filter', 'blur(6px)', 'important');
  }

  // Photo counter ("1 / 57 photos"): move it to the bottom-right, lined up with the home info line.
  let countEl = null;
  function moveCount(r) {
    if (!countEl || !countEl.isConnected) {
      countEl = null;
      for (const el of document.querySelectorAll('span,div,p,small,b,strong')) {
        if (el.children.length > 2) continue;
        if (!/^\d+\s*\/\s*\d+(\s*photos?)?$/i.test(el.textContent.trim())) continue;
        const b = el.getBoundingClientRect();
        if (!b.width || b.bottom < r.top - 20 || b.top > r.bottom || b.right < r.left || b.left > r.right) continue;
        const cs = getComputedStyle(el);
        if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
        countEl = el;
        break;
      }
      if (!countEl) return;
    }
    const el = countEl;
    const parent = el.offsetParent || el.parentElement;
    if (!parent) return;

    // Home info line (beds / baths / sq ft) in the bottom-left of the photo: smallest element that matches.
    let info = null;
    for (const s of parent.querySelectorAll('div,p,span,li')) {
      if (s === el || s.contains(el)) continue;
      const t = s.textContent.trim();
      if (!t || t.length > 90 || !/\b(bd|ba|beds?|baths?|sq\.? ?ft)\b/i.test(t)) continue;
      const sb = s.getBoundingClientRect();
      if (!sb.width || sb.bottom > r.bottom + 2 || sb.top < r.top + r.height / 2 || sb.left > r.left + r.width / 2) continue;
      if (!info || sb.height < info.getBoundingClientRect().height) info = s;
    }

    // Line up the actual text (glyph boxes), not the boxes around it: pills and lines have different padding.
    const textMid = (node) => {
      const rg = document.createRange();
      rg.selectNodeContents(node);
      const b = rg.getBoundingClientRect();
      return b.height ? b.top + b.height / 2 : null;
    };
    const pr = parent.getBoundingClientRect();
    const eb = el.getBoundingClientRect();
    const countMid = textMid(el);
    const infoMid = info ? textMid(info) : null;
    const ib = info ? info.getBoundingClientRect() : null;
    const bottom = infoMid != null && countMid != null
      ? Math.round(pr.bottom - infoMid - (eb.bottom - countMid))
      : 14;
    const right = ib ? Math.max(8, Math.round(ib.left - r.left) + Math.round(pr.right - r.right)) : 14;
    el.style.setProperty('top', 'auto', 'important');
    el.style.setProperty('left', 'auto', 'important');
    el.style.setProperty('bottom', bottom + 'px', 'important');
    el.style.setProperty('right', right + 'px', 'important');
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
    if (!photo) { btn.style.display = 'none'; layer.classList.remove('on'); return; } if (photoKind(photo) !== true) { btn.style.display = 'none'; layer.classList.remove('on'); return; }
    const r = photo.getBoundingClientRect();
    btn.style.display = 'inline-flex';
    // Big lightbox: sit beside Share. Small modal: bottom-right of the photo.
    let sh = r.width > innerWidth * 0.7 ? shareBtn(r) : null;
    if (sh && !sh.el.dataset.lsCompact) { compactShare(sh.el); sh = shareBtn(r); }
    if (sh) moveCount(r);
    skin(sh && sh.el);
    // Beside Share: icon-only square (less busy, esp. on phones); label only while active.
    const icon = !!sh && !active;
    btn.classList.toggle('ls-icon', icon);
    btn.title = icon ? 'Search this look' : '';
    btn.setAttribute('aria-label', active ? 'Done' : 'Search this look');
    if (icon) {
      btn.style.padding = '0';
      btn.style.width = btn.style.height || '40px';
      btn.style.justifyContent = 'center';
    } else {
      btn.style.width = '';
      btn.style.justifyContent = '';
    }
    btn.style.left = (sh ? sh.right - btn.offsetWidth : r.right - btn.offsetWidth - 14) + 'px';
    btn.style.top = (sh ? sh.bottom + 8 : Math.max(8, r.bottom - btn.offsetHeight - 14)) + 'px';
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
      render(Object.assign(d, { _src: body.photoUrl, _box: box, _nw: img.naturalWidth, _nh: img.naturalHeight }));
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
    // Quiet Article suggestion: one line plus small search pills (no hard sell).
    const articleLink = (q) => {
      const l = (q.links || []).find((x) => x.name === 'Article') || (q.links || [])[0];
      return l ? l.url : 'https://www.article.com/search?q=' + encodeURIComponent(q.phrase);
    };
    const showShop = d.furnishing !== false;
    const pills = d.results
      .map((q) => `<a href="${esc(articleLink(q))}" target="_blank" rel="sponsored noopener">${esc(q.phrase)}</a>`)
      .join('');
    const shop = showShop ? `
      <div class="ls-shop">
        <p class="ls-shop-t">Like this look? Browse similar pieces at <a href="${esc(articleLink(d.results[0]))}" target="_blank" rel="sponsored noopener">Article</a><svg class="ls-leaf" viewBox="0 0 24 20" role="img" aria-label="Canadian"><polygon points="12,2 13.4,4.9 15,4.1 14.4,7.7 16.7,5.2 17.2,6.6 19.8,6.1 18.9,9 20.1,9.6 16.3,12.8 16.9,14.2 12.6,13.5 12.7,18 11.3,18 11.4,13.5 7.1,14.2 7.7,12.8 3.9,9.6 5.1,9 4.2,6.1 6.8,6.6 7.3,5.2 9.6,7.7 9,4.1 10.6,4.9"/></svg></p>
        <div class="ls-alts">${pills}</div>
      </div>
      <p class="ls-note">Article is a Canadian furniture company. Similar pieces, not the exact item in this home. We may earn a commission.</p>` : '';
    openPanel(`<div class="ls-head"><div class="ls-head-main">${thumbHtml(d)}<div><div class="ls-kicker">Looks like</div><h3>${esc(d.item)}</h3></div></div><button class="ls-x" aria-label="Close">&times;</button></div>
      <p class="ls-desc">${esc(d.description)}</p>${shop}${guessHtml(d)}`);
  }

  // Thumbnail of the boxed area, cropped from the listing photo with CSS (no extra download).
  function thumbHtml(d) {
    const b = d._box, W = d._nw, H = d._nh;
    if (!d._src || !b || !W || !H) return '';
    const S = 72, cw = b.w * W, ch = b.h * H;
    if (cw < 4 || ch < 4) return '';
    const k = Math.max(S / cw, S / ch);
    const bx = -(b.x * W * k - (S - cw * k) / 2);
    const by = -(b.y * H * k - (S - ch * k) / 2);
    const url = String(d._src).replace(/["\\()]/g, (c) => encodeURIComponent(c));
    return `<div class="ls-thumb" style="background-image:url('${esc(url)}');background-size:${Math.round(W * k)}px ${Math.round(H * k)}px;background-position:${Math.round(bx)}px ${Math.round(by)}px"></div>`;
  }

  setInterval(place, 600);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
})();


// Homes page filters from a pill or panel (?style= / ?waterfrontType= / ?viewType=):
// retitle the heading ("Nanaimo Ocean View Homes.") and show a clearable chip.
(() => {
  // Filters from a link (?style=, ?viewType=, ?waterfrontType=) shown in the page title and as a "x" chip,
  // and kept on pages that don't handle them themselves (the city / Greater Victoria homepages).
  // Homepages swap pages without reloading (Astro ClientRouter), so this runs again on every astro:page-load.
  const WATER = { lakefront: 'Lakefront', oceanfront: 'Oceanfront', riverfront: 'Riverfront', any: 'Waterfront', waterfront: 'Waterfront' };
  const VIEW = { ocean: 'Ocean View', mountain: 'Mountain View', lake: 'Lake View', water: 'Water View', city: 'City View' };
  const titleCase = (t) => t.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const TYPE_WORD = /\b(Mobile Homes|Homes|Condos|Townhomes|Land|Lots)\b/;
  const HOME_WORD = /\bhome(s?)\b/;

  let active = [];      // styles in force on this page
  let parts = [];
  let navTo = null;     // address a client-side navigation was heading to (page scripts may rewrite it)

  // Listing requests and address updates keep the style: done by the early script in Layout.astro
  // (window.__lsActiveStyles), so requests sent while the page loads carry it too.
  // A new client-side navigation: its own address decides the style from here on.
  document.addEventListener('astro:before-preparation', (e) => {
    try { navTo = new URL(e.to); } catch (err) { navTo = null; }
    active = navTo ? navTo.searchParams.getAll('style').filter(Boolean) : [];
  });

  const retitle = () => {
    const label = parts.map((p) => p.title).join(' ');
    const lower = label.toLowerCase();
    const h1 = document.querySelector('h1');
    if (!h1) return false;
    // Type pages: "Nanaimo Land." -> "Nanaimo Ocean View Land."; homepages: "Find a Greater Victoria home." ->
    // "Find a Greater Victoria mid-century home."
    if (!h1.textContent.toLowerCase().includes(lower)) {
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent;
        if (TYPE_WORD.test(t)) { n.textContent = t.replace(TYPE_WORD, label + ' $1'); break; }
        if (HOME_WORD.test(t)) { n.textContent = t.replace(HOME_WORD, lower + ' home$1'); h1.dataset.lsFit = '1'; break; }
      }
    }
    if (!document.title.toLowerCase().includes(lower)) document.title = document.title.replace(TYPE_WORD, label + ' $1');
    // Homepage results heading: "All Greater Victoria Listings" / "All Greater Victoria homes for sale".
    const h2 = document.getElementById('home-listings-title');
    if (h2 && !h2.textContent.toLowerCase().includes(lower)) {
      const m = h2.textContent.trim().match(/^All (.+?) (Listings|homes for sale)$/i);
      if (m) h2.textContent = 'All ' + m[1] + ' ' + lower + ' homes';
    }
    return true;
  };

  // Chip under the filters: "Ocean Views x" (clears these filters).
  const mountChip = () => {
    if (document.querySelector('.ls-style-chip')) return true;
    const anchor = document.getElementById('listing-results-anchor');
    const grid = !anchor && document.getElementById('home-listings-grid'); // city homepages
    if (!anchor && !grid) return false;
    const bar = document.createElement('div');
    bar.className = 'ls-style-chip';
    bar.style.cssText = 'display:flex;justify-content:flex-start;margin:12px 0';
    bar.innerHTML = '<span style="display:inline-flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;border-radius:999px;background:color-mix(in srgb,var(--accent,#2f5d50) 14%,#fff);color:var(--accent,#2f5d50);font:500 14px/1 \'DM Sans\',system-ui,sans-serif"><strong></strong><button type="button" aria-label="Clear filter" style="border:0;background:var(--accent,#2f5d50);color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:15px;line-height:1">&times;</button></span>';
    bar.querySelector('strong').textContent = parts.map((p) => p.chip).join(' · ');
    bar.querySelector('button').addEventListener('click', () => {
      active = [];
      window.__lsActiveStyles = [];
      const u = new URL(location.href);
      ['style', 'waterfrontType', 'viewType'].forEach((k) => u.searchParams.delete(k));
      location.href = u.pathname + u.search;
    });
    // Keep the filter bar and its "More filters" panel together: the chip goes below both.
    const panel = document.querySelector('.type-more-filters-panel');
    if (grid) grid.before(bar);
    else (panel && panel.parentElement === anchor.parentElement ? panel : anchor).after(bar);
    return true;
  };

  // Homepage hero lines don't wrap: if the longer title runs under the featured-home card, shrink it to fit.
  const fitHero = (force) => {
    const h1 = document.querySelector('h1[data-ls-fit]');
    const card = document.querySelector('.locus-home-featured');
    if (!h1 || !card || (force !== true && h1.dataset.lsFitFor === h1.textContent)) return;
    h1.dataset.lsFitFor = h1.textContent;
    h1.style.removeProperty('font-size');
    const c = card.getBoundingClientRect();
    const sideBySide = () => { const h = h1.getBoundingClientRect(); return c.width && c.top < h.bottom && c.bottom > h.top && c.left > h.left; };
    if (!sideBySide()) return;
    let size = parseFloat(getComputedStyle(h1).fontSize);
    for (let i = 0; i < 40 && size > 24 && h1.getBoundingClientRect().right > c.left - 24; i++) {
      size -= 2;
      h1.style.setProperty('font-size', size + 'px', 'important');
    }
  };
  addEventListener('resize', () => requestAnimationFrame(() => fitHero(true)));

  const run = () => { if (parts.length) { retitle(); mountChip(); fitHero(); } };

  const apply = () => {
    const qs = new URLSearchParams(location.search);
    // The address the page was opened or navigated to, in case a page script already rewrote it.
    // (A client-side navigation may have gone through a redirect, e.g. /greater-victoria/homes -> /greater-victoria/.)
    let from = navTo ? navTo.searchParams : null;
    if (!from) {
      try {
        const opened = new URL(performance.getEntriesByType('navigation')[0]?.name || location.href);
        from = opened.pathname.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '') ? opened.searchParams : qs;
      } catch (e) { from = qs; }
    }
    const pick = (k) => qs.getAll(k).length ? qs.getAll(k) : from.getAll(k);
    active = (window.__pageStyles && window.__pageStyles.length) ? window.__pageStyles : pick('style').filter(Boolean);
    const water = String(pick('waterfrontType')[0] || '').toLowerCase();
    const view = String(pick('viewType')[0] || '').toLowerCase();
    parts = [];
    if (water && WATER[water]) parts.push({ title: WATER[water], chip: WATER[water] });
    if (view && VIEW[view]) parts.push({ title: VIEW[view], chip: VIEW[view] + 's' });
    window.__lsActiveStyles = active;
    if (active.length) parts.push({ title: titleCase(active.join(' / ')), chip: active.join(', ') });
    if (active.length && !qs.has('style')) {
      const u = new URL(location.href);
      active.forEach((s) => u.searchParams.append('style', s));
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }
    run();
  };

  apply();
  document.addEventListener('astro:page-load', () => { apply(); navTo = null; });
  // Page scripts re-render headings and results after load: put the title and chip back when they do.
  let queued = false;
  new MutationObserver(() => {
    if (queued || !parts.length) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
