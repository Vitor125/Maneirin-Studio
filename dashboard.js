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
    try {
        const response = await fetch(`${API_URL}/db-status`);
        if (!response.ok) throw new Error('Erro ao consultar banco');

        const data = await response.json();
        const database = data.database || {};
        const source = database.source || 'desconhecida';
        const dialect = database.dialect || 'desconhecido';

        if (database.is_local_sqlite) {
            setDatabaseStatus(
                `Atenção: o backend está usando SQLite local (${source}). Na Railway, configure DATABASE_URL para salvar no PostgreSQL.`,
                'error'
            );
            return;
        }

        setDatabaseStatus(
            `Banco conectado: ${dialect} via ${source}. Produtos: ${data.products_count}. Horários: ${data.schedules_count}.`,
            'success'
        );
    } catch (error) {
        console.error(error);
        setDatabaseStatus('Não foi possível confirmar a conexão com o banco.', 'error');
    }
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

        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
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

async function submitSchedule(event) {
    event.preventDefault();

    const schedule = {
        barber_name: document.getElementById('schedBarber').value.trim(),
        date: document.getElementById('schedDate').value,
        time: `${document.getElementById('schedTime').value}:00`
    };

    try {
        const response = await fetch(`${API_URL}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schedule)
        });

        if (!response.ok) throw new Error('Erro ao salvar horário');

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
        const response = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Erro ao remover produto');
        setDashboardStatus('Produto removido.');
        loadDashboardProducts();
    } catch (error) {
        console.error(error);
        setDashboardStatus('Erro ao remover produto.', 'error');
    }
}

async function deleteSchedule(id) {
    try {
        const response = await fetch(`${API_URL}/schedules/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Erro ao remover horário');
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
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        const products = await response.json();

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
        const response = await fetch(`${API_URL}/schedules?include_unavailable=true`);
        if (!response.ok) throw new Error('Erro ao carregar horários');
        const schedules = await response.json();

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
    const productForm = document.getElementById('productForm');
    const scheduleForm = document.getElementById('scheduleForm');

    if (productForm) productForm.addEventListener('submit', submitProduct);
    if (scheduleForm) scheduleForm.addEventListener('submit', submitSchedule);

    loadDatabaseStatus();
    loadDashboardProducts();
    loadDashboardSchedules();
});
