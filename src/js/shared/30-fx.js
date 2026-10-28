/* Text that reacts to scroll: focus/blur headlines, highlight bars, chapter marker. */
(function () {
  var TX = window.TX, doc = document;
  var chapN = TX.$('#chapN'), chapT = TX.$('#chapT'), chap = TX.$('#chap');
  var focusEls = TX.$$('main .h1:not(.hero-title), main .h2').filter(function (el) { return !el.closest('.hero'); });
  focusEls.forEach(function (el) { el.classList.remove('rv'); el.setAttribute('data-fx', 'focus'); });
  var hls = TX.$$('main mark.hl');
  var chapters = [], lastIdx = -1, ticking = false;
  function readChapters() {
    chapters = TX.$$('[data-chapter]').map(function (el) { var r = el.getBoundingClientRect(); return { top: r.top + scrollY, name: el.getAttribute('data-chapter') }; });
  }
  function update() {
    ticking = false;
    var vh = innerHeight, mid = vh * 0.5;
    focusEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -vh * .4 || r.top > vh * 1.4) return;
      var c = r.top + r.height / 2, d = (c - mid) / mid;           /* -1 top .. 1 bottom */
      var ad = Math.abs(d), o = 1 - TX.clamp((ad - .78) / .5, 0, 1), b = TX.clamp((ad - .72) / .55, 0, 1) * 7;
      el.style.setProperty('--fx-o', o.toFixed(3));
      el.style.setProperty('--fx-b', b.toFixed(2) + 'px');
      el.style.setProperty('--fx-y', (d * 14).toFixed(1) + 'px');
    });
    hls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var p = TX.clamp((vh * 0.8 - r.top) / (vh * 0.3), 0, 1);
      el.style.setProperty('--p', p.toFixed(3)); el.classList.toggle('full', p > .97);
    });
    if (document.body.classList.contains('is-home')) { var h = TX.$('#hero'); document.body.classList.toggle('past-hero', !!h && h.getBoundingClientRect().bottom < vh * .6); }
    if (chapN && chapters.length) {
      var y = scrollY + vh * .55, idx = 0;
      for (var k = 0; k < chapters.length; k++) if (chapters[k].top <= y) idx = k;
      if (idx !== lastIdx) {
        lastIdx = idx;
        var num = idx + (document.body.classList.contains('is-home') ? 0 : 1); chapN.textContent = (num < 10 ? '0' : '') + num; chapT.textContent = chapters[idx].name;
        chap.classList.remove('swap'); void chap.offsetWidth; chap.classList.add('swap');
      }
    }
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  readChapters(); update();
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', function () { readChapters(); req(); });
  addEventListener('load', function () { readChapters(); update(); });
  setInterval(function () { readChapters(); }, 1500);
})();
