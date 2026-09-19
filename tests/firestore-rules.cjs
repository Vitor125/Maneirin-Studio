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
    const add = (name, expectation, collection, method, role, before, after, own = true) => {
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
                value: role === 'missing' ? null : { data: { role } }
            } }]
        } });
    };
    const profile = { role: 'pending', name: 'Teste', email: 'test@example.com', createdAt: '2026-09-18' };
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
            add(`${collection}: escrita ${role}`, ['barber', 'admin', 'ADMIN', 'BARBER'].includes(role) ? 'ALLOW' : 'DENY', collection, 'create', role, null, { name: 'Teste' });
        }
    }
    add('horário disponível público', 'ALLOW', 'schedules', 'get', null, { is_available: true });
    add('horário reservado privado', 'DENY', 'schedules', 'get', null, { is_available: false, client_name: 'Teste' });
    add('horário sem disponibilidade privado', 'DENY', 'schedules', 'get', null, {});
    add('barbeiro lê reserva', 'ALLOW', 'schedules', 'get', 'barber', { is_available: false });
    add('cliente não confirma reserva', 'DENY', 'schedules', 'update', null, { is_available: true }, { is_available: false });
    add('pending não confirma reserva', 'DENY', 'schedules', 'update', 'pending', { is_available: true }, { is_available: false });
    add('barbeiro confirma reserva', 'ALLOW', 'schedules', 'update', 'barber', { is_available: true }, { is_available: false, client_name: 'Teste' });
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
