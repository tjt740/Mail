/* Interruptible transitions for the mailbox workspace. Data updates never wait for motion. */
(function () {
    'use strict';
    document.documentElement.classList.add('mailbox-page');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const running = new Map();
    const visibility = new WeakMap();
    const modalOrigins = new WeakMap();
    const modalStack = [];
    const ease = 'cubic-bezier(.22,1,.36,1)';

    function animate(element, frames, duration, complete = () => {}) {
        running.get(element)?.animation.cancel();
        running.delete(element);
        if (reduced.matches || !element.animate) { complete(); return; }
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
    reduced.addEventListener('change', () => {
        if (reduced.matches) [...running.values()].forEach(entry => entry.finish());
    });

    function reveal(element) {
        if (!element) return;
        // Keep results readable even during rapid typing or repeated page changes.
        const style = getComputedStyle(element);
        animate(element, [
            { opacity: running.has(element) ? style.opacity : .72, transform: running.has(element) ? style.transform : 'translateY(4px)' },
            { opacity: 1, transform: 'none' }
        ], 200);
    }

    function popup(element, open, display = 'block') {
        if (!element || visibility.get(element) === open) return;
        const wasVisible = element.getClientRects().length > 0;
        const style = getComputedStyle(element);
        const from = { opacity: wasVisible ? style.opacity : 0, transform: wasVisible ? style.transform : 'translateY(-5px) scale(.985)' };
        visibility.set(element, open);
        element.inert = !open;
        element.setAttribute('aria-hidden', String(!open));
        if (!wasVisible && !open) { element.style.display = 'none'; return; }
        element.style.display = display;
        animate(element, [from, { opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(-5px) scale(.985)' }], open ? 200 : 150, () => {
            if (!open) element.style.display = 'none';
        });
    }

    function expand(element, open, display = 'block') {
        if (!element || visibility.get(element) === open) return;
        const fromHeight = element.getBoundingClientRect().height;
        const before = getComputedStyle(element);
        const from = { height: `${fromHeight}px`, opacity: fromHeight ? before.opacity : 0, overflow: 'hidden' };
        const edges = ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'borderTopWidth', 'borderBottomWidth'];
        edges.forEach(key => { from[key] = fromHeight ? before[key] : '0px'; });
        visibility.set(element, open);
        element.inert = !open;
        element.setAttribute('aria-hidden', String(!open));
        if (!fromHeight && !open) { element.hidden = true; return; }
        running.get(element)?.animation.cancel();
        running.delete(element);
        element.hidden = false;
        element.style.display = display;
        const natural = getComputedStyle(element);
        const to = { height: `${open ? element.getBoundingClientRect().height : 0}px`, opacity: open ? 1 : 0, overflow: 'hidden' };
        edges.forEach(key => { to[key] = open ? natural[key] : '0px'; });
        animate(element, [from, to], 240, () => { element.hidden = !open; });
    }

    function lockModalScroll() {
        document.documentElement.classList.toggle('mailbox-modal-open', !!document.querySelector('.modal.show, .modal.is-closing'));
    }
    function openModal(element) {
        if (typeof element === 'string') element = document.getElementById(element);
        if (!element || element.classList.contains('show')) return;
        const wasVisible = element.classList.contains('is-closing');
        const content = element.querySelector('.modal-content');
        const opacity = wasVisible ? getComputedStyle(element).opacity : 0;
        const transform = wasVisible ? getComputedStyle(content).transform : 'translateY(12px) scale(.985)';
        if (!wasVisible) {
            const active = document.activeElement;
            const trigger = active?.closest('.au-dropdown')?.querySelector('.au-dropdown-toggle')
                || active?.closest('.mailbox-actions-more')?.querySelector('[data-action="more"]') || active;
            modalOrigins.set(element, trigger);
        }
        const index = modalStack.indexOf(element);
        if (index >= 0) modalStack.splice(index, 1);
        modalStack.push(element);
        element.classList.remove('is-closing');
        element.classList.add('show');
        element.inert = false;
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'true');
        element.setAttribute('aria-hidden', 'false');
        if (!element.dataset.motionBackdrop) {
            element.dataset.motionBackdrop = 'true';
            element.addEventListener('click', event => {
                if (event.target === element && element.classList.contains('show')) element.querySelector('.modal-close')?.click();
            });
        }
        const title = element.querySelector('.modal-title, .modal-header h3');
        if (title) { title.id ||= `${element.id}Title`; element.setAttribute('aria-labelledby', title.id); }
        lockModalScroll();
        animate(element, [{ opacity }, { opacity: 1 }], 180);
        animate(content, [{ transform }, { transform: 'none' }], 260);
        content.tabIndex = -1;
        const focusable = [...element.querySelectorAll('input:not([type="hidden"]):not(:disabled):not([readonly]), textarea:not(:disabled), select:not(:disabled)')].find(item => item.getClientRects().length)
            || element.querySelector('.modal-close');
        (focusable || content).focus({ preventScroll: true });
    }
    function closeModal(element, complete = () => {}) {
        if (typeof element === 'string') element = document.getElementById(element);
        if (!element?.classList.contains('show')) return;
        const content = element.querySelector('.modal-content');
        const opacity = getComputedStyle(element).opacity;
        const transform = getComputedStyle(content).transform;
        element.classList.add('is-closing');
        element.classList.remove('show');
        element.inert = true;
        element.setAttribute('aria-hidden', 'true');
        element.removeAttribute('aria-modal');
        const index = modalStack.indexOf(element);
        if (index >= 0) modalStack.splice(index, 1);
        const previous = modalOrigins.get(element);
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        animate(content, [{ transform }, { transform: 'translateY(8px) scale(.99)' }], 170);
        animate(element, [{ opacity }, { opacity: 0 }], 170, () => {
            element.classList.remove('is-closing');
            lockModalScroll();
            complete();
        });
    }
    function dismiss(element) {
        if (!element || element.inert) return;
        element.inert = true;
        animate(element, [{ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }, { opacity: 0, transform: 'translateY(-6px)' }], 160, () => element.remove());
    }

    document.addEventListener('keydown', event => {
        const modal = modalStack[modalStack.length - 1];
        if (!modal) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            modal.querySelector('.modal-close')?.click();
        } else if (event.key === 'Tab') {
            const items = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
                .filter(item => item.getClientRects().length && !item.closest('[inert]'));
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }, true);

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.au-dropdown').forEach(wrapper => {
            const menu = wrapper.querySelector('.au-dropdown-menu');
            const trigger = wrapper.querySelector('.au-dropdown-toggle');
            const sync = () => {
                const open = wrapper.classList.contains('open');
                trigger?.setAttribute('aria-expanded', String(open));
                popup(menu, open);
            };
            sync();
            new MutationObserver(sync).observe(wrapper, { attributes: true, attributeFilter: ['class'] });
        });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            document.querySelectorAll('.au-dropdown.open').forEach(wrapper => {
                wrapper.classList.remove('open');
                wrapper.querySelector('.au-dropdown-toggle')?.focus({ preventScroll: true });
            });
            const columnMenu = document.getElementById('columnConfigMenu');
            if (columnMenu?.classList.contains('show')) {
                columnMenu.classList.remove('show'); popup(columnMenu, false);
                document.getElementById('columnConfigBtn').focus({ preventScroll: true });
            }
            const more = document.querySelector('.mailbox-actions-more.open [data-action="more"]');
            if (more) { window.closeMailboxMoreMenus(); more.focus({ preventScroll: true }); }
        });
    });
    window.MailboxInteractions = { popup, expand, reveal, openModal, closeModal, dismiss };
})();
