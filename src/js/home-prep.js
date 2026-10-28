/* "What we prepare": the three cards rise one after another as the section scrolls into view. */
(function () {
  var TX = window.TX, wrap = TX.$('#prepCards'), cards = TX.$$('.prep-card', wrap || document);
  if (!wrap || !cards.length) return;
  var ticking = false, smooth = function (t) { return t * t * (3 - 2 * t); };
  function update() {
    ticking = false;
    var vh = innerHeight;
    if (TX.reduce) { cards.forEach(function (c) { c.style.setProperty('--rise', 1); }); return; }
    if (innerWidth > 900) {
      var r = wrap.getBoundingClientRect(), base = TX.clamp((vh * .96 - r.top) / (vh * .62), 0, 1);
      cards.forEach(function (c, i) { c.style.setProperty('--rise', smooth(TX.clamp(base * 1.7 - i * .42, 0, 1)).toFixed(3)); });
    } else {
      cards.forEach(function (c) { var r = c.getBoundingClientRect(); c.style.setProperty('--rise', smooth(TX.clamp((vh * .96 - r.top) / (vh * .42), 0, 1)).toFixed(3)); });
    }
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  update();
})();
