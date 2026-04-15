const CACHE_NAME = 'thc-v3.4.5';
const CORE_ASSETS = [
  // HTML pages
  '/',
  '/index.html',
  '/discography.html',
  '/links.html',
  '/tour-map.html',
  '/unplucked-gems.html',
  '/forum-invite.html',
  '/404.html',
  // CSS
  '/css/shared.css',
  // JS
  '/js/shared-footer.js',
  '/js/tth-launch-gate.js',
  '/js/tth-member-gate.js',
  '/js/supabase.min.js',
  // Data
  '/data/discography.json',
  '/data/lyrics.json',
  '/data/setlists.min.json',
  '/data/tth-tour-data.json',
  '/data/unplucked-gems.json',
  '/data/live-play-counts-merged.json',
  // Other
  '/manifest.json'
];

// Install: cache core pages
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML pages: network-first with cache fallback
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/404.html')))
    );
    return;
  }

  // JSON data files: network-first with cache fallback (ensures data updates reach users)
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
