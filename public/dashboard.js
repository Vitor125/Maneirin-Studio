import { collection, addDoc, deleteDoc, doc, getDocs, runTransaction, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { db, auth, escapeHtml, formatDateBR, formatTime, getScheduleStart, isUpcomingSchedule, safeExternalUrl, sortSchedulesByStart } from './script.js';

const MAX_IMAGE_SIZE = 600 * 1024;
const APPOINTMENT_DURATION_MINUTES = 60;
const STUDIO_ADDRESS = 'R. Nilópolis, 352 - Éden, São João de Meriti - RJ, 25535-050';
const GOOGLE_CALENDAR_ID = 'd2970e3f2205392d94a72d232a6e03bccd39237d8291c4f068d6fa6348e42fc7@group.calendar.google.com';
const GOOGLE_CALENDAR_TIMEZONE = 'America/Sao_Paulo';

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

function setDatabaseStatus(message, type = 'success') {
    const status = document.getElementById('databaseStatus');
    if (!status) return;

    status.textContent = message;
    status.className = `database-status ${type}`;
}

async function loadDatabaseStatus() {
    try {
        await getDoc(doc(db, 'users', auth.currentUser.uid));
        setDatabaseStatus('Painel conectado.', 'success');
    } catch {
        setDatabaseStatus('Não foi possível verificar a conexão.', 'error');
    }
}

async function ensureUserProfile(user, name) {
    const ref = doc(db, 'users', user.uid);
    await runTransaction(db, async transaction => {
        const profile = await transaction.get(ref);
        if (!profile.exists()) transaction.set(ref, {
            email: user.email,
            name: name || user.email.split('@')[0],
            role: 'pending',
            createdAt: new Date().toISOString()
        });
    });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function validateImageLink(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const timeout = window.setTimeout(() => {
            image.onload = image.onerror = null;
            reject(new Error('A imagem demorou para carregar. Envie o arquivo ou tente outro link.'));
        }, 15000);
        image.onload = () => { window.clearTimeout(timeout); resolve(url); };
        image.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error('Este link não abre uma imagem. Envie o arquivo ou use o endereço direto da foto.'));
        };
        image.src = url;
    });
}

function toGoogleCalendarDate(date) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function buildGoogleCalendarUrl(schedule, clientName) {
    const start = getScheduleStart(schedule);
    const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60 * 1000);
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        src: GOOGLE_CALENDAR_ID,
        text: `Maneirin Studio - ${clientName}`,
        dates: `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`,
        details: `Cliente: ${clientName}\nBarbeiro: ${schedule.barber_name || 'Maneirin Studio'}\nHorário confirmado pela dashboard do Maneirin Studio.`,
        location: STUDIO_ADDRESS,
        ctz: GOOGLE_CALENDAR_TIMEZONE
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function getProductImage() {
    const fileInput = document.getElementById('prodImageFile');
    const urlInput = document.getElementById('prodImageUrl');
    const file = fileInput.files[0];

    if (file) {
        if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error('Use uma imagem de até 600 KB ou um link de imagem.');
        }
        return readFileAsDataUrl(file);
    }

    const url = urlInput.value.trim();
    if (url && safeExternalUrl(url) === '#') throw new Error('Informe um link HTTP/HTTPS para a imagem.');
    return url ? validateImageLink(url) : '';
}

async function getGalleryImage() {
    const fileInput = document.getElementById('galleryImageFile');
    const urlInput = document.getElementById('galleryImageUrl');
    const file = fileInput.files[0];

    if (file) {
        if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem.');
        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error('Use uma imagem de até 600 KB ou um link de imagem.');
        }
        return readFileAsDataUrl(file);
    }

    const url = urlInput.value.trim();
    if (!url || safeExternalUrl(url) === '#') {
        throw new Error('Envie uma foto ou informe um link HTTP/HTTPS válido.');
    }
    return validateImageLink(url);
}

async function submitGalleryPhoto(event) {
    event.preventDefault();
    try {
        const imageUrl = await getGalleryImage();
        await addDoc(collection(db, 'gallery'), {
            image_url: imageUrl,
            alt: document.getElementById('galleryAlt').value.trim(),
            created_at: new Date().toISOString()
        });
        event.target.reset();
        setDashboardStatus('Foto adicionada à galeria.');
        loadDashboardGallery();
    } catch (error) {
        setDashboardStatus(error.message || 'Erro ao adicionar foto.', 'error');
    }
}

async function deleteGalleryPhoto(id) {
    try {
        await deleteDoc(doc(db, 'gallery', id));
        setDashboardStatus('Foto removida da galeria.');
        loadDashboardGallery();
    } catch (error) {
        setDashboardStatus('Erro ao remover foto.', 'error');
    }
}

async function submitProduct(event) {
    event.preventDefault();
    try {
        const imageUrl = await getProductImage();
        if (!imageUrl) {
            setDashboardStatus('Adicione uma foto ou um link de imagem para o produto.', 'error');
            return;
        }

        const product = {
            name: document.getElementById('prodName').value.trim(),
            description: document.getElementById('prodDesc').value.trim(),
            image_url: imageUrl,
            affiliate_link: document.getElementById('prodLink').value.trim()
        };
        if (!product.name || safeExternalUrl(product.affiliate_link) === '#') {
            throw new Error('Informe o nome e um link HTTP/HTTPS para o produto.');
        }
        if (new TextEncoder().encode(JSON.stringify(product)).length > 950000) {
            throw new Error('Produto muito grande. Reduza a imagem ou a descrição.');
        }

        await addDoc(collection(db, "products"), product);
        event.target.reset();
        setDashboardStatus('Produto cadastrado com sucesso.');
        loadDashboardProducts();
    } catch (error) {
        setDashboardStatus(error.message || 'Erro ao salvar produto.', 'error');
    }
}

async function submitSchedule(event) {
    event.preventDefault();
    const schedule = {
        barber_name: document.getElementById('schedBarber').value.trim(),
        date: document.getElementById('schedDate').value,
        time: `${document.getElementById('schedTime').value}:00`,
        is_available: true
    };

    try {
        if (!schedule.barber_name || !isUpcomingSchedule(schedule)) {
            setDashboardStatus('Informe o barbeiro e um horário válido no futuro.', 'error');
            return;
        }
        await addDoc(collection(db, "schedules"), schedule);
        document.getElementById('schedDate').value = '';
        document.getElementById('schedTime').value = '';
        setDashboardStatus('Horário adicionado com sucesso.');
        loadDashboardSchedules();
    } catch (error) {
        setDashboardStatus('Erro ao salvar horário.', 'error');
    }
}

async function deleteProduct(id) {
    try {
        await deleteDoc(doc(db, "products", id));
        setDashboardStatus('Produto removido.');
        loadDashboardProducts();
    } catch (error) {
        setDashboardStatus('Erro ao remover produto.', 'error');
    }
}

async function deleteSchedule(id) {
    try {
        await deleteDoc(doc(db, "schedules", id));
        setDashboardStatus('Horário removido.');
        loadDashboardSchedules();
    } catch (error) {
        setDashboardStatus('Erro ao remover horário.', 'error');
    }
}

async function confirmSchedule(id, schedule) {
    const clientName = window.prompt('Nome do cliente para confirmar este agendamento:');
    const normalizedClientName = clientName?.trim();

    if (!normalizedClientName) {
        setDashboardStatus('Informe o nome do cliente para confirmar o agendamento.', 'error');
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
        if (calendarWindow) calendarWindow.location.replace(buildGoogleCalendarUrl(confirmedSchedule, normalizedClientName));
        setDashboardStatus(calendarWindow
            ? 'Horário confirmado. Clique em Salvar no Google Calendar para concluir o evento.'
            : 'Horário confirmado. Use Adicionar à agenda para salvar o evento no Google Calendar.');
        loadDashboardSchedules();
    } catch (error) {
        if (calendarWindow) calendarWindow.close();
        setDashboardStatus(error.message || 'Erro ao confirmar agendamento.', 'error');
    }
}

async function loadDashboardProducts() {
    const list = document.getElementById('dashboardProductsList');
    if (!list) return;
    list.innerHTML = '<p class="loading-message">Carregando produtos...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const products = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!products.length) {
            list.innerHTML = '<p class="empty-message">Nenhum produto cadastrado.</p>';
            return;
        }
        list.innerHTML = products.map(product => `
            <article class="list-item">
                <img class="list-thumb" src="${escapeHtml(product.image_url || '')}" alt="${escapeHtml(product.name)}" onerror="this.style.display='none';">
                <div class="list-item-content">
                    <strong>${escapeHtml(product.name)}</strong>
                    <a href="${escapeHtml(safeExternalUrl(product.affiliate_link))}" target="_blank" rel="noopener">Abrir link</a>
                </div>
                <button class="icon-button danger" type="button" data-delete-product="${product.id}" aria-label="Remover produto">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');

        list.querySelectorAll('[data-delete-product]').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.deleteProduct));
        });
    } catch (error) {
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os produtos.</p>';
    }
}
async function loadDashboardSchedules() {
    const list = document.getElementById('dashboardSchedulesList');
    if (!list) return;
    list.innerHTML = '<p class="loading-message">Carregando horários...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        const schedules = sortSchedulesByStart(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })))
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
                        <button class="btn btn-primary btn-compact" type="button" data-confirm-schedule="${schedule.id}">
                            Confirmar
                        </button>
                    ` : ''}
                    ${!isAvailable && getScheduleStart(schedule) && schedule.client_name ? `
                        <a class="btn btn-secondary btn-compact" href="${escapeHtml(buildGoogleCalendarUrl(schedule, schedule.client_name))}" target="_blank" rel="noopener">Adicionar à agenda</a>
                    ` : ''}
                    <button class="icon-button danger" type="button" data-delete-schedule="${schedule.id}" aria-label="Remover horário">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </article>
            `;
        }).join('');

        list.querySelectorAll('[data-confirm-schedule]').forEach(btn => {
            const schedule = schedules.find(item => item.id === btn.dataset.confirmSchedule);
            btn.addEventListener('click', () => confirmSchedule(btn.dataset.confirmSchedule, schedule));
        });

        list.querySelectorAll('[data-delete-schedule]').forEach(btn => {
            btn.addEventListener('click', () => deleteSchedule(btn.dataset.deleteSchedule));
        });
    } catch (error) {
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os horários.</p>';
    }
}

async function loadDashboardGallery() {
    const list = document.getElementById('dashboardGalleryList');
    if (!list) return;

    list.innerHTML = '<p class="loading-message">Carregando fotos...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, 'gallery'));
        const photos = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!photos.length) {
            list.innerHTML = '<p class="empty-message">Nenhuma foto cadastrada.</p>';
            return;
        }
        list.innerHTML = photos.map(photo => `
            <article class="list-item">
                <img class="list-thumb" src="${escapeHtml(photo.image_url)}" alt="${escapeHtml(photo.alt || 'Foto da galeria')}" onerror="this.hidden=true; this.nextElementSibling.textContent='Imagem indisponível. Remova esta entrada e envie o arquivo ou o link direto da foto.';">
                <div class="list-item-content"><strong>${escapeHtml(photo.alt || 'Foto do Studio')}</strong></div>
                <button class="icon-button danger" type="button" data-delete-gallery="${photo.id}" aria-label="Remover foto">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');
        list.querySelectorAll('[data-delete-gallery]').forEach(button => {
            button.addEventListener('click', () => deleteGalleryPhoto(button.dataset.deleteGallery));
        });
    } catch (error) {
        list.innerHTML = '<p class="empty-message">Não foi possível carregar as fotos.</p>';
    }
}

async function loadAdminUsers() {
    const list = document.getElementById('adminUsersList');
    if (!list) return;
    
    list.innerHTML = '<p class="loading-message">Carregando barbeiros...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users = querySnapshot.docs.map(d => ({ id: d.id, ...d.data(), role: String(d.data().role || 'pending').toLowerCase() }));
        
        if (!users.length) {
            list.innerHTML = '<p class="empty-message">Nenhum usuário encontrado.</p>';
            return;
        }

        list.innerHTML = users.map(u => `
            <article class="list-item ${u.role === 'pending' ? 'muted' : ''}">
                <div class="list-item-content">
                    <strong>${escapeHtml(u.name || 'Sem nome')}</strong>
                    <span>${escapeHtml(u.email)} - Status: <b>${escapeHtml(u.role)}</b></span>
                </div>
                ${u.role === 'pending' ? `
                    <button class="btn btn-primary btn-compact" type="button" data-approve="${u.id}">Aprovar</button>
                ` : u.role === 'barber' ? `
                    <button class="btn btn-danger-outline btn-compact" type="button" data-revoke="${u.id}">Revogar</button>
                ` : `
                    <span class="admin-role-label">Admin</span>
                `}
            </article>
        `).join('');
        
        list.querySelectorAll('[data-approve]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = btn.dataset.approve;
                btn.disabled = true;
                try {
                    await updateDoc(doc(db, 'users', uid), { role: 'barber' });
                    await loadAdminUsers();
                } catch {
                    setDashboardStatus('Não foi possível aprovar o acesso.', 'error');
                    btn.disabled = false;
                }
            });
        });
        
        list.querySelectorAll('[data-revoke]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = btn.dataset.revoke;
                btn.disabled = true;
                try {
                    await updateDoc(doc(db, 'users', uid), { role: 'pending' });
                    await loadAdminUsers();
                } catch {
                    setDashboardStatus('Não foi possível revogar o acesso.', 'error');
                    btn.disabled = false;
                }
            });
        });
        
    } catch (error) {
        list.innerHTML = '<p class="empty-message">Erro ao carregar usuários. Verifique as permissões.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authForm');
    const authToggleBtn = document.getElementById('authToggleBtn');
    const loginOverlay = document.getElementById('loginOverlay');
    const pendingOverlay = document.getElementById('pendingOverlay');
    const mainDashboard = document.getElementById('mainDashboard');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminSection = document.getElementById('adminSection');

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
            submitBtn.disabled = true;
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
                submitBtn.disabled = false;
                submitBtn.textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }

    let unsubscribeProfile = () => {};
    onAuthStateChanged(auth, async user => {
        unsubscribeProfile();
        mainDashboard.style.display = 'none';
        adminSection.style.display = 'none';
        for (const id of ['dashboardProductsList', 'dashboardSchedulesList', 'dashboardGalleryList', 'adminUsersList']) {
            document.getElementById(id).innerHTML = '';
        }
        loginOverlay.style.display = user ? 'none' : 'flex';
        pendingOverlay.style.display = user ? 'flex' : 'none';
        logoutBtn.style.display = user ? 'block' : 'none';
        if (!user) return;
        try {
            await ensureUserProfile(user, document.getElementById('authName').value.trim());
            if (auth.currentUser?.uid !== user.uid) return;
            unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
                const role = String(snapshot.data()?.role || 'pending').toLowerCase();
                const allowed = ['admin', 'barber'].includes(role);
                pendingOverlay.style.display = allowed ? 'none' : 'flex';
                mainDashboard.style.display = allowed ? 'block' : 'none';
                adminSection.style.display = role === 'admin' ? 'block' : 'none';
                if (!allowed) return;
                if (role === 'admin') loadAdminUsers();
                loadDatabaseStatus();
                loadDashboardProducts();
                loadDashboardSchedules();
                loadDashboardGallery();
            }, error => {
                console.error('Erro ao verificar acesso:', error);
                mainDashboard.style.display = 'none';
                pendingOverlay.style.display = 'flex';
            });
        } catch (error) {
            console.error('Erro ao verificar acesso:', error);
            pendingOverlay.style.display = 'flex';
        }
    });
});
