// Bundles src/world-src/world.js (three.js scene) into the minified src/js/world.js the site loads.
// Only needed when you change the scene: `npm install` then `npm run bundle:world`. The built file is committed.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
await build({ entryPoints: [join(ROOT, 'src/world-src/world.js')], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: join(ROOT, 'src/js/world.js'), legalComments: 'none' });
console.log('bundled src/js/world.js');
