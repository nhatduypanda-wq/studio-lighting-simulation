// Offline support: cache the app shell, serve from cache first and refresh in the background.
const CACHE = 'studio-light-v3';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/main.js', 'src/engine.js', 'src/models.js', 'src/diagram.js', 'src/data.js', 'src/i18n.js', 'src/models-meta.js', 'src/materials.js',
  'vendor/three.module.js', 'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'vendor/OrbitControls.js',
  'assets/LeePerrySmith.glb', 'assets/head-color.jpg', 'assets/head-normal.jpg',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
