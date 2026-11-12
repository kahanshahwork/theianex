/* Why Theianex: the climb.
   One long SVG mountain. Scroll position p (0..1 through the section) drives a camera that follows the route:
   the SVG viewBox is the camera (pan, zoom, pull back), the ridges and route are drawn with stroke-dashoffset,
   the finer lines are revealed by a mask that moves up ahead of the climber.
   Text and markers are HTML in screen space, placed from the camera so they stay crisp. No library.
   With reduced motion the mountain is dropped and the steps stack as plain content. */
(function () {
  var TX = window.TX, root = TX.$('#mtn');
  if (!root) return;
  if (TX.reduce) { root.classList.add('mtn-static'); return; }

  var stick = TX.$('#mtnStick'), svg = TX.$('#mtnSvg'), route = TX.$('#mtnRoute'), rL = TX.$('#mtnL'), rR = TX.$('#mtnR'),
      dot = TX.$('#mtnDot'), flag = TX.$('#mtnFlag'), front = TX.$('#mtnFront'), lay = TX.$('#mtnLay'),
      cons = TX.$$('path', TX.$('#mtnCon')), cps = TX.$$('.mt-cp'), steps = TX.$$('.mt-step[data-i]'),
      intro = TX.$('#mtnIntro'), sum = TX.$('#mtnSum'), phs = TX.$$('.ph', sum), go = TX.$('#mtnGo');
  var SX = 520, SY = 200;
  var clamp = TX.clamp;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function win(p, p0, p1, fi, fo) { return clamp((p - p0) / fi, 0, 1) * clamp((p1 - p) / fo, 0, 1); }

  /* geometry tables */
  var RL = route.getTotalLength(); route.style.strokeDasharray = RL;
  function table(path) {
    var L = path.getTotalLength(), n = 320, a = [];
    for (var i = 0; i <= n; i++) a.push(path.getPointAtLength(L * i / n).y);
    path.style.strokeDasharray = L;
    return { L: L, a: a, n: n };
  }
  var tL = table(rL), tR = table(rR);
  function lenAtY(t, y) {
    if (y >= t.a[0]) return 0; if (y <= t.a[t.n]) return t.L;
    var lo = 0, hi = t.n;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (t.a[m] >= y) lo = m; else hi = m; }
    var f = (t.a[lo] - y) / ((t.a[lo] - t.a[hi]) || 1);
    return t.L * (lo + f) / t.n;
  }
  var CPS = [.15, .31, .47, .63, .80];
  var cpPt = CPS.map(function (f) { return route.getPointAtLength(RL * f); });
  var phS = [.86, .93, 1];
  var phPt = phS.map(function (f) { return route.getPointAtLength(RL * f); });

  /* the climb: route progress for each stretch of scroll (travel, then hold while the words are up) */
  var KEYS = [[0, 0], [.10, .012], [.17, CPS[0]], [.25, CPS[0]], [.32, CPS[1]], [.40, CPS[1]], [.47, CPS[2]], [.55, CPS[2]],
              [.62, CPS[3]], [.70, CPS[3]], [.77, CPS[4]], [.83, CPS[4]], [.89, 1], [1, 1]];
  function S(p) {
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (p <= b[0]) return a[1] + (b[1] - a[1]) * sm((p - a[0]) / (b[0] - a[0]));
    }
    return 1;
  }

  /* screen */
  var sw = 0, sh = 0, mob = false, P, anch = [], layLeft = 0;
  function measure() {
    sw = stick.clientWidth; sh = stick.clientHeight; mob = sw <= 900;
    P = mob ? { W0: 1000, W1: 900, W2: 1100, MY0: .9, MY1: .23, MYS: .3, lead: .16 }
            : { W0: 2000, W1: 1250, W2: 1650, MY0: .8, MY1: .54, MYS: .42, lead: .2 };
    var sr = stick.getBoundingClientRect(), lr = lay.getBoundingClientRect();
    layLeft = lr.left - sr.left;
    anch = steps.map(function (st) {
      var tx = TX.$('.mt-tx', st), side = st.getAttribute('data-side');
      var top = mob ? tx.offsetTop : tx.offsetTop - tx.offsetHeight / 2, left = layLeft + tx.offsetLeft;
      if (mob) return { x: sw / 2, y: top - 10 };
      return { x: side === 'l' ? left + tx.offsetWidth + 16 : left - 16, y: top + 24 };
    });
  }

  var last = -1, lastKey = '';
  function render() {
    var r = root.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < -vh * .3 || r.top > vh * 1.3) return;
    var span = Math.max(r.height - sh, 1), p = clamp(-r.top / span, 0, 1);
    var key = p.toFixed(5) + '|' + sw + 'x' + sh;
    if (key === lastKey) return; lastKey = key;

    var s = S(p), u = sm((p - .89) / .07);
    var W = lerp(lerp(P.W0, P.W1, sm(s / .55)), P.W2, u), vbH = W * sh / sw;
    var my = lerp(lerp(P.MY0, P.MY1, sm(p / .17)), P.MYS, u);
    var pt = route.getPointAtLength(RL * s);
    var cx = lerp(pt.x, SX, u), cy = pt.y + (.5 - my) * vbH;
    var vx = cx - W / 2, vy = cy - vbH / 2, k = sw / W;
    svg.setAttribute('viewBox', vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + W.toFixed(1) + ' ' + vbH.toFixed(1));
    svg.style.setProperty('--sw', (1.5 / k).toFixed(3));

    /* drawing: route up to the climber; ridges and fine lines ahead of the camera */
    var fy = lerp(vy + vbH * P.lead, -120, u);
    route.style.strokeDashoffset = (RL * (1 - s)).toFixed(1);
    rL.style.strokeDashoffset = (tL.L - lenAtY(tL, fy)).toFixed(1);
    rR.style.strokeDashoffset = (tR.L - lenAtY(tR, fy)).toFixed(1);
    front.setAttribute('y', fy.toFixed(1));
    dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1)); dot.setAttribute('r', (7 / Math.max(k, .45) * .9).toFixed(1));
    flag.classList.toggle('on', p > .93);

    function X(x) { return (x - vx) * k; } function Y(y) { return (y - vy) * k; }

    /* introduction */
    var oi = win(p, -1, .09, 1, .03);
    setStep(intro, oi, 0, -(1 - clamp((.09 - p) / .03, 0, 1)) * 12);

    /* checkpoints */
    var act = -1;
    for (var i = 0; i < steps.length; i++) {
      var a = .10 + .15 * i, fi = clamp((p - (a + .055)) / .03, 0, 1), fo = clamp((a + .16 - p) / .03, 0, 1), o = fi * fo;
      setStep(steps[i], o, i, fi < 1 ? (1 - fi) * 16 : -(1 - fo) * 10);
      if (o > .45) act = i;
      var m = cps[i], mx = X(cpPt[i].x), mvy = Y(cpPt[i].y);
      m.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,' + mvy.toFixed(1) + 'px,0)';
      m.style.opacity = clamp((s - (CPS[i] - .08)) / .05, 0, 1).toFixed(2);
      m.classList.toggle('pass', s >= CPS[i] - .003);
      m.classList.toggle('now', o > .45);
      var c = cons[i];
      if (o > .02 && !(mob && false)) {
        var ax = anch[i].x, ay = anch[i].y, dx = ax - mx, dy = ay - mvy, d = Math.sqrt(dx * dx + dy * dy) || 1, sx = mx + dx / d * 14, sy = mvy + dy / d * 14;
        var len = Math.max(d - 14, 1);
        c.setAttribute('d', 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' L' + ax.toFixed(1) + ' ' + ay.toFixed(1));
        c.style.strokeDasharray = len.toFixed(1); c.style.strokeDashoffset = (len * (1 - fi) + len * (1 - fo) * .6).toFixed(1); c.style.opacity = o.toFixed(2);
      } else c.style.opacity = 0;
    }

    /* summit */
    var os = win(p, .86, 2, .04, 1);
    setStep(sum, os, -1, (1 - clamp((p - .86) / .04, 0, 1)) * 16);
    phs.forEach(function (ph, j) {
      var on = p > [.915, .94, .965][j];
      ph.classList.toggle('on', on);
      var c = cons[5 + j];
      if (!mob && on) {
        var pr = ph.getBoundingClientRect(), sr = stick.getBoundingClientRect();
        var ax = pr.left - sr.left - 8, ay = pr.top - sr.top + pr.height * .5, mx = X(phPt[j].x), my2 = Y(phPt[j].y);
        var dx = ax - mx, dy = ay - my2, d = Math.sqrt(dx * dx + dy * dy) || 1;
        c.setAttribute('d', 'M' + (mx + dx / d * 8).toFixed(1) + ' ' + (my2 + dy / d * 8).toFixed(1) + ' L' + ax.toFixed(1) + ' ' + ay.toFixed(1));
        c.style.strokeDasharray = d.toFixed(1); c.style.strokeDashoffset = 0; c.style.opacity = .9;
      } else c.style.opacity = 0;
    });
  }
  function setStep(el, o, i, ty) {
    el.style.opacity = o.toFixed(3);
    el.style.setProperty('--ty', ty.toFixed(1) + 'px');
    el.classList.toggle('vis', o > .01);
    el.classList.toggle('on', o > .45);
  }

  function relayout() { measure(); lastKey = ''; render(); }
  addEventListener('txscroll', render);
  addEventListener('resize', function () { clearTimeout(relayout.t); relayout.t = setTimeout(relayout, 80); });
  addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if (go) go.addEventListener('click', function (e) {
    e.preventDefault();
    var r = root.getBoundingClientRect(), span = Math.max(r.height - sh, 1);
    scrollTo({ top: scrollY + r.top + span * .205, behavior: 'smooth' });
  });
  root.classList.add('mtn-live');
  relayout();
})();
