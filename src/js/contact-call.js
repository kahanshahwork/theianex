/* Contact hero: animated call tiles. Decorative only. */
(function () {
  var TX = window.TX, call = document.getElementById('call');
  if (!call) return;
  var w1 = TX.$$('#wave1 i'), w2 = TX.$$('#wave2 i'), items = TX.$$('.call-agenda li', call), turn = 0, k = 0, timer = null, ag = null;
  function bars(set, on) { set.forEach(function (b) { b.style.height = on ? (20 + Math.random() * 80) + '%' : '25%'; b.style.opacity = on ? 1 : .4; }); }
  function tick() { bars(w1, turn === 0); bars(w2, turn === 1); }
  function swap() { turn = 1 - turn; }
  function agenda() { k = (k + 1) % items.length; items.forEach(function (li, i) { li.classList.toggle('on', i === k); }); }
  function start() { if (timer) return; timer = setInterval(tick, 180); ag = setInterval(function () { swap(); }, 2600); ag2 = setInterval(agenda, 3600); }
  var ag2 = null;
  function stop() { clearInterval(timer); clearInterval(ag); clearInterval(ag2); timer = ag = ag2 = null; }
  if (TX.reduce) { bars(w1, false); bars(w2, false); return; }
  TX.onView(call, function (v) { v ? start() : stop(); }, '0px');
})();
