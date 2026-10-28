// Vercel serverless function: POST /api/contact
// Sends the enquiry to your inbox and an automatic reply to the sender, through Resend (https://resend.com).
// Environment variables: RESEND_API_KEY, CONTACT_TO, CONTACT_FROM, optional BOOKING_URL. See .env.example.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

async function send(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  // Spam traps: a hidden field real people never fill, and a form that was submitted impossibly fast.
  if (body.company_website) return res.status(200).json({ ok: true });
  if (body.t && Date.now() - Number(body.t) < 2500) return res.status(200).json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const practice = clean(body.practice, 160);
  const volume = clean(body.volume, 40);
  const message = String(body.message ?? '').trim().slice(0, 4000);
  if (!name || !practice || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please check your name, work email and practice.' });
  }
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_TO || !process.env.CONTACT_FROM) {
    return res.status(500).json({ ok: false, error: 'Email is not configured yet.' });
  }

  try {
    await send({
      from: process.env.CONTACT_FROM,
      to: [process.env.CONTACT_TO],
      reply_to: email,
      subject: `New enquiry: ${name}, ${practice}`,
      text: `Name: ${name}\nEmail: ${email}\nPractice: ${practice}\nDocuments a month: ${volume || 'not given'}\n\n${message || '(no message)'}`,
      html: `<p><b>${esc(name)}</b> (${esc(email)})<br>${esc(practice)}<br>Documents a month: ${esc(volume || 'not given')}</p><p>${esc(message || '(no message)').replace(/\n/g, '<br>')}</p>`,
    });

    const booking = process.env.BOOKING_URL ? `\n\nIf you would rather pick a time now, use this link: ${process.env.BOOKING_URL}` : '';
    await send({
      from: process.env.CONTACT_FROM,
      to: [email],
      subject: "We've got your message",
      text: `Hi ${name},\n\nThanks for getting in touch. We'll reply within one business day to set up your discovery call.${booking}\n\nTheianex`,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ ok: false, error: 'We could not send your message just now.' });
  }
}
