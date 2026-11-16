// Tells Bing and other IndexNow search engines that pages have changed. Run after each deploy:  node scripts/indexnow.mjs
// The key file lives at the site root (src/root/<key>.txt), so the engines can verify it.
const HOST = 'theianex.com.au';
const KEY = '773424343791b4ae0858680511a6cb14';
const urls = ['/', '/why-ianex', '/how-we-work', '/paraiq', '/contact', '/ai-statement-of-advice', '/outsourcing-paraplanning'].map((p) => 'https://' + HOST + p);
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: urls }),
});
console.log('IndexNow responded', res.status, res.status === 200 || res.status === 202 ? '(accepted)' : '(check the key file is live at the keyLocation above)');
