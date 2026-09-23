// Orquestra o painel: sessão → perfil/permissões → abas → consultas e ações autorizadas.
import { collection, addDoc, deleteDoc, doc, getDocs, runTransaction, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { db, auth } from './js/firebase.js';
import { escapeHtml, formatDateBR, formatTime, getScheduleStart, isUpcomingSchedule, safeExternalUrl, safeImageUrl, sortSchedulesByStart, documentData, boundedText } from './js/utils.js';
import { buildGoogleCalendarUrl, GOOGLE_CALENDAR_ID } from './js/calendar.js';
import { readImageInput, bindImageErrors } from './js/media.js';
import { initCommonUI } from './js/ui.js';
import { FEATURES, getAccess, accessFingerprint } from './js/permissions.js';
import { memberCard, saveBarberAccess } from './js/admin.js';

let dashboardAccessVersion = 0;
let dashboardRole = null;
let dashboardPermissions = getAccess().permissions;

/** Invalida operações antigas, recalcula permissões e limpa as listas da sessão anterior. */
function resetDashboardData(profile = null) {
    dashboardAccessVersion++;
    const access = getAccess(profile);
    dashboardRole = access.role;
    dashboardPermissions = access.permissions;
    for (const id of ['dashboardProductsList', 'dashboardSchedulesList', 'dashboardGalleryList', 'adminUsersList']) {
        document.getElementById(id).innerHTML = '';
    }
    setDashboardStatus('');
    setDatabaseStatus('');
}

// Uma resposta iniciada por outra sessão/permissão não pode preencher o painel.
/** Captura usuário, versão da sessão e área exigida; a função retornada deve ser conferida após cada espera. */
function captureDashboardAccess(requiredRole) {
    const version = dashboardAccessVersion;
    const uid = auth.currentUser?.uid;
    return () => Boolean(uid && uid === auth.currentUser?.uid && version === dashboardAccessVersion
        && (requiredRole === 'admin' ? dashboardRole === 'admin'
            : requiredRole ? dashboardPermissions[requiredRole] === true : ['admin', 'barber'].includes(dashboardRole)));
}

/** Mostra uma mensagem temporária de sucesso ou erro sem inserir HTML recebido do usuário. */
function setDashboardStatus(message, type = 'success') {
    const status = document.getElementById('dashboardStatus');
    if (!status) return;

    status.textContent = message;
    status.className = `dashboard-status ${type}`;

    window.clearTimeout(setDashboardStatus.timeoutId);
    setDashboardStatus.timeoutId = window.setTimeout(() => {
        status.textContent = '';
        status.className = 'dashboard-status';
    }, 5000);
}

/** Atualiza o indicador persistente de conexão do painel. */
function setDatabaseStatus(message, type = 'success') {
    const status = document.getElementById('databaseStatus');
    if (!status) return;

    status.textContent = message;
    status.className = `database-status ${type}`;
}

/** Confere se o perfil atual pode ser lido, descartando respostas de uma sessão encerrada. */
async function loadDatabaseStatus() {
    const canRender = captureDashboardAccess();
    if (!canRender()) return;
    try {
        await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!canRender()) return;
        setDatabaseStatus('Painel conectado.', 'success');
    } catch {
        if (!canRender()) return;
        setDatabaseStatus('Não foi possível verificar a conexão.', 'error');
    }
}

/** Cria apenas perfis ausentes como pending; a transação preserva papéis já aprovados. */
async function ensureUserProfile(user, name) {
    const ref = doc(db, 'users', user.uid);
    await runTransaction(db, async transaction => {
        const profile = await transaction.get(ref);
        if (!profile.exists()) transaction.set(ref, {
            email: user.email,
            name: (name?.trim() || user.email.split('@')[0]).slice(0, 120),
            role: 'pending',
            createdAt: new Date().toISOString()
        });
    });
}

/** Lê arquivo ou URL do formulário de produto usando o validador compartilhado. */
function getProductImage() {
    return readImageInput('prodImageFile', 'prodImageUrl');
}

/** Exige uma imagem válida para o formulário da galeria. */
function getGalleryImage() {
    return readImageInput('galleryImageFile', 'galleryImageUrl', true);
}

/** Valida e grava uma foto; interrupções de acesso durante o carregamento cancelam o envio. */
async function submitGalleryPhoto(event) {
    event.preventDefault();
    const canRender = captureDashboardAccess('gallery');
    if (!canRender()) return;
    try {
        const imageUrl = await getGalleryImage();
        if (!canRender()) return;
        await addDoc(collection(db, 'gallery'), {
            image_url: imageUrl,
            alt: boundedText(document.getElementById('galleryAlt').value, 'Descrição da foto', 160, false),
            created_at: new Date().toISOString()
        });
        if (!canRender()) return;
        event.target.reset();
        setDashboardStatus('Foto adicionada à galeria.');
        loadDashboardGallery();
    } catch (error) {
        if (!canRender()) return;
        setDashboardStatus(error.message || 'Erro ao adicionar foto.', 'error');
    }
}

/** Remove a entrada da galeria quando a sessão possui permissão de Fotos. */
async function deleteGalleryPhoto(id) {
    const canRender = captureDashboardAccess('gallery');
    if (!canRender()) return;
    try {
        await deleteDoc(doc(db, 'gallery', id));
        if (!canRender()) return;
        setDashboardStatus('Foto removida da galeria.');
        loadDashboardGallery();
    } catch (error) {
        if (!canRender()) { return; }
        setDashboardStatus('Erro ao remover foto.', 'error');
    }
}

/** Valida imagem, textos e link de afiliado antes de salvar o produto e recarregar a lista. */
async function submitProduct(event) {
    event.preventDefault();
    const canRender = captureDashboardAccess('products');
    if (!canRender()) return;
    try {
        const imageUrl = await getProductImage();
        if (!canRender()) return;
        if (!imageUrl) {
            setDashboardStatus('Adicione uma foto ou um link de imagem para o produto.', 'error');
            return;
        }

        const product = {
            name: boundedText(document.getElementById('prodName').value, 'Nome do produto', 120),
            description: boundedText(document.getElementById('prodDesc').value, 'Descrição do produto', 2000, false),
            image_url: imageUrl,
            affiliate_link: safeExternalUrl(document.getElementById('prodLink').value.trim())
        };
        if (product.affiliate_link === '#' || product.affiliate_link.length > 4096) {
            throw new Error('Informe o nome e um link HTTP/HTTPS para o produto.');
        }
        if (new TextEncoder().encode(JSON.stringify(product)).length > 950000) {
            throw new Error('Produto muito grande. Reduza a imagem ou a descrição.');
        }

        await addDoc(collection(db, "products"), product);
        if (!canRender()) return;
        event.target.reset();
        setDashboardStatus('Produto cadastrado com sucesso.');
        loadDashboardProducts();
    } catch (error) {
        if (!canRender()) return;
        setDashboardStatus(error.message || 'Erro ao salvar produto.', 'error');
    }
}

/** Publica uma disponibilidade futura no fuso do Studio, sem reservar automaticamente para o cliente. */
async function submitSchedule(event) {
    const canRender = captureDashboardAccess('schedules');
    if (!canRender()) return;
    event.preventDefault();
    const schedule = {
        barber_name: document.getElementById('schedBarber').value.trim(),
        date: document.getElementById('schedDate').value,
        time: `${document.getElementById('schedTime').value}:00`,
        is_available: true
    };

    try {
        if (!schedule.barber_name || schedule.barber_name.length > 120 || !isUpcomingSchedule(schedule)) {
            setDashboardStatus('Informe o barbeiro e um horário válido no futuro.', 'error');
            return;
        }
        await addDoc(collection(db, "schedules"), schedule);
        if (!canRender()) return;
        document.getElementById('schedDate').value = '';
        document.getElementById('schedTime').value = '';
        setDashboardStatus('Horário adicionado com sucesso.');
        loadDashboardSchedules();
    } catch (error) {
        if (!canRender()) { return; }
        setDashboardStatus('Erro ao salvar horário.', 'error');
    }
}

/** Exclui um produto permitido e atualiza a lista do painel. */
async function deleteProduct(id) {
    const canRender = captureDashboardAccess('products');
    if (!canRender()) return;
    try {
        await deleteDoc(doc(db, "products", id));
        if (!canRender()) return;
        setDashboardStatus('Produto removido.');
        loadDashboardProducts();
    } catch (error) {
        if (!canRender()) { return; }
        setDashboardStatus('Erro ao remover produto.', 'error');
    }
}

/** Remove o horário do Firestore; esta ação não apaga eventos já salvos no Google Calendar. */
async function deleteSchedule(id) {
    const canRender = captureDashboardAccess('schedules');
    if (!canRender()) return;
    try {
        await deleteDoc(doc(db, "schedules", id));
        if (!canRender()) return;
        setDashboardStatus('Horário removido.');
        loadDashboardSchedules();
    } catch (error) {
        if (!canRender()) { return; }
        setDashboardStatus('Erro ao remover horário.', 'error');
    }
}

/** Relê e confirma a vaga em uma transação; depois abre o calendário para o usuário clicar em Salvar. */
async function confirmSchedule(id, schedule) {
    const canRender = captureDashboardAccess('schedules');
    if (!canRender()) return;
    const clientName = window.prompt('Nome do cliente para confirmar este agendamento:');
    const normalizedClientName = clientName?.trim();

    if (!normalizedClientName || normalizedClientName.length > 120) {
        setDashboardStatus('Informe o nome do cliente com até 120 caracteres.', 'error');
        return;
    }

    if (!schedule || !isUpcomingSchedule(schedule)) {
        setDashboardStatus('Este horário está com data ou hora inválida.', 'error');
        return;
    }

    const calendarWindow = window.open('about:blank', '_blank');
    if (calendarWindow) calendarWindow.opener = null;
    try {
        let confirmedSchedule;
        await runTransaction(db, async transaction => {
            const ref = doc(db, 'schedules', id);
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists() || snapshot.data().is_available !== true
                || !isUpcomingSchedule(snapshot.data())) {
                throw new Error('Este horário já foi confirmado, removido ou expirou.');
            }
            confirmedSchedule = snapshot.data();
            transaction.update(ref, {
                calendar_id: GOOGLE_CALENDAR_ID,
                client_name: normalizedClientName,
                confirmed_at: new Date().toISOString(),
                is_available: false
            });
        });
        if (!canRender()) { calendarWindow?.close(); return; }
        let openedCalendar = false;
        try {
            if (calendarWindow && !calendarWindow.closed) {
                calendarWindow.location.replace(buildGoogleCalendarUrl(confirmedSchedule, normalizedClientName));
                openedCalendar = true;
            }
        } catch { /* A confirmação já foi salva; o link do painel permite recuperar o evento. */ }
        setDashboardStatus(openedCalendar
            ? 'Horário confirmado. Clique em Salvar no Google Calendar para concluir o evento.'
            : 'Horário confirmado. Use Adicionar à agenda para salvar o evento no Google Calendar.');
        loadDashboardSchedules();
    } catch (error) {
        if (!canRender()) { calendarWindow?.close(); return; }
        if (calendarWindow) calendarWindow.close();
        setDashboardStatus(error.message || 'Erro ao confirmar agendamento.', 'error');
    }
}

/** Lista produtos para quem pode gerenciá-los, escapando textos e identificadores nos botões. */
async function loadDashboardProducts() {
    const canRender = captureDashboardAccess('products');
    if (!canRender()) return;
    const list = document.getElementById('dashboardProductsList');
    if (!list) return;
    list.innerHTML = '<p class="loading-message">Carregando produtos...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        if (!canRender()) return;
        const products = querySnapshot.docs.map(d => documentData(d));
        if (!products.length) {
            list.innerHTML = '<p class="empty-message">Nenhum produto cadastrado.</p>';
            return;
        }
        list.innerHTML = products.map(product => `
            <article class="list-item">
                <img class="list-thumb" src="${escapeHtml(safeImageUrl(product.image_url))}" alt="${escapeHtml(product.name)}">
                <div class="list-item-content">
                    <strong>${escapeHtml(product.name)}</strong>
                    <a href="${escapeHtml(safeExternalUrl(product.affiliate_link))}" target="_blank" rel="noopener">Abrir link</a>
                </div>
                <button class="icon-button danger" type="button" data-delete-product="${escapeHtml(product.id)}" aria-label="Remover produto">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');

        bindImageErrors(list);
        list.querySelectorAll('[data-delete-product]').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.deleteProduct));
        });
    } catch (error) {
        if (!canRender()) return;
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os produtos.</p>';
    }
}
/** Lista disponibilidades e reservas privadas somente para quem tem acesso à Agenda. */
async function loadDashboardSchedules() {
    const canRender = captureDashboardAccess('schedules');
    if (!canRender()) return;
    const list = document.getElementById('dashboardSchedulesList');
    if (!list) return;
    list.innerHTML = '<p class="loading-message">Carregando horários...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        if (!canRender()) return;
        const schedules = sortSchedulesByStart(querySnapshot.docs.map(d => documentData(d)))
            .sort((first, second) => Number(isUpcomingSchedule(second)) - Number(isUpcomingSchedule(first)));
        if (!schedules.length) {
            list.innerHTML = '<p class="empty-message">Nenhum horário cadastrado.</p>';
            return;
        }
        list.innerHTML = schedules.map(schedule => {
            const isAvailable = schedule.is_available === true;
            const reservationStatus = isAvailable
                ? (isUpcomingSchedule(schedule) ? 'disponível' : 'encerrado ou inválido')
                : `reservado${schedule.client_name ? ` para ${escapeHtml(schedule.client_name)}` : ''}`;

            return `
            <article class="list-item ${isAvailable ? '' : 'muted'}">
                <div class="list-item-content">
                    <strong>${escapeHtml(formatDateBR(schedule.date))} às ${escapeHtml(formatTime(schedule.time))}</strong>
                    <span>${escapeHtml(schedule.barber_name || 'Maneirin Studio')} ${reservationStatus}</span>
                </div>
                <div class="list-actions">
                    ${isAvailable && isUpcomingSchedule(schedule) ? `
                        <button class="btn btn-primary btn-compact" type="button" data-confirm-schedule="${escapeHtml(schedule.id)}">
                            Confirmar
                        </button>
                    ` : ''}
                    ${!isAvailable && getScheduleStart(schedule) && schedule.client_name ? `
                        <a class="btn btn-secondary btn-compact" href="${escapeHtml(buildGoogleCalendarUrl(schedule, schedule.client_name))}" target="_blank" rel="noopener">Adicionar à agenda</a>
                    ` : ''}
                    <button class="icon-button danger" type="button" data-delete-schedule="${escapeHtml(schedule.id)}" aria-label="Remover horário">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </article>
            `;
        }).join('');

        list.querySelectorAll('[data-confirm-schedule]').forEach(btn => {
            const schedule = schedules.find(item => item.id === btn.dataset.confirmSchedule);
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;
                btn.disabled = true;
                try { await confirmSchedule(btn.dataset.confirmSchedule, schedule); }
                finally { btn.disabled = false; }
            });
        });

        list.querySelectorAll('[data-delete-schedule]').forEach(btn => {
            btn.addEventListener('click', () => deleteSchedule(btn.dataset.deleteSchedule));
        });
    } catch (error) {
        if (!canRender()) return;
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os horários.</p>';
    }
}

/** Lista as fotos gerenciáveis e indica arquivos indisponíveis sem executar HTML inline. */
async function loadDashboardGallery() {
    const canRender = captureDashboardAccess('gallery');
    if (!canRender()) return;
    const list = document.getElementById('dashboardGalleryList');
    if (!list) return;

    list.innerHTML = '<p class="loading-message">Carregando fotos...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, 'gallery'));
        if (!canRender()) return;
        const photos = querySnapshot.docs.map(d => documentData(d));
        if (!photos.length) {
            list.innerHTML = '<p class="empty-message">Nenhuma foto cadastrada.</p>';
            return;
        }
        list.innerHTML = photos.map(photo => `
            <article class="list-item">
                <img class="list-thumb" src="${escapeHtml(safeImageUrl(photo.image_url))}" alt="${escapeHtml(photo.alt || 'Foto da galeria')}">
                <div class="list-item-content"><strong>${escapeHtml(photo.alt || 'Foto do Studio')}</strong></div>
                <button class="icon-button danger" type="button" data-delete-gallery="${escapeHtml(photo.id)}" aria-label="Remover foto">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');
        bindImageErrors(list, 'Imagem indisponível. Remova esta entrada e envie o arquivo ou o link direto da foto.');
        list.querySelectorAll('[data-delete-gallery]').forEach(button => {
            button.addEventListener('click', () => deleteGalleryPhoto(button.dataset.deleteGallery));
        });
    } catch (error) {
        if (!canRender()) return;
        list.innerHTML = '<p class="empty-message">Não foi possível carregar as fotos.</p>';
    }
}

/** Carrega a equipe para o master e conecta cada formulário ao salvamento transacional. */
async function loadAdminUsers() {
    const canRender = captureDashboardAccess('admin');
    if (!canRender()) return;
    const list = document.getElementById('adminUsersList');
    list.innerHTML = '<p class="loading-message">Carregando equipe...</p>';
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        if (!canRender()) return;
        const users = snapshot.docs.map(documentData);
        list.innerHTML = users.length ? users.map(memberCard).join('') : '<p class="empty-message">Nenhuma conta encontrada.</p>';
        list.querySelectorAll('[data-member]').forEach(card => {
            const profile = users.find(user => user.id === card.dataset.member);
            const submit = async revoke => {
                if (!canRender()) return;
                const controls = [...card.querySelectorAll('button, input')];
                if (controls.some(control => control.disabled)) return;
                const permissions = Object.fromEntries(FEATURES.map(({ key }) => [key,
                    revoke ? getAccess(profile).permissions[key] : card.querySelector('[data-permission="' + key + '"]').checked
                ]));
                controls.forEach(control => { control.disabled = true; });
                const feedback = card.querySelector('.member-feedback');
                feedback.textContent = 'Salvando...';
                try {
                    await saveBarberAccess(profile, revoke ? 'pending' : 'barber', permissions);
                    if (!canRender()) return;
                    setDashboardStatus(revoke ? 'Acesso revogado.' : 'Permissões atualizadas.');
                    await loadAdminUsers();
                } catch (error) {
                    if (!canRender()) return;
                    feedback.textContent = error.message || 'Não foi possível alterar o acesso.';
                    controls.forEach(control => { control.disabled = false; });
                }
            };
            card.querySelector('[data-save-access]')?.addEventListener('click', () => submit(false));
            card.querySelector('[data-revoke-access]')?.addEventListener('click', () => submit(true));
        });
    } catch {
        if (canRender()) list.innerHTML = '<p class="empty-message">Não foi possível carregar a equipe. Use Atualizar lista para tentar novamente.</p>';
    }
}

/** Controla seleção, teclado e visibilidade das abas conforme as permissões atuais. */
function setupDashboardTabs() {
    const tabs = [...document.querySelectorAll('[data-dashboard-tab]')];
    if (!tabs.length) return () => {};
    let activePanel = 'agendaPanel';

    const select = (panelId, focus = false) => {
        const selected = tabs.find(tab => tab.dataset.dashboardTab === panelId && !tab.hidden);
        if (!selected) return;
        activePanel = panelId;
        tabs.forEach(tab => {
            const active = tab === selected;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            document.getElementById(tab.dataset.dashboardTab).hidden = !active;
        });
        if (focus) selected.focus();
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => select(tab.dataset.dashboardTab));
        tab.addEventListener('keydown', event => {
            const visible = tabs.filter(item => !item.hidden);
            const index = visible.indexOf(tab);
            let next;
            if (event.key === 'ArrowRight') next = visible[(index + 1) % visible.length];
            if (event.key === 'ArrowLeft') next = visible[(index - 1 + visible.length) % visible.length];
            if (event.key === 'Home') next = visible[0];
            if (event.key === 'End') next = visible[visible.length - 1];
            if (next) {
                event.preventDefault();
                select(next.dataset.dashboardTab, true);
            }
        });
    });

    return profile => {
        const access = getAccess(profile);
        const featuresByPanel = { agendaPanel: 'schedules', galleryPanel: 'gallery', productsPanel: 'products' };
        tabs.forEach(tab => {
            const panel = tab.dataset.dashboardTab;
            tab.hidden = panel === 'adminSection' ? access.role !== 'admin' : !access.permissions[featuresByPanel[panel]];
            if (tab.hidden) {
                tab.setAttribute('aria-selected', 'false');
                tab.tabIndex = -1;
                document.getElementById(panel).hidden = true;
            }
        });
        const visible = tabs.filter(tab => !tab.hidden);
        if (!visible.some(tab => tab.dataset.dashboardTab === activePanel)) activePanel = visible[0]?.dataset.dashboardTab;
        if (activePanel) select(activePanel);
        document.getElementById('noAccessMessage').hidden = visible.length > 0;
    };
}

// Conecta os formulários somente depois que seus elementos existem no DOM.
document.addEventListener('DOMContentLoaded', () => {
    initCommonUI();
    const authForm = document.getElementById('authForm');
    const authToggleBtn = document.getElementById('authToggleBtn');
    const loginOverlay = document.getElementById('loginOverlay');
    const pendingOverlay = document.getElementById('pendingOverlay');
    const mainDashboard = document.getElementById('mainDashboard');
    const logoutBtn = document.getElementById('logoutBtn');
    const updateDashboardTabs = setupDashboardTabs();
    document.getElementById('refreshUsersBtn').addEventListener('click', loadAdminUsers);

    const galleryForm = document.getElementById('galleryForm');
    const handleForm = handler => async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try { await handler(event); } finally { button.disabled = false; }
    };
    if (galleryForm) galleryForm.addEventListener('submit', handleForm(submitGalleryPhoto));

    const productForm = document.getElementById('productForm');
    const scheduleForm = document.getElementById('scheduleForm');

    if (productForm) productForm.addEventListener('submit', handleForm(submitProduct));
    if (scheduleForm) scheduleForm.addEventListener('submit', handleForm(submitSchedule));

    if (authToggleBtn) {
        authToggleBtn.addEventListener('click', () => {
            if (document.getElementById('authSubmitBtn').disabled) return;
            const mode = document.getElementById('authMode').value;
            const authTitle = document.getElementById('authTitle');
            const authSubmitBtn = document.getElementById('authSubmitBtn');
            const authToggleText = document.getElementById('authToggleText');
            const nameGroup = document.getElementById('nameGroup');

            if (mode === 'login') {
                document.getElementById('authMode').value = 'register';
                authTitle.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
                nameGroup.style.display = 'block';
                document.getElementById('authName').required = true;
                document.getElementById('authPassword').autocomplete = 'new-password';
                authSubmitBtn.textContent = 'Cadastrar';
                authToggleText.textContent = 'Já tem uma conta?';
                authToggleBtn.textContent = 'Entrar';
            } else {
                document.getElementById('authMode').value = 'login';
                authTitle.innerHTML = '<i class="fas fa-lock"></i> Acesso Restrito';
                nameGroup.style.display = 'none';
                document.getElementById('authName').required = false;
                document.getElementById('authPassword').autocomplete = 'current-password';
                authSubmitBtn.textContent = 'Entrar';
                authToggleText.textContent = 'Não tem uma conta?';
                authToggleBtn.textContent = 'Cadastre-se';
            }
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = document.getElementById('authMode').value;
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const errorDiv = document.getElementById('authError');
            const submitBtn = document.getElementById('authSubmitBtn');
            
            errorDiv.style.display = 'none';
            if (submitBtn.disabled) return;
            submitBtn.disabled = true;
            authToggleBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            
            try {
                if (mode === 'login') {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    const name = document.getElementById('authName').value || email.split('@')[0];
                    
                    await ensureUserProfile(user, name);
                }
            } catch (error) {
                console.error(error);
                if (mode === 'login') {
                    errorDiv.textContent = 'Erro ao fazer login. Credenciais incorretas.';
                } else {
                    errorDiv.textContent = 'Erro ao criar conta. A senha deve ter 6+ caracteres ou o email já existe.';
                }
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = mode === 'login' ? 'Entrar' : 'Cadastrar';
            }
            finally {
                authToggleBtn.disabled = false;
                document.getElementById('authPassword').value = '';
                submitBtn.disabled = false;
                submitBtn.textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
            } catch {
                window.alert('Não foi possível sair. Verifique sua conexão e tente novamente.');
            }
        });
    }

    // Cada troca de conta invalida o observador anterior e todas as respostas pendentes.
    let unsubscribeProfile = () => {};
    let authGeneration = 0;
    const showAccessMessage = (title, message, retry = false) => {
        document.getElementById('pendingTitle').textContent = title;
        document.getElementById('pendingMessage').textContent = message;
        document.getElementById('retryAccessBtn').hidden = !retry;
    };
    document.getElementById('retryAccessBtn').addEventListener('click', () => window.location.reload());

    onAuthStateChanged(auth, async user => {
        const generation = ++authGeneration;
        const isCurrentSession = () => generation === authGeneration && auth.currentUser?.uid === user?.uid;
        unsubscribeProfile();
        unsubscribeProfile = () => {};
        mainDashboard.style.display = 'none';
        resetDashboardData();
        updateDashboardTabs(null);
        for (const form of [productForm, scheduleForm, galleryForm]) form?.reset();
        document.getElementById('authPassword').value = '';
        loginOverlay.style.display = user ? 'none' : 'flex';
        pendingOverlay.style.display = user ? 'flex' : 'none';
        logoutBtn.style.display = user ? 'block' : 'none';
        if (!user) return;
        showAccessMessage('Verificando acesso', 'Aguarde enquanto carregamos as permissões da sua conta.');
        const failAccess = error => {
            if (!isCurrentSession()) return;
            console.error('Erro ao verificar acesso:', error);
            resetDashboardData();
            updateDashboardTabs(null);
            mainDashboard.style.display = 'none';
            pendingOverlay.style.display = 'flex';
            showAccessMessage('Não foi possível verificar o acesso', 'Verifique sua conexão e tente novamente.', true);
        };
        try {
            await ensureUserProfile(user, document.getElementById('authName').value.trim());
            if (!isCurrentSession()) return;
            unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
                if (!isCurrentSession()) return;
                const profile = snapshot.data() || {};
                const { role } = getAccess(profile);
                const allowed = ['admin', 'barber'].includes(role);
                const changed = accessFingerprint({ role: dashboardRole, permissions: dashboardPermissions }) !== accessFingerprint(getAccess(profile));
                if (changed) {
                    resetDashboardData(profile);
                    for (const form of [productForm, scheduleForm, galleryForm]) form?.reset();
                }
                pendingOverlay.style.display = allowed ? 'none' : 'flex';
                mainDashboard.style.display = allowed ? 'block' : 'none';
                updateDashboardTabs(profile);
                if (!allowed) {
                    for (const form of [productForm, scheduleForm, galleryForm]) form?.reset();
                    showAccessMessage('Aguardando aprovação', 'Um administrador precisa liberar o acesso da sua conta ao painel.');
                    return;
                }
                if (!changed) return;
                if (role === 'admin') loadAdminUsers();
                loadDatabaseStatus();
                loadDashboardProducts();
                loadDashboardSchedules();
                loadDashboardGallery();
            }, failAccess);
        } catch (error) {
            failAccess(error);
        }
    });
});
