import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, runTransaction } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
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
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

export function formatTime(timeStr) {
    return String(timeStr || '').slice(0, 5);
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

function toLocalDate(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
}

function calendarDate(date) {
    return date.toISOString().replaceAll('-', '').replaceAll(':', '').split('.')[0] + 'Z';
}

export function buildCalendarUrl(appointment) {
    const start = toLocalDate(appointment.date, appointment.time);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `Atendimento Maneirin Studio - ${appointment.barber_name}`,
        dates: `${calendarDate(start)}/${calendarDate(end)}`,
        details: `Cliente: ${appointment.client_name}\nTelefone: ${appointment.client_phone}\nLembrete criado pelo site Maneirin Studio.`,
        location: 'R. Nilópolis, 352 - Éden, São João de Meriti - RJ'
    });
    return `https://calendar.google.com/calendar/render?${params}`;
}

function setupAppointmentBooking() {
    const form = document.getElementById('appointmentForm');
    const modal = document.getElementById('appointmentModal');
    const closeButton = document.querySelector('[data-close-appointment]');
    const result = document.getElementById('appointmentResult');
    let selectedSlot = null;

    if (!form || !modal) return;

    const closeModal = () => {
        modal.hidden = true;
        result.hidden = true;
        result.innerHTML = '';
        form.reset();
    };

    if (closeButton) closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeModal();
    });

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-book-slot]');
        if (!button) return;

        selectedSlot = JSON.parse(button.dataset.bookSlot);
        document.getElementById('appointmentSummary').textContent =
            `${formatDateBR(selectedSlot.date)} às ${formatTime(selectedSlot.time)} com ${selectedSlot.barber_name}`;
        modal.hidden = false;
        document.getElementById('appointmentName').focus();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!selectedSlot) return;

        const submitButton = form.querySelector('button[type="submit"]');
        const appointment = {
            schedule_id: selectedSlot.id,
            barber_name: selectedSlot.barber_name,
            date: selectedSlot.date,
            time: selectedSlot.time,
            client_name: document.getElementById('appointmentName').value.trim(),
            client_phone: document.getElementById('appointmentPhone').value.trim(),
            client_email: document.getElementById('appointmentEmail').value.trim(),
            created_at: new Date().toISOString()
        };

        submitButton.disabled = true;
        result.hidden = true;
        try {
            await runTransaction(db, async transaction => {
                const scheduleRef = doc(db, 'schedules', selectedSlot.id);
                const appointmentRef = doc(db, 'appointments', selectedSlot.id);
                const scheduleSnapshot = await transaction.get(scheduleRef);

                if (!scheduleSnapshot.exists() || scheduleSnapshot.data().is_available === false) {
                    throw new Error('Este horário acabou de ser reservado por outra pessoa.');
                }

                transaction.set(appointmentRef, appointment);
                transaction.update(scheduleRef, { is_available: false, appointment_id: selectedSlot.id });
            });

            const customerMessage = `Olá! Meu agendamento no Maneirin Studio foi confirmado para ${formatDateBR(appointment.date)} às ${appointment.time} com ${appointment.barber_name}.`;
            const barberMessage = `Novo agendamento: ${appointment.client_name} para ${formatDateBR(appointment.date)} às ${appointment.time} com ${appointment.barber_name}. Telefone: ${appointment.client_phone}.`;
            result.innerHTML = `
                <p><strong>Horário reservado com sucesso!</strong></p>
                <a class="btn btn-primary" href="${buildCalendarUrl(appointment)}" target="_blank" rel="noopener">Adicionar à minha agenda</a>
                <a class="btn btn-whatsapp" href="${buildWhatsappUrl(customerMessage)}" target="_blank" rel="noopener">Receber confirmação no WhatsApp</a>
                <a class="btn btn-secondary" href="${buildWhatsappUrl(barberMessage)}" target="_blank" rel="noopener">Avisar o barbeiro</a>
            `;
            result.hidden = false;
            form.reset();
            fetchSchedules();
        } catch (error) {
            result.textContent = error.message || 'Não foi possível reservar este horário.';
            result.hidden = false;
        } finally {
            submitButton.disabled = false;
        }
    });
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
        <div class="gallery-track">
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

    if (!schedules.length) {
        list.innerHTML = '<div class="no-slots">Nenhum horário disponível no momento.</div>';
        return;
    }

    const groupedSchedules = schedules.reduce((groups, schedule) => {
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
                    const barber = escapeHtml(slot.barber_name);
                    const time = formatTime(slot.time);
                    return `
                        <article class="slot-card fade-in">
                            <span class="slot-time">${time}</span>
                            <span class="slot-barber">Com ${barber}</span>
                            <button type="button" class="btn btn-primary" data-book-slot='${escapeHtml(JSON.stringify({
                                id: slot.id,
                                barber_name: slot.barber_name,
                                date: slot.date,
                                time: slot.time
                            }))}'>
                                Agendar
                            </button>
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
        const querySnapshot = await getDocs(collection(db, "schedules"));
        const schedules = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const availableSchedules = schedules.filter(s => s.is_available !== false);
        renderSchedules(availableSchedules);
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
    setupAppointmentBooking();
    setupAnimations();
    fetchProducts();
    fetchGallery();
    fetchSchedules();
    registerServiceWorker();
});
