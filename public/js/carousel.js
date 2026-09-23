// Três faixas equivalentes permitem atravessar as extremidades sem salto visual.
// As cópias são apenas de apresentação; os itens originais mantêm o acesso por teclado.
export function setupInfiniteCarousel(track) {
    let originals = [...track.children];
    let span = 0;
    let frame;
    let lastTime = 0;
    let travel = 0;
    let pausedUntil = 0;
    let hovered = false;
    let focused = false;
    let pointer = null;
    let dragged = false;
    let previousWidth = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pause = () => { pausedUntil = performance.now() + 4500; };

    // Recalcula as três faixas após redimensionamento ou remoção de uma imagem quebrada.
    const refresh = () => {
        originals = originals.filter(item => item.parentElement === track);
        track.querySelectorAll('[data-carousel-copy]').forEach(item => item.remove());
        span = 0;
        if (!originals.length || !track.clientWidth) return;
        const gap = parseFloat(getComputedStyle(track).gap) || 0;
        const step = originals[0].getBoundingClientRect().width + gap;
        const repeats = Math.max(1, Math.ceil((track.clientWidth + step) / (step * originals.length)));
        const copy = item => {
            const clone = item.cloneNode(true);
            clone.dataset.carouselCopy = 'true';
            clone.setAttribute('aria-hidden', 'true');
            clone.querySelectorAll('a, button, [tabindex]').forEach(el => { el.tabIndex = -1; });
            return clone;
        };
        const side = () => {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < repeats; i++) originals.forEach(item => fragment.append(copy(item)));
            return fragment;
        };
        track.prepend(side());
        for (let i = 1; i < repeats; i++) originals.forEach(item => track.append(copy(item)));
        track.append(side());
        span = step * originals.length * repeats;
        track.scrollLeft = span;
    };
    // Reposiciona na faixa equivalente central sem mudar o conteúdo que está visível.
    const normalize = () => {
        if (!span) return;
        if (track.scrollLeft < span - 1) track.scrollLeft += span;
        else if (track.scrollLeft >= 2 * span) track.scrollLeft -= span;
    };
    // Mantém velocidade constante; respeita foco, interação e preferência por menos movimento.
    const animate = time => {
        if (!track.isConnected) { destroy(); return; }
        const elapsed = Math.min(time - (lastTime || time), 50);
        lastTime = time;
        if (span && !hovered && !focused && !pointer && !document.hidden && !reducedMotion.matches && time > pausedUntil) {
            travel += elapsed * 0.028;
            const pixels = Math.floor(travel);
            travel -= pixels;
            track.scrollLeft += pixels;
            normalize();
        }
        frame = requestAnimationFrame(animate);
    };
    // No celular o navegador controla o toque; no mouse, convertemos o arraste em rolagem.
    const onDown = event => {
        pause();
        dragged = false;
        pointer = { id: event.pointerId, x: event.clientX, mouse: event.pointerType === 'mouse' };
    };
    const onMove = event => {
        if (!pointer?.mouse) return;
        const delta = pointer.x - event.clientX;
        if (!dragged && Math.abs(delta) < 6) return;
        dragged = true;
        track.setPointerCapture(pointer.id);
        track.scrollLeft += delta;
        pointer.x = event.clientX;
        pause();
        event.preventDefault();
    };
    const onUp = () => { pointer = null; pause(); };
    // Arrastar um produto não deve abrir acidentalmente seu link de compra.
    const onClick = event => { if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; } };
    const onKey = event => {
        if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        pause();
        track.scrollLeft += (event.key === 'ArrowRight' ? 1 : -1) * (originals[0]?.getBoundingClientRect().width || 200);
    };
    const onEnter = () => { hovered = true; };
    const onLeave = () => { hovered = false; };
    const onFocus = () => { focused = true; };
    const onBlur = event => { focused = track.contains(event.relatedTarget); pause(); };
    const preventDrag = event => event.preventDefault();
    const events = { scroll: normalize, pointerdown: onDown, pointermove: onMove, pointerenter: onEnter,
        pointerleave: onLeave, click: onClick, keydown: onKey, focusin: onFocus, focusout: onBlur,
        wheel: pause, dragstart: preventDrag };
    Object.entries(events).forEach(([name, handler]) => track.addEventListener(name, handler));
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const observer = new ResizeObserver(() => {
        if (track.clientWidth !== previousWidth) { previousWidth = track.clientWidth; refresh(); }
    });
    // Libera observadores e eventos quando a faixa deixa a página.
    const destroy = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        Object.entries(events).forEach(([name, handler]) => track.removeEventListener(name, handler));
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };
    observer.observe(track);
    refresh();
    frame = requestAnimationFrame(animate);
    return { refresh, destroy };
}
