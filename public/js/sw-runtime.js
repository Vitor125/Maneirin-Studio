// Motor compartilhado: cada worker fornece identidade, escopo e arquivos próprios.
// CacheStorage é compartilhado na origem, por isso toda leitura/limpeza usa o prefixo do app.
const config = self.APP_CONFIG;
const CACHE_NAME = config.prefix + config.version;
const APP_SHELL = config.shell;

// Prepara a versão nova inteira antes de ativá-la.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Remove somente caches antigos deste aplicativo e assume as páginas abertas.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith(config.prefix) && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Prefere a rede; usa cache/offline apenas quando necessário, sem interceptar outros domínios.
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Dados do Firebase e autenticação nunca são armazenados neste cache.
    if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;
    // Nunca oferece o offline deste app para a navegação do outro.
    if (request.mode === 'navigate' && !url.pathname.startsWith(config.scope)) return;
    event.respondWith((async () => {
        let cache;
        try { cache = await caches.open(CACHE_NAME); } catch { /* A rede funciona mesmo sem cache. */ }
        try {
            const response = await fetch(request);
            // Falha de armazenamento não deve descartar uma resposta válida da rede.
            if (cache && response.ok && !url.search && APP_SHELL.includes(url.pathname)) {
                try { await cache.put(request, response.clone()); } catch { /* Cache indisponível ou cheio. */ }
            }
            return response;
        } catch (error) {
            const cached = await cache?.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') {
                const offline = await cache?.match(config.offline);
                if (offline) return offline;
            }
            throw error;
        }
    })());
});
