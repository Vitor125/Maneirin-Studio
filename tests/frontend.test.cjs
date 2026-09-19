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
        initializeApp: () => ({}), getFirestore: () => ({}), getAuth: () => ({ currentUser: null }),
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
    for (const file of ['script.js', 'dashboard.js']) {
        let source = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
        source = source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
        vm.runInContext(source, context, { filename: file });
    }
    context.setupAnimations = () => {};
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
