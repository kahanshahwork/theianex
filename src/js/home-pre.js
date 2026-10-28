/* Home intro: a short logo moment on the first visit of a session, then the hero starts. */
(function () {
  var pre = document.getElementById('pre'), TX = window.TX;
  var seen = false;
  try { seen = sessionStorage.getItem('tx-pre') === '1'; } catch (e) {}
  var quick = seen || (TX && TX.reduce) || new URLSearchParams(location.search).has('nopre');
  function go() {
    window.__preDone = true;
    if (pre) { pre.classList.add('done'); setTimeout(function () { pre.style.display = 'none'; }, 1100); }
    setTimeout(function () { if (window.__heroStart) window.__heroStart(); }, quick ? 0 : 300);
  }
  if (!pre) return go();
  if (quick) { document.documentElement.classList.add('no-pre'); return go(); }
  try { sessionStorage.setItem('tx-pre', '1'); } catch (e) {}
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var minWait = new Promise(function (r) { setTimeout(r, 1500); });
  Promise.race([Promise.all([fonts, minWait]), new Promise(function (r) { setTimeout(r, 3200); })]).then(go);
})();
