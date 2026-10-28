/* How we work hero: scattered client documents are pulled through the gate and come out as one
   structured advice document. Scroll plays it, one checkpoint per scroll step (left to right, top to bottom on phones). */
(function () {
  var TX = window.TX, cv = document.getElementById('convCv');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d'), box = cv.parentElement, core = document.getElementById('convCore');
  var hero = document.getElementById('how-hero');
  var T = 12.4, LIFE = 6.4, W = 0, H = 0, vert = false, N = 0, K = 0, frags = [], lines = [], doc = {}, gate = 0, C = {};
  var clk = 0, last = 0, running = false, visible = false;

  function colors() {
    C = { surf: TX.token('--surf2'), surf1: TX.token('--surf'), line: TX.token('--line2'), acc: TX.token('--acc'), mute: TX.token('--mute'), ink: TX.token('--ink'), ok: TX.token('--ok'), bg: TX.token('--bg') };
  }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var sm = function (t) { t = TX.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function layout() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = box.clientWidth; H = box.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vert = W < 560; N = vert ? 15 : 24; K = N;
    var dh, dw;
    if (!vert) { dh = H * .84; dw = Math.min(dh * .72, W * .27); doc = { x: W * .79 - dw / 2, y: (H - dh) / 2, w: dw, h: dh }; gate = W * .5; core.style.left = gate + 'px'; core.style.top = '50%'; }
    else { dw = W * .62; dh = H * .36; doc = { x: (W - dw) / 2, y: H * .58, w: dw, h: dh }; gate = H * .45; core.style.left = '50%'; core.style.top = gate + 'px'; }
    var r = rng(11), pad = doc.w * .1, top = doc.y + doc.h * .12, avail = doc.h * .66, pitch = avail / K;
    lines = [];
    for (var k = 0; k < K; k++) {
      var head = k % 6 === 0, len = (head ? .34 : .5 + r() * .4) * (doc.w - 2 * pad);
      lines.push({ x: doc.x + pad, y: top + k * pitch, w: len, h: Math.max(2.4, head ? pitch * .62 : pitch * .36), head: head });
    }
    var sc = vert ? .72 : 1;
    frags = [];
    for (var i = 0; i < N; i++) {
      var kind = i % 4, w = (54 + r() * 40) * sc, h = (kind === 2 ? 34 + r() * 14 : 44 + r() * 28) * sc;
      var cx = vert ? W * (.1 + r() * .8) : W * (.05 + r() * .32), cy = vert ? H * (.05 + r() * .27) : H * (.12 + r() * .76);
      frags.push({ kind: kind, w: w, h: h, x: cx, y: cy, rot: (r() - .5) * 1.1, ph: r() * 6.28, ph2: r() * 6.28, arr: 3.0 + (i / N) * 5.4, slot: i, gy: 0 });
    }
    // fragments reach the gate at points spread across it
    frags.forEach(function (f, i) { f.gy = (vert ? W : H) * (.22 + .56 * ((i * 7 % N) / N)); });
    if (!running) draw(clk);
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function drawFrag(f, w, h, alpha, glow) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.surf; ctx.strokeStyle = glow > .05 ? C.acc : C.line; ctx.lineWidth = 1.3;
    rr(-w / 2, -h / 2, w, h, Math.min(8, h * .22)); ctx.fill(); ctx.stroke();
    if (w < 24) return;
    ctx.globalAlpha = alpha * .55; ctx.fillStyle = C.mute;
    var k = f.kind, ix = -w / 2 + w * .12, iw = w * .76, y0 = -h / 2 + h * .22;
    if (k === 0 || k === 3) { for (var j = 0; j < 3; j++) { ctx.fillRect(ix, y0 + j * h * .22, iw * (j === 2 ? .55 : 1), Math.max(1.6, h * .07)); } }
    else if (k === 1) { var cw = iw / 3 - 2, ch = h * .2; for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) { ctx.globalAlpha = alpha * (a === 0 ? .6 : .3); ctx.fillRect(ix + b * (cw + 3), y0 + a * (ch + 3), cw, ch); } }
    else { ctx.globalAlpha = alpha * .8; ctx.fillStyle = C.acc; ctx.fillRect(ix, y0, iw * .4, Math.max(2, h * .1)); ctx.globalAlpha = alpha * .5; ctx.fillStyle = C.mute; ctx.fillRect(ix, y0 + h * .26, iw, Math.max(1.6, h * .07)); ctx.fillRect(ix, y0 + h * .42, iw * .7, Math.max(1.6, h * .07)); }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    var ct = ((t % T) + T) % T;
    /* gate beam */
    var gx0 = vert ? 0 : gate, gy0 = vert ? gate : 0, flash = 0;
    frags.forEach(function (f) { var tau = ((ct - (f.arr - LIFE)) % T + T) % T; if (tau > 4.6 && tau < 6.0) flash = Math.max(flash, 1 - Math.abs(tau - 5.2) / .8); });
    var g = vert ? ctx.createLinearGradient(0, gate - 40, 0, gate + 40) : ctx.createLinearGradient(gate - 40, 0, gate + 40, 0);
    g.addColorStop(0, 'transparent'); g.addColorStop(.5, C.acc); g.addColorStop(1, 'transparent');
    ctx.globalAlpha = .12 + .28 * flash; ctx.fillStyle = g;
    if (vert) ctx.fillRect(0, gate - 40, W, 80); else ctx.fillRect(gate - 40, 0, 80, H);
    ctx.globalAlpha = .5; ctx.strokeStyle = C.acc; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath();
    if (vert) { ctx.moveTo(0, gate); ctx.lineTo(W, gate); } else { ctx.moveTo(gate, 0); ctx.lineTo(gate, H); }
    ctx.stroke(); ctx.setLineDash([]);

    /* document */
    var fadeOut = ct > 11.2 ? 1 - TX.clamp((ct - 11.2) / 1, 0, 1) : 1;
    ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.strokeStyle = C.line; ctx.lineWidth = 1.4;
    rr(doc.x, doc.y, doc.w, doc.h, 14); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = .6 * fadeOut; ctx.fillStyle = C.ink; var tl = doc.w * .36; ctx.fillRect(doc.x + doc.w * .1, doc.y + doc.h * .06, tl, 5); // title
    for (var k = 0; k < K; k++) {
      var L = lines[k], a = sm((ct - frags[k].arr) / .5) * fadeOut; if (a <= 0) continue;
      ctx.globalAlpha = (L.head ? .95 : .5) * a; ctx.fillStyle = L.head ? C.acc : C.mute;
      rr(L.x, L.y, L.w, L.h, L.h / 2); ctx.fill();
    }
    /* stamp */
    var sa = sm((ct - 9.0) / .6) * fadeOut;
    if (sa > 0) {
      var sx = doc.x + doc.w / 2, sy = doc.y + doc.h - doc.h * .1, sw = Math.min(doc.w * .84, 190), sh = vert ? 24 : 30;
      ctx.globalAlpha = sa; ctx.fillStyle = C.ok; ctx.globalAlpha = sa * .16; rr(sx - sw / 2, sy - sh / 2, sw, sh, sh / 2); ctx.fill();
      ctx.globalAlpha = sa; ctx.strokeStyle = C.ok; ctx.lineWidth = 1.4; rr(sx - sw / 2, sy - sh / 2, sw, sh, sh / 2); ctx.stroke();
      ctx.fillStyle = C.ok; ctx.font = '600 ' + (vert ? 9 : 10.5) + 'px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('READY FOR SIGN-OFF', sx + 6, sy + .5);
      ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); var ck = sx - sw / 2 + 14; ctx.moveTo(ck - 4, sy); ctx.lineTo(ck - 1, sy + 3.2); ctx.lineTo(ck + 4.5, sy - 3.4); ctx.stroke();
    }

    /* fragments */
    for (var i = 0; i < N; i++) {
      var f = frags[i], tau = ((ct - (f.arr - LIFE)) % T + T) % T; if (tau > LIFE) continue;
      var x, y, rot, w = f.w, h = f.h, al = 1, glow = 0;
      var wx = f.x + Math.sin(tau * .7 + f.ph) * (vert ? 14 : 22), wy = f.y + Math.cos(tau * .55 + f.ph2) * (vert ? 12 : 18), wr = f.rot + Math.sin(tau * .5 + f.ph) * .16;
      if (tau < 3.4) { x = wx; y = wy; rot = wr; al = sm(tau / .9); }
      else if (tau < 5.2) {
        var p = ease((tau - 3.4) / 1.8), gxp = vert ? f.gy : gate, gyp = vert ? gate : f.gy;
        x = wx + (gxp - wx) * p; y = wy + (gyp - wy) * p; rot = wr * (1 - p); var s = 1 - .45 * p; w *= s; h *= s; glow = p > .8 ? 1 : 0;
      } else {
        var q = ease((tau - 5.2) / 1.2), L2 = lines[f.slot], gxp2 = vert ? f.gy : gate, gyp2 = vert ? gate : f.gy;
        var tx = L2.x + L2.w / 2, ty = L2.y + L2.h / 2;
        x = gxp2 + (tx - gxp2) * q; y = gyp2 + (ty - gyp2) * q; rot = 0;
        var w0 = f.w * .55, h0 = f.h * .55; w = w0 + (L2.w - w0) * q; h = h0 + (L2.h - h0) * q; glow = 1 - q; al = q > .92 ? 1 - (q - .92) / .08 : 1;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); drawFrag(f, w, h, al, glow); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* scroll is the clock: each of the four scroll steps plays one checkpoint of the animation */
  var SEG = [0, 3.4, 6.2, 9.0, 11.2];
  function target() {
    var P = hero && hero._pin; if (!P) return 0;
    var f = TX.clamp(P.f, 0, 4), k = Math.min(3, Math.floor(f)), u = f - k;
    return SEG[k] + (SEG[k + 1] - SEG[k]) * u;
  }
  function frame(now) {
    if (!running) return;
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    var tg = target(), d = tg - clk;
    if (Math.abs(d) > .002) { clk += d * Math.min(1, dt * 7); draw(clk); }
    requestAnimationFrame(frame);
  }
  function run(v) {
    visible = v;
    if (v && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!v) running = false;
  }
  colors(); layout();
  clk = target(); draw(clk);
  if (TX.reduce) { clk = 10.2; draw(clk); }
  if (!TX.reduce) TX.onView(hero || box, run, '60px 0px');
  var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { var w = box.clientWidth, h = box.clientHeight; if (w !== W || h !== H) layout(); }, 120); });
  addEventListener('themechange', function () { colors(); if (!running) draw(clk); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) draw(clk); });
})();
