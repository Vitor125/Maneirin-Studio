// dashboard.js — Lógica do painel do barbeiro (login + gestão)
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

// ─── Helpers de UI ────────────────────────────────────────────────────────────
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

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
}

function setLoginLoading(loading) {
    const btn = document.getElementById('loginBtn');
    const text = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');
    if (!btn) return;
    btn.disabled = loading;
    if (text) text.textContent = loading ? 'Entrando...' : 'Entrar';
    if (spinner) spinner.hidden = !loading;
}

// ─── Auth ──────────────────────────────────────────────────────────────────
function waitForFirebase(callback) {
    if (window.__firebase) { callback(window.__firebase); return; }
    window.addEventListener('firebase-ready', () => callback(window.__firebase), { once: true });
    setTimeout(() => { if (window.__firebase) callback(window.__firebase); }, 2000);
}

waitForFirebase(({ auth, signInWithEmailAndPassword, signOut, onAuthStateChanged }) => {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');

    // Observa estado do login
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (loginScreen) loginScreen.hidden = true;
            if (dashboardScreen) dashboardScreen.hidden = false;
            loadDashboardProducts();
            loadDashboardSchedules();
        } else {
            if (loginScreen) loginScreen.hidden = false;
            if (dashboardScreen) dashboardScreen.hidden = true;
        }
    });

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoginLoading(true);
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (err) {
                const msgs = {
                    'auth/invalid-credential': 'E-mail ou senha incorretos.',
                    'auth/user-not-found': 'Usuário não encontrado.',
                    'auth/wrong-password': 'Senha incorreta.',
                    'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
                };
                showLoginError(msgs[err.code] || 'Erro ao fazer login. Tente novamente.');
            } finally {
                setLoginLoading(false);
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => signOut(auth));
    }
});

// ─── Imagem do produto ────────────────────────────────────────────────────────
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
    const file = fileInput?.files[0];
    if (file) {
        if (file.size > MAX_IMAGE_SIZE) throw new Error('Use uma imagem de até 2 MB.');
        return readFileAsDataUrl(file);
    }
    return urlInput?.value.trim() || '';
}

// ─── Produtos ────────────────────────────────────────────────────────────────
async function submitProduct(event) {
    event.preventDefault();
    try {
        const imageUrl = await getProductImage();
        if (!imageUrl) {
            setDashboardStatus('Adicione uma foto ou link de imagem.', 'error');
            return;
        }
        const product = {
            name: document.getElementById('prodName').value.trim(),
            description: document.getElementById('prodDesc').value.trim(),
            image_url: imageUrl,
            affiliate_link: document.getElementById('prodLink').value.trim(),
        };
        const response = await window.__firebase.authFetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product),
        });
        if (!response.ok) throw new Error('Erro ao salvar produto');
        event.target.reset();
        setDashboardStatus('Produto cadastrado com sucesso.');
        loadDashboardProducts();
    } catch (error) {
        console.error(error);
        setDashboardStatus(error.message || 'Erro ao salvar produto.', 'error');
    }
}

async function deleteProduct(id) {
    try {
        const response = await window.__firebase.authFetch(`/api/products/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error();
        setDashboardStatus('Produto removido.');
        loadDashboardProducts();
    } catch {
        setDashboardStatus('Erro ao remover produto.', 'error');
    }
}

async function loadDashboardProducts() {
    const list = document.getElementById('dashboardProductsList');
    if (!list) return;
    list.innerHTML = '<p class="loading-message">Carregando produtos...</p>';
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        if (!products.length) {
            list.innerHTML = '<p class="empty-message">Nenhum produto cadastrado.</p>';
            return;
        }
        list.innerHTML = products.map(p => `
            <article class="list-item">
                <img class="list-thumb" src="${escapeHtml(p.image_url || '')}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none';">
                <div class="list-item-content">
                    <strong>${escapeHtml(p.name)}</strong>
                    <a href="${escapeHtml(safeExternalUrl(p.affiliate_link))}" target="_blank" rel="noopener">Abrir link</a>
                </div>
                <button class="icon-button danger" type="button" data-delete-product="${p.id}" aria-label="Remover produto">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');
        list.querySelectorAll('[data-delete-product]').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.deleteProduct));
        });
    } catch {
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os produtos.</p>';
    }
}

// ─── Horários ────────────────────────────────────────────────────────────────
async function submitSchedule(event) {
    event.preventDefault();
    const schedule = {
        barber_name: document.getElementById('schedBarber').value.trim(),
        date: document.getElementById('schedDate').value,
        time: `${document.getElementById('schedTime').value}:00`,
    };
    try {
        const response = await window.__firebase.authFetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schedule),
        });
        if (!response.ok) throw new Error();
        document.getElementById('schedDate').value = '';
        document.getElementById('schedTime').value = '';
        setDashboardStatus('Horário adicionado com sucesso.');
        loadDashboardSchedules();
    } catch {
        setDashboardStatus('Erro ao salvar horário.', 'error');
    }
}

async function deleteSchedule(id) {
    try {
        const response = await window.__firebase.authFetch(`/api/schedules/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error();
        setDashboardStatus('Horário removido.');
        loadDashboardSchedules();
    } catch {
        setDashboardStatus('Erro ao remover horário.', 'error');
    }
}

async function loadDashboardSchedules() {
    const list = document.getElementById('dashboardSchedulesList');
    if (!list) return;
    list.innerHTML = '<p class="loading-message">Carregando horários...</p>';
    try {
        const response = await fetch('/api/schedules?include_unavailable=true');
        const schedules = await response.json();
        if (!schedules.length) {
            list.innerHTML = '<p class="empty-message">Nenhum horário cadastrado.</p>';
            return;
        }
        list.innerHTML = schedules.map(s => `
            <article class="list-item ${s.is_available ? '' : 'muted'}">
                <div class="list-item-content">
                    <strong>${formatDateBR(s.date)} às ${formatTime(s.time)}</strong>
                    <span>${escapeHtml(s.barber_name)} — ${s.is_available ? '<em style="color:#60a5fa">Disponível</em>' : `<em style="color:#f87171">Reservado por ${escapeHtml(s.client_name || '?')}</em>`}</span>
                    ${s.client_email ? `<small style="color:var(--text-muted)">${escapeHtml(s.client_email)}</small>` : ''}
                </div>
                <button class="icon-button danger" type="button" data-delete-schedule="${s.id}" aria-label="Remover horário">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </article>
        `).join('');
        list.querySelectorAll('[data-delete-schedule]').forEach(btn => {
            btn.addEventListener('click', () => deleteSchedule(btn.dataset.deleteSchedule));
        });
    } catch {
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os horários.</p>';
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const productForm = document.getElementById('productForm');
    const scheduleForm = document.getElementById('scheduleForm');
    if (productForm) productForm.addEventListener('submit', submitProduct);
    if (scheduleForm) scheduleForm.addEventListener('submit', submitSchedule);
});
