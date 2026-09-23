// Contrato de acesso compartilhado pela navegação, ações e área master.
// As mesmas decisões são verificadas no servidor em firestore.rules.
export const FEATURES = [
    { key: 'schedules', label: 'Agenda', description: 'Ver reservas, publicar horários, confirmar e remover atendimentos.' },
    { key: 'gallery', label: 'Fotos', description: 'Adicionar e remover fotos da galeria.' },
    { key: 'products', label: 'Produtos', description: 'Cadastrar e remover produtos recomendados.' }
];

/** Converte um perfil em permissões efetivas; valores inválidos não concedem acesso. */
export function getAccess(profile = {}) {
    const data = typeof profile === 'string' ? { role: profile } : (profile || {});
    const role = String(data.role || 'pending').toLowerCase();
    const legacy = !Object.prototype.hasOwnProperty.call(data, 'permissions');
    const permissions = Object.fromEntries(FEATURES.map(({ key }) => [key,
        role === 'admin' || (role === 'barber' && (legacy || data.permissions?.[key] === true))
    ]));
    return { role, permissions };
}

/** Compara o acesso efetivo para invalidar consultas e detectar edições concorrentes. */
export function accessFingerprint(profile) {
    return JSON.stringify(getAccess(profile));
}

/** Valida o contrato completo usado pelo formulário do master antes da gravação. */
export function validPermissions(permissions) {
    return permissions !== null && typeof permissions === 'object'
        && Object.keys(permissions).length === FEATURES.length
        && FEATURES.every(({ key }) => typeof permissions[key] === 'boolean');
}
