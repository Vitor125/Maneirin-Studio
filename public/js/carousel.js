// Faixa de itens únicos: rolagem manual e pistas visuais apenas onde há conteúdo fora da tela.
export function setupCarousel(track) {
    let pointer = null;
    let dragged = false;
    const hint = track.parentElement.querySelector('[data-carousel-hint]');
    // Recalcula as pistas após rolagem, mudança de largura ou remoção de uma foto inválida.
    // A tolerância evita mostrar uma dica por arredondamento de poucos pixels.
    const refresh = () => {
        const remaining = track.scrollWidth - track.clientWidth;
        const overflowing = remaining > 2;
        track.dataset.overflow = String(overflowing);
        track.dataset.moreBefore = String(overflowing && track.scrollLeft > 2);
        track.dataset.moreAfter = String(overflowing && track.scrollLeft < remaining - 2);
        if (hint) hint.hidden = !overflowing;
    };
    // Desencontra a oscilação vertical dos cartões; o CSS respeita movimento reduzido.
    [...track.children].forEach((item, index) => item.style.setProperty('--float-delay', `${index * -1.7}s`));
    // Toque usa a rolagem nativa; mouse pode arrastar sem abrir links por acidente.
    const onDown = event => {
        if (event.button !== 0) return;
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
        event.preventDefault();
    };
    const onUp = () => { pointer = null; };
    // O clique emitido ao terminar um arraste não deve abrir o link de compra.
    const onClick = event => {
        if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; }
    };
    // Só intercepta setas com foco na faixa; os links internos mantêm seu teclado nativo.
    const onKey = event => {
        if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        track.scrollLeft += (event.key === 'ArrowRight' ? 1 : -1) * (track.firstElementChild?.getBoundingClientRect().width || 200);
    };
    const preventDrag = event => event.preventDefault();
    const events = { scroll: refresh, pointerdown: onDown, pointermove: onMove,
        pointerup: onUp, pointercancel: onUp, lostpointercapture: onUp,
        pointerleave: event => { if (!track.hasPointerCapture(event.pointerId)) onUp(); },
        click: onClick, keydown: onKey, dragstart: preventDrag };
    Object.entries(events).forEach(([name, handler]) => track.addEventListener(name, handler));
    const observer = new ResizeObserver(refresh);
    observer.observe(track);
    // Chamado quando a galeria fica vazia, para liberar o observador e os eventos.
    const destroy = () => {
        observer.disconnect();
        Object.entries(events).forEach(([name, handler]) => track.removeEventListener(name, handler));
    };
    refresh();
    return { refresh, destroy };
}
