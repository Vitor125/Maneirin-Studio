import { collection, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { db } from './js/firebase.js';
import { escapeHtml, buildWhatsappUrl, formatDateBR, formatTime, isUpcomingSchedule, safeExternalUrl, safeImageUrl, sortSchedulesByStart, documentData } from './js/utils.js';
import { initCommonUI, setupAnimations } from './js/ui.js';
import { setupInfiniteCarousel } from './js/carousel.js';
import { bindImageErrors } from './js/media.js';

/** Gera o cartão público com textos escapados e links/imagens filtrados. */
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

/** Monta a galeria contínua e retira fotos que falham, preservando o loop após a remoção. */
function renderGallery(photos) {
    const container = document.querySelector('[data-gallery-list]');
    if (!container) return;

    if (!photos.length) {
        container.innerHTML = '<p class="empty-message">As fotos do Studio aparecerão aqui.</p>';
        return;
    }

    container.innerHTML = `
        <div class="gallery-track loop-carousel" tabindex="0" role="region" aria-label="Fotos dos trabalhos do Studio. Deslize ou use as setas do teclado.">
            ${photos.map(photo => `
                <figure class="gallery-slide">
                    <img src="${escapeHtml(safeImageUrl(photo.image_url))}" alt="${escapeHtml(photo.alt || 'Foto do Maneirin Studio')}" loading="lazy">
                    ${photo.alt ? `<figcaption>${escapeHtml(photo.alt)}</figcaption>` : ''}
                </figure>
            `).join('')}
        </div>
    `;
    const track = container.querySelector('.gallery-track');
    const carousel = setupInfiniteCarousel(track);
    const updateControls = () => {
        const count = container.querySelectorAll('.gallery-slide').length;

        if (!count) container.innerHTML = '<p class="empty-message">As fotos do Studio estarão disponíveis em breve.</p>';
    };
    container.querySelectorAll('.gallery-slide:not([data-carousel-copy]) img').forEach(img => {
        const removeBrokenPhoto = () => {
            img.closest('.gallery-slide')?.remove();
            carousel.refresh();
            updateControls();
        };
        img.addEventListener('error', removeBrokenPhoto, { once: true });
        if (img.complete && !img.naturalWidth) removeBrokenPhoto();
    });
    updateControls();
}

/** Busca fotos públicas e ordena pela data cadastrada; não altera documentos. */
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

/** Escolhe entre carrossel na página inicial e grade na vitrine completa. */
function renderProducts(products) {
    const container = document.querySelector('[data-products-list]');
    if (!container) return;

    if (!products.length) {
        container.innerHTML = '<p class="empty-message">Nenhum produto cadastrado ainda.</p>';
        return;
    }

    if (container.dataset.productsMode === 'carousel') {
        container.innerHTML = `
            <div class="products-carousel-track loop-carousel" tabindex="0" role="region" aria-label="Produtos recomendados. Deslize ou use as setas do teclado.">
                ${products.map(productCardTemplate).join('')}
            </div>
        `;
        setupInfiniteCarousel(container.querySelector('.products-carousel-track'));
    } else {
        container.innerHTML = products.map(productCardTemplate).join('');
    }

    bindImageErrors(container);
    setupAnimations();
}

/** Carrega recomendações públicas e apresenta uma mensagem recuperável quando a consulta falha. */
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

/** Agrupa horários por dia e monta links de WhatsApp; o clique não confirma nem bloqueia a vaga. */
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

/** Acompanha apenas disponibilidades públicas e remove horários expirados da tela a cada minuto. */
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
