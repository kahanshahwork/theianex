/* Getting started: a curved path that connects the six steps and fills as you scroll. */
(function () {
  var TX = window.TX, list = document.getElementById('gsList');
  if (!list) return;
  var steps = TX.$$('.gs-step', list), NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'gs-svg'); svg.setAttribute('aria-hidden', 'true');
  var base = document.createElementNS(NS, 'path'), prog = document.createElementNS(NS, 'path');
  base.setAttribute('class', 'base'); prog.setAttribute('class', 'fill');
  svg.appendChild(base); svg.appendChild(prog); list.insertBefore(svg, list.firstChild);
  var len = 1, pts = [];
  function build() {
    var lr = list.getBoundingClientRect();
    pts = steps.map(function (s) { var d = TX.$('.gs-dot', s).getBoundingClientRect(); return [d.left - lr.left + d.width / 2, d.top - lr.top + d.height / 2]; });
    var d = 'M' + pts[0][0] + ' ' + (pts[0][1] - 40);
    d += ' L' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], my = (a[1] + b[1]) / 2;
      d += ' C' + a[0] + ' ' + my + ' ' + b[0] + ' ' + my + ' ' + b[0] + ' ' + b[1];
    }
    base.setAttribute('d', d); prog.setAttribute('d', d);
    len = prog.getTotalLength(); prog.style.strokeDasharray = len; update();
  }
  function update() {
    var lr = list.getBoundingClientRect(), vh = innerHeight, mid = vh * 0.62;
    var p = TX.clamp((mid - lr.top + 40) / (lr.height + 40), 0, 1);
    prog.style.strokeDashoffset = len * (1 - p);
    steps.forEach(function (s, i) { var r = s.getBoundingClientRect(); s.classList.toggle('on', r.top + r.height / 2 < mid + 40); });
  }
  build();
  addEventListener('resize', function () { clearTimeout(build.t); build.t = setTimeout(build, 120); });
  addEventListener('txscroll', update);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
})();
