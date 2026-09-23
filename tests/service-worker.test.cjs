const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function worker(fetch, cache, app = 'cliente') {
    const handlers = {};
    const context = vm.createContext({
        URL, fetch, caches: { open: async () => { if (cache instanceof Error) throw cache; return cache; } },
        self: { location: { origin: 'https://studio.test' }, addEventListener: (type, handler) => { handlers[type] = handler; } },
        importScripts() {}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', app, 'sw.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/sw-runtime.js'), 'utf8'), context);
    return (url, mode = 'cors') => {
        let response;
        handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith(promise) { response = promise; } });
        return response;
    };
}

test('cache cheio não descarta resposta válida da rede', async () => {
    const fresh = { ok: true, clone: () => ({}) };
    const run = worker(async () => fresh, { put: async () => { throw new Error('quota'); }, match: async () => 'stale' });
    assert.equal(await run('https://studio.test/cliente/'), fresh);
});

test('requisições Firebase e rotas de autenticação não são interceptadas', () => {
    const run = worker(() => { throw new Error('Não deveria buscar'); }, {});
    assert.equal(run('https://firestore.googleapis.com/documents'), undefined);
    assert.equal(run('https://studio.test/__/auth/handler'), undefined);
});

test('sem rede usa cache e oferece página offline para navegação desconhecida', async () => {
    const run = worker(async () => { throw new Error('offline'); }, { match: async request => request === '/cliente/offline.html' ? 'offline-page' : undefined });
    assert.equal(await run('https://studio.test/cliente/unknown', 'navigate'), 'offline-page');
});

test('URLs arbitrárias não aumentam o cache estático', async () => {
    let writes = 0;
    const run = worker(async () => ({ ok: true, clone: () => ({}) }), { put: async () => { writes++; } });
    await run('https://studio.test/?random=1');
    await run('https://studio.test/cliente/unknown');
    assert.equal(writes, 0);
});

test('cache totalmente indisponível ainda permite carregar pela rede', async () => {
    const fresh = { ok: true, clone: () => ({}) };
    const run = worker(async () => fresh, new Error('storage disabled'));
    assert.equal(await run('https://studio.test/cliente/'), fresh);
});

// Testa o comportamento dos dois caches no mesmo domínio, incluindo atualizações e offline.
for (const app of ['cliente', 'barbeiro']) {
    test(app + ': offline e navegação não invadem o outro aplicativo', async () => {
        const other = app === 'cliente' ? 'barbeiro' : 'cliente';
        const run = worker(async () => { throw new Error('offline'); }, { match: async value => value === '/' + app + '/offline.html' ? app : undefined }, app);
        assert.equal(await run('https://studio.test/' + app + '/unknown', 'navigate'), app);
        assert.equal(run('https://studio.test/' + other + '/', 'navigate'), undefined);
    });
    test(app + ': atualização apaga somente versões do próprio cache', async () => {
        const handlers = {}, deleted = [], precached = [];
        const context = vm.createContext({
            importScripts() {},
            caches: {
                // Usa a versão atual declarada pelo worker, preservando também o cache do outro app.
                keys: async () => ['maneirin-cliente-v0', 'maneirin-barbeiro-v0',
                    context.self.APP_CONFIG.prefix + context.self.APP_CONFIG.version,
                    'maneirin-' + (app === 'cliente' ? 'barbeiro' : 'cliente') + '-current'],
                delete: async key => deleted.push(key),
                open: async () => ({ addAll: async paths => precached.push(...paths) })
            },
            self: { addEventListener: (type, handler) => { handlers[type] = handler; }, skipWaiting() {}, clients: { claim() {} } }
        });
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', app, 'sw.js'), 'utf8'), context);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/sw-runtime.js'), 'utf8'), context);
        let pending;
        handlers.install({ waitUntil: value => { pending = value; } }); await pending;
        for (const asset of precached) assert.ok(fs.existsSync(path.join(__dirname, '../public', asset)), 'Arquivo ausente: ' + asset);
        assert.ok(precached.includes('/' + app + '/offline.html'));
        assert.ok(!precached.some(value => value.startsWith('/' + (app === 'cliente' ? 'barbeiro' : 'cliente') + '/')));
        handlers.activate({ waitUntil: value => { pending = value; } }); await pending;
        assert.deepEqual(deleted, ['maneirin-' + app + '-v0']);
    });
}

test('manifests têm identidades diferentes e escopos sem sobreposição', () => {
    const manifests = ['cliente', 'barbeiro'].map(app => JSON.parse(fs.readFileSync(path.join(__dirname, '../public', app, 'manifest.webmanifest'), 'utf8')));
    assert.notEqual(manifests[0].id, manifests[1].id);
    assert.notEqual(manifests[0].icons[0].src, manifests[1].icons[0].src);
    for (const manifest of manifests) {
        assert.ok(manifest.start_url.startsWith(manifest.scope));
        for (const shortcut of manifest.shortcuts) assert.ok(shortcut.url.startsWith(manifest.scope));
    }
    assert.ok(!manifests[0].scope.startsWith(manifests[1].scope));
    assert.ok(!manifests[1].scope.startsWith(manifests[0].scope));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, '../public/manifest.webmanifest'), 'utf8')), manifests[0]);
});

test('worker legado remove apenas seus caches e se desregistra', async () => {
    const handlers = {}, deleted = []; let unregistered = false, pending;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), {
        caches: { keys: async () => ['maneirin-studio-v20', 'maneirin-cliente-v2', 'maneirin-barbeiro-v1'], delete: async key => deleted.push(key) },
        self: { addEventListener: (type, handler) => { handlers[type] = handler; }, registration: { unregister: async () => { unregistered = true; } } }
    });
    handlers.activate({ waitUntil: value => { pending = value; } }); await pending;
    assert.deepEqual(deleted, ['maneirin-studio-v20']);
    assert.equal(unregistered, true);
    assert.equal(handlers.fetch, undefined);
});

// Garante que mover uma página não quebre seus recursos nem associe o manifest errado.
test('páginas usam recursos existentes e o manifest do aplicativo correspondente', () => {
    for (const file of ['cliente/index.html', 'cliente/agenda/index.html', 'cliente/produtos/index.html', 'barbeiro/index.html']) {
        const app = file.split('/')[0];
        const html = fs.readFileSync(path.join(__dirname, '../public', file), 'utf8');
        assert.ok(html.includes('data-app="' + app + '"'));
        assert.ok(html.includes('rel="manifest" href="/' + app + '/manifest.webmanifest"'));
        for (const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
            assert.ok(fs.existsSync(path.join(__dirname, '../public', match[1])), file + ': recurso ausente ' + match[1]);
        }
    }
});
