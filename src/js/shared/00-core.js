/* Core: helpers, theme switch, navigation, progress bar, reveals, scrubbed text. */
(function () {
  var doc = document, root = doc.documentElement;
  var TX = (window.TX = window.TX || {});
  TX.$ = function (s, r) { return (r || doc).querySelector(s); };
  TX.$$ = function (s, r) { return [].slice.call((r || doc).querySelectorAll(s)); };
  TX.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  TX.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  TX.theme = function () { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; };
  /* run cb(true|false) whenever el enters or leaves the viewport */
  TX.onView = function (el, cb, margin) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (en) { cb(en[0].isIntersecting); }, { rootMargin: margin || '80px 0px' }).observe(el);
  };
  /* read a CSS colour token as a plain value (for canvas) */
  TX.token = function (name) { return getComputedStyle(root).getPropertyValue(name).trim(); };

  /* ---- theme switch ---- */
  var toggle = TX.$('#themeToggle'), toggles = TX.$$('#themeToggle, .js-theme');
  function paintToggle() {
    if (!toggle) return;
    var light = TX.theme() === 'light';
    toggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    TX.$$('.js-theme').forEach(function (b) { b.textContent = light ? 'Switch to dark theme' : 'Switch to light theme'; });
    var m = TX.$('meta[name=theme-color]');
    if (m) m.setAttribute('content', light ? '#f5f7fd' : '#03060f');
  }
  paintToggle();
  toggles.forEach(function (tb) { tb.addEventListener('click', function () {
    var next = TX.theme() === 'light' ? 'dark' : 'light';
    root.classList.add('theme-anim');
    root.setAttribute('data-theme', next);
    try { sessionStorage.setItem('tx-theme', next); } catch (e) {}
    paintToggle();
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    setTimeout(function () { root.classList.remove('theme-anim'); }, 700);
  }); });
  /* follow the device clock (light 6am to 6pm) until the visitor picks a theme for this visit */
  function clockTheme() { var h = new Date().getHours(); return (h >= 6 && h < 18) ? 'light' : 'dark'; }
  setInterval(function () {
    var saved = null; try { saved = sessionStorage.getItem('tx-theme'); } catch (x) {}
    if (saved === 'light' || saved === 'dark') return;
    var t = clockTheme();
    if (t === TX.theme()) return;
    root.setAttribute('data-theme', t); paintToggle();
    window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }, 30000);

  /* ---- menu ---- */
  var burger = TX.$('#burger'), fab = TX.$('#fab'), sheet = TX.$('#sheet');
  function setMenu(o) {
    sheet.classList.toggle('open', o);
    [burger, fab].forEach(function (b) {
      if (!b) return;
      b.setAttribute('aria-expanded', o ? 'true' : 'false');
      b.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
    });
    doc.body.style.overflow = o ? 'hidden' : '';
  }
  if (burger && sheet) {
    [burger, fab].forEach(function (b) { if (b) b.addEventListener('click', function () { setMenu(!sheet.classList.contains('open')); }); });
    TX.$$('a', sheet).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 901px)').addEventListener('change', function () { setMenu(false); });
  }

  /* ---- scroll: nav state, progress, scrubbed text ---- */
  var nav = TX.$('#nav'), prog = TX.$('#prog'), lastY = 0, ticking = false;
  var scrubs = TX.$$('[data-scrub]').map(function (el) {
    var words = el.textContent.trim().split(/\s+/); el.textContent = '';
    var spans = words.map(function (w, i) {
      var s = doc.createElement('span'); s.className = 'w'; s.textContent = w; el.appendChild(s);
      if (i < words.length - 1) el.appendChild(doc.createTextNode(' ')); return s;
    });
    return { el: el, spans: spans };
  });
  function onScroll() {
    ticking = false;
    var y = scrollY, vh = innerHeight, max = root.scrollHeight - vh;
    if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? TX.clamp(y / max, 0, 1) : 0) + ')';
    if (nav) {
      root.classList.toggle('fab-on', y > 140);
    nav.classList.toggle('scrolled', y > 30);
      nav.classList.toggle('hide', y > lastY + 4 && y > vh * 0.7 && !(sheet && sheet.classList.contains('open')));
      if (y < lastY - 4) nav.classList.remove('hide');
    }
    lastY = y;
    scrubs.forEach(function (s) {
      var r = s.el.getBoundingClientRect(), p = TX.clamp((vh * 0.84 - r.top) / (r.height + vh * 0.34), 0, 1), n = Math.round(p * s.spans.length * 1.04);
      for (var i = 0; i < s.spans.length; i++) s.spans[i].classList.toggle('on', i < n);
    });
    window.dispatchEvent(new CustomEvent('txscroll', { detail: { y: y, vh: vh } }));
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---- reveals ---- */
  var rvs = TX.$$('.rv');
  if ('IntersectionObserver' in window && !TX.reduce) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    rvs.forEach(function (el) { io.observe(el); });
  } else rvs.forEach(function (el) { el.classList.add('in'); });
})();
