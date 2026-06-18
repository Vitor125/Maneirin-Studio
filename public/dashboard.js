import { collection, addDoc, deleteDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
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
        console.error(error);
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
        console.error(error);
        setDashboardStatus('Erro ao salvar horário.', 'error');
    }
}

async function deleteProduct(id) {
    try {
        await deleteDoc(doc(db, "products", id));
        setDashboardStatus('Produto removido.');
        loadDashboardProducts();
    } catch (error) {
        console.error(error);
        setDashboardStatus('Erro ao remover produto.', 'error');
    }
}

async function deleteSchedule(id) {
    try {
        await deleteDoc(doc(db, "schedules", id));
        setDashboardStatus('Horário removido.');
        loadDashboardSchedules();
    } catch (error) {
        console.error(error);
        setDashboardStatus('Erro ao remover horário.', 'error');
    }
}

async function loadDashboardProducts() {
    const list = document.getElementById('dashboardProductsList');
    if (!list) return;

    list.innerHTML = '<p class="loading-message">Carregando produtos...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

        list.querySelectorAll('[data-delete-product]').forEach(button => {
            button.addEventListener('click', () => deleteProduct(button.dataset.deleteProduct));
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os produtos.</p>';
    }
}

async function loadDashboardSchedules() {
    const list = document.getElementById('dashboardSchedulesList');
    if (!list) return;

    list.innerHTML = '<p class="loading-message">Carregando horários...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        const schedules = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

        list.querySelectorAll('[data-delete-schedule]').forEach(button => {
            button.addEventListener('click', () => deleteSchedule(button.dataset.deleteSchedule));
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = '<p class="empty-message">Não foi possível carregar os horários.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginOverlay = document.getElementById('loginOverlay');
    const mainDashboard = document.getElementById('mainDashboard');
    const logoutBtn = document.getElementById('logoutBtn');

    const productForm = document.getElementById('productForm');
    const scheduleForm = document.getElementById('scheduleForm');

    if (productForm) productForm.addEventListener('submit', submitProduct);
    if (scheduleForm) scheduleForm.addEventListener('submit', submitSchedule);

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            errorDiv.style.display = 'none';
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error(error);
                errorDiv.textContent = 'Erro ao fazer login. Credenciais incorretas.';
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

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginOverlay.style.display = 'none';
            mainDashboard.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'block';
            
            loadDatabaseStatus();
            loadDashboardProducts();
            loadDashboardSchedules();
        } else {
            loginOverlay.style.display = 'flex';
            mainDashboard.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            
            // clear lists when logged out
            const productsList = document.getElementById('dashboardProductsList');
            const schedulesList = document.getElementById('dashboardSchedulesList');
            if (productsList) productsList.innerHTML = '';
            if (schedulesList) schedulesList.innerHTML = '';
        }
    });
});
