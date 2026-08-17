(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.add('ready');
  });

  var page = document.body.dataset.page;
  // Path to the shared media folder. Project pages set __MEDIA_PREFIX__ so old
  // version pages (one folder deeper) resolve images correctly too.
  var MEDIA_PREFIX = window.__MEDIA_PREFIX__ || '../../assets/media/';

  // ---------- Desktop recommendation on phones ----------
  // The portfolio is designed for the desktop browsing experience. When it's
  // opened on a phone or tablet, gently suggest viewing it on a computer.
  var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var isNarrow = window.innerWidth < 900;
  function showDesktopNotice() {
    var bar = document.createElement('div');
    bar.className = 'desktop-notice';
    bar.setAttribute('role', 'note');
    var text = document.createElement('span');
    text.textContent = 'This portfolio is best viewed on a desktop.';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'desktop-notice-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '\u2715';
    close.addEventListener('click', function () {
      bar.parentNode.removeChild(bar);
      try { localStorage.setItem('workshop-desktop-notice', '1'); } catch (e) {}
    });
    bar.appendChild(text);
    bar.appendChild(close);
    (document.body || document.documentElement).appendChild(bar);
  }
  if (isTouchDevice && isNarrow) {
    var dismissed = false;
    try { dismissed = localStorage.getItem('workshop-desktop-notice') === '1'; } catch (e) {}
    if (!dismissed) showDesktopNotice();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Reveal on scroll ----------
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    // Stagger hero elements for a layered entrance
    var hero = document.querySelector('.hero');
    if (hero) {
      Array.prototype.slice.call(hero.querySelectorAll('[data-reveal]')).forEach(function (el, i) {
        el.style.transitionDelay = (i * 120) + 'ms';
        el.addEventListener('transitionend', function once() {
          el.style.transitionDelay = '';
          el.removeEventListener('transitionend', once);
        });
      });
    }

    function colCount() {
      var grid = document.getElementById('projectGrid');
      if (!grid) return 1;
      var cols = getComputedStyle(grid).gridTemplateColumns.split(' ');
      return cols.length > 0 ? cols.length : 1;
    }

    function restoreCard(card) {
      card.style.transitionDelay = '';
      card.style.transition = 'transform 0.35s var(--ease-out), box-shadow 0.35s ease, border-color 0.35s ease';
    }

    // Diagonal cascade across every card grid (projects + components), with
    // fast hover restoration after the reveal finishes.
    var grids = ['projectGrid', 'componentGrid'];
    var cards = [];
    grids.forEach(function (id) {
      var grid = document.getElementById(id);
      if (grid) cards = cards.concat(Array.prototype.slice.call(grid.querySelectorAll('.card')));
    });
    cards.forEach(function (card) {
      card.addEventListener('transitionend', function onEnd(e) {
        if (e.propertyName === 'transform') {
          restoreCard(card);
          card.removeEventListener('transitionend', onEnd);
        }
      });
    });
    function staggerCards() {
      var cols = colCount();
      cards.forEach(function (card, i) {
        var row = Math.floor(i / cols);
        var col = i % cols;
        card.style.transitionDelay = (((row + col) % 6) * 55) + 'ms';
      });
    }
    staggerCards();
    window.addEventListener('resize', staggerCards, { passive: true });

    // Cascade every other reveal already in view at load (titles,
    // sections, footer) so the whole page animates in sequence.
    var cascadeIdx = 0;
    items.forEach(function (el) {
      if (el.style.transitionDelay || !inView(el)) return;
      el.style.transitionDelay = (cascadeIdx * 90) + 'ms';
      cascadeIdx++;
      el.addEventListener('transitionend', function once() {
        el.style.transitionDelay = '';
        el.removeEventListener('transitionend', once);
      });
    });

    function inView(el) {
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight - 40 && r.bottom > 0;
    }
    function revealDuring() {
      items.forEach(function (el) {
        if (!el.classList.contains('revealed') && inView(el)) el.classList.add('revealed');
      });
    }
    function revealAll() {
      items.forEach(function (el) { el.classList.add('revealed'); });
    }

    if (!('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    // Reveal each element once it's ~10% visible, then stop watching it.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !en.target.classList.contains('revealed')) {
          en.target.classList.add('revealed');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    // Wait two frames and force a reflow so the initial hidden state is
    // painted before observing. Without this the reveal can happen before the
    // browser ever shows the hidden frame, making the entrance invisible.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        void document.body.offsetHeight;
        items.forEach(function (el) { io.observe(el); });
      });
    });

    // Fallbacks: nothing on the page is ever left invisible.
    window.addEventListener('resize', revealDuring, { passive: true });
    setTimeout(revealDuring, 600);
    setTimeout(revealDuring, 2000);
    window.addEventListener('scroll', revealDuring, { passive: true });
  }

  // ---------- Back to top ----------
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.title = 'Back to top';
    btn.textContent = '\u2191';
    document.body.appendChild(btn);
    function onScroll() {
      btn.classList.toggle('show', (window.pageYOffset || document.documentElement.scrollTop) > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', function () {
      if (window.__smoothScroll && window.__smoothScroll.to) { window.__smoothScroll.to(0); return; }
      var startY = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (startY <= 0) return;
      var t0 = null;
      var DUR = 600;
      function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
      function step(now) {
        if (t0 == null) t0 = now;
        var k = Math.min(1, (now - t0) / DUR);
        window.scrollTo(0, Math.round(startY * (1 - ease(k))));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ---------- Version selector (themed dropdown) ----------
  function initVersionSwitch() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-version-switch]'), function (wrap) {
      var btn = wrap.querySelector('.version-select-btn');
      if (!btn) return;
      var menu = wrap.querySelector('.version-select-menu');
      function close() {
        wrap.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
      function toggle(e) {
        e.stopPropagation();
        var open = wrap.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && menu) menu.querySelector('.version-select-opt.selected') && menu.querySelector('.version-select-opt.selected').focus();
      }
      btn.addEventListener('click', toggle);
      document.addEventListener('click', close);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && wrap.classList.contains('open')) {
          close();
          btn.focus();
        }
      });
    });
  }

  // ---------- Touch swipe ----------
  function addSwipe(el, onLeft, onRight) {
    if (!el) return;
    var x0 = null, y0 = null;
    el.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0;
      var dy = t.clientY - y0;
      x0 = y0 = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onLeft();
      else onRight();
    }, { passive: true });
  }

  // ---------- Gallery (photo previewer) ----------
  function initGallery() {
    var section = document.querySelector('[data-gallery]');
    if (!section) return;
    var items;
    try { items = JSON.parse(section.dataset.gallery); } catch (e) { return; }
    if (!items || !items.length) return;

    var main = section.querySelector('.gallery-main');
    var frame = main.parentNode;
    var counter = section.querySelector('.gal-counter');
    var thumbs = Array.prototype.slice.call(section.querySelectorAll('.gallery-thumb'));
    var prevBtn = section.querySelector('.gal-prev');
    var nextBtn = section.querySelector('.gal-next');
    var current = 0;

    function pathOf(i) { return MEDIA_PREFIX + items[i].path; }

    function setProps() {
      if (counter) counter.textContent = (current + 1) + ' / ' + items.length;
      thumbs.forEach(function (t, i) { t.classList.toggle('active', i === current); });
      if (thumbs[current] && thumbs[current].scrollIntoView) {
        try { thumbs[current].scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      }
    }

    function show(index, dir) {
      current = (index + items.length) % items.length;
      var target = pathOf(current);
      var changed = main.src !== new URL(target, document.baseURI).href;
      dir = dir || 0;
      setProps();
      if (!changed) return;

      var d = dir < 0 ? -1 : dir > 0 ? 1 : 0;
      if (d === 0) {
        main.classList.add('switching');
        setTimeout(function () {
          main.src = target;
          main.alt = items[current].caption || '';
          requestAnimationFrame(function () { main.classList.remove('switching'); });
        }, 150);
        return;
      }

      // Full sideways slide: the current image exits toward the swipe
      // direction while the next one enters from the opposite edge.
      var inCls = d > 0 ? 'next' : 'prev';
      var outCls = d > 0 ? 'out-next' : 'out-prev';

      main.classList.remove('out-next', 'out-prev');
      main.style.pointerEvents = '';
      Array.prototype.slice.call(frame.querySelectorAll('.gallery-incoming')).forEach(function (el) { el.remove(); });

      var incoming = document.createElement('img');
      incoming.className = 'gallery-main gallery-incoming ' + inCls;
      incoming.alt = items[current].caption || '';
      incoming.src = target;
      frame.appendChild(incoming);
      void incoming.getBoundingClientRect();
      incoming.classList.remove(inCls);
      main.classList.add(outCls);
      main.style.pointerEvents = 'none';
      incoming.addEventListener('transitionend', function onEnd(e) {
        if (e.propertyName !== 'transform') return;
        incoming.removeEventListener('transitionend', onEnd);
        if (main !== incoming && main.parentNode) main.remove();
        main = incoming;
        incoming.classList.remove('gallery-incoming');
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { show(current - 1, -1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(current + 1, 1); });
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i, i > current ? 1 : i < current ? -1 : 0); }); });
    addSwipe(section.querySelector('.gallery-stage'), function () { show(current + 1, 1); }, function () { show(current - 1, -1); });

    // ---------- Lightbox (modal panel, like the file preview) ----------
    var lightbox = document.querySelector('.lightbox');
    if (!lightbox) return;
    var lbPanel = lightbox.querySelector('.lb-panel');
    var lbImg = lightbox.querySelector('.lb-img');
    var lbBusy = lightbox.querySelector('.lb-busy');
    var lbCounter = lightbox.querySelector('.lb-counter');
    var lbClose = lightbox.querySelector('.lb-close');
    var lbPrev = lightbox.querySelector('.lb-prev');
    var lbNext = lightbox.querySelector('.lb-next');
    var lbIndex = current;
    var lbStage = lightbox.querySelector('.lb-stage');
    var loadSeq = 0;
    var switchTimer = null;

    function updateLbMeta() {
      if (lbCounter) lbCounter.textContent = (lbIndex + 1) + ' / ' + items.length;
      if (lbImg) lbImg.alt = items[lbIndex].caption || '';
    }

    function preload(i) {
      var idx = (i + items.length) % items.length;
      if (idx === lbIndex) return;
      var im = new Image();
      im.src = pathOf(idx);
    }

    function clearLbBusy() { if (lbBusy) lbBusy.classList.remove('busy'); }

    function loadLb(i, animate, dir) {
      var idx = (i + items.length) % items.length;
      var target = pathOf(idx);
      var changed = lbImg.src !== new URL(target, document.baseURI).href;
      lbIndex = idx;
      updateLbMeta();
      animate = animate && items.length > 1;
      var d = animate ? (dir < 0 ? -1 : dir > 0 ? 1 : 0) : 0;

      if (d !== 0 && changed) {
        var inCls = d > 0 ? 'next' : 'prev';
        var outCls = d > 0 ? 'out-next' : 'out-prev';

        lbImg.classList.remove('out-next', 'out-prev');
        lbImg.style.pointerEvents = '';
        Array.prototype.slice.call(lbStage.querySelectorAll('.lb-incoming')).forEach(function (el) { el.remove(); });

        var incoming = document.createElement('img');
        incoming.className = 'lb-img lb-incoming ' + inCls;
        incoming.alt = items[idx].caption || '';
        incoming.src = target;
        if (lbBusy) lbBusy.classList.add('busy');
        incoming.onload = incoming.onerror = clearLbBusy;
        if (incoming.complete) clearLbBusy();
        lbStage.appendChild(incoming);
        void incoming.getBoundingClientRect();
        incoming.classList.remove(inCls);
        lbImg.classList.add(outCls);
        lbImg.style.pointerEvents = 'none';
        incoming.addEventListener('transitionend', function onEnd(e) {
          if (e.propertyName !== 'transform') return;
          incoming.removeEventListener('transitionend', onEnd);
          if (lbImg !== incoming && lbImg.parentNode) lbImg.remove();
          lbImg = incoming;
          incoming.classList.remove('lb-incoming');
        });
        preload(idx + 1);
        preload(idx - 1);
        return;
      }

      // Crossfade path (open, direct nav without animation).
      var seq = ++loadSeq;
      if (lbBusy) lbBusy.classList.add('busy');
      if (lbImg) lbImg.classList.add('switching');
      clearTimeout(switchTimer);
      switchTimer = setTimeout(function () {
        if (!lbImg) return;
        lbImg.onload = lbImg.onerror = function () {
          if (seq === loadSeq) clearLbBusy();
        };
        lbImg.src = target;
        updateLbMeta();
        requestAnimationFrame(function () {
          lbImg.classList.remove('switching');
          clearTimeout(switchTimer);
          switchTimer = null;
        });
      }, animate ? 170 : 0);
      preload(idx + 1);
      preload(idx - 1);
    }

    function nav(dir) { loadLb(lbIndex + dir, true, dir); }

    var lbCloseTimer = null;
    function openLb() {
      clearTimeout(lbCloseTimer);
      lightbox.classList.remove('closing');
      lbPanel.classList.remove('closing');
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      loadLb(current, false, 1);
    }
    function closeLb() {
      if (lightbox.hidden || lightbox.classList.contains('closing')) return;
      clearTimeout(switchTimer);
      clearTimeout(lbCloseTimer);
      lightbox.classList.add('closing');
      lbPanel.classList.add('closing');
      document.body.style.overflow = '';
      lbCloseTimer = setTimeout(function () {
        lightbox.hidden = true;
        lightbox.classList.remove('closing');
        lbPanel.classList.remove('closing');
      }, 260);
    }

    frame.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'IMG') openLb();
    });
    if (lbClose) lbClose.addEventListener('click', closeLb);
    if (lbPrev) lbPrev.addEventListener('click', function () { nav(-1); });
    if (lbNext) lbNext.addEventListener('click', function () { nav(1); });
    if (lbPanel) lbPanel.addEventListener('click', function (e) { e.stopPropagation(); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLb(); });
    addSwipe(lightbox.querySelector('.lb-stage'), function () { nav(1); }, function () { nav(-1); });

    // Keyboard: arrows browse, Esc closes
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) {
        if (e.key === 'ArrowLeft') show(current - 1, -1);
        else if (e.key === 'ArrowRight') show(current + 1, 1);
        return;
      }
      if (lightbox.classList.contains('closing')) return;
      if (e.key === 'Escape') { closeLb(); return; }
      if (e.key === 'ArrowLeft') nav(-1);
      else if (e.key === 'ArrowRight') nav(1);
    });
  }

  // ---------- Cursor glow (desktop, lively) ----------
  function initCursorGlow() {
    var body = document.body;
    if (!body.classList.contains('anim-lively')) return;
    if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
    var size = glow.offsetWidth || 520;
    var x = -9999, y = -9999, tx = x, ty = y, raf = null;
    function loop() {
      x += (tx - x) * 0.13;
      y += (ty - y) * 0.13;
      glow.style.transform = 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px)';
      if (Math.abs(tx - x) < 0.6 && Math.abs(ty - y) < 0.6) { raf = null; return; }
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      glow.style.opacity = '1';
      if (!raf) loop();
    }, { passive: true });
    document.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
  }

  // ---------- File preview modal ----------
  function initFilePreview() {
    var btns = Array.prototype.slice.call(document.querySelectorAll('[data-preview]'));
    if (!btns.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'file-preview-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="fp-panel" role="dialog" aria-modal="true">' +
        '<div class="fp-head">' +
          '<span class="fp-title"></span>' +
          '<button type="button" class="fp-close" aria-label="Close preview">\u2715</button>' +
        '</div>' +
        '<div class="fp-body"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var title = overlay.querySelector('.fp-title');
    var panel = overlay.querySelector('.fp-panel');
    var body = overlay.querySelector('.fp-body');
    var closeBtn = overlay.querySelector('.fp-close');
    var closeTimer = null;

    function model3dHtml(url) {
      return '<div class="model3d" data-model="' + esc(url) + '">' +
        '<div class="model3d-bar" role="toolbar" aria-label="3D view controls">' +
          '<span class="model3d-hint">Drag to rotate &middot; scroll to zoom</span>' +
          '<button type="button" class="model3d-btn" data-view="home" title="Home view">\u2302</button>' +
          '<button type="button" class="model3d-btn" data-view="zoom-in" title="Zoom in">+</button>' +
          '<button type="button" class="model3d-btn" data-view="zoom-out" title="Zoom out">\u2212</button>' +
          '<button type="button" class="model3d-btn" data-view="grid" title="Toggle grid">\u25a6</button>' +
        '</div>' +
      '</div>';
    }

    function close() {
      if (overlay.hidden || overlay.classList.contains('closing')) return;
      clearTimeout(closeTimer);
      overlay.classList.add('closing');
      panel.classList.add('closing');
      document.body.style.overflow = '';
      closeTimer = setTimeout(function () {
        overlay.hidden = true;
        overlay.classList.remove('closing');
        panel.classList.remove('closing');
        body.innerHTML = '';
        body.className = 'fp-body';
      }, 260);
    }

    function open(btn) {
      clearTimeout(closeTimer);
      overlay.classList.remove('closing');
      panel.classList.remove('closing');
      var url = btn.dataset.preview;
      var type = btn.dataset.type || 'text';
      var name = btn.dataset.name || url.split('/').pop();
      title.textContent = name;
      body.innerHTML = '';

      if (type === 'image') {
        var img = document.createElement('img');
        img.src = url;
        img.alt = name;
        body.appendChild(img);
      } else if (type === 'pdf') {
        var frame = document.createElement('iframe');
        frame.src = url;
        frame.setAttribute('title', name);
        body.appendChild(frame);
      } else if (type === 'model') {
        body.classList.add('model');
        body.innerHTML = model3dHtml(url);
      } else {
        var pre = document.createElement('pre');
        body.classList.add('text');
        body.appendChild(pre);
        var busy = document.createElement('div');
        busy.className = 'fp-busy';
        busy.textContent = 'Loading\u2026';
        body.appendChild(busy);
        fetch(url).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        }).then(function (txt) {
          pre.textContent = txt;
          busy.remove();
        }).catch(function () {
          busy.textContent = "Couldn't preview this file here \u2014 use the download button instead.";
        });
      }

      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
    }

    btns.forEach(function (b) { b.addEventListener('click', function () { open(b); }); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });
  }

  initBackToTop();
  initReveal();
  initCursorGlow();
  if (page === 'project') initGallery();
  initFilePreview();
  initVersionSwitch();
})();
