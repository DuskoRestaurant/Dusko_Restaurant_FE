self.addEventListener('install', event => event.waitUntil(caches.open('dusko-staff-v2').then(cache => cache.addAll(['/', '/manifest.webmanifest', '/dusko-logo-v1.png']))));
self.addEventListener('activate', event => event.waitUntil(caches.delete('dusko-staff-v1')));
self.addEventListener('fetch', event => { if (event.request.method === 'GET' && new URL(event.request.url).origin === self.location.origin) event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); });
