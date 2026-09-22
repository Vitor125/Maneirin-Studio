const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function worker(fetch, cache) {
    const handlers = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), {
        URL, fetch, caches: { open: async () => { if (cache instanceof Error) throw cache; return cache; } },
        self: { location: { origin: 'https://studio.test' }, addEventListener: (type, handler) => { handlers[type] = handler; } }
    });
    return (url, mode = 'cors') => {
        let response;
        handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith(promise) { response = promise; } });
        return response;
    };
}

test('cache cheio não descarta resposta válida da rede', async () => {
    const fresh = { ok: true, clone: () => ({}) };
    const run = worker(async () => fresh, { put: async () => { throw new Error('quota'); }, match: async () => 'stale' });
    assert.equal(await run('https://studio.test/dashboard.html'), fresh);
});

test('requisições Firebase e rotas de autenticação não são interceptadas', () => {
    const run = worker(() => { throw new Error('Não deveria buscar'); }, {});
    assert.equal(run('https://firestore.googleapis.com/documents'), undefined);
    assert.equal(run('https://studio.test/__/auth/handler'), undefined);
});

test('sem rede usa cache e oferece página offline para navegação desconhecida', async () => {
    const run = worker(async () => { throw new Error('offline'); }, { match: async request => request === '/offline.html' ? 'offline-page' : undefined });
    assert.equal(await run('https://studio.test/unknown', 'navigate'), 'offline-page');
});

test('URLs arbitrárias não aumentam o cache estático', async () => {
    let writes = 0;
    const run = worker(async () => ({ ok: true, clone: () => ({}) }), { put: async () => { writes++; } });
    await run('https://studio.test/?random=1');
    await run('https://studio.test/unknown');
    assert.equal(writes, 0);
});

test('cache totalmente indisponível ainda permite carregar pela rede', async () => {
    const fresh = { ok: true, clone: () => ({}) };
    const run = worker(async () => fresh, new Error('storage disabled'));
    assert.equal(await run('https://studio.test/dashboard.html'), fresh);
});
