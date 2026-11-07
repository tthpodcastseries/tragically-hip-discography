// Bump with each release (matches the footer version). Fans get new pages, CSS, JS
// and data even if this is forgotten: those are all fetched network-first below
// (pages and data fall back to a saved copy after a few seconds on a weak signal).
const CACHE_NAME = 'hh-v5.8.2';
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
  '/little-bones.html',
  '/are-we-family.html',
  '/words-into-birds.html',
  '/song.html',
  '/forum-invite.html',
  '/privacy.html',
  '/lyrics.html',
  '/setlists.html',
  '/top-40.html',
  '/podcasts.html',
  '/podcasts/fully-and-completely.html',
  '/podcasts/getting-hip-to-the-hip.html',
  '/podcasts/discovering-downie.html',
  '/podcasts/top-forty-countdown.html',
  '/podcasts/on-shuffle.html',
  '/podcasts/yer-hipstories.html',
  '/podcasts/its-a-good-life.html',
  '/podcasts/interview-series.html',
  '/podcasts/album-countdown.html',
  '/podcasts/the-completists.html',
  '/404.html',
  '/js/not-found.js',
  '/offline.html',
  // CSS
  '/css/shared.css',
  '/css/passport.css',
  '/css/bring-it-all-back.css',
  '/css/unlocked.css',
  '/css/little-bones.css',
  '/css/are-we-family.css',
  '/css/words-into-birds.css',
  '/css/song.css',
  '/css/home.css',
  '/css/discography.css',
  '/css/tour-map.css',
  '/css/unplucked-gems.css',
  '/css/video-for-new-recruits.css',
  '/css/live-stats.css',
  '/css/offline.css',
  '/css/podcasts.css',
  // JS
  '/js/shared-footer.js',
  '/js/discography-app.js',
  '/js/live-stats.js',
  '/js/passport.js',
  '/js/bring-it-all-back.js',
  '/js/unlocked.js',
  '/js/little-bones.js',
  '/js/are-we-family.js',
  '/js/words-into-birds.js',
  '/js/song.js',
  '/js/tth-member-gate.js',
  '/js/home.js',
  '/js/track-names.js',
  '/js/dialog-a11y.js',
  '/js/tour-map.js',
  '/js/tour-map-player.js',
  '/js/forum-invite.js',
  '/js/music-videos.js',
  '/js/unplucked-gems.js',
  '/js/video-for-new-recruits.js',
  // Leaflet, our own copy since audit PRIV-04 (map pages)
  '/js/vendor/leaflet-1.9.4.js',
  '/js/vendor/leaflet.markercluster-1.5.3.js',
  '/css/vendor/leaflet-1.9.4.css',
  '/css/vendor/MarkerCluster-1.5.3.css',
  '/css/vendor/MarkerCluster.Default-1.5.3.css',
  // Fonts (the two every page preloads; the other weights are cached when first used)
  '/fonts/poppins-400-latin.woff2',
  '/fonts/poppins-600-latin.woff2',
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

// How long a page or data file gets to answer before a saved copy is shown instead
// (audit PERF-05 / FUNC-12). Only used when a saved copy exists; the network answer
// still lands in the cache in the background, ready for the next visit.
const NETWORK_WAIT_MS = 4000;

// Saved pages (audit FUNC-01 / PERF-08). Fans tap the short addresses (/tour-map,
// /my-shows), the shell above is saved under the file names (/tour-map.html), and a
// search address (/lyrics?q=...) is the same page. So a page is saved under its address
// without the ?search part, and looked up under every name it goes by.
const PAGE_ALIASES = { '/my-shows': '/passport.html', '/song': '/song.html' };

function pageKeys(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const keys = [path];
  if (path === '/' || path === '/index' || path === '/index.html') keys.push('/', '/index.html');
  else if (path.endsWith('.html')) keys.push(path.slice(0, -5));
  else keys.push(path + '.html');
  const bare = path.replace(/\.html$/, '');
  if (PAGE_ALIASES[bare]) keys.push(PAGE_ALIASES[bare]);
  return [...new Set(keys)];
}

// A copy saved after a redirect (say /tour-map.html -> /tour-map) can't answer a page
// load as it is: the browser refuses it. Hand back a plain copy of it instead.
function usable(response) {
  if (!response || !response.redirected) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function savedPage(url) {
  const cache = await caches.open(CACHE_NAME);
  for (const key of pageKeys(url.pathname)) {
    const hit = await cache.match(key, { ignoreSearch: true, ignoreVary: true });
    if (hit) return usable(hit);
  }
  return null;
}

function savePage(url, response) {
  if (response.status === 200 && response.type === 'basic' && !response.redirected) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(url.origin + url.pathname, clone)).catch(() => {});
  }
  return response;
}

// Offline and nothing saved for this address
async function offlinePage(url) {
  const cache = await caches.open(CACHE_NAME);
  // A song page not visited yet: song.html reads the slug from the address
  const r = (url.pathname.startsWith('/song/') && await cache.match('/song.html'))
    || await cache.match('/offline.html')
    || await cache.match('/404.html');
  return usable(r) || Response.error();
}

// The network answer, unless it takes longer than NETWORK_WAIT_MS (or fails) and a
// saved copy exists: then the saved copy
function networkOrSaved(network, saved) {
  if (!saved) return network;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(saved), NETWORK_WAIT_MS);
    network.then(
      response => { clearTimeout(timer); resolve(response); },
      () => { clearTimeout(timer); resolve(saved); }
    );
  });
}

// Fetch: pages and data are network-first, falling back to the saved copy when offline
// or when the network is too slow (above). CSS, JS and the manifest are network-first
// with no time limit, so a release's new code always arrives. Images and everything
// else: cached copy first, refreshed in the background.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, cross-origin and partial (audio/video range) requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || event.request.headers.has('range')) return;

  // HTML pages
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    const network = fetch(event.request).then(response => savePage(url, response));
    event.waitUntil(network.catch(() => {}));
    event.respondWith((async () => {
      const saved = await savedPage(url).catch(() => null);
      try {
        return await networkOrSaved(network, saved);
      } catch (e) {
        return offlinePage(url);
      }
    })());
    return;
  }

  // JSON data: as pages, with the same time limit when a saved copy exists
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
    const network = fetch(event.request, { cache: 'no-cache' }).then(response => save(event.request, response));
    event.waitUntil(network.catch(() => {}));
    event.respondWith((async () => {
      const saved = await caches.match(event.request).catch(() => null);
      try {
        return await networkOrSaved(network, saved);
      } catch (e) {
        return Response.error();
      }
    })());
    return;
  }

  // CSS, JS, manifest: always ask the server (a quick "not modified" when unchanged)
  if (/^\/(css|js)\//.test(url.pathname) || url.pathname === '/manifest.json') {
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
