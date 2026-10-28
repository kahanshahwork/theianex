/* ParaIQ hero: a short, looping, illustrative exchange. Not live data. */
(function () {
  var TX = window.TX, win = document.getElementById('pqWin'), chat = document.getElementById('pqChat');
  if (!win || !chat) return;
  var files = TX.$$('.pq-side li', win), timers = [], running = false, run = 0;
  var script = [
    { t: 'user', s: 'Prepare the Statement of Advice draft for client file 0142.' },
    { t: 'ai', s: 'Reading the fact-find, statements and notes.', files: true },
    { t: 'ai', s: 'Draft started. Two items need a paraplanner’s attention.' },
    { t: 'status', s: 'Paraplanner review in progress' },
    { t: 'status', s: 'Reviewed by a paraplanner. Ready for the adviser.', ok: true }
  ];
  function add(m) {
    var el = document.createElement('div');
    if (m.t === 'status') { el.className = 'pm-status' + (m.ok ? ' ok' : ''); el.textContent = m.s; }
    else {
      el.className = 'pm ' + m.t;
      if (m.t === 'ai') el.innerHTML = '<i class="av">AI</i><p></p>'; else el.innerHTML = '<p></p>';
      TX.$('p', el).textContent = m.s;
    }
    chat.appendChild(el); return el;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function showAll() { chat.innerHTML = ''; script.forEach(add); files.forEach(function (f) { f.classList.add('ok'); }); }
  function play() {
    clear(); chat.innerHTML = ''; files.forEach(function (f) { f.classList.remove('ok'); });
    var at = 500, my = ++run;
    script.forEach(function (m, i) {
      if (m.t === 'ai') {
        later(function () { if (my !== run) return; var ty = document.createElement('div'); ty.className = 'pm ai typing'; ty.setAttribute('data-ty', 1); ty.innerHTML = '<i class="av">AI</i><p><i></i><i></i><i></i></p>'; chat.appendChild(ty); }, at);
        at += 1100;
        later(function () { if (my !== run) return; var ty = TX.$('[data-ty]', chat); if (ty) ty.remove(); add(m); if (m.files) files.forEach(function (f, k) { later(function () { f.classList.add('ok'); }, 250 + k * 380); }); }, at);
        at += 1500;
      } else { later(function () { if (my !== run) return; add(m); }, at); at += m.t === 'status' ? 1900 : 1100; }
    });
    later(function () { if (my === run && running) play(); }, at + 3200);
  }
  if (TX.reduce) { showAll(); return; }
  TX.onView(win, function (v) { if (v && !running) { running = true; play(); } else if (!v) { running = false; clear(); } }, '0px');
})();

/* On narrow screens the answer sits below the questions: bring it into view after a choice. */
(function () {
  var TX = window.TX, qs = TX.$$('.dp-qb'), a = TX.$('.dp-a');
  if (!qs.length || !a) return;
  qs.forEach(function (b) {
    b.addEventListener('click', function () {
      if (innerWidth > 980) return;
      setTimeout(function () { a.scrollIntoView({ behavior: TX.reduce ? 'auto' : 'smooth', block: 'center' }); }, 60);
    });
  });
})();
