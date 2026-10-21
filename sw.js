/* Service worker: the app works offline at the gym.
 * App files: cache first, refreshed on each new version (bump VERSION).
 * Google Fonts: served from cache, refreshed in the background. */
const VERSION = 'v2.0.0';
const CACHE = 'tnm-' + VERSION;
const APP = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/figure.js',
  'js/bodymap.js',
  'js/data/catalog.js',
  'js/data/library.js',
  'js/data/heads.js',
  'js/data/art.js',
  'js/ai.js',
  'js/i18n.js',
  'js/i18n/en.js',
  'js/i18n/en-data.js',
  'js/engine/recovery.js',
  'js/engine/progression.js',
  'js/engine/generator.js',
  'js/engine/planner.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tnm-') && k !== CACHE && k !== 'tnm-fonts' && k !== 'tnm-img').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('tnm-fonts').then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    // Library photos from free-exercise-db: cached the first time they are shown.
    e.respondWith(caches.open('tnm-img').then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(hit => hit || fetch(req)));
    return;
  }
  if (url.pathname.includes('/img/')) {
    // Exercise photos: cached the first time they are shown.
    e.respondWith(caches.open('tnm-img').then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
