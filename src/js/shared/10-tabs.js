/* Generic tabs with optional autoplay.
   <div data-tabs data-auto="5200"> ... <button data-tab="0"> ... <div data-panel="0"> ... </div>
   The root gets data-active="n" so CSS can react. Fires "tabchange" on the root. */
(function () {
  var TX = window.TX;
  TX.$$('[data-tabs]').forEach(function (root) {
    var tabs = TX.$$('[data-tab]', root), panels = TX.$$('[data-panel]', root);
    var auto = +root.getAttribute('data-auto') || 0, n = tabs.length, cur = -1, timer = 0, paused = 0, visible = false;
    function set(i, user) {
      i = (i + n) % n; if (i === cur) return; cur = i;
      root.setAttribute('data-active', i);
      tabs.forEach(function (t, k) { var on = k === i; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.setAttribute('tabindex', on ? '0' : '-1'); });
      panels.forEach(function (p, k) { var on = k === i; p.classList.toggle('is-active', on); p.hidden = !on && p.hasAttribute('data-hide'); });
      root.dispatchEvent(new CustomEvent('tabchange', { detail: i }));
      if (root.hasAttribute('data-fk')) window.dispatchEvent(new CustomEvent('tx:focus', { detail: { index: i, k: +root.getAttribute('data-fk') || 3, el: root } }));
      if (user) { paused = Date.now() + 14000; }
    }
    function loop() { clearTimeout(timer); if (!auto || TX.reduce) return; timer = setTimeout(function () { if (visible && Date.now() > paused) set(cur + 1); loop(); }, auto); }
    tabs.forEach(function (t, k) {
      t.setAttribute('role', 'tab');
      t.addEventListener('click', function () { set(k, true); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); set(cur + 1, true); tabs[cur].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); set(cur - 1, true); tabs[cur].focus(); }
      });
    });
    set(0, false);
    TX.onView(root, function (v) { visible = v; root.classList.toggle('in-view', v); }, '-10% 0px');
    loop();
  });
})();
