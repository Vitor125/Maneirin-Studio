import { collection, addDoc, deleteDoc, doc, getDocs, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { db, auth, escapeHtml, formatDateBR, formatTime, safeExternalUrl } from './script.js';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

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
    setDatabaseStatus('Banco conectado: Firebase Firestore', 'success');
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function getProductImage() {
    const fileInput = document.getElementById('prodImageFile');
    const urlInput = document.getElementById('prodImageUrl');
    const file = fileInput.files[0];

    if (file) {
        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error('Use uma imagem de até 2 MB.');
        }
        return readFileAsDataUrl(file);
    }

    return urlInput.value.trim();
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
        const schedules = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!schedules.length) {
            list.innerHTML = '<p class="empty-message">Nenhum horário cadastrado.</p>';
            return;
        }
        list.innerHTML = schedules.map(schedule => `
            <article class="list-item ${schedule.is_available ? '' : 'muted'}">
                <div class="list-item-content">
                    <strong>${formatDateBR(schedule.date)} às ${formatTime(schedule.time)}</strong>
                    <span>${escapeHtml(schedule.barber_name)} ${schedule.is_available ? 'disponível' : 'reservado'}</span>
                </div>
                <button class="icon-button danger" type="button" data-delete-schedule="${schedule.id}" aria-label="Remover horário">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');

        list.querySelectorAll('[data-delete-schedule]').forEach(btn => {
            btn.addEventListener('click', () => deleteSchedule(btn.dataset.deleteSchedule));
        });
    } catch (error) {
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os horários.</p>';
    }
}

async function loadAdminUsers() {
    const list = document.getElementById('adminUsersList');
    if (!list) return;
    
    list.innerHTML = '<p class="loading-message">Carregando barbeiros...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
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
                    <button class="btn btn-primary" type="button" data-approve="${u.id}" style="padding: 6px 12px; font-size: 0.8rem;">Aprovar</button>
                ` : u.role === 'barber' ? `
                    <button class="btn btn-secondary" type="button" data-revoke="${u.id}" style="padding: 6px 12px; font-size: 0.8rem; background-color: var(--danger); border-color: var(--danger);">Revogar</button>
                ` : `
                    <span style="font-size: 0.8rem; color: var(--text-muted); padding-right: 10px;">Admin</span>
                `}
            </article>
        `).join('');
        
        list.querySelectorAll('[data-approve]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = btn.dataset.approve;
                await updateDoc(doc(db, 'users', uid), { role: 'barber' });
                loadAdminUsers();
            });
        });
        
        list.querySelectorAll('[data-revoke]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = btn.dataset.revoke;
                await updateDoc(doc(db, 'users', uid), { role: 'pending' });
                loadAdminUsers();
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

    const productForm = document.getElementById('productForm');
    const scheduleForm = document.getElementById('scheduleForm');

    if (productForm) productForm.addEventListener('submit', submitProduct);
    if (scheduleForm) scheduleForm.addEventListener('submit', submitSchedule);

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
                authSubmitBtn.textContent = 'Cadastrar';
                authToggleText.textContent = 'Já tem uma conta?';
                authToggleBtn.textContent = 'Entrar';
            } else {
                document.getElementById('authMode').value = 'login';
                authTitle.innerHTML = '<i class="fas fa-lock"></i> Acesso Restrito';
                nameGroup.style.display = 'none';
                document.getElementById('authName').required = false;
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
            errorDiv.style.display = 'none';
            
            try {
                if (mode === 'login') {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    const name = document.getElementById('authName').value || email.split('@')[0];
                    
                    await setDoc(doc(db, 'users', user.uid), {
                        email: user.email,
                        name: name,
                        role: 'pending',
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error(error);
                if (mode === 'login') {
                    errorDiv.textContent = 'Erro ao fazer login. Credenciais incorretas.';
                } else {
                    errorDiv.textContent = 'Erro ao criar conta. A senha deve ter 6+ caracteres ou o email já existe.';
                }
                errorDiv.style.display = 'block';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            loginOverlay.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                let role = 'pending';
                if (userDoc.exists()) {
                    role = userDoc.data().role;
                } else {
                    // Fail-safe se doc não existir, força criação.
                    await setDoc(userDocRef, {
                        email: user.email,
                        name: user.email.split('@')[0],
                        role: 'pending',
                        createdAt: new Date().toISOString()
                    });
                }

                if (role === 'pending') {
                    pendingOverlay.style.display = 'flex';
                    mainDashboard.style.display = 'none';
                } else {
                    pendingOverlay.style.display = 'none';
                    mainDashboard.style.display = 'block';
                    
                    if (role === 'admin') {
                        adminSection.style.display = 'block';
                        loadAdminUsers();
                    } else {
                        adminSection.style.display = 'none';
                    }
                    
                    loadDatabaseStatus();
                    loadDashboardProducts();
                    loadDashboardSchedules();
                }
            } catch (err) {
                console.error("Erro ao verificar role:", err);
                // Pode acontecer se a regra de leitura falhar, então jogamos pra pending
                pendingOverlay.style.display = 'flex';
                mainDashboard.style.display = 'none';
            }
        } else {
            loginOverlay.style.display = 'flex';
            pendingOverlay.style.display = 'none';
            mainDashboard.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            
            if (document.getElementById('dashboardProductsList')) document.getElementById('dashboardProductsList').innerHTML = '';
            if (document.getElementById('dashboardSchedulesList')) document.getElementById('dashboardSchedulesList').innerHTML = '';
        }
    });
});
