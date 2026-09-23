import { buildWhatsappUrl } from './utils.js';

/** Abre/fecha a navegação móvel, atualiza acessibilidade e libera a rolagem ao voltar ao desktop. */
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

/** Ajusta o contraste do cabeçalho ao rolar, preservando a lateral do painel desktop. */
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

/** Revela elementos quando entram na área visível; não altera os dados exibidos. */
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

/** Preenche os links declarados com data-whatsapp-message e protege a nova janela. */
function setupWhatsappLinks() {
    document.querySelectorAll('[data-whatsapp-message]').forEach(link => {
        const message = link.getAttribute('data-whatsapp-message') || 'Olá! Gostaria de entrar em contato com o Maneirin Studio.';
        link.setAttribute('href', buildWhatsappUrl(message));
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
    });
}

/** Exibe instalação somente quando o navegador disponibiliza seu fluxo nativo de PWA. */
function setupInstallAppPrompt() {
    let installPromptEvent = null;
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'install-app-button';
    button.innerHTML = '<i class="fas fa-mobile-alt"></i> Instalar ' + (document.documentElement.dataset.app === 'barbeiro' ? 'Barbeiro' : 'Cliente');
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

/** Registra o cache após o carregamento da página e mantém falhas de instalação fora do fluxo principal. */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        // O escopo é explícito e não se sobrepõe ao outro aplicativo.
        const app = document.documentElement.dataset.app;
        if (!['cliente', 'barbeiro'].includes(app)) return;
        navigator.serviceWorker.register('/' + app + '/sw.js', { scope: '/' + app + '/', updateViaCache: 'none' }).then(async () => {
            // Retira apenas a instalação técnica antiga de escopo raiz, preservando os dois apps.
            const legacy = await navigator.serviceWorker.getRegistration('/');
            if (legacy && new URL(legacy.scope).pathname === '/') await legacy.unregister();
        }).catch(error => {
            console.error('Erro ao registrar service worker:', error);
        });
    });
}

/** Inicializa comportamentos comuns e a navegação para contatos; cada página chama esta função uma vez. */
export function initCommonUI() {
    setupMobileMenu();
    // Aguarda o fechamento do menu móvel antes de posicionar a seção de contatos.
    document.querySelectorAll('a[href="#contato"]').forEach(link => {
        link.addEventListener('click', event => {
            const contact = document.getElementById('contato');
            if (!contact) return;
            event.preventDefault();
            history.replaceState(null, '', '#contato');
            requestAnimationFrame(() => contact.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
                block: 'start'
            }));
        });
    });
    setupScrollHeader();
    setupWhatsappLinks();
    setupInstallAppPrompt();
    setupAnimations();
    registerServiceWorker();
}
