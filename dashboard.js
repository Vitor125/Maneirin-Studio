const API_URL = 'http://127.0.0.1:8000/api';

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const product = {
        name: document.getElementById('prodName').value,
        description: document.getElementById('prodDesc').value,
        image_url: document.getElementById('prodImage').value,
        affiliate_link: document.getElementById('prodLink').value
    };

    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if(response.ok) {
            alert('Produto cadastrado com sucesso!');
            document.getElementById('productForm').reset();
            loadDashboardProducts();
        }
    } catch (error) {
        alert('Erro ao conectar com a API');
    }
});

document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const schedule = {
        barber_name: document.getElementById('schedBarber').value,
        date: document.getElementById('schedDate').value,
        time: document.getElementById('schedTime').value + ':00' // Adiciona segundos para o formato
    };

    try {
        const response = await fetch(`${API_URL}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schedule)
        });
        if(response.ok) {
            alert('Horário cadastrado com sucesso!');
            loadDashboardSchedules();
        }
    } catch (error) {
        alert('Erro ao conectar com a API');
    }
});

async function loadDashboardProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const products = await res.json();
        const list = document.getElementById('dashboardProductsList');
        list.innerHTML = products.map(p => `
            <div class="list-item">
                <div>
                    <strong>${p.name}</strong><br>
                    <small>${p.description.substring(0, 30)}...</small>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function loadDashboardSchedules() {
    try {
        const res = await fetch(`${API_URL}/schedules`);
        const schedules = await res.json();
        const list = document.getElementById('dashboardSchedulesList');
        list.innerHTML = schedules.map(s => `
            <div class="list-item">
                <div>
                    <strong>${s.date} às ${s.time}</strong><br>
                    <small>Barbeiro: ${s.barber_name}</small>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

// Load initial data
loadDashboardProducts();
loadDashboardSchedules();
