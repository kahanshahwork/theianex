// Theianex static build. No dependencies.
// src/pages/*.html  +  src/partials/*.html  ->  dist/*.html, one css bundle, one shared js bundle, per-page scripts.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://www.your-domain.com.au').replace(/\/$/, '');
const STRICT = process.env.STRICT === '1';

const read = (p) => readFileSync(p, 'utf8');
const ls = (d, ext) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(ext)).sort() : []);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

/* ---- css: one bundle, light minify ---- */
const minCss = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').replace(/:\s+/g, ':').trim();
let css = '';
for (const f of ls(join(SRC, 'css'), '.css')) css += read(join(SRC, 'css', f)) + '\n';
mkdirSync(join(DIST, 'css'), { recursive: true });
writeFileSync(join(DIST, 'css/site.css'), process.env.NOMIN ? css : minCss(css));

/* ---- js: shared bundle (js/shared/*.js in order) + per-page scripts ---- */
let shared = '';
for (const f of ls(join(SRC, 'js/shared'), '.js')) shared += `/* ${f} */\n` + read(join(SRC, 'js/shared', f)) + '\n';
mkdirSync(join(DIST, 'js'), { recursive: true });
writeFileSync(join(DIST, 'js/site.js'), shared);
const pageScript = (name) => {
  for (const d of ['js', 'data']) {
    const p = join(SRC, d, name);
    if (existsSync(p)) { cpSync(p, join(DIST, 'js', name)); return true; }
  }
  return false;
};

/* ---- the 3D scene bundle (built from src/world-src by `npm run bundle:world`) ---- */
if (existsSync(join(SRC, 'js/world.js'))) cpSync(join(SRC, 'js/world.js'), join(DIST, 'js/world.js'));

/* ---- assets ---- */
cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });

/* ---- templating ---- */
const partials = {};
for (const f of ls(join(SRC, 'partials'), '.html')) partials[basename(f, '.html')] = read(join(SRC, 'partials', f));

function render(tpl, vars, depth = 0) {
  if (depth > 6) throw new Error('partial nesting too deep');
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => {
    if (!(n in partials)) throw new Error('missing partial: ' + n);
    return render(partials[n], vars, depth + 1);
  });
  tpl = tpl.replace(/\{\{active:([\w-]+)\}\}/g, (_, n) => (vars.page === n ? ' aria-current="page"' : ''));
  tpl = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  return tpl;
}

function parsePage(src) {
  const m = src.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  const meta = {};
  if (m) m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  return { meta, body: m ? src.slice(m[0].length) : src };
}

const pages = [];
let tbcTotal = 0;
const tbcRows = {}, tbcSeen = {}, footerTbc = new Set(), footerDone = new Set();
(read(join(SRC, 'partials', 'footer.html')).match(/<mark class="tbc[^"]*">[\s\S]*?<\/mark>/g) || []).forEach((m) => footerTbc.add(m.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()));
for (const f of ls(join(SRC, 'pages'), '.html')) {
  const name = basename(f, '.html');
  const { meta, body } = parsePage(read(join(SRC, 'pages', f)));
  const scripts = (meta.scripts || '').split(',').map((s) => s.trim()).filter(Boolean);
  scripts.forEach((s) => { if (!pageScript(s)) throw new Error(`${f}: script not found: ${s}`); });
  const vars = {
    page: meta.page || name,
    title: meta.title || 'Theianex',
    description: meta.description || '',
    bodyClass: meta.bodyClass || '',
    robots: meta.robots === 'noindex' ? '<meta name="robots" content="noindex">' : '',
    path: name === 'index' ? '/' : '/' + name,
    siteUrl: SITE_URL,
    pageScripts: scripts.map((s) => `<script defer src="/js/${s}"></script>`).join('\n'),
    year: String(new Date().getFullYear()),
  };
  vars.main = render(body, vars);
  let out = render('{{> layout}}', vars);
  /* "to confirm" items: the site shows none of them. They are lifted out of the page here and listed in TO-CONFIRM.md */
  const seen = tbcSeen[name] || (tbcSeen[name] = new Set());
  out = out.replace(/\s?<mark class="tbc([^"]*)">([\s\S]*?)<\/mark>/g, (all, cls, inner) => {
    const note = /\bnote\b/.test(cls), text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (footerTbc.has(text)) { if (footerDone.has(text)) return note ? '' : (all.startsWith(' ') ? ' ' : '') + inner; footerDone.add(text); }
    if (!seen.has(text)) { seen.add(text); tbcTotal++; (tbcRows[name] = tbcRows[name] || []).push({ note, text }); }
    return note ? '' : (all.startsWith(' ') ? ' ' : '') + inner;
  });
  out = out.replace(/<p class="[^"]*">\s*<\/p>\s*/g, '');
  const outFile = join(DIST, name + '.html');
  writeFileSync(outFile, out);
  pages.push({ name, path: vars.path, noindex: meta.robots === 'noindex' });
}

/* ---- robots + sitemap ---- */
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.filter((p) => !p.noindex && p.name !== '404').map((p) => `  <url><loc>${SITE_URL}${p.path === '/' ? '' : p.path}</loc></url>`).join('\n') +
    `\n</urlset>\n`
);

console.log(`built ${pages.length} pages -> dist/`);
if (tbcTotal) {
  const md = ['# To confirm', '', 'Nothing on the site is highlighted. Every drafted or placeholder line is listed here by page. Lines marked "note" are instructions that were taken off the page; the rest stay on the page as plain text until they are replaced. In the source, they are the <mark class="tbc"> tags in src/pages.', ''];
  for (const [pg, rows] of Object.entries(tbcRows)) { md.push(`## ${pg}`, ''); rows.forEach((r) => md.push(`- ${r.note ? '(note, removed from page) ' : ''}${r.text}`)); md.push(''); }
  writeFileSync(join(ROOT, 'TO-CONFIRM.md'), md.join('\n'));
  console.log(`\n${tbcTotal} drafted or placeholder items listed in TO-CONFIRM.md`);
  if (STRICT) { console.error('\nSTRICT build failed: resolve every "to confirm" item before launch.'); process.exit(1); }
}
