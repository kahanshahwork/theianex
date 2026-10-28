# Theianex website

A static, multi-page site with one serverless function for the contact form. No framework and no dependencies: a small Node script builds it, and Vercel hosts it.

## Run it locally

```bash
node build.mjs        # builds ./dist
node serve.mjs        # preview at http://localhost:3000 (PORT=4000 node serve.mjs to change)
```

Needs Node 18 or newer. Add `?nopre` to a URL to skip the intro animation while editing.

## Deploy on Vercel

1. Push this folder to a Git repository, or run `vercel` from it.
2. In Vercel, import the project. `vercel.json` already sets the build command (`node build.mjs`) and output folder (`dist`). No framework preset is needed.
3. Add the environment variables below, then redeploy.
4. Add your domain under Project Settings > Domains and set `SITE_URL` (used in the sitemap and share tags).

### Environment variables

| Name | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key from resend.com, used to send the form emails |
| `CONTACT_TO` | Inbox that receives enquiries |
| `CONTACT_FROM` | Sender, e.g. `Theianex <hello@your-domain.com.au>`. The domain must be verified in Resend |
| `BOOKING_URL` | Optional. Added to the automatic reply when set |
| `SITE_URL` | Optional. Full site URL, e.g. `https://your-domain.com.au` |

Verify the sending domain in Resend and add the SPF, DKIM and DMARC records it gives you, so replies reach inboxes.

## Structure

```
src/pages/       one HTML file per page (a <!--meta--> block sets title, description, scripts)
src/partials/    header, footer, head, logo, layout shell
src/css/         numbered files, bundled in order into dist/css/site.css
src/js/shared/   scripts used on every page (theme, menu, tabs, form)
src/js/          per-page scripts, loaded only where listed in the page meta
src/data/        map outline for the home hero
src/assets/      fonts, favicon
api/contact.js   the contact form endpoint
```

To add a page: create `src/pages/name.html`, add a `<!--meta ... -->` block at the top, and link to `/name`.

## Before launch

Nothing on the site is highlighted. Anything not yet decided is tagged in the source as `<mark class="tbc">` (add `note` to a tag for an instruction that should not show on the page). The build lifts them out of the page and writes them, page by page, to `TO-CONFIRM.md`:

```bash
node build.mjs         # rewrites TO-CONFIRM.md
STRICT=1 node build.mjs   # fails the build while any remain (use this as a final check)
```

Items include the public email address, legal entity name and ABN, the booking tool embed, call length, the ParaIQ data-privacy answers, and the Privacy Policy and Terms, which are structure only and need a lawyer.

## Theme and the 3D scene

Dark and light themes switch from the header and are remembered. The first visit follows the visitor's device setting. Colours are tokens at the top of `src/css/00-tokens.css`, including the colours the 3D scene reads (`--w-*` and `--g*`).

Behind every page sits one fixed 3D scene (three.js): glossy document tiles over a curved crosshair grid, lit by one blue glow that sweeps in from a different edge in each chapter. The home hero (infinity into Australia) is separate and sits on top of it.

Each section chooses what the scene does while it is on screen, using data attributes in the page HTML:

```html
<section data-chapter="Who we are" data-form="stream" data-n="5" data-path="0" data-glow="0" data-grid="0">
```

| Attribute | Meaning |
| --- | --- |
| `data-chapter` | Name shown in the corner marker. Marks the start of a chapter |
| `data-form` | `none`, `stream`, `orbit`, `cluster`, `column` or `stack`: what the tiles do (pinned scenes can also use `doc` and `jam`) |
| `data-n` | How many tiles are visible. The rest wait out of sight and appear from nowhere when needed |
| `data-pos` | Anchor of the arrangement, -1 to 1 across the screen (cluster, column, stack) |
| `data-path` | Route of a stream, 0 to 2 |
| `data-r` | Orbit size (optional) |
| `data-glow` | Glow preset 0 to 5 (which edge the blue light comes from) |
| `data-grid` | Grid preset 0 to 4 (dome, flat floor, leaning wall, quiet, diagonal) |

You do not have to keep the grid out of the way of text: the scene finds headings, copy and panels on its own, fades the grid behind them and dims any tile that drifts behind plain text.

### Scroll-pinned steps

Several sections are not timers any more: they are tall "pinned" sections whose stage sticks to the screen while the scroll position picks the step (`src/js/shared/15-pin.js`, styles in `src/css/45-pin.css`). Used for Trained / Equipped / Flexible, Faster / Smarter / More efficient, the four How we work checkpoints, the Why IANEX? statement and bottlenecks, and the ParaTech moment.

```html
<section class="pin" data-pin="3" style="--steps:3;--sl:72vh" data-chapter="Technology" data-scenes="t0,t1,t2" data-doc="tech">
  <div class="pin-stick"> ... [data-tab="k"] buttons, [data-panel="k"] panels ... </div>
</section>
```

| Attribute | Meaning |
| --- | --- |
| `data-pin="n"` | Number of steps. Section height is the screen plus `n` x `--sl` (scroll per step) |
| `data-tab="k"` / `data-panel="k"` | Step buttons (fill like a progress bar, click to jump) and step panels |
| `data-at=".5"` | Inside a panel: shows once the step is that far through |
| `data-type="text"` | A mono line that types itself as the step progresses |
| `data-lit` | Words that light up across the whole pin |
| `data-scenes="a,b,c"` | One 3D scene per step, defined in `SC` in `src/world-src/world.js` (form, position, glow, grid) |
| `data-doc="tech\|how"` | Drives the live paper sheet from scroll: files fall into a core, the sheet is written, scanned, flagged, stamped and stacked |
| `data-go` | For gate ("jam") scenes: the gate opens as each step moves from problem to answer |

`data-ptx` (see `src/js/shared/20-ptx.js`) turns the word "Paraplanning" into "ParaTech" with the tagline following, driven by the pin's progress.

Text effects live in `src/js/shared/30-fx.js`: headlines come into focus as they reach the middle of the screen, `<mark class="hl">` words get a highlight bar as they scroll in, and the chapter marker updates.

The scene source is `src/world-src/world.js`. The site loads the minified bundle `src/js/world.js` (about 150 KB gzipped), which is already built. Only if you change the scene:

```bash
npm install
npm run bundle:world
```

Visitors with reduced-motion settings get a still scene that only moves with their scroll. If WebGL is unavailable the page falls back to plain sections.
