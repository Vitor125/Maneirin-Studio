const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Executa os módulos reais com uma borda simulada para DOM/Firebase.
// Nenhuma conta ou reserva é criada no ambiente de produção.
function loadApp(overrides = {}) {
    const nodes = new Map();
    const listeners = new Map();
    const element = id => {
        if (!nodes.has(id)) nodes.set(id, {
            value: '', textContent: '', innerHTML: '', style: {}, disabled: false,
            files: [], className: '', addEventListener(type, fn) { this[type] = fn; },
            querySelectorAll() { return []; }, reset() {}
        });
        return nodes.get(id);
    };
    const context = vm.createContext({
        console, URL, URLSearchParams, TextEncoder, Date,
        initializeApp: () => ({}), getFirestore: () => ({}), getAuth: () => ({ currentUser: { uid: 'tester' } }),
        doc: (_, collection, id) => `${collection}/${id}`, collection: (_, name) => name,
        query: (...args) => args, where: (...args) => args,
        getDocs: async () => ({ docs: [] }),
        getDoc: async () => ({ exists: () => true }),
        onSnapshot: () => () => {},
        document: {
            getElementById: element, querySelector: () => null, querySelectorAll: () => [],
            addEventListener: (type, fn) => { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); }
        },
        window: { prompt: () => 'Cliente de teste', open: () => null, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, addEventListener() {} },
        ...overrides
    });
    for (const file of ['js/firebase.js', 'js/utils.js', 'js/media.js', 'js/calendar.js', 'js/ui.js', 'js/permissions.js', 'js/admin.js', 'script.js', 'dashboard.js']) {
        let source = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
        source = source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
        vm.runInContext(source, context, { filename: file });
    }
    context.setupAnimations = () => {};
    context.initCommonUI = () => {};
    context.resetDashboardData('admin');
    return { context, element, listeners };
}

test('agenda usa o fuso do Studio e rejeita datas impossíveis', () => {
    const { context: app } = loadApp();
    assert.equal(app.getScheduleStart({ date: '2030-01-01', time: '23:30:00' }).toISOString(), '2030-01-02T02:30:00.000Z');
    for (const slot of [
        { date: '2030-02-30', time: '10:00' }, { date: '2030-13-01', time: '10:00' },
        { date: '2030-01-01', time: '24:00' }, { date: '2030-01-01', time: '10:99' },
        { date: '2030-01-01' }, { time: '10:00' }, { date: 'bad', time: '10:00' }
    ]) assert.equal(app.getScheduleStart(slot), null);
    assert.equal(app.isUpcomingSchedule({ date: '2020-01-01', time: '10:00' }), false);
});

test('calendário preserva data, duração e nome com caracteres especiais', () => {
    const { context: app } = loadApp();
    const url = new URL(app.buildGoogleCalendarUrl({ date: '2030-12-31', time: '23:30', barber_name: 'Nicolas' }, 'José & Ana'));
    assert.equal(url.origin, 'https://calendar.google.com');
    assert.equal(url.searchParams.get('dates'), '20310101T023000Z/20310101T033000Z');
    assert.equal(url.searchParams.get('text'), 'Maneirin Studio - José & Ana');
    assert.equal(url.searchParams.get('ctz'), 'America/Sao_Paulo');
    assert.equal(url.searchParams.get('authuser'), 'maneirinbarbeiro222@gmail.com');
    assert.equal(url.searchParams.get('src'), 'maneirinbarbeiro222@gmail.com');
});

test('links e textos de produtos não executam HTML recebido do banco', () => {
    const { context: app } = loadApp();
    assert.equal(app.safeExternalUrl('javascript:alert(1)'), '#');
    const html = app.productCardTemplate({ name: '<script>alert(1)</script>', affiliate_link: 'javascript:alert(1)' });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('href="#"'));
    assert.equal(new URL(app.buildWhatsappUrl('José & Ana?')).searchParams.get('text'), 'José & Ana?');
});

test('a agenda pública consulta apenas disponibilidade explícita e reage à confirmação', async () => {
    let receive;
    let filter;
    const { context: app, element } = loadApp({
        onSnapshot(q, callback) { filter = q; receive = callback; return () => {}; }
    });
    await app.fetchSchedules();
    assert.deepEqual(JSON.parse(JSON.stringify(filter)), ['schedules', ['is_available', '==', true]]);
    receive({ docs: [{ id: 'slot', data: () => ({ date: '2030-01-01', time: '10:00', barber_name: 'Nicolas', is_available: true }) }] });
    assert.ok(element('agendaList').innerHTML.includes('wa.me/5521980453636'));
    receive({ docs: [] });
    assert.ok(element('agendaList').innerHTML.includes('Nenhum horário disponível'));
});

test('confirmação usa o estado atual da reserva e mantém recuperação de popup bloqueado', async () => {
    const slot = { date: '2030-01-01', time: '10:00', barber_name: 'Nicolas', is_available: true };
    let writes = 0;
    const { context: app, element } = loadApp({
        runTransaction: async (_, callback) => callback({
            get: async () => ({ exists: () => true, data: () => ({ ...slot }) }),
            update: (_, update) => { writes++; Object.assign(slot, update); }
        })
    });
    await app.confirmSchedule('slot', slot);
    assert.equal(writes, 1);
    assert.equal(slot.is_available, false);
    assert.equal(slot.client_name, 'Cliente de teste');
    assert.match(element('dashboardStatus').textContent, /Adicionar à agenda/);
    await app.confirmSchedule('slot', { ...slot, is_available: true });
    assert.equal(writes, 1);
    assert.match(element('dashboardStatus').textContent, /já foi confirmado/);
});

test('perfil existente nunca é sobrescrito para pending durante cadastro/login', async () => {
    let writes = 0;
    const { context: app } = loadApp({ runTransaction: async (_, callback) => callback({
        get: async () => ({ exists: () => true, data: () => ({ role: 'admin' }) }), set() { writes++; }
    }) });
    await app.ensureUserProfile({ uid: 'owner', email: 'test@example.com' }, 'Nome');
    assert.equal(writes, 0);
});

test('imagem excessiva é rejeitada antes da gravação no Firestore', async () => {
    const { context: app, element } = loadApp();
    element('prodImageFile').files = [{ size: 700 * 1024, type: 'image/jpeg' }];
    await assert.rejects(app.getProductImage(), /600 KB/);
    element('galleryImageFile').files = [{ size: 700 * 1024, type: 'image/jpeg' }];
    await assert.rejects(app.getGalleryImage(), /600 KB/);
});

test('links de páginas são rejeitados quando não carregam como imagem', async () => {
    const { context: app } = loadApp({ Image: class {
        set src(value) { queueMicrotask(() => this.onerror()); }
    } });
    await assert.rejects(app.validateImageLink('https://example.com/postagem'), /não abre uma imagem/);
});

test('login libera novamente o botão após sucesso e depois de erro', async () => {
    let fail = false;
    const { context: app, element, listeners } = loadApp({
        onAuthStateChanged() {}, signInWithEmailAndPassword: async () => { if (fail) throw new Error('credencial inválida'); },
        console: { error() {} }
    });
    listeners.get('DOMContentLoaded')[1]();
    element('authMode').value = 'login';
    await element('authForm').submit({ preventDefault() {} });
    assert.equal(element('authSubmitBtn').disabled, false);
    fail = true;
    await element('authForm').submit({ preventDefault() {} });
    assert.equal(element('authSubmitBtn').disabled, false);
    assert.equal(element('authError').style.display, 'block');
});

test('metadados vencem campo id forjado e IDs são escapados nos botões', async () => {
    const maliciousId = 'x" onclick="alert(1)';
    const { context: app, element } = loadApp({
        getAuth: () => ({ currentUser: { uid: 'owner' } }),
        getDocs: async () => ({ docs: [{ id: maliciousId, data: () => ({ id: 'forged', name: '<img onerror=alert(1)>', affiliate_link: 'https://example.com' }) }] })
    });
    assert.equal(app.documentData({ id: 'real', data: () => ({ id: 'forged' }) }).id, 'real');
    app.resetDashboardData('admin');
    await app.loadDashboardProducts();
    const html = element('dashboardProductsList').innerHTML;
    assert.ok(html.includes('data-delete-product="x&quot; onclick=&quot;alert(1)"'));
    assert.ok(!html.includes(' onclick="'));
    assert.ok(!html.includes('<img onerror'));
});

test('resposta atrasada de lista não reaparece após revogar acesso', async () => {
    let resolve;
    const { context: app, element } = loadApp({
        getAuth: () => ({ currentUser: { uid: 'owner' } }),
        getDocs: () => new Promise(done => { resolve = done; })
    });
    app.resetDashboardData('admin');
    const loading = app.loadAdminUsers();
    app.resetDashboardData('barber');
    resolve({ docs: [{ id: 'private', data: () => ({ email: 'private@example.com', role: 'pending' }) }] });
    await loading;
    assert.equal(element('adminUsersList').innerHTML, '');
});

test('erro atrasado de rede não sobrescreve outra sessão', async () => {
    let reject;
    const { context: app, element } = loadApp({
        getAuth: () => ({ currentUser: { uid: 'owner' } }),
        getDocs: () => new Promise((_, fail) => { reject = fail; })
    });
    app.resetDashboardData('admin');
    const loading = app.loadDashboardSchedules();
    app.resetDashboardData();
    reject(new Error('permission-denied'));
    await loading;
    assert.equal(element('dashboardSchedulesList').innerHTML, '');
});

test('URLs de imagem bloqueiam scripts, SVG embutido e credenciais', () => {
    const { context: app } = loadApp();
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'data:image/svg+xml;base64,PHN2Zz4=', 'https://user:pass@example.com/photo.jpg']) {
        assert.equal(app.safeImageUrl(url), '');
    }
    assert.equal(app.safeImageUrl('data:image/png;base64,aGVsbG8='), 'data:image/png;base64,aGVsbG8=');
    assert.equal(app.safeImageUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
});

test('upload verifica conteúdo e rejeita arquivo falso mesmo com MIME de imagem', async () => {
    const { context: app, element } = loadApp({
        FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,bm90LWFuLWltYWdl'; this.onload(); } },
        Image: class { set src(value) { queueMicrotask(() => this.onerror()); } }
    });
    element('galleryImageFile').files = [{ size: 10, type: 'image/png' }];
    await assert.rejects(app.getGalleryImage(), /não abre uma imagem/);
    element('galleryImageFile').files = [{ size: 10, type: 'image/svg+xml' }];
    await assert.rejects(app.getGalleryImage(), /JPG, PNG/);
});

test('falha ao abrir calendário não apresenta reserva salva como erro', async () => {
    const slot = { date: '2030-01-01', time: '10:00', barber_name: 'Nicolas', is_available: true };
    const { context: app, element } = loadApp({ runTransaction: async (_, callback) => callback({
        get: async () => ({ exists: () => true, data: () => slot }), update() {}
    }) });
    app.window.open = () => ({ location: { replace() { throw new Error('Janela indisponível'); } }, close() {} });
    await app.confirmSchedule('slot', slot);
    assert.match(element('dashboardStatus').textContent, /Horário confirmado.*Adicionar à agenda/);
});

test('validação limita textos antes da gravação', () => {
    const { context: app } = loadApp();
    assert.equal(app.boundedText('  Corte  ', 'Nome', 120), 'Corte');
    assert.throws(() => app.boundedText(' ', 'Nome', 120), /Nome/);
    assert.throws(() => app.boundedText('x'.repeat(161), 'Descrição', 160, false), /160/);
});

test('carregamento de foto interrompido por revogação não grava em outra sessão', async () => {
    let resolveImage;
    let writes = 0;
    const { context: app } = loadApp({
        getAuth: () => ({ currentUser: { uid: 'owner' } }), addDoc: async () => { writes++; }
    });
    app.getGalleryImage = () => new Promise(resolve => { resolveImage = resolve; });
    app.resetDashboardData('admin');
    const upload = app.submitGalleryPhoto({ preventDefault() {}, target: { reset() {} } });
    app.resetDashboardData('pending');
    resolveImage('https://example.com/image.jpg');
    await upload;
    assert.equal(writes, 0);
});

test('callback antigo de perfil não reabre painel após sair', async () => {
    const user = { uid: 'owner', email: 'test@example.com' };
    const auth = { currentUser: user };
    let authCallback;
    let profileCallback;
    const { element, listeners } = loadApp({
        getAuth: () => auth,
        onAuthStateChanged: (_, callback) => { authCallback = callback; },
        onSnapshot: (_, callback) => { profileCallback = callback; return () => {}; },
        runTransaction: async (_, callback) => callback({ get: async () => ({ exists: () => true }) })
    });
    listeners.get('DOMContentLoaded')[1]();
    await authCallback(user);
    profileCallback({ data: () => ({ role: 'admin' }) });
    assert.equal(element('mainDashboard').style.display, 'block');
    auth.currentUser = null;
    await authCallback(null);
    profileCallback({ data: () => ({ role: 'admin' }) });
    assert.equal(element('mainDashboard').style.display, 'none');
    assert.equal(element('adminUsersList').innerHTML, '');
});

test('permissões explícitas restringem o barbeiro e preservam o master', () => {
    const { context: app } = loadApp();
    const denied = { schedules: false, gallery: false, products: false };
    assert.equal(app.getAccess({ role: 'barber' }).permissions.products, true);
    assert.equal(app.getAccess({ role: 'barber', permissions: denied }).permissions.products, false);
    assert.equal(app.getAccess({ role: 'barber', permissions: { gallery: true } }).permissions.schedules, false);
    assert.equal(app.getAccess({ role: 'barber', permissions: null }).permissions.gallery, false);
    assert.equal(app.getAccess({ role: 'pending', permissions: { gallery: true } }).permissions.gallery, false);
    assert.equal(app.getAccess({ role: 'admin', permissions: denied }).permissions.products, true);
});

test('área master escapa nomes e não permite editar a própria conta', () => {
    const { context: app } = loadApp();
    const html = app.memberCard({ id: 'other', role: 'barber', name: '<script>alert(1)</script>' });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('data-permission="schedules"'));
    assert.ok(!app.memberCard({ id: 'tester', role: 'admin' }).includes('data-save-access'));
});

test('master grava papel e permissões na mesma transação', async () => {
    let update;
    const profile = { id: 'other', role: 'pending' };
    const { context: app } = loadApp({ runTransaction: async (_, callback) => callback({
        get: async () => ({ exists: () => true, data: () => profile }),
        update: (ref, data) => { update = { ref, data }; }
    }) });
    await app.saveBarberAccess(profile, 'barber', { schedules: true, gallery: false, products: false });
    assert.equal(update.ref, 'users/other');
    assert.equal(update.data.role, 'barber');
    assert.equal(update.data.permissions.schedules, true);
    assert.equal(update.data.permissions.gallery, false);
});

test('alteração concorrente de permissões impede sobrescrita', async () => {
    let writes = 0;
    const profile = { id: 'other', role: 'barber' };
    const { context: app } = loadApp({ runTransaction: async (_, callback) => callback({
        get: async () => ({ exists: () => true, data: () => ({ ...profile, permissions: { schedules: false, gallery: true, products: true } }) }),
        update: () => { writes++; }
    }) });
    await assert.rejects(app.saveBarberAccess(profile, 'barber', { schedules: true, gallery: true, products: true }), /acesso mudou/);
    assert.equal(writes, 0);
});

test('mudança concorrente de escolhas pending também é detectada', async () => {
    const profile = { id: 'other', role: 'pending', permissions: { schedules: false, gallery: false, products: false } };
    const { context: app } = loadApp({ runTransaction: async (_, callback) => callback({
        get: async () => ({ exists: () => true, data: () => ({ ...profile, permissions: { ...profile.permissions, gallery: true } }) }),
        update: () => { throw new Error('Não deveria gravar'); }
    }) });
    await assert.rejects(app.saveBarberAccess(profile, 'barber', profile.permissions), /acesso mudou/);
});

test('mapas incompletos e alteração da própria conta são recusados', async () => {
    const { context: app } = loadApp();
    await assert.rejects(app.saveBarberAccess({ id: 'other' }, 'barber', { gallery: true }), /inválida/);
    await assert.rejects(app.saveBarberAccess({ id: 'tester' }, 'pending', { schedules: false, gallery: false, products: false }), /inválida/);
});

test('consulta e ação de área bloqueada não chegam ao banco', async () => {
    let requests = 0;
    const { context: app } = loadApp({ getDocs: async () => { requests++; return { docs: [] }; }, deleteDoc: async () => { requests++; } });
    app.resetDashboardData({ role: 'barber', permissions: { schedules: true, gallery: false, products: false } });
    await app.loadDashboardProducts();
    await app.deleteGalleryPhoto('photo');
    assert.equal(requests, 0);
    await app.loadDashboardSchedules();
    assert.equal(requests, 1);
});

test('revogar só Agenda invalida resposta pendente sem mudar o papel', async () => {
    let resolve;
    const { context: app, element } = loadApp({ getDocs: () => new Promise(done => { resolve = done; }) });
    app.resetDashboardData({ role: 'barber' });
    const loading = app.loadDashboardSchedules();
    app.resetDashboardData({ role: 'barber', permissions: { schedules: false, gallery: true, products: true } });
    resolve({ docs: [{ id: 'private', data: () => ({ client_name: 'Privado', date: '2030-01-01', time: '10:00', is_available: false }) }] });
    await loading;
    assert.equal(element('dashboardSchedulesList').innerHTML, '');
});
