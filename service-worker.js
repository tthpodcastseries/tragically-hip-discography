// Bump with each release (matches the footer version). Fans get new pages, CSS, JS
// and data even if this is forgotten: those are all fetched network-first below.
const CACHE_NAME = 'hh-v5.4.13';
// The small shell only. Big data files (setlists, tour data, lyrics, song index...)
// are cached the first time a page asks for them.
const CORE_ASSETS = [
  // HTML pages
  '/',
  '/index.html',
  '/discography.html',
  '/links.html',
  '/tour-map.html',
  '/unplucked-gems.html',
  '/video-for-new-recruits.html',
  '/music-videos.html',
  '/live-stats.html',
  '/passport.html',
  '/bring-it-all-back.html',
  '/unlocked.html',
  '/song.html',
  '/forum-invite.html',
  '/404.html',
  // CSS
  '/css/shared.css',
  '/css/passport.css',
  '/css/bring-it-all-back.css',
  '/css/unlocked.css',
  '/css/song.css',
  '/css/home.css',
  '/css/discography.css',
  '/css/tour-map.css',
  '/css/unplucked-gems.css',
  '/css/video-for-new-recruits.css',
  '/css/live-stats.css',
  // JS
  '/js/shared-footer.js',
  '/js/discography-app.js',
  '/js/live-stats.js',
  '/js/passport.js',
  '/js/bring-it-all-back.js',
  '/js/unlocked.js',
  '/js/song.js',
  '/js/tth-member-gate.js',
  // Data
  '/data/discography.json',
  '/data/missing-lyrics.json',
  // Other
  '/manifest.json'
];

// Install: cache the shell. Each file is fetched on its own, so one missing file
// can't fail the whole install and leave a phone on the old worker.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(CORE_ASSETS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches. Coming from a pre-v5.4.11 worker ('thc-' caches,
// which served CSS/JS cache-first), the open page may be new HTML on old CSS/JS,
// so reload it once. Later releases never need this. The reload runs after
// activation, not inside waitUntil: the reloaded page's requests wait for this
// worker to finish activating, so waiting on them here would hang.
self.addEventListener('activate', event => {
  const cleanup = (async () => {
    const old = (await caches.keys()).filter(k => k !== CACHE_NAME);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    return old.some(k => k.startsWith('thc-'));
  })();
  event.waitUntil(cleanup);
  cleanup.then(async fromOldWorker => {
    if (!fromOldWorker) return;
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach(c => c.navigate(c.url).catch(() => {}));
  }).catch(() => {});
});

function save(request, response) {
  if (response.status === 200) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
  }
  return response;
}

// Fetch: network-first for pages, CSS, JS, data and the manifest (cache only when
// offline); images and everything else: cached copy first, refreshed in the background
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, cross-origin and partial (audio/video range) requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || event.request.headers.has('range')) return;

  // HTML pages
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => save(event.request, response))
        .catch(() => caches.match(event.request)
          // Offline on a song page not visited yet: song.html reads the slug from the address
          .then(r => r || (url.pathname.startsWith('/song/') ? caches.match('/song.html') : null))
          .then(r => r || caches.match('/404.html')))
    );
    return;
  }

  // CSS, JS, JSON data, manifest: always ask the server (a quick "not modified" when unchanged)
  if (/^\/(css|js)\//.test(url.pathname) || (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => save(event.request, response))
        .catch(() => caches.match(event.request).then(r => r || Response.error()))
    );
    return;
  }

  // Images and other files: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request).then(response => save(event.request, response));
      if (cached) {
        event.waitUntil(fresh.catch(() => {}));
        return cached;
      }
      return fresh;
    })
  );
});
