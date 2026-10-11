import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
const sw = await readFile('dist/sw.js', 'utf8');
const cached = new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]));
const assets = (await readdir('dist/assets')).filter((name) => /\.(js|css)$/.test(name));
assert(assets.some((name) => name.startsWith('balance.worker-')), 'Calculation worker must be emitted');
for (const path of ['index.html', 'manifest.webmanifest', 'favicon.svg', 'apple-touch-icon.png', ...assets.map((name) => `assets/${name}`), ...manifest.icons.map((icon) => icon.src)]) {
  assert(cached.has(path), `Missing offline asset: ${path}`);
}
for (const icon of manifest.icons) {
  const png = await readFile(`dist/${icon.src}`);
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
}
assert(sw.includes('SKIP_WAITING'), 'Update activation must use a message');
console.log(`PWA verified: ${cached.size} cached assets, calculation worker, relative scope, and icon dimensions.`);
