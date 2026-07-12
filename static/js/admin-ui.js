/* ============================================================
   admin-ui.js — 后台共享交互层（window.AdminUI）
   在 i18n.js 之后、各页 block scripts 之前加载。
   页面内的同名局部函数（如 showToast 声明）会遮蔽这里的兜底，
   翻新到某页时应删除该页的本地副本。
   ============================================================ */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    function modalOpen(id) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el) return null;
        el.classList.remove('au-leaving');
        el.classList.add('show');
        modalStack.push(el);
        if (!el.dataset.auModalWired) {
            el.dataset.auModalWired = '1';
            el.addEventListener('mousedown', function (e) {
                if (e.target === el) modalClose(el);
            });
        }
        const focusable = el.querySelector('input, select, textarea, button');
        if (focusable) setTimeout(function () { try { focusable.focus(); } catch (e) { /* noop */ } }, 60);
        return el;
    }

    function modalClose(id) {
        const el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el || !el.classList.contains('show')) return;
        const idx = modalStack.indexOf(el);
        if (idx >= 0) modalStack.splice(idx, 1);
        if (reduceMotion) {
            el.classList.remove('show');
            return;
        }
        el.classList.add('au-leaving');
        setTimeout(function () {
            el.classList.remove('show');
            el.classList.remove('au-leaving');
        }, 150);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || modalStack.length === 0) return;
        modalClose(modalStack[modalStack.length - 1]);
    });

    /* ------------------------------------------------ 数字滚动 */
    function countUp(el, target, opts) {
        if (!el) return;
        opts = opts || {};
        const duration = opts.duration || 800;
        const formatter = opts.formatter || function (v) { return String(Math.round(v)); };
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

    /* ------------------------------------------------ 背景粒子 canvas */
    function initCanvas(opts) {
        const canvas = document.getElementById('adminBgCanvas');
        // 前台页有自己的 #bgCanvas，双重背景没有意义
        if (!canvas || !canvas.getContext || document.getElementById('bgCanvas')) return;
        opts = opts || {};
        const ctx = canvas.getContext('2d');
        const RGB = opts.rgb || '201, 100, 66';
        const dotAlpha = opts.dotAlpha || 0.25;
        const lineAlpha = opts.lineAlpha || 0.12;

        let width = 0;
        let height = 0;
        let particles = [];
        let rafId = null;

        function resize() {
            const dpr = window.devicePixelRatio || 1;
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const target = Math.max(12, Math.min(30, Math.floor(width / 48)));
            while (particles.length < target) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    r: 1.1 + Math.random() * 1.6
                });
            }
            particles.length = target;
        }

        function drawFrame() {
            ctx.clearRect(0, 0, width, height);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -20) p.x = width + 20; else if (p.x > width + 20) p.x = -20;
                if (p.y < -20) p.y = height + 20; else if (p.y > height + 20) p.y = -20;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + RGB + ', ' + dotAlpha + ')';
                ctx.fill();
            }
            const linkDistance = 110;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.hypot(dx, dy);
                    if (dist >= linkDistance) continue;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = 'rgba(' + RGB + ', ' + (lineAlpha * (1 - dist / linkDistance)) + ')';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        function loop() {
            drawFrame();
            rafId = requestAnimationFrame(loop);
        }

        function start() {
            if (rafId === null && !reduceMotion) rafId = requestAnimationFrame(loop);
        }

        function stop() {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }

        let resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                resize();
                if (reduceMotion) drawFrame();
            }, 150);
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stop(); else start();
        });

        resize();
        if (reduceMotion) {
            drawFrame();
        } else {
            start();
        }
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
        modal: { open: modalOpen, close: modalClose },
        countUp: countUp,
        staggerRows: staggerRows,
        staggerCards: staggerCards,
        skeleton: skeleton,
        clearSkeleton: clearSkeleton,
        emptyState: emptyState,
        initCanvas: initCanvas,
        reduceMotion: reduceMotion
    };

    // 兜底：未删除本地 showToast 的页面仍用其本地版；已删除的页自动接入
    if (typeof window.showToast === 'undefined') {
        window.showToast = toast;
    }
})();
