/* Why Theianex: the climb of Everest.
   One mountain drawn as a single outline. Scroll drives a camera:
     whole mountain (title inside it) -> zoom to the base -> zoom in on flag 1 -> zoom out, the trail climbs the slope ->
     zoom in on flag 2 -> ... -> pull back to the whole mountain for the end title.
   The line is SVG in world units (the camera is one transform on a group). Text is HTML laid out in screen space, so it is
   always straight and crisp: the problem in the sky beside the flag, how Theianex helps inside the mountain. No library.
   With reduced motion the mountain is dropped and the steps stack as plain content. */
(function () {
  var TX = window.TX, root = TX.$('#mtn');
  if (!root) return;
  if (TX.reduce) { root.classList.add('mtn-static'); return; }

  var stick = TX.$('#mtnStick'), svg = TX.$('#mtnSvg'), world = TX.$('#mtnWorld'), name = TX.$('#mtnName'),
      steps = TX.$$('.mt-step[data-i]'), intro = TX.$('#mtnIntro'), sum = TX.$('#mtnSum'), phs = TX.$$('.ph', sum), go = TX.$('#mtnGo');
  var clamp = TX.clamp, NS = 'http://www.w3.org/2000/svg';
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- the mountain, world units (1 unit = 1 px at the flag zoom) ---------- */
  var Y0 = 3750, PX = 2800, RW = 2900;
  function rough(t) { return 30 * Math.sin(t * 17 + .4) + 14 * Math.sin(t * 47 + 1.3) + 6 * Math.sin(t * 120); }
  function L(t) { return [PX * t, Y0 - 3750 * (t + .05 * Math.sin(t * Math.PI * 3)) + rough(t) * sm(t / .05) * (1 - sm((t - .9) / .08))]; }
  function R(r) {
    var g = Math.pow(r, 1.1) * .86 + .14 * r * r * r + .018 * Math.sin(r * 22) * sm(r / .12);
    return [PX + RW * r, 3750 * g + (22 * Math.sin(r * 19 + .7) + 8 * Math.sin(r * 61)) * sm(r / .14)];
  }

  var left = [], i, t, n, xx;
  for (xx = -420; xx < 0; xx += 28) left.push([xx, Y0 - 1.15 * xx]);               // a little ground before the trail starts
  n = 520; for (i = 0; i <= n; i++) left.push(L(.965 * i / n));
  var iX0 = 0; while (left[iX0][0] < 0) iX0++;
  var A = left[left.length - 1], A2 = left[left.length - 7], dA = Math.atan2(A[1] - A2[1], A[0] - A2[0]);
  var B = R(.04), B2 = R(.05), dB = Math.atan2(B2[1] - B[1], B2[0] - B[0]);
  var c1 = [A[0] + Math.cos(dA) * 120, A[1] + Math.sin(dA) * 120], c2 = [B[0] - Math.cos(dB) * 120, B[1] - Math.sin(dB) * 120];
  var cap = [];
  for (i = 1; i <= 50; i++) {
    t = i / 50; var u1 = 1 - t;
    cap.push([u1 * u1 * u1 * A[0] + 3 * u1 * u1 * t * c1[0] + 3 * u1 * t * t * c2[0] + t * t * t * B[0],
              u1 * u1 * u1 * A[1] + 3 * u1 * u1 * t * c1[1] + 3 * u1 * t * t * c2[1] + t * t * t * B[1]]);
  }
  var iTop = 0; cap.forEach(function (p, j) { if (p[1] < cap[iTop][1]) iTop = j; });
  var route = left.concat(cap.slice(0, iTop + 1)), summit = route[route.length - 1];
  var right = cap.slice(iTop);
  for (i = 1; i <= 280; i++) right.push(R(.04 + 1.1 * i / 280));

  var cum = [0];
  for (i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  var LT = cum[cum.length - 1], S0 = cum[iX0], LL = LT - S0;
  function idxAt(s) { var lo = 0, hi = cum.length - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } return lo; }
  function ptAt(s) {
    s = clamp(s, 0, LT); var k = idxAt(s), kk = Math.min(k + 1, route.length - 1), a = route[k], b = route[kk], d = cum[kk] - cum[k] || 1, f = (s - cum[k]) / d;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  var SCP = [.17, .34, .51, .68, .85].map(function (f) { return S0 + LL * f; });
  var CPT = SCP.map(ptAt), SIN = S0 + LL * .02, SEND = LT;

  /* ---------- draw the scene once ---------- */
  function mk(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); (parent || world).appendChild(e); return e; }
  function poly(pts, step) {
    var d = ''; for (var j = 0; j < pts.length; j += step) d += (j ? 'L' : 'M') + pts[j][0].toFixed(1) + ' ' + pts[j][1].toFixed(1);
    var last = pts[pts.length - 1]; return d + 'L' + last[0].toFixed(1) + ' ' + last[1].toFixed(1);
  }
  var defs = mk('defs', {}, svg);
  var gr = mk('linearGradient', { id: 'mtnBody', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  mk('stop', { offset: 0, style: 'stop-color:var(--acc2);stop-opacity:.20' }, gr);
  mk('stop', { offset: .5, style: 'stop-color:var(--acc);stop-opacity:.07' }, gr);
  mk('stop', { offset: 1, style: 'stop-color:var(--acc);stop-opacity:.01' }, gr);
  var BOT = Y0 + 900;
  mk('path', { class: 'mt-fill', d: poly(route, 5) + 'L' + summit[0] + ' ' + BOT + 'L-420 ' + BOT + 'Z' });
  mk('path', { class: 'mt-fill', d: poly(right, 5) + 'L' + right[right.length - 1][0] + ' ' + BOT + 'L' + summit[0] + ' ' + BOT + 'Z' });
  [[140, 330, .9], [300, 700, .6], [480, 1150, .38]].forEach(function (o) {
    var c = mk('path', { class: 'mt-cont', d: poly(left.slice(iX0), 6), transform: 'translate(' + o[0] + ' ' + o[1] + ')' }); c.style.opacity = o[2];
  });
  mk('path', { class: 'mt-line', d: poly(route, 3) });
  mk('path', { class: 'mt-line', d: poly(right, 3) });
  var prog = mk('path', { class: 'mt-route', d: '' });
  function flagAt(pt, h) {
    var g = mk('g', { class: 'mt-fg' });
    mk('path', { class: 'mt-flag', d: 'M' + pt[0] + ' ' + pt[1] + 'L' + pt[0] + ' ' + (pt[1] - h) }, g);
    mk('path', { class: 'mt-flagf', d: 'M' + pt[0] + ' ' + (pt[1] - h) + 'L' + (pt[0] + h * .56) + ' ' + (pt[1] - h * .8) + 'L' + pt[0] + ' ' + (pt[1] - h * .6) + 'Z' }, g);
    return g;
  }
  var flags = CPT.map(function (pt) { return flagAt(pt, 120); });
  var topFlag = flagAt(summit, 220);
  var dot = mk('circle', { r: 6 });

  /* ---------- the camera ---------- */
  var sw = 0, sh = 0, mob = false, K, KEYS = [], HOLD = [];
  function key(p, s, q, ax, ay, k) { KEYS.push({ p: p, s: s, qx: q[0], qy: q[1], ax: ax, ay: ay, k: k }); }
  function measure() {
    sw = stick.clientWidth; sh = stick.clientHeight; mob = sw <= 900;
    K = mob
      ? { kO: sh * .34 / 3750, ov: [.56, .62], kB: .4, kM: .26, cy: .47 }
      : { kO: Math.min(sw * .000119, sh * .72 / 3750), ov: [.52, .19], kB: .5, kM: .36, cy: .52 };
    stick.style.setProperty('--ay', (K.cy * sh).toFixed(1) + 'px');
    KEYS = []; HOLD = [];
    var OV = [summit[0], summit[1]];
    key(0, SIN, OV, K.ov[0], K.ov[1], K.kO); key(.07, SIN, OV, K.ov[0], K.ov[1], K.kO);
    key(.13, SIN, ptAt(SIN + 560), .5, K.cy + .08, K.kB);
    key(.18, SCP[0], CPT[0], .5, K.cy, 1); key(.26, SCP[0], CPT[0], .5, K.cy, 1); HOLD.push([.18, .26]);
    for (var j = 1; j < 5; j++) {
      var t0 = .26 + .14 * (j - 1), sm_ = (SCP[j - 1] + SCP[j]) / 2;
      key(t0 + .03, sm_, ptAt(sm_), .5, .55, K.kM);
      key(t0 + .06, SCP[j], CPT[j], .5, K.cy, 1); key(t0 + .14, SCP[j], CPT[j], .5, K.cy, 1); HOLD.push([t0 + .06, t0 + .14]);
    }
    key(.94, SEND, OV, K.ov[0], K.ov[1], K.kO); key(1, SEND, OV, K.ov[0], K.ov[1], K.kO);
  }
  function cam(p) {
    for (var j = 0; j < KEYS.length - 1; j++) {
      var a = KEYS[j], b = KEYS[j + 1];
      if (p <= b.p) {
        var f = sm((p - a.p) / (b.p - a.p));
        return { s: lerp(a.s, b.s, f), qx: lerp(a.qx, b.qx, f), qy: lerp(a.qy, b.qy, f), ax: lerp(a.ax, b.ax, f), ay: lerp(a.ay, b.ay, f), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), f)) };
      }
    }
    var e = KEYS[KEYS.length - 1]; return { s: e.s, qx: e.qx, qy: e.qy, ax: e.ax, ay: e.ay, k: e.k };
  }

  var lastKey = '';
  function render() {
    var r = root.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < -vh * .3 || r.top > vh * 1.3) return;
    var span = Math.max(r.height - sh, 1), p = clamp(-r.top / span, 0, 1);
    var key_ = p.toFixed(5) + '|' + sw + 'x' + sh;
    if (key_ === lastKey) return; lastKey = key_;

    var c = cam(p), k = c.k, ox = c.ax * sw - c.qx * k, oy = c.ay * sh - c.qy * k;
    world.setAttribute('transform', 'translate(' + ox.toFixed(1) + ' ' + oy.toFixed(1) + ') scale(' + k.toFixed(5) + ')');

    /* the trail climbed so far, and the climber */
    var q = ptAt(c.s), ci = idxAt(c.s), pts = route.slice(iX0 - 1, ci + 1); pts.push(q);
    prog.setAttribute('d', poly(pts, 3));
    dot.setAttribute('cx', q[0].toFixed(1)); dot.setAttribute('cy', q[1].toFixed(1)); dot.setAttribute('r', (6 / Math.max(k, .12)).toFixed(1));
    flags.forEach(function (f, j) { f.classList.toggle('on', c.s >= SCP[j] - 12); });
    topFlag.classList.toggle('on', c.s >= SEND - 12);

    /* the mountain's name above the summit when the whole mountain is in view */
    var nl = clamp((.3 - k) / .1, 0, 1);
    name.style.opacity = nl.toFixed(2);
    name.style.transform = 'translate(' + (ox + summit[0] * k).toFixed(1) + 'px,' + (oy + summit[1] * k - 220 * k - 8).toFixed(1) + 'px) translate(-50%,-100%)';

    /* introduction */
    setStep(intro, 1 - sm((p - .06) / .04));

    /* checkpoints */
    for (var j = 0; j < steps.length; j++) {
      var h = HOLD[j], fi = clamp((p - (h[0] - .01)) / .025, 0, 1), fo = clamp((h[1] + .025 - p) / .025, 0, 1);
      setStep(steps[j], fi * fo);
    }

    /* summit */
    setStep(sum, clamp((p - .9) / .04, 0, 1));
    phs.forEach(function (ph, n2) { ph.classList.toggle('on', p > [.935, .95, .965][n2]); });
  }
  function setStep(el, o) {
    el.style.opacity = o.toFixed(3);
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
    scrollTo({ top: scrollY + r.top + span * .22, behavior: 'smooth' });
  });
  root.classList.add('mtn-live');
  relayout();
})();
