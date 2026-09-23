// Gestão da equipe: somente o papel admin existente representa o administrador master.
import { doc, runTransaction } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { escapeHtml } from './utils.js';
import { FEATURES, getAccess, accessFingerprint, validPermissions } from './permissions.js';

/** Monta um cartão com checkboxes acessíveis; contas master nunca recebem controles de edição. */
export function memberCard(profile) {
    const { role, permissions } = getAccess(profile);
    const editable = ['pending', 'barber'].includes(role) && profile.id !== auth.currentUser?.uid;
    const choices = role === 'pending' ? (profile.permissions || {}) : permissions;
    const status = role === 'admin' ? 'Administrador master' : role === 'barber' ? 'Acesso aprovado' : 'Aguardando aprovação';
    return `<article class="member-card" data-member="${escapeHtml(profile.id)}">
        <div class="list-item-content">
            <strong>${escapeHtml(profile.name || 'Sem nome')}</strong>
            <span>${escapeHtml(profile.email || '')}</span>
            <span class="member-status">${escapeHtml(status)}</span>
        </div>
        ${editable ? `<fieldset class="member-permissions">
            <legend>Permissões de ${escapeHtml(profile.name || 'barbeiro')}</legend>
            ${FEATURES.map(feature => `<label class="permission-option">
                <input type="checkbox" data-permission="${feature.key}" ${choices[feature.key] === true ? 'checked' : ''}>
                <span><strong>${feature.label}</strong><small>${feature.description}</small></span>
            </label>`).join('')}
        </fieldset>
        <div class="list-actions">
            <button class="btn btn-primary btn-compact" type="button" data-save-access>${role === 'pending' ? 'Aprovar acesso' : 'Salvar acessos'}</button>
            ${role === 'barber' ? '<button class="btn btn-danger-outline btn-compact" type="button" data-revoke-access>Revogar acesso</button>' : ''}
        </div>` : '<p class="form-help">Esta conta não pode ser alterada por esta área.</p>'}
        <p class="member-feedback" role="status" aria-live="polite"></p>
    </article>`;
}

/** Salva papel e permissões juntos; evita sobrescrever mudanças de outro administrador. */
export async function saveBarberAccess(profile, role, permissions) {
    if (!auth.currentUser || profile.id === auth.currentUser.uid
        || !['pending', 'barber'].includes(role) || !validPermissions(permissions)) {
        throw new Error('Alteração de acesso inválida.');
    }
    const actor = auth.currentUser.uid;
    await runTransaction(db, async transaction => {
        const ref = doc(db, 'users', profile.id);
        const current = await transaction.get(ref);
        if (auth.currentUser?.uid !== actor) throw new Error('Sua sessão mudou. Entre novamente.');
        if (!current.exists() || !['pending', 'barber'].includes(getAccess(current.data()).role)) {
            throw new Error('Esta conta não está disponível para edição. Atualize a lista.');
        }
        // Também compara escolhas de uma conta pending, ainda sem permissões efetivas.
        if (getAccess(current.data()).role !== getAccess(profile).role
            || accessFingerprint({ ...current.data(), role: 'barber' }) !== accessFingerprint({ ...profile, role: 'barber' })) {
            throw new Error('O acesso mudou desde o carregamento. Atualize a lista antes de salvar.');
        }
        transaction.update(ref, { role, permissions });
    });
}
