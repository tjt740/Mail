/* Keep scroll gestures separate from click actions, including modal backdrops. */
(function () {
    let gesture = null;
    document.addEventListener('pointerdown', event => {
        gesture = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, target: event.target, moved: false, ended: 0 };
    }, { capture: true, passive: true });
    document.addEventListener('pointermove', event => {
        if (gesture?.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true;
    }, { capture: true, passive: true });
    for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, event => {
        if (gesture?.id !== event.pointerId) return;
        if (type === 'pointercancel') gesture.moved = true;
        gesture.ended = performance.now();
    }, { capture: true, passive: true });
    document.addEventListener('click', event => {
        if (!gesture || !event.detail || performance.now() - gesture.ended > 600) return;
        const dragged = gesture.moved && gesture.type !== 'mouse';
        const crossedBackdrop = event.target.matches?.('.modal') && gesture.target !== event.target;
        if (dragged || crossedBackdrop) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    // A page scroll over a focused number field must not change its value.
    document.addEventListener('wheel', event => {
        if (event.target.matches?.('input[type="number"]') && document.activeElement === event.target) event.target.blur();
    }, { capture: true, passive: true });
})();
