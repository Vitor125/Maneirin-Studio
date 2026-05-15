document.addEventListener('DOMContentLoaded', () => {
    // Menu Mobile (Hamburger)
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const links = document.querySelectorAll('.nav-links li');
    const header = document.querySelector('.header');

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
    // Seleciona as seções principais e cards para animar
    const fadeElements = document.querySelectorAll('.about-text, .about-image, .product-card, .info-item, .section-desc, .disclaimer');
    
    // Adiciona a classe inicial
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
    });

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1 // Dispara quando 10% do elemento está visível
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Para de observar após animar
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => {
        observer.observe(el);
    });

    // Efeito na navbar ao fazer scroll (adiciona sombra e muda transparência)
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
