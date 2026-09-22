import { buildWhatsappUrl } from './utils.js';

function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const header = document.querySelector('.header');

    if (!hamburger || !navLinks || !header) return;

    const setOpen = isOpen => {
        navLinks.classList.toggle('active', isOpen);
        const icon = hamburger.querySelector('i');
        icon.classList.toggle('fa-bars', !isOpen);
        icon.classList.toggle('fa-times', isOpen);
        hamburger.setAttribute('aria-expanded', String(isOpen));
        hamburger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
        document.body.style.overflow = isOpen ? 'hidden' : '';
        header.style.background = isOpen ? 'rgba(17, 24, 39, 1)' : '';
    };
    setOpen(false);
    hamburger.addEventListener('click', () => setOpen(!navLinks.classList.contains('active')));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && navLinks.classList.contains('active')) {
            setOpen(false);
            hamburger.focus();
        }
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navLinks.classList.contains('active')) setOpen(false);
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setOpen(false));
    });
}

function setupScrollHeader() {
    const header = document.querySelector('.header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (document.body.classList.contains('dashboard-page') && window.innerWidth > 768) return;
        if (window.scrollY > 50) {
            header.style.background = 'rgba(17, 24, 39, 0.98)';
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        } else {
            header.style.background = 'rgba(17, 24, 39, 0.85)';
            header.style.boxShadow = 'none';
        }
    });
}

export function setupAnimations() {
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

export function initCommonUI() {
    setupMobileMenu();
    setupScrollHeader();
    setupWhatsappLinks();
    setupInstallAppPrompt();
    setupAnimations();
    registerServiceWorker();
}
