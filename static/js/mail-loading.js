/* A small, theme-aware canvas that runs only while mail is being retrieved. */
(function () {
    'use strict';
    function create(canvas) {
        if (!canvas) return null;
        let ctx = null;
        try { ctx = canvas.getContext('2d'); } catch (_) { /* The status text remains available. */ }
        canvas.hidden = !ctx;
        const fallback = canvas.parentElement.querySelector('.mail-loading-fallback');
        if (fallback) fallback.hidden = !!ctx;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const coarse = matchMedia('(pointer: coarse)');
        let active = false, suspended = false, destroyed = false, raf = null;
        let width = 320, height = 140, time = 0, last = 0, frameCount = 0;
        let palette = window.MailThemes.get(document.documentElement.dataset.colorTheme);
        const cleanups = [];
        const on = (target, event, handler) => {
            target.addEventListener(event, handler);
            cleanups.push(() => target.removeEventListener(event, handler));
        };
        function roundedRect(x, y, w, h, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + w, y, x + w, y + h, radius);
            ctx.arcTo(x + w, y + h, x, y + h, radius);
            ctx.arcTo(x, y + h, x, y, radius);
            ctx.arcTo(x, y, x + w, y, radius);
            ctx.closePath();
        }
        function envelope(angle, opacity, ghost = false, tone = palette.primary) {
            const depth = Math.cos(angle), scale = .82 + (depth + 1) * .1;
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.translate(160 + Math.sin(angle) * 86, 69 + depth * 8);
            ctx.rotate(Math.sin(angle) * .2);
            ctx.scale(scale, scale);
            // The narrow edge and the offset spine make the turn read as a solid object.
            ctx.scale(.24 + Math.abs(depth) * .76, 1);
            ctx.fillStyle = tone;
            roundedRect(-33 + Math.sin(angle) * 5, -25, 66, 50, 10);
            ctx.fill();
            const surface = ctx.createLinearGradient(-33, -25, 33, 25);
            surface.addColorStop(0, tone);
            surface.addColorStop(1, palette.primary);
            ctx.fillStyle = surface;
            if (!ghost) { ctx.shadowColor = tone + '30'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; }
            roundedRect(-33, -25, 66, 50, 10);
            ctx.fill();
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            if (!ghost) {
                ctx.strokeStyle = palette.dark ? '#12283ca8' : '#ffffffe0';
                ctx.fillStyle = palette.dark ? '#10213018' : '#ffffff1c';
                ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(-29, -20); ctx.lineTo(0, 3); ctx.lineTo(29, -20);
                ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-29, 20); ctx.lineTo(-8, 2); ctx.lineTo(0, 8); ctx.lineTo(8, 2); ctx.lineTo(29, 20); ctx.closePath();
                ctx.fill();
                ctx.beginPath(); ctx.moveTo(-29, 20); ctx.lineTo(-8, 2); ctx.moveTo(8, 2); ctx.lineTo(29, 20); ctx.stroke();
            }
            ctx.restore();
        }
        function draw() {
            if (!ctx || destroyed) return;
            ctx.clearRect(0, 0, width, height);
            if (!active) return;
            frameCount++;
            ctx.save();
            const scale = Math.min(width / 320, height / 140);
            ctx.translate((width - 320 * scale) / 2, (height - 140 * scale) / 2);
            ctx.scale(scale, scale);
            const angles = [palette.primary, palette.companion, palette.highlight].map((tone, index) => ({
                angle: time * 1.7 + index * Math.PI * 2 / 3 - .35, tone
            }));
            if (!reduced.matches) {
                // Render short, translucent trails rather than accumulating old frames.
                ctx.filter = 'blur(3px)';
                for (let sample = 4; sample >= 1; sample--) {
                    angles.forEach(({angle, tone}) => envelope(angle - sample * .11, .035 + (4 - sample) * .022, true, tone));
                }
                ctx.filter = 'none';
            }
            angles.sort((a, b) => Math.cos(a.angle) - Math.cos(b.angle));
            angles.forEach(({angle, tone}) => envelope(angle, .72 + (Math.cos(angle) + 1) * .14, false, tone));
            ctx.restore();
        }
        function resize() {
            if (!ctx || destroyed) return;
            const rect = canvas.getBoundingClientRect();
            width = rect.width || 320; height = rect.height || 140;
            const ratio = Math.min(devicePixelRatio || 1, coarse.matches ? 1.5 : 2);
            canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            draw();
        }
        function canAnimate() { return !!ctx && active && !destroyed && !suspended && !document.hidden && !reduced.matches; }
        function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; last = 0; }
        function tick(now) {
            raf = null;
            if (!canAnimate()) return;
            const elapsed = last ? now - last : 0;
            if (!last || !coarse.matches || elapsed >= 32) {
                time += last ? Math.min(elapsed, 50) / 1000 : 0;
                last = now;
                draw();
            }
            raf = requestAnimationFrame(tick);
        }
        function sync() {
            stop();
            if (destroyed) return;
            palette = window.MailThemes.get(document.documentElement.dataset.colorTheme);
            resize();
            if (canAnimate()) raf = requestAnimationFrame(tick);
        }
        const sizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
        sizeObserver?.observe(canvas);
        if (!sizeObserver) on(window, 'resize', resize);
        const themeObserver = new MutationObserver(sync);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-theme'] });
        on(reduced, 'change', sync);
        on(coarse, 'change', sync);
        on(document, 'visibilitychange', sync);
        on(window, 'pagehide', () => { suspended = true; sync(); });
        on(window, 'pageshow', () => { suspended = false; sync(); });
        return {
            setActive(value) {
                if (destroyed || active === !!value) return;
                active = !!value;
                if (active) time = 0;
                sync();
            },
            get state() { return { active, animating: raf !== null, frameCount }; },
            destroy() {
                active = false; stop();
                if (ctx) ctx.clearRect(0, 0, width, height);
                destroyed = true;
                sizeObserver?.disconnect(); themeObserver.disconnect(); cleanups.forEach(remove => remove());
            }
        };
    }
    window.MailLoading = create(document.getElementById('mailLoadingCanvas')) || {};
    window.MailLoading.create = create;
})();
