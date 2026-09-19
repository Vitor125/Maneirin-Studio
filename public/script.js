import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyChDecK-r3NqC1wgYo0OUXl0R6e6qXF4HM",
    authDomain: "site-maneirin-studio.firebaseapp.com",
    projectId: "site-maneirin-studio",
    storageBucket: "site-maneirin-studio.firebasestorage.app",
    messagingSenderId: "974534005078",
    appId: "1:974534005078:web:1adb1420fec91092f086f7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const WHATSAPP_PHONE = '5521980453636';

export function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function buildWhatsappUrl(message) {
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

export function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = String(dateStr).split('-');
    return `${day}/${month}/${year}`;
}

export function formatTime(timeStr) {
    return String(timeStr || '').slice(0, 5);
}

export function getScheduleStart(schedule) {
    const date = String(schedule.date || '');
    const rawTime = String(schedule.time || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(rawTime)) return null;
    const time = formatTime(rawTime);
    // Os horários pertencem ao Studio, independentemente do fuso do visitante.
    const start = new Date(`${date}T${time}:00-03:00`);
    if (Number.isNaN(start.getTime())) return null;
    const local = new Date(start.getTime() - 3 * 60 * 60 * 1000);
    return local.toISOString().slice(0, 16) === `${date}T${time}` ? start : null;
}

export function isUpcomingSchedule(schedule) {
    const start = getScheduleStart(schedule);
    if (!start) return false;

    return start.getTime() >= Date.now();
}

export function sortSchedulesByStart(schedules) {
    return [...schedules].sort((first, second) => {
        const firstStart = getScheduleStart(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const secondStart = getScheduleStart(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return firstStart - secondStart;
    });
}

export function safeExternalUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.href;
        }
    } catch (error) {
        return '#';
    }

    return '#';
}

function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const header = document.querySelector('.header');

    if (!hamburger || !navLinks || !header) return;

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');

        const icon = hamburger.querySelector('i');
        const isOpen = navLinks.classList.contains('active');
        icon.classList.toggle('fa-bars', !isOpen);
        icon.classList.toggle('fa-times', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : 'auto';
        header.style.background = isOpen ? 'rgba(17, 24, 39, 1)' : 'rgba(17, 24, 39, 0.85)';
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = hamburger.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
            document.body.style.overflow = 'auto';
        });
    });
}

function setupScrollHeader() {
    const header = document.querySelector('.header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(17, 24, 39, 0.98)';
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        } else {
            header.style.background = 'rgba(17, 24, 39, 0.85)';
            header.style.boxShadow = 'none';
        }
    });
}

function setupAnimations() {
    const fadeElements = document.querySelectorAll('.about-text, .about-image, .product-card, .info-item, .section-desc, .disclaimer, .slot-card');

    fadeElements.forEach(el => el.classList.add('fade-in'));

    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                currentObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    fadeElements.forEach(el => observer.observe(el));

    const heroContent = document.querySelector('.hero-content, .agenda-hero .container');
    if (heroContent) {
        heroContent.classList.add('fade-in');
        setTimeout(() => heroContent.classList.add('visible'), 100);
    }
}

function setupWhatsappLinks() {
    document.querySelectorAll('[data-whatsapp-message]').forEach(link => {
        const message = link.getAttribute('data-whatsapp-message') || 'Olá! Gostaria de entrar em contato com o Maneirin Studio.';
        link.setAttribute('href', buildWhatsappUrl(message));
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
    });
}

function setupInstallAppPrompt() {
    let installPromptEvent = null;
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'install-app-button';
    button.innerHTML = '<i class="fas fa-mobile-alt"></i> Instalar App';
    button.hidden = true;
    document.body.appendChild(button);

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPromptEvent = event;
        button.hidden = false;
    });

    button.addEventListener('click', async () => {
        if (!installPromptEvent) return;

        installPromptEvent.prompt();
        await installPromptEvent.userChoice;
        installPromptEvent = null;
        button.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
        installPromptEvent = null;
        button.hidden = true;
    });
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.error('Erro ao registrar service worker:', error);
        });
    });
}

function productCardTemplate(product) {
    const name = escapeHtml(product.name);
    const description = escapeHtml(product.description || '');
    const imageUrl = escapeHtml(product.image_url || '');
    const productUrl = escapeHtml(safeExternalUrl(product.affiliate_link));

    return `
        <article class="product-card fade-in">
            <div class="product-img">
                ${imageUrl
                    ? `<img src="${imageUrl}" alt="${name}" loading="lazy" onerror="this.remove();">`
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
                    <img src="${escapeHtml(photo.image_url)}" alt="${escapeHtml(photo.alt || 'Foto do Maneirin Studio')}" loading="lazy">
                    ${photo.alt ? `<figcaption>${escapeHtml(photo.alt)}</figcaption>` : ''}
                </figure>
            `).join('')}
        </div>
        <button class="gallery-button gallery-button-next" type="button" data-gallery-next aria-label="Próxima foto">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    setupGalleryCarousel(container);
}

async function fetchGallery() {
    const container = document.querySelector('[data-gallery-list]');
    if (!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, 'gallery'));
        const photos = querySnapshot.docs
            .map(photo => ({ id: photo.id, ...photo.data() }))
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

    setupAnimations();
}

async function fetchProducts() {
    const container = document.querySelector('[data-products-list]');
    if (!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    setupMobileMenu();
    setupScrollHeader();
    setupWhatsappLinks();
    setupInstallAppPrompt();
    setupAnimations();
    fetchProducts();
    fetchGallery();
    fetchSchedules();
    registerServiceWorker();
});
