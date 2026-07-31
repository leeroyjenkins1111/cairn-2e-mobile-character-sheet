const CACHE_NAME = 'cairn-mobile-sheet-v0.30.1';
const APP_SHELL = [
  './',
  './index.html',
  './styles/app.css',
  './styles/tokens.css?v=0.30.1',
  './styles/foundations.css?v=0.30.1',
  './styles/shell.css?v=0.30.1',
  './styles/components.css?v=0.30.1',
  './styles/screens.css?v=0.30.1',
  './styles/dice.css?v=0.30.1',
  './styles/atmosphere.css?v=0.30.1',
  './styles/combat.css?v=0.30.1',
  './scripts/app-config.js?v=0.30.1',
  './scripts/inventory-domain.js?v=0.30.1',
  './scripts/app-core.js?v=0.30.1',
  './scripts/app-bootstrap.js?v=0.30.1',
  './scripts/render-hooks.js?v=0.30.1',
  './scripts/dice-motion.js?v=0.30.1',
  './scripts/dice-feedback.js?v=0.30.1',
  './scripts/ux-direct-editing.js?v=0.30.1',
  './scripts/inventory-view.js?v=0.30.1',
  './scripts/character-redesign.js?v=0.30.1',
  './scripts/dice-renderer.js?v=0.30.1',
  './scripts/app-entry.js?v=0.30.1',
  './assets/forest-background.jpg',
  './manifest.webmanifest',
  './icon.svg',
  './service-worker.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cairn-mobile-sheet-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html').then(response => response || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
