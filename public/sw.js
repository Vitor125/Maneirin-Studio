const CACHE_NAME = 'maneirin-studio-v15';
const APP_SHELL = [
    '/',
    '/index.html',
    '/agenda/',
    '/barbeiro/',
    '/produtos/',
    '/dashboard.html',
    '/offline.html',
    '/styles.css',
    '/script.js',
    '/dashboard.js',
    '/Fotos/Logo.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.webmanifest'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('maneirin-studio-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Dados do Firebase e autenticação nunca são armazenados neste cache.
    if (url.origin !== self.location.origin) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request);
            if (response.ok) await cache.put(request, response.clone());
            return response;
        } catch (error) {
            const cached = await cache.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') return cache.match('/offline.html');
            throw error;
        }
    })());
});
