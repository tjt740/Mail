/* Shared, decorative Canvas motion. No user content is read by the renderer. */
(function () {
    'use strict';
    const instances = new Map();
    const palettes = {
        clay: [201, 100, 66], ocean: [37, 99, 235], emerald: [5, 150, 105],
        violet: [124, 58, 237], rose: [225, 29, 72]
    };

    function mount(canvas, { variant = 'workspace' } = {}) {
        if (!canvas || !canvas.getContext) return null;
        if (instances.has(canvas)) return instances.get(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const coarse = window.matchMedia('(pointer: coarse)');
        const listeners = [];
        const particles = [];
        const ripples = [];
        const pointer = { x: 0, y: 0, active: false };
        let width = 0, height = 0, raf = null, last = 0, time = 0;
        let visible = true, suspended = false, destroyed = false;
        let targetColor = palettes[document.documentElement.dataset.colorTheme] || palettes.clay;
        let color = [...targetColor];
        const strength = variant === 'workspace' ? 0.65 : 1;
        const rgba = (alpha) => `rgba(${color.map(Math.round).join(',')},${alpha * strength})`;
        const on = (target, event, handler) => {
            target.addEventListener(event, handler, { passive: true });
            listeners.push(() => target.removeEventListener(event, handler));
        };

        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            // Keep the backing store bounded on large/Retina monitors.
            const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2400000 / (width * height))));
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.max(14, Math.min(coarse.matches ? 26 : 48, Math.round(width * height / 26000)));
            while (particles.length < count) particles.push({
                x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10, phase: Math.random() * Math.PI * 2,
                radius: 1.2 + Math.random() * 1.5
            });
            particles.length = count;
            render(0);
        }

        function render(dt) {
            time += dt;
            color = color.map((value, index) => value + (targetColor[index] - value) * (reduced.matches ? 1 : Math.min(1, dt * 5)));
            ctx.clearRect(0, 0, width, height);
            // Slowly drifting, layered light fields behind the page surfaces.
            for (let i = 0; i < 3; i++) {
                const x = width * (0.16 + i * 0.34) + Math.sin(time * 0.12 + i * 2) * width * 0.06;
                const y = height * (i % 2 ? 0.72 : 0.23) + Math.cos(time * 0.15 + i) * 35;
                const radius = Math.min(430, Math.max(width, height) * 0.4);
                const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
                glow.addColorStop(0, rgba(0.105));
                glow.addColorStop(0.5, rgba(0.035));
                glow.addColorStop(1, rgba(0));
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);
            }
            particles.forEach((p) => {
                p.x = (p.x + p.vx * dt / width + 1) % 1;
                p.y = (p.y + p.vy * dt / height + 1) % 1;
                const x = p.x * width, y = p.y * height;
                ctx.beginPath();
                ctx.arc(x, y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = rgba(0.25 + Math.sin(time + p.phase) * 0.08);
                ctx.fill();
                if (pointer.active && !reduced.matches) {
                    const distance = Math.hypot(x - pointer.x, y - pointer.y);
                    if (distance < 170) {
                        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(pointer.x, pointer.y);
                        ctx.strokeStyle = rgba(0.22 * (1 - distance / 170));
                        ctx.lineWidth = 0.8; ctx.stroke();
                    }
                }
            });
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i], b = particles[j];
                    const distance = Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
                    if (distance > 145) continue;
                    ctx.beginPath(); ctx.moveTo(a.x * width, a.y * height); ctx.lineTo(b.x * width, b.y * height);
                    ctx.strokeStyle = rgba(0.15 * (1 - distance / 145));
                    ctx.lineWidth = 0.7; ctx.stroke();
                }
            }
            // Small envelopes follow quiet orbital paths around the content.
            for (let i = 0; i < (coarse.matches ? 3 : 5); i++) {
                const x = width * (0.09 + i * 0.2) + Math.sin(time * 0.16 + i * 1.5) * 22;
                const y = height * (i % 2 ? 0.8 : 0.18) + Math.cos(time * 0.2 + i) * 18;
                ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 0.14 + i) * 0.14);
                ctx.strokeStyle = rgba(0.19); ctx.lineWidth = 1;
                ctx.strokeRect(-10, -7, 20, 14);
                ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(0, 1); ctx.lineTo(10, -7); ctx.stroke();
                ctx.restore();
            }
            for (let i = ripples.length - 1; i >= 0; i--) {
                const ripple = ripples[i]; ripple.age += dt;
                if (ripple.age >= 0.75) { ripples.splice(i, 1); continue; }
                const progress = ripple.age / 0.75;
                ctx.beginPath(); ctx.arc(ripple.x, ripple.y, 8 + 64 * (1 - Math.pow(1 - progress, 3)), 0, Math.PI * 2);
                ctx.strokeStyle = rgba(0.32 * (1 - progress)); ctx.lineWidth = 1.5; ctx.stroke();
            }
        }

        function canAnimate() { return !destroyed && !suspended && !document.hidden && visible && !reduced.matches; }
        function tick(now) {
            raf = null;
            if (!canAnimate()) return;
            const elapsed = now - last;
            if (!last || elapsed >= (coarse.matches ? 32 : 22)) {
                render(last ? Math.min(elapsed / 1000, 0.05) : 0);
                last = now;
            }
            raf = requestAnimationFrame(tick);
        }
        function stop() {
            if (raf !== null) cancelAnimationFrame(raf);
            raf = null; last = 0;
        }
        function update() {
            stop();
            if (destroyed || suspended || document.hidden || !visible) return;
            if (reduced.matches) { ripples.length = 0; pointer.active = false; render(0); }
            else raf = requestAnimationFrame(tick);
        }
        on(document, 'visibilitychange', update);
        on(reduced, 'change', update);
        on(coarse, 'change', () => { resize(); update(); });
        on(window, 'pagehide', () => { suspended = true; stop(); });
        on(window, 'pageshow', () => { suspended = false; update(); });
        on(window, 'pointermove', (event) => {
            if (coarse.matches || reduced.matches) return;
            const rect = canvas.getBoundingClientRect();
            pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.active = true;
        });
        on(document.documentElement, 'pointerleave', () => { pointer.active = false; });
        on(window, 'blur', () => { pointer.active = false; });
        on(document, 'click', (event) => {
            if (reduced.matches || !event.target.closest?.('button, .btn, [role="tab"]') || !event.detail) return;
            const rect = canvas.getBoundingClientRect();
            ripples.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, age: 0 });
            if (ripples.length > 4) ripples.shift();
        });
        const themeObserver = new MutationObserver(() => {
            targetColor = palettes[document.documentElement.dataset.colorTheme] || palettes.clay;
            if (reduced.matches) render(0);
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-theme'] });
        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        resizeObserver?.observe(canvas);
        if (!resizeObserver) on(window, 'resize', resize);
        const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting; update();
        }) : null;
        intersection?.observe(canvas);
        const controller = {
            destroy() {
                if (destroyed) return;
                destroyed = true; stop();
                listeners.forEach((remove) => remove());
                themeObserver.disconnect(); resizeObserver?.disconnect(); intersection?.disconnect();
                ctx.clearRect(0, 0, width, height);
                instances.delete(canvas);
            }
        };
        instances.set(canvas, controller);
        resize(); update();
        return controller;
    }
    const activeTransitions = new Map();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', () => {
        if (preference.matches) {
            activeTransitions.forEach((animation) => animation.cancel());
            activeTransitions.clear();
        }
    });
    function reveal(element, direction = 1) {
        if (!element || !element.animate || preference.matches) return;
        activeTransitions.get(element)?.cancel();
        const animation = element.animate([
            { opacity: 0, transform: `translateY(${direction * 8}px)` },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
        activeTransitions.set(element, animation);
        const finish = () => { if (activeTransitions.get(element) === animation) activeTransitions.delete(element); };
        animation.onfinish = finish;
        animation.oncancel = finish;
    }
    window.MailMotion = { mount, reveal };
})();
