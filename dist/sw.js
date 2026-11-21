const cacheName = 'registro-ore-lavoro-v13'
const shell = ['index.html','app.mjs?v=13','core.mjs?v=11','store.mjs?v=11','reports.mjs?v=11','styles.css?v=13','manifest.webmanifest?v=10',
  'assets/icon-180.png?v=10','assets/icon-192.png?v=10','assets/icon-512.png?v=10',
  'assets/at-spline.webp','assets/bg-welding-machine.webp','assets/bg-electric-motor.webp','vendor/pdf-lib.min.js','vendor/jszip.min.js']
const home = new URL('index.html', self.registration.scope).href
const assets = new Set(shell.map(path => new URL(path, self.registration.scope).href))

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...assets])))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('registro-ore-lavoro-') && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(home)))
  } else if (assets.has(request.url)) {
    event.respondWith(caches.match(request, { cacheName }).then(cached => cached ?? fetch(request)))
  }
})
