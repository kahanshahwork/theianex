/* ParaIQ screens: seven real screens stacked inside a small browser window. The scroll position brings the next one forward. */
(function () {
  var TX = window.TX, root = TX && TX.$('#screens'); if (!root) return;
  var slides = TX.$$('.sh', root), nameEl = TX.$('#shName'), names = (TX.$('.sh-win', root).getAttribute('data-names') || '').split(',');
  var n = slides.length, last = '';
  function ease(t) { return t * t * (3 - 2 * t); }
  function paint(q) {
    var s = '';
    slides.forEach(function (el, i) {
      var o = i - q, tx = 0, ty = 0, sc = 1, op = 1;
      if (o >= 0) {                       /* waiting behind: up and to the right, smaller, fading */
        var d = Math.min(o, 3);
        tx = d * 3.6; ty = -d * 4.6; sc = 1 - d * .045;
        op = d <= 1 ? 1 - d * .34 : Math.max(0, .66 - (d - 1) * .33);
      } else {                            /* leaving: slides down and away, fades */
        var g = Math.min(-o, 1);
        tx = -g * 5; ty = g * 9; sc = 1 + g * .01; op = 1 - g * 1.15;
      }
      el.style.opacity = Math.max(0, op).toFixed(3);
      el.style.transform = 'translate(' + tx.toFixed(2) + '%,' + ty.toFixed(2) + '%) scale(' + sc.toFixed(4) + ')';
      el.style.zIndex = String(40 - i);
      s += (o > -.5 && o < .5) ? i : '';
    });
    var front = Math.round(q); front = Math.max(0, Math.min(n - 1, front));
    if (String(front) !== last) { last = String(front); if (nameEl) nameEl.textContent = names[front] || ''; TX.$$('.sh-dot', root).forEach(function (d, i) { d.classList.toggle('on', i === front); d.setAttribute('aria-selected', i === front ? 'true' : 'false'); }); }
  }
  function update() {
    var P = root._pin; if (!P) return;
    var k = P.k, sp = P.sp;
    var q = k + (k < n - 1 ? ease(TX.clamp((sp - .5) / .5, 0, 1)) : 0);
    paint(TX.clamp(q, 0, n - 1));
  }
  if (TX.reduce) { paint(0); return; }
  addEventListener('txscroll', update); addEventListener('resize', update); update();
})();
