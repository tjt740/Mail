/* Public UI motion: keep input/data live and cancel obsolete visual work. */
(function () {
    'use strict';
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Map();
    const visibility = new WeakMap();
    const ease = 'cubic-bezier(.22,1,.36,1)';
    let transition = null, revision = 0;

    function animate(element, frames, duration, complete = () => {}) {
        running.get(element)?.animation.cancel();
        running.delete(element);
        if (duration === 0 || reduced.matches || document.hidden || !element.animate) { complete(); return; }
        const animation = element.animate(frames, { duration, easing: ease, fill: 'both' });
        const finish = () => {
            if (running.get(element)?.animation !== animation) return;
            running.delete(element);
            complete();
            animation.cancel();
        };
        running.set(element, { animation, finish });
        animation.finished.then(finish, () => {});
    }

    function reveal(element, direction = 1) {
        if (!element) return;
        const style = getComputedStyle(element);
        animate(element, [
            { opacity: running.has(element) ? style.opacity : .78,
                transform: running.has(element) ? style.transform : `translateY(${direction * 5}px)` },
            { opacity: 1, transform: 'none' }
        ], 240);
    }

    function popup(element, open, immediate = false) {
        if (visibility.get(element) === open) return;
        const visible = !element.hidden;
        const style = getComputedStyle(element);
        const from = { opacity: visible ? style.opacity : 0,
            transform: visible ? style.transform : 'translateY(-6px) scale(.985)' };
        visibility.set(element, open);
        element.inert = !open;
        element.setAttribute('aria-hidden', String(!open));
        if (open) element.hidden = false;
        const finish = () => { element.hidden = !open; };
        animate(element, [from, { opacity: open ? 1 : 0,
            transform: open ? 'none' : 'translateY(-4px) scale(.99)' }], immediate || (!visible && !open) ? 0 : open ? 230 : 170, finish);
    }

    function change(apply, kind = 'theme') {
        const current = ++revision;
        transition?.skipTransition();
        const update = () => { if (current === revision) apply(); };
        if (reduced.matches || document.hidden || !document.startViewTransition) {
            update();
            return;
        }
        // The old/new palettes are composited as complete frames, so foreground
        // and background never interpolate independently into unreadable pairs.
        root.dataset.frontendTransition = kind;
        const active = document.startViewTransition(update);
        transition = active;
        active.ready.catch(() => {}); // Rapid changes may intentionally skip a snapshot.
        active.finished.then(() => {
            if (transition !== active) return;
            transition = null;
            delete root.dataset.frontendTransition;
        }, () => {});
    }

    function overlay(element, open) {
        const style = getComputedStyle(element);
        const opacity = running.has(element) ? style.opacity : open ? 0 : 1;
        element.inert = !open;
        element.setAttribute('aria-hidden', String(!open));
        if (open) element.classList.add('show');
        animate(element, [{ opacity }, { opacity: open ? 1 : 0 }], open ? 240 : 180, () => {
            if (!open) element.classList.remove('show');
        });
        if (open) reveal(element.querySelector('img'));
    }

    function settle() {
        if (!reduced.matches && !document.hidden) return;
        transition?.skipTransition();
        [...running.values()].forEach(entry => entry.finish());
    }
    reduced.addEventListener('change', settle);
    document.addEventListener('visibilitychange', settle);
    window.addEventListener('pagehide', () => {
        transition?.skipTransition();
        [...running.values()].forEach(entry => entry.finish());
    });
    window.FrontendMotion = { reveal, popup, change, overlay };
})();
