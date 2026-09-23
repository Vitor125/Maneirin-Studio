// Migração do PWA único antigo. Novos apps registram workers em escopos separados.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => /^maneirin-studio-v[0-9]+$/.test(key)).map(key => caches.delete(key)));
        await self.registration.unregister();
    })());
});
// Não intercepta requisições nem remove caches dos apps Cliente e Barbeiro.
