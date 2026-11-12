// Offline support: cache the app shell, serve from cache first and refresh in the background.
const CACHE = 'studio-light-v9';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/main.js', 'src/engine.js', 'src/models.js', 'src/diagram.js', 'src/data.js', 'src/i18n.js', 'src/models-meta.js', 'src/materials.js', 'src/lessons.js', 'src/pathtrace.js',
  'vendor/three.module.js', 'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'vendor/OrbitControls.js', 'vendor/three-gpu-pathtracer.js', 'vendor/three-mesh-bvh.js', 'vendor/postprocessing/Pass.js',
  'assets/LeePerrySmith.glb', 'assets/head-color.jpg', 'assets/head-normal.jpg',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// App code (HTML, CSS, our own modules) is fetched from the network first so an update shows
// up on the next launch; the cache is only the offline fallback. Large, rarely changing files
// (models, textures, vendored libraries) are served from the cache first.
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const path = url.pathname;
  const isCode = !path.includes('/vendor/') && !path.includes('/assets/') && (path.endsWith('/') || /\.(html|css|js|webmanifest)$/.test(path));
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = () => fetch(req, isCode ? { cache: 'no-cache' } : undefined).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    if (isCode) return fresh().catch(() => hit || Response.error());
    return hit || fresh();
  }));
});
