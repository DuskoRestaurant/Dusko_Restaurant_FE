self.addEventListener('install', event => event.waitUntil(caches.open('dusko-staff-v1').then(cache => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg']))));
self.addEventListener('fetch', event => { if (event.request.method === 'GET' && new URL(event.request.url).origin === self.location.origin) event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); });
