/* Pinned, scroll-driven steps.
   <section class="pin" data-pin="3">  (tall)
     <div class="pin-stick">           (sticks to the screen while the section scrolls past)
       [data-tab="k"]   buttons: lit for the current step, filled like a progress bar, click to jump
       [data-panel="k"] one panel per step, only the current one shows
       [data-at=".3"]   inside a panel: appears once the step is that far through
       [data-type="text"] types itself out as the step progresses (data-t0 / data-t1 set when)
       [data-lit]       words light up across the whole pin
   The scroll position is the only clock: nothing here runs on a timer.
   Fires "tx:focus" when the step changes so the 3D scene can react, and keeps root._pin = {p, f, k, sp, n} for other scripts. */
(function () {
  var TX = window.TX, doc = document, clamp = TX.clamp, pins = [];

  function wrapWords(el) {
    var spans = [];
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          c.nodeValue.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(doc.createTextNode(w)); return; }
            var s = doc.createElement('span'); s.className = 'lw'; s.textContent = w; frag.appendChild(s); spans.push(s);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    })(el);
    return spans;
  }

  TX.$$('[data-pin]').forEach(function (root) {
    var tabs = TX.$$('[data-tab]', root), panels = TX.$$('[data-panel]', root);
    var n = +root.getAttribute('data-pin') || tabs.length || 1;
    var P = { root: root, n: n, k: -1, tabs: tabs, panels: panels, ats: [], types: [], lits: [] };
    root.style.setProperty('--steps', n);
    panels.forEach(function (pn, j) { P.ats[j] = TX.$$('[data-at]', pn).map(function (el) { return { el: el, at: parseFloat(el.getAttribute('data-at')) || 0 }; }); });
    TX.$$('[data-type]', root).forEach(function (el) {
      var pn = el.closest('[data-panel]'), txt = el.getAttribute('data-type');
      P.types.push({ el: el, txt: txt, j: pn ? +pn.getAttribute('data-panel') : 0, t0: parseFloat(el.getAttribute('data-t0')) || .06, t1: parseFloat(el.getAttribute('data-t1')) || .6, last: -1 });
      el.textContent = '';
    });
    TX.$$('[data-lit]', root).forEach(function (el) {
      var rg = (el.getAttribute('data-lit') || '').split(',').map(parseFloat);
      P.lits.push({ spans: wrapWords(el), a: isFinite(rg[0]) ? rg[0] : .06, b: isFinite(rg[1]) ? rg[1] : .82, last: -1 });
    });
    tabs.forEach(function (t) {
      t.setAttribute('role', 'tab');
      t.addEventListener('click', function () { go(P, +t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return; e.preventDefault();
        var k = clamp(P.k + d, 0, P.n - 1); go(P, k); if (tabs[k]) tabs[k].focus();
      });
    });
    root._pin = { p: 0, f: 0, k: 0, sp: 0, n: n };
    pins.push(P);
  });

  /* click: scroll so that the step sits comfortably into view */
  function go(P, k) {
    var r = P.root.getBoundingClientRect(), span = Math.max(r.height - innerHeight, 1), y = r.top + scrollY + span * ((k + .42) / P.n);
    scrollTo({ top: y, behavior: TX.reduce ? 'auto' : 'smooth' });
  }

  function update() {
    var vh = innerHeight;
    pins.forEach(function (P) {
      var r = P.root.getBoundingClientRect();
      if (r.bottom < -vh * .5 || r.top > vh * 1.5) return;
      var span = Math.max(r.height - vh, 1), p = clamp(-r.top / span, 0, 1), f = p * P.n, k = Math.min(P.n - 1, Math.floor(f)), sp = f - k;
      P.root._pin.p = p; P.root._pin.f = f; P.root._pin.k = k; P.root._pin.sp = sp;
      P.root.style.setProperty('--p', p.toFixed(4)); P.root.style.setProperty('--sp', sp.toFixed(4));
      if (k !== P.k) {
        P.k = k; P.root.setAttribute('data-step', k);
        P.tabs.forEach(function (t, j) { var on = +t.getAttribute('data-tab') === k; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.setAttribute('tabindex', on ? '0' : '-1'); });
        P.panels.forEach(function (pn) { pn.classList.toggle('is-active', +pn.getAttribute('data-panel') === k); });
        window.dispatchEvent(new CustomEvent('tx:focus', { detail: { index: k, k: P.n, el: P.root } }));
      }
      P.tabs.forEach(function (t) { var j = +t.getAttribute('data-tab'); t.style.setProperty('--f', (j < k ? 1 : j === k ? sp : 0).toFixed(3)); });
      P.ats.forEach(function (list, j) { list.forEach(function (a) { a.el.classList.toggle('on', j < k || (j === k && sp >= a.at)); }); });
      P.types.forEach(function (T) {
        var q = T.j < k ? 1 : T.j > k ? 0 : clamp((sp - T.t0) / (T.t1 - T.t0), 0, 1), c = Math.round(q * T.txt.length);
        if (c !== T.last) { T.last = c; T.el.textContent = T.txt.slice(0, c); T.el.classList.toggle('typing', c > 0 && c < T.txt.length); }
      });
      P.lits.forEach(function (L) {
        var c = Math.round(clamp((p - L.a) / (L.b - L.a), 0, 1) * L.spans.length);
        if (c !== L.last) { L.last = c; L.spans.forEach(function (s, i) { s.classList.toggle('on', i < c); }); }
      });
    });
  }
  window.TX.pinUpdate = update;
  addEventListener('txscroll', update);
  addEventListener('resize', update);
  addEventListener('load', update);
  update();
})();
