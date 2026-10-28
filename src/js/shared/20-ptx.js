/* "Paraplanning" turns into "ParaTech", then the tagline follows. Scroll is the clock.
   <div class="ptx" data-ptx>  ...  .ptx-s > .ptx-o ("planning") + .ptx-n ("Tech")  ...  .ptx-tag
   Inside a pinned section it follows the pin's progress; elsewhere it follows its own place on screen. */
(function () {
  var TX = window.TX, clamp = TX.clamp, smooth = function (t) { return t * t * (3 - 2 * t); };
  var items = TX.$$('[data-ptx]').map(function (el) {
    var rg = (el.getAttribute('data-ptx') || '').split(',').map(parseFloat);
    return { el: el, box: TX.$('.ptx-s', el), o: TX.$('.ptx-o', el), n: TX.$('.ptx-n', el), tag: TX.$('.ptx-tag', el), pin: el.closest('[data-pin]'), a: isFinite(rg[0]) ? rg[0] : .16, b: isFinite(rg[1]) ? rg[1] : .5, wo: 0, wn: 0, last: -1, lastT: -1 };
  });
  if (!items.length) return;
  function measure() { items.forEach(function (I) { I.wo = I.o.offsetWidth; I.wn = I.n.offsetWidth; I.last = -1; }); update(); }
  function update() {
    var vh = innerHeight;
    items.forEach(function (I) {
      var p;
      if (I.pin && I.pin._pin) p = I.pin._pin.p;
      else { var r = I.el.getBoundingClientRect(); p = clamp((vh * .86 - r.top) / (vh * .6), 0, 1); }
      var k = TX.reduce ? 1 : smooth(clamp((p - I.a) / (I.b - I.a), 0, 1)), t = TX.reduce ? 1 : smooth(clamp((p - I.b + .02) / .26, 0, 1));
      if (Math.abs(k - I.last) > .002) {
        I.last = k;
        I.box.style.width = (I.wo + (I.wn - I.wo) * k).toFixed(1) + 'px';
        I.o.style.opacity = (1 - k).toFixed(3); I.o.style.transform = 'translateY(' + (-k * 42).toFixed(1) + '%)'; I.o.style.filter = 'blur(' + (k * 6).toFixed(1) + 'px)';
        I.n.style.opacity = k.toFixed(3); I.n.style.transform = 'translateY(' + ((1 - k) * 42).toFixed(1) + '%)'; I.n.style.filter = 'blur(' + ((1 - k) * 6).toFixed(1) + 'px)';
        I.el.style.setProperty('--k', k.toFixed(3));
      }
      if (I.tag && Math.abs(t - I.lastT) > .002) { I.lastT = t; I.tag.style.opacity = t.toFixed(3); I.tag.style.transform = 'translateY(' + ((1 - t) * 14).toFixed(1) + 'px)'; }
    });
  }
  measure();
  addEventListener('txscroll', update);
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
