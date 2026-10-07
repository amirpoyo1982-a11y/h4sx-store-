import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public');
// Explicit public allowlist: env files and backend modules can never be static assets.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of [
  'index.htm', 'h4sx-intro.html', 'catalog-control.htm', 'styles.css',
  'catalog-control.css', 'app.js', 'catalog-control.js', 'product-sheet-sync.js',
  'changelog-loader.js', 'sw.js', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'assets'
]) await cp(path.join(root, file), path.join(output, file), { recursive: true });
console.log('Static website built into public/; backend and secrets excluded.');
