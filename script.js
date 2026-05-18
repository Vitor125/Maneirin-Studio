document.addEventListener('DOMContentLoaded', () => {
    // Menu Mobile (Hamburger)
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const links = document.querySelectorAll('.nav-links li');
    const header = document.querySelector('.header');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            
            // Alternar ícone (bars para times/x)
            const icon = hamburger.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
                // Travar rolagem da página quando o menu está aberto
                document.body.style.overflow = 'hidden';
                header.style.background = 'rgba(17, 24, 39, 1)';
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                // Restaurar rolagem
                document.body.style.overflow = 'auto';
                if (window.scrollY <= 50) {
                    header.style.background = 'rgba(17, 24, 39, 0.85)';
                }
            }
        });
    }

    // Fechar menu ao clicar num link
    links.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = hamburger.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
            document.body.style.overflow = 'auto';
        });
    });

    // Intersection Observer para animações ao rolar a página (Fade-in)
    const fadeElements = document.querySelectorAll('.about-text, .about-image, .product-card, .info-item, .section-desc, .disclaimer');
    
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
    });

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => {
        observer.observe(el);
    });

    // Efeito na navbar ao fazer scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(17, 24, 39, 0.98)';
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
            header.style.padding = '10px 5%';
        } else {
            header.style.background = 'rgba(17, 24, 39, 0.85)';
            header.style.boxShadow = 'none';
            header.style.padding = '15px 5%';
        }
    });

    // Acionar a animação do conteúdo da seção Hero imediatamente (se não for feito no CSS via @keyframes)
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.classList.add('fade-in');
        setTimeout(() => {
            heroContent.classList.add('visible');
        }, 100);
    }
});

// --- API FETCH LOGIC ---
const API_URL = 'http://127.0.0.1:8000/api';

async function fetchProducts() {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error('Falha na API');
        const products = await response.json();
        
        if(products.length === 0) {
            grid.innerHTML = '<p style="text-align:center; width:100%; color:var(--text-muted)">Nenhum produto cadastrado ainda.</p>';
            return;
        }

        grid.innerHTML = products.map(product => `
            <div class="product-card fade-in">
                <div class="product-img" style="overflow: hidden;">
                    <img src="${product.image_url}" alt="${product.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <i class="fas fa-box" style="display:none;"></i>
                </div>
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <a href="${product.affiliate_link}" class="btn btn-secondary" target="_blank">Ver Produto no Site</a>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        grid.innerHTML = '<p style="text-align:center; width:100%; color:var(--text-muted)">Não foi possível carregar os produtos no momento.</p>';
    }
}

async function fetchSchedules() {
    const list = document.getElementById('agendaList');
    if (!list) return;

    try {
        const response = await fetch(`${API_URL}/schedules`);
        if (!response.ok) throw new Error('Falha na API');
        const schedules = await response.json();

        if (schedules.length === 0) {
            list.innerHTML = '<div class="no-slots">Nenhum horário disponível no momento. Volte mais tarde!</div>';
            return;
        }

        const grouped = schedules.reduce((acc, curr) => {
            if (!acc[curr.date]) acc[curr.date] = [];
            acc[curr.date].push(curr);
            return acc;
        }, {});

        let html = '';
        for (const [dateStr, slots] of Object.entries(grouped)) {
            const [y, m, d] = dateStr.split('-');
            const formattedDate = `${d}/${m}/${y}`;
            
            html += `<div class="date-group">
                <h3 class="date-title"><i class="far fa-calendar-alt"></i> ${formattedDate}</h3>
                <div class="slots-grid">`;
            
            slots.forEach(slot => {
                const timeStr = slot.time.substring(0, 5);
                const msg = encodeURIComponent(`Olá! Gostaria de agendar um horário com ${slot.barber_name} no dia ${formattedDate} às ${timeStr}.`);
                const whatsappUrl = `https://wa.me/5521980453636?text=${msg}`;
                
                html += `
                    <div class="slot-card">
                        <div class="slot-time">${timeStr}</div>
                        <div class="slot-barber">Com: ${slot.barber_name}</div>
                        <a href="${whatsappUrl}" class="btn btn-primary" target="_blank" onclick="markAsBooked(${slot.id})">Agendar</a>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        list.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        list.innerHTML = '<div class="no-slots">Erro ao conectar com o servidor. Tente novamente mais tarde.</div>';
    }
}

async function markAsBooked(id) {
    try {
        await fetch(`${API_URL}/schedules/book/${id}`, { method: 'POST' });
    } catch(e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
});
