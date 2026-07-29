const CACHE_NAME = 'cairn-mobile-sheet-v0.27.0';
const COMPATIBILITY_CACHE = 'cairn-mobile-sheet-v0.23.0';
const APP_SHELL = ['./', './index.html', './styles/app.css', './styles/character-redesign.css?v=0.24.1', './styles/screen-unification.css?v=0.25.0', './scripts/app.js', './scripts/dice-motion.js?v=0.26.3', './scripts/dice-face-v2.js?v=0.27.0', './scripts/dice-feedback.js?v=0.26.1', './scripts/ux-direct-editing.js?v=0.23.2', './scripts/typography-system.js?v=0.23.3', './scripts/character-redesign.js?v=0.25.1', './scripts/screen-unification.js?v=0.25.0', './scripts/inventory-spacing.js?v=0.25.2', './assets/forest-background.jpg', './manifest.webmanifest', './icon.svg', './service-worker.js'];

self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)),
    caches.open(COMPATIBILITY_CACHE).then(cache => cache.add('./assets/forest-background.jpg'))
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cairn-mobile-sheet-') && key !== CACHE_NAME && key !== COMPATIBILITY_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
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