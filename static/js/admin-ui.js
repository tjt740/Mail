/* ============================================================
   admin-ui.js — 后台共享交互层（window.AdminUI）
   在 i18n.js 之后、各页 block scripts 之前加载。
   页面内的同名局部函数（如 showToast 声明）会遮蔽这里的兜底，
   翻新到某页时应删除该页的本地副本。
   ============================================================ */
(function () {
    'use strict';

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionPreference.matches;
    motionPreference.addEventListener('change', (event) => { reduceMotion = event.matches; });

    /* ------------------------------------------------ Toast */
    function ensureToastStack() {
        let stack = document.querySelector('.au-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'au-toast-stack';
            document.body.appendChild(stack);
        }
        return stack;
    }

    function toast(message, type, duration) {
        type = type || 'info';
        duration = typeof duration === 'number' ? duration : 3000;
        const stack = ensureToastStack();
        const el = document.createElement('div');
        el.className = 'au-toast ' + type;
        el.textContent = message == null ? '' : String(message);
        stack.appendChild(el);
        const remove = function () {
            el.classList.add('au-toast-hide');
            setTimeout(function () { el.remove(); }, 320);
        };
        setTimeout(remove, duration);
        el.addEventListener('click', remove);
        return el;
    }

    /* ------------------------------------------------ Modal */
    const modalStack = [];
    const modalTimers = new WeakMap();
    const modalFocus = new WeakMap();

    function modalOpen(id) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el) return null;
        clearTimeout(modalTimers.get(el));
        if (!modalStack.includes(el)) {
            modalFocus.set(el, document.activeElement);
            modalStack.push(el);
        }
        el.classList.remove('au-leaving');
        el.classList.add('show');
        if (!el.dataset.auModalWired) {
            el.dataset.auModalWired = '1';
            el.addEventListener('click', function (e) {
                if (e.target === el) modalClose(el);
            });
        }
        const focusable = el.querySelector('input, select, textarea, button');
        if (focusable) modalTimers.set(el, setTimeout(function () { if (el.classList.contains('show')) focusable.focus(); }, 60));
        return el;
    }

    function modalClose(id) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el || !el.classList.contains('show')) return;
        clearTimeout(modalTimers.get(el));
        const idx = modalStack.indexOf(el);
        if (idx >= 0) modalStack.splice(idx, 1);
        const finish = function () {
            el.classList.remove('show');
            el.classList.remove('au-leaving');
            const previous = modalFocus.get(el);
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
        if (reduceMotion) { finish(); return; }
        el.classList.add('au-leaving');
        modalTimers.set(el, setTimeout(finish, 210));
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || modalStack.length === 0) return;
        modalClose(modalStack[modalStack.length - 1]);
    });

    /* Theme-aware confirmation; callers await an explicit decision before writing. */
    let confirmationOpen = false;
    function confirmAction(message, options = {}) {
        // Repeated clicks must not queue duplicate destructive operations.
        if (confirmationOpen) return Promise.resolve(false);
        confirmationOpen = true;
        const t = text => window.AppI18n?.t(text) || text;
        const previous = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'admin-confirm modal-content';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-labelledby', 'admin-confirm-title');
        dialog.setAttribute('aria-describedby', 'admin-confirm-message');
        dialog.innerHTML = '<div class="modal-header"><h3 class="modal-title" id="admin-confirm-title"></h3>' +
            '<button type="button" class="modal-close">&times;</button></div>' +
            '<div class="modal-body"><p class="admin-confirm-message" id="admin-confirm-message"></p></div>' +
            '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-decision="cancel" autofocus></button>' +
            '<button type="button" class="btn" data-decision="confirm"></button></div>';
        dialog.querySelector('.modal-title').textContent = t(options.title || '确认');
        dialog.querySelector('.admin-confirm-message').textContent = t(String(message ?? ''));
        dialog.querySelector('.modal-close').setAttribute('aria-label', t('关闭'));
        dialog.querySelector('[data-decision="cancel"]').textContent = t('取消');
        const accept = dialog.querySelector('[data-decision="confirm"]');
        accept.classList.add(options.danger ? 'btn-danger' : 'btn-primary');
        accept.textContent = t(options.confirmText || '确认');
        return new Promise(resolve => {
            let settled = false;
            function finish(accepted) {
                if (settled) return;
                settled = true;
                dialog.close();
                dialog.remove();
                confirmationOpen = false;
                if (previous?.isConnected) previous.focus({ preventScroll: true });
                resolve(accepted);
            }
            dialog.querySelector('.modal-close').addEventListener('click', () => finish(false));
            dialog.querySelector('[data-decision="cancel"]').addEventListener('click', () => finish(false));
            accept.addEventListener('click', () => finish(true));
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
            dialog.addEventListener('close', () => finish(false));
            // Escape must not also close an underlying edit/recycle-bin dialog.
            dialog.addEventListener('keydown', event => {
                event.stopPropagation();
                if (event.key !== 'Tab') return;
                const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
                const first = buttons[0], last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            });
            document.body.appendChild(dialog);
            dialog.showModal();
        });
    }

    /* ------------------------------------------------ 数字滚动 */
    function countUp(el, target, opts) {
        if (!el) return;
        opts = opts || {};
        const duration = opts.duration || 800;
        const formatter = opts.formatter || function (v) { return window.AppI18n?.formatNumber(Math.round(v)) || String(Math.round(v)); };
        const numeric = Number(target);
        if (!isFinite(numeric) || reduceMotion) {
            el.textContent = isFinite(numeric) ? formatter(numeric) : String(target);
            return;
        }
        const startTime = performance.now();
        function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = formatter(numeric * eased);
            if (reduceMotion) { el.textContent = formatter(numeric); return; }
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /* ------------------------------------------------ 行/卡片入场 */
    function staggerRows(container, selector, step) {
        if (!container || reduceMotion) return;
        selector = selector || 'tr';
        step = step || 25;
        const items = container.querySelectorAll(selector);
        for (let i = 0; i < items.length; i++) {
            items[i].classList.add('au-row-enter');
            items[i].style.animationDelay = Math.min(i * step, 500) + 'ms';
        }
    }

    function staggerCards(container, selector, step) {
        if (!container || reduceMotion) return;
        const items = container.querySelectorAll(selector || '.stat-card, .card');
        for (let i = 0; i < items.length; i++) {
            items[i].classList.add('au-card-enter');
            items[i].style.animationDelay = Math.min(i * (step || 60), 480) + 'ms';
        }
    }

    /* ------------------------------------------------ 骨架屏 */
    function skeleton(tbody, rows, cols) {
        if (!tbody) return;
        rows = rows || 5;
        cols = cols || (tbody.closest('table') ? tbody.closest('table').querySelectorAll('thead th').length : 4) || 4;
        let html = '';
        for (let r = 0; r < rows; r++) {
            html += '<tr class="au-skeleton-row">';
            for (let c = 0; c < cols; c++) {
                const width = 40 + ((r * 7 + c * 13) % 45);
                html += '<td><span class="au-skeleton-cell" style="width:' + width + '%"></span></td>';
            }
            html += '</tr>';
        }
        tbody.innerHTML = html;
    }

    function clearSkeleton(tbody) {
        if (!tbody) return;
        tbody.querySelectorAll('.au-skeleton-row').forEach(function (row) { row.remove(); });
    }

    /* ------------------------------------------------ 空状态 */
    function emptyState(opts) {
        opts = opts || {};
        const icon = opts.icon || 'ai-inbox';
        const title = opts.title || '暂无数据';
        const hint = opts.hint || '';
        return '<div class="au-empty">' +
            '<span class="au-empty-icon anticon"><svg aria-hidden="true"><use href="#' + icon + '"></use></svg></span>' +
            '<span class="au-empty-title">' + title + '</span>' +
            (hint ? '<span class="au-empty-hint">' + hint + '</span>' : '') +
            '</div>';
    }

    /* Shared Canvas renderer, also used by the public page and React login. */
    function initCanvas() {
        if (document.getElementById('bgCanvas')) return;
        window.MailMotion?.mount(document.getElementById('adminWeatherCanvas'), { variant: 'weather' });
        return window.MailMotion?.mount(document.getElementById('adminBgCanvas'), { variant: 'admin' });
    }

    /* ------------------------------------------------ 通用下拉菜单 */
    document.addEventListener('click', function (e) {
        const toggle = e.target.closest('.au-dropdown-toggle');
        if (toggle) {
            const dd = toggle.closest('.au-dropdown');
            const willOpen = dd && !dd.classList.contains('open');
            document.querySelectorAll('.au-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
            if (willOpen) dd.classList.add('open');
            e.stopPropagation();
            return;
        }
        // 点击菜单项后收起
        if (e.target.closest('.au-dropdown-item')) {
            document.querySelectorAll('.au-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
            return;
        }
        // 点击外部收起
        if (!e.target.closest('.au-dropdown-menu')) {
            document.querySelectorAll('.au-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
        }
    });

    window.AdminUI = {
        toast: toast,
        confirm: confirmAction,
        modal: { open: modalOpen, close: modalClose },
        countUp: countUp,
        staggerRows: staggerRows,
        staggerCards: staggerCards,
        skeleton: skeleton,
        clearSkeleton: clearSkeleton,
        emptyState: emptyState,
        initCanvas: initCanvas,
        get reduceMotion() { return reduceMotion; }
    };

    // 兜底：未删除本地 showToast 的页面仍用其本地版；已删除的页自动接入
    if (typeof window.showToast === 'undefined') {
        window.showToast = toast;
    }
})();
