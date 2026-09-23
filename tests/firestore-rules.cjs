// Executa o simulador de regras com documentos fictícios, sem gravar dados.
// Requer Firebase CLI instalado e uma sessão `firebase login` ativa.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

async function main() {
    const globalRoot = process.platform === 'win32'
        ? path.join(process.env.APPDATA, 'npm', 'node_modules')
        : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const cli = path.join(globalRoot, 'firebase-tools', 'lib');
    const { configstore } = require(path.join(cli, 'configstore'));
    await require(path.join(cli, 'requireAuth')).requireAuth({
        project: 'site-maneirin-studio',
        user: configstore.get('user'),
        tokens: configstore.get('tokens')
    });
    const { Client } = require(path.join(cli, 'apiv2'));
    const client = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
    const cases = [];
    const add = (name, expectation, collection, method, role, before, after, own = true, permissions) => {
        cases.push({ name, test: {
            expectation,
            request: {
                path: `/databases/(default)/documents/${collection}/${own ? 'actor' : 'other'}`,
                method,
                auth: role === null ? null : { uid: 'actor', token: { email: 'test@example.com' } },
                ...(after ? { resource: { data: after } } : {})
            },
            ...(before ? { resource: { data: before } } : {}),
            functionMocks: [{ function: 'get', args: [{ anyValue: {} }], result: {
                value: role === 'missing' ? null : { data: { role, ...(permissions === undefined ? {} : { permissions }) } }
            } }]
        } });
    };
    const profile = { role: 'pending', name: 'Teste', email: 'test@example.com', createdAt: '2026-09-18' };
    const product = { name: 'Teste', description: '', image_url: 'https://example.com/photo.jpg', affiliate_link: 'https://example.com/product' };
    const photo = { image_url: 'https://example.com/photo.jpg', alt: 'Corte', created_at: '2026-09-22' };
    const slot = { barber_name: 'Nicolas', date: '2030-01-01', time: '10:00:00', is_available: true };
    const booking = { ...slot, is_available: false, client_name: 'Teste', confirmed_at: '2026-09-22', calendar_id: 'calendar@example.com' };
    add('cadastro pending permitido', 'ALLOW', 'users', 'create', 'missing', null, profile);
    add('cadastro como admin negado', 'DENY', 'users', 'create', 'missing', null, { ...profile, role: 'admin' });
    add('cadastro de outro usuário negado', 'DENY', 'users', 'create', 'pending', null, profile, false);
    add('leitura do próprio perfil ausente', 'ALLOW', 'users', 'get', 'missing');
    add('leitura do próprio perfil', 'ALLOW', 'users', 'get', 'pending', profile);
    add('leitura de outro perfil negada', 'DENY', 'users', 'get', 'pending', profile, null, false);
    add('promoção própria negada', 'DENY', 'users', 'update', 'pending', profile, { ...profile, role: 'admin' });
    add('nome próprio permitido', 'ALLOW', 'users', 'update', 'pending', profile, { ...profile, name: 'Novo' });
    add('aprovação por admin permitida', 'ALLOW', 'users', 'update', 'admin', profile, { ...profile, role: 'barber' }, false);
    add('aprovação por barbeiro negada', 'DENY', 'users', 'update', 'barber', profile, { ...profile, role: 'barber' }, false);
    add('exclusão própria negada', 'DENY', 'users', 'delete', 'pending', profile);
    for (const collection of ['products', 'gallery']) {
        add(`${collection}: leitura pública`, 'ALLOW', collection, 'get', null, {});
        for (const role of [null, 'pending', 'barber', 'admin', 'ADMIN', 'BARBER']) {
            add(`${collection}: escrita ${role}`, ['barber', 'admin', 'ADMIN', 'BARBER'].includes(role) ? 'ALLOW' : 'DENY', collection, 'create', role, null, collection === 'products' ? product : photo);
        }
    }
    add('horário disponível público', 'ALLOW', 'schedules', 'get', null, { is_available: true });
    add('horário reservado privado', 'DENY', 'schedules', 'get', null, { is_available: false, client_name: 'Teste' });
    add('horário sem disponibilidade privado', 'DENY', 'schedules', 'get', null, {});
    add('barbeiro lê reserva', 'ALLOW', 'schedules', 'get', 'barber', { is_available: false });
    add('cliente não confirma reserva', 'DENY', 'schedules', 'update', null, { is_available: true }, { is_available: false });
    add('pending não confirma reserva', 'DENY', 'schedules', 'update', 'pending', { is_available: true }, { is_available: false });
    add('barbeiro confirma reserva', 'ALLOW', 'schedules', 'update', 'barber', slot, booking);
    add('cadastro com email de outra pessoa negado', 'DENY', 'users', 'create', 'missing', null, { ...profile, email: 'owner@example.com' });
    add('cadastro com nome vazio negado', 'DENY', 'users', 'create', 'missing', null, { ...profile, name: '' });
    add('nome próprio com tipo errado negado', 'DENY', 'users', 'update', 'pending', profile, { ...profile, name: [] });
    add('admin não altera email de outra conta', 'DENY', 'users', 'update', 'admin', profile, { ...profile, email: 'forged@example.com' }, false);
    add('admin não remove seu próprio perfil', 'DENY', 'users', 'delete', 'admin', { ...profile, role: 'admin' });
    add('admin revoga barbeiro', 'ALLOW', 'users', 'update', 'admin', { ...profile, role: 'barber' }, profile, false);
    for (const [collection, data] of [['products', product], ['gallery', photo]]) {
        add(`${collection}: id forjado negado`, 'DENY', collection, 'create', 'barber', null, { ...data, id: 'other' });
        add(`${collection}: javascript negado`, 'DENY', collection, 'create', 'barber', null, { ...data, image_url: 'javascript:alert(1)' });
        add(`${collection}: SVG embutido negado`, 'DENY', collection, 'create', 'barber', null, { ...data, image_url: 'data:image/svg+xml;base64,PHN2Zz4=' });
        add(`${collection}: imagem raster aceita`, 'ALLOW', collection, 'create', 'barber', null, { ...data, image_url: 'data:image/png;base64,aGVsbG8=' });
        add(`${collection}: tipo inválido negado`, 'DENY', collection, 'create', 'barber', null, { ...data, image_url: 123 });
        add(`${collection}: exclusão legada permitida`, 'ALLOW', collection, 'delete', 'barber', { legacy: true });
        add(`${collection}: alteração sem acesso negada`, 'DENY', collection, 'update', 'pending', data, data);
    }
    add('produto com descrição excessiva negado', 'DENY', 'products', 'create', 'barber', null, { ...product, description: 'a'.repeat(2001) });
    add('link de afiliado executável negado', 'DENY', 'products', 'create', 'barber', null, { ...product, affiliate_link: 'javascript:alert(1)' });
    add('link com credenciais negado', 'DENY', 'products', 'create', 'barber', null, { ...product, affiliate_link: 'https://user:pass@example.com/' });
    add('barbeiro publica horário válido', 'ALLOW', 'schedules', 'create', 'barber', null, slot);
    add('cliente não publica horário', 'DENY', 'schedules', 'create', null, null, slot);
    add('horário público com nome de cliente negado', 'DENY', 'schedules', 'create', 'barber', null, { ...slot, client_name: 'Privado' });
    add('horário com hora inválida negado', 'DENY', 'schedules', 'create', 'barber', null, { ...slot, time: '25:00' });
    add('horário com data malformada negado', 'DENY', 'schedules', 'create', 'barber', null, { ...slot, date: 'amanhã' });
    add('disponibilidade com tipo errado negada', 'DENY', 'schedules', 'create', 'barber', null, { ...slot, is_available: 'true' });
    add('republicar reserva confirmada negado', 'DENY', 'schedules', 'update', 'barber', booking, { ...booking, is_available: true });
    add('sobrescrever cliente confirmado negado', 'DENY', 'schedules', 'update', 'barber', booking, { ...booking, client_name: 'Outro' });
    add('trocar data durante confirmação negado', 'DENY', 'schedules', 'update', 'barber', slot, { ...booking, date: '2030-01-02' });
    add('confirmar sem cliente negado', 'DENY', 'schedules', 'update', 'barber', slot, { ...booking, client_name: '' });
    // Matriz de privilégios: a interface não é a barreira de segurança.
    const denied = { schedules: false, gallery: false, products: false };
    const permitted = { schedules: true, gallery: true, products: true };
    const barber = { ...profile, role: 'barber', permissions: permitted };
    add('master altera permissões da equipe', 'ALLOW', 'users', 'update', 'admin', barber, { ...barber, permissions: denied }, false);
    add('barbeiro não concede permissões a si', 'DENY', 'users', 'update', 'barber', { ...barber, permissions: denied }, barber, true, denied);
    add('barbeiro não altera outro barbeiro', 'DENY', 'users', 'update', 'barber', barber, { ...barber, permissions: denied }, false, permitted);
    add('pending não cria perfil com permissões', 'DENY', 'users', 'create', 'missing', null, { ...profile, permissions: permitted });
    add('master não remove mapa para reativar acesso legado', 'DENY', 'users', 'update', 'admin', barber, { ...profile, role: 'barber' }, false);
    add('master não salva mapa parcial', 'DENY', 'users', 'update', 'admin', barber, { ...barber, permissions: { schedules: true } }, false);
    add('master não salva permissão com tipo errado', 'DENY', 'users', 'update', 'admin', barber, { ...barber, permissions: { ...denied, gallery: 'true' } }, false);
    add('master não adiciona poder de administrar ao mapa', 'DENY', 'users', 'update', 'admin', barber, { ...barber, permissions: { ...permitted, admin: true } }, false);
    add('master não altera outro master', 'DENY', 'users', 'update', 'admin', { ...profile, role: 'admin' }, barber, false);
    add('master aprova com acesso restrito', 'ALLOW', 'users', 'update', 'admin', profile, { ...barber, permissions: { ...denied, schedules: true } }, false);
    add('master revoga sem apagar escolhas', 'ALLOW', 'users', 'update', 'admin', barber, { ...barber, role: 'pending' }, false);
    for (const [collection, data] of [['products', product], ['gallery', photo], ['schedules', slot]]) {
        add(`${collection}: permissão explícita permite criar`, 'ALLOW', collection, 'create', 'barber', null, data, true, { ...denied, [collection]: true });
        add(`${collection}: permissão revogada nega criar`, 'DENY', collection, 'create', 'barber', null, data, true, denied);
        add(`${collection}: permissão revogada nega excluir`, 'DENY', collection, 'delete', 'barber', data, null, true, denied);
        add(`${collection}: mapa vazio não concede acesso`, 'DENY', collection, 'create', 'barber', null, data, true, {});
        add(`${collection}: mapa inválido não concede acesso`, 'DENY', collection, 'create', 'barber', null, data, true, null);
        add(`${collection}: pending com mapa não concede acesso`, 'DENY', collection, 'create', 'pending', null, data, true, permitted);
        add(`${collection}: master mantém acesso completo`, 'ALLOW', collection, 'create', 'admin', null, data, true, denied);
    }
    add('reserva privada bloqueada sem Agenda', 'DENY', 'schedules', 'get', 'barber', booking, null, true, denied);
    add('reserva privada liberada com Agenda', 'ALLOW', 'schedules', 'get', 'barber', booking, null, true, { ...denied, schedules: true });
    add('confirmar bloqueado sem Agenda', 'DENY', 'schedules', 'update', 'barber', slot, booking, true, denied);
    add('confirmar liberado com Agenda', 'ALLOW', 'schedules', 'update', 'barber', slot, booking, true, { ...denied, schedules: true });
    const response = await client.post('/projects/site-maneirin-studio:test', {
        source: { files: [{ name: 'firestore.rules', content: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }] },
        testSuite: { testCases: cases.map(item => item.test) }
    }, { skipLog: { body: true } });
    let failed = 0;
    for (const [index, result] of (response.body.testResults || []).entries()) {
        console.log(`${result.state}: ${cases[index].name}`);
        if (result.state !== 'SUCCESS') {
            failed++;
            console.log(JSON.stringify(result));
        }
    }
    if ((response.body.testResults || []).length !== cases.length) {
        failed++;
        console.log(JSON.stringify(response.body));
    }
    console.log(`${cases.length - failed}/${cases.length} testes de regras aprovados.`);
    if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
