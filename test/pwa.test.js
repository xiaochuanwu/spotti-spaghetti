import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('web app manifest is installable and points to bundled icons', async () => {
  const manifest = await readJson('public/manifest.webmanifest');

  assert.equal(manifest.name, 'Spotti Spaghetti');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0a0a0c');
  assert.ok(manifest.icons.some((icon) => icon.src === '/icons/icon-192.png' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.src === '/icons/icon-512.png' && icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
});

test('service worker only caches same-origin app assets', async () => {
  const serviceWorker = await readFile('public/sw.js', 'utf8');

  assert.match(serviceWorker, /request\.method !== 'GET'/);
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
  assert.match(serviceWorker, /requestUrl\.origin === self\.location\.origin/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(serviceWorker, /api\.spotify\.com/);
});
