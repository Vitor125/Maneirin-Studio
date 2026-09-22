import { collection, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { db } from './js/firebase.js';
import { escapeHtml, buildWhatsappUrl, formatDateBR, formatTime, isUpcomingSchedule, safeExternalUrl, safeImageUrl, sortSchedulesByStart, documentData } from './js/utils.js';
import { initCommonUI, setupAnimations } from './js/ui.js';
import { bindImageErrors } from './js/media.js';

function productCardTemplate(product) {
    const name = escapeHtml(product.name);
    const description = escapeHtml(product.description || '');
    const imageUrl = escapeHtml(safeImageUrl(product.image_url));
    const productUrl = escapeHtml(safeExternalUrl(product.affiliate_link));

    return `
        <article class="product-card fade-in">
            <div class="product-img">
                ${imageUrl
                    ? `<img src="${imageUrl}" alt="${name}" loading="lazy">`
                    : '<i class="fas fa-box-open"></i>'}
            </div>
            <h3>${name}</h3>
            ${description ? `<p>${description}</p>` : '<p>Produto recomendado pelo Maneirin Studio.</p>'}
            <a href="${productUrl}" class="btn btn-secondary" target="_blank" rel="noopener">Ver Produto</a>
        </article>
    `;
}

function setupProductCarousel(container) {
    const track = container.querySelector('.products-carousel-track');
    const prev = container.querySelector('[data-carousel-prev]');
    const next = container.querySelector('[data-carousel-next]');

    if (!track || !prev || !next) return;

    const scrollCarousel = direction => {
        const distance = Math.max(track.clientWidth * 0.82, 280);
        track.scrollBy({ left: direction * distance, behavior: 'smooth' });
    };

    prev.addEventListener('click', () => scrollCarousel(-1));
    next.addEventListener('click', () => scrollCarousel(1));
}

function setupGalleryCarousel(container) {
    const track = container.querySelector('.gallery-track');
    const prev = container.querySelector('[data-gallery-prev]');
    const next = container.querySelector('[data-gallery-next]');
    if (!track || !prev || !next) return;

    const scroll = direction => {
        track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
    };
    prev.addEventListener('click', () => scroll(-1));
    next.addEventListener('click', () => scroll(1));
}

function renderGallery(photos) {
    const container = document.querySelector('[data-gallery-list]');
    if (!container) return;

    if (!photos.length) {
        container.innerHTML = '<p class="empty-message">As fotos do Studio aparecerão aqui.</p>';
        return;
    }

    container.innerHTML = `
        <button class="gallery-button gallery-button-prev" type="button" data-gallery-prev aria-label="Foto anterior">
            <i class="fas fa-chevron-left"></i>
        </button>
        <div class="gallery-track" tabindex="0" aria-label="Fotos dos trabalhos do Studio">
            ${photos.map(photo => `
                <figure class="gallery-slide">
                    <img src="${escapeHtml(safeImageUrl(photo.image_url))}" alt="${escapeHtml(photo.alt || 'Foto do Maneirin Studio')}" loading="lazy">
                    ${photo.alt ? `<figcaption>${escapeHtml(photo.alt)}</figcaption>` : ''}
                </figure>
            `).join('')}
        </div>
        <button class="gallery-button gallery-button-next" type="button" data-gallery-next aria-label="Próxima foto">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    setupGalleryCarousel(container);
    const updateControls = () => {
        const count = container.querySelectorAll('.gallery-slide').length;
        container.querySelectorAll('.gallery-button').forEach(button => { button.hidden = count < 2; });
        if (!count) container.innerHTML = '<p class="empty-message">As fotos do Studio estarão disponíveis em breve.</p>';
    };
    container.querySelectorAll('.gallery-slide img').forEach(img => {
        const removeBrokenPhoto = () => {
            img.closest('.gallery-slide')?.remove();
            updateControls();
        };
        img.addEventListener('error', removeBrokenPhoto, { once: true });
        if (img.complete && !img.naturalWidth) removeBrokenPhoto();
    });
    updateControls();
}

async function fetchGallery() {
    const container = document.querySelector('[data-gallery-list]');
    if (!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, 'gallery'));
        const photos = querySnapshot.docs
            .map(photo => documentData(photo))
            .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
        renderGallery(photos);
    } catch (error) {
        console.error('Erro ao carregar galeria:', error);
        container.innerHTML = '<p class="empty-message">Não foi possível carregar as fotos agora.</p>';
    }
}

function renderProducts(products) {
    const container = document.querySelector('[data-products-list]');
    if (!container) return;

    if (!products.length) {
        container.innerHTML = '<p class="empty-message">Nenhum produto cadastrado ainda.</p>';
        return;
    }

    if (container.dataset.productsMode === 'carousel') {
        container.innerHTML = `
            <button class="carousel-button carousel-button-prev" type="button" data-carousel-prev aria-label="Produto anterior">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="products-carousel-track" tabindex="0">
                ${products.map(productCardTemplate).join('')}
            </div>
            <button class="carousel-button carousel-button-next" type="button" data-carousel-next aria-label="Próximo produto">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        setupProductCarousel(container);
    } else {
        container.innerHTML = products.map(productCardTemplate).join('');
    }

    bindImageErrors(container);
    setupAnimations();
}

async function fetchProducts() {
    const container = document.querySelector('[data-products-list]');
    if (!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const products = querySnapshot.docs.map(doc => documentData(doc));
        renderProducts(products);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="empty-message">Não foi possível carregar os produtos agora.</p>';
    }
}

function renderSchedules(schedules) {
    const list = document.getElementById('agendaList');
    if (!list) return;

    const orderedSchedules = sortSchedulesByStart(schedules);

    if (!orderedSchedules.length) {
        list.innerHTML = '<div class="no-slots">Nenhum horário disponível no momento.</div>';
        return;
    }

    const groupedSchedules = orderedSchedules.reduce((groups, schedule) => {
        const key = schedule.date;
        if (!groups[key]) groups[key] = [];
        groups[key].push(schedule);
        return groups;
    }, {});

    list.innerHTML = Object.entries(groupedSchedules).map(([date, slots]) => `
        <section class="date-group">
            <h2 class="date-title"><i class="far fa-calendar-alt"></i> ${formatDateBR(date)}</h2>
            <div class="slots-grid">
                ${slots.map(slot => {
                    const barber = escapeHtml(slot.barber_name || 'Maneirin Studio');
                    const time = escapeHtml(formatTime(slot.time));
                    const message = `Olá! Vim pelo site do Maneirin Studio e gostaria de agendar um horário com ${slot.barber_name || 'Maneirin Studio'} no dia ${formatDateBR(slot.date)} às ${time}.`;

                    return `
                        <article class="slot-card fade-in">
                            <span class="slot-time">${time}</span>
                            <span class="slot-barber">Com ${barber}</span>
                            <a href="${buildWhatsappUrl(message)}" class="btn btn-primary" target="_blank" rel="noopener">
                                Agendar
                            </a>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `).join('');

    setupAnimations();
}

async function fetchSchedules() {
    const list = document.getElementById('agendaList');
    if (!list) return;

    try {
        const availableQuery = query(collection(db, 'schedules'), where('is_available', '==', true));
        let schedules = [];
        const refresh = () => renderSchedules(schedules.filter(isUpcomingSchedule));
        onSnapshot(availableQuery, snapshot => {
            schedules = snapshot.docs.map(doc => documentData(doc));
            refresh();
        }, error => {
            console.error(error);
            schedules = [];
            list.innerHTML = '<div class="no-slots">Não foi possível carregar a agenda agora.</div>';
        });
        window.setInterval(() => { if (schedules.length) refresh(); }, 60000);
    } catch (error) {
        console.error(error);
        list.innerHTML = '<div class="no-slots">Não foi possível carregar a agenda agora.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCommonUI();
    fetchProducts();
    fetchGallery();
    fetchSchedules();
});
