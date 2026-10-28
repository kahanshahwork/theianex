/* Contact form: posts JSON to /api/contact. Falls back to a plain email link if the request fails. */
(function () {
  var TX = window.TX, form = TX.$('#contactForm');
  if (!form) return;
  var status = TX.$('#formStatus'), btn = TX.$('button[type=submit]', form), t0 = Date.now();
  function say(msg, bad) { status.textContent = msg; status.className = 'form-status' + (bad ? ' bad' : ' ok'); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = {}; new FormData(form).forEach(function (v, k) { d[k] = v; }); d.t = t0;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn.disabled = true; btn.classList.add('busy'); say('Sending…');
    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { location.href = '/thank-you'; return; }
        throw new Error((res.j && res.j.error) || 'failed');
      })
      .catch(function (err) {
        btn.disabled = false; btn.classList.remove('busy');
        say((err && err.message && err.message !== 'failed' ? err.message + ' ' : 'We could not send that just now. ') + 'Please try again, or email us directly.', true);
      });
  });
})();
