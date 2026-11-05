import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

// Build-scoped caches keep each deployed app shell and its hashed assets together.
export function gamePwa(): Plugin {
  let base = '/';
  return {
    name: 'neon-void-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { base = config.base; },
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(name => !name.endsWith('.map'));
      const revision = createHash('sha256');
      for (const file of files.sort()) {
        const item = bundle[file];
        revision.update(file).update(item.type === 'chunk' ? item.code : item.source);
      }
      const prefix = `neon-void:${base}:`;
      const version = prefix + revision.digest('hex').slice(0, 16);
      const urls = [...files, 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
        'icons/maskable-512.png', 'icons/apple-touch-icon.png'].map(file => base + file);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify(version)};
const PREFIX = ${JSON.stringify(prefix)};
const SHELL = ${JSON.stringify(base + 'index.html')};
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
// A new version waits until the previous game's windows close, avoiding mid-game reloads.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(${JSON.stringify(base)})) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => response.ok ? response : caches.open(CACHE).then(cache => cache.match(SHELL))).catch(() => caches.open(CACHE).then(cache => cache.match(SHELL))));
    return;
  }
  // Cache only this build's known assets; external URLs and other sites stay untouched.
  if (FILES.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
});
` });
    },
  };
}
