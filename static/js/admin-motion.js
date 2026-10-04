/* Administrative decoration: bounded Canvas rendering and light 3D pointer feedback. */
(function () {
    'use strict';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = matchMedia('(pointer: coarse)');
    const scenes = new Map();
    function mountScene(canvas) {
        if (!canvas?.getContext) return null;
        if (scenes.has(canvas)) return scenes.get(canvas);
        let ctx;
        try { ctx = canvas.getContext('2d'); } catch (_) { return null; }
        if (!ctx) return null;
        let width = 1, height = 1, frame = null, last = 0, time = 0, visible = true, suspended = false, destroyed = false, frames = 0;
        const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
        const listeners = [];
        let theme = document.documentElement.dataset.colorTheme;
        let palette = window.MailThemes?.get(theme);
        const themeObserver = new MutationObserver(() => { theme = document.documentElement.dataset.colorTheme; palette = window.MailThemes?.get(theme); if (reduced.matches) draw(0); });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-theme'] });
        const on = (target, event, callback) => { target.addEventListener(event, callback, { passive: true }); listeners.push(() => target.removeEventListener(event, callback)); };
        function project(x, y, z) {
            const angle = time * .16 + pointer.x;
            const c = Math.cos(angle), s = Math.sin(angle);
            const xx = x * c + z * s, zz = z * c - x * s;
            const tilt = -.24 + pointer.y;
            const yy = y * Math.cos(tilt) - zz * Math.sin(tilt), depth = y * Math.sin(tilt) + zz * Math.cos(tilt);
            const scale = 440 / (440 + depth);
            return { x: width * .73 + xx * scale, y: height * .52 + yy * scale, scale, depth };
        }
        function draw(dt) {
            frames++; time += dt;
            pointer.x += (pointer.tx - pointer.x) * .06; pointer.y += (pointer.ty - pointer.y) * .06;
            ctx.clearRect(0, 0, width, height);
            window.MailMotion?.drawWeather(ctx, width, height, time, theme, { hero: true, coarse: coarse.matches });
            if (theme === 'rain') return;
            const radius = Math.min(height * .65, width * .24, 170);
            const glow = ctx.createRadialGradient(width * .73, height * .5, 0, width * .73, height * .5, radius * 1.5);
            glow.addColorStop(0, 'rgba(237,161,106,.15)'); glow.addColorStop(1, 'rgba(237,161,106,0)');
            ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
            for (let ring = 0; ring < 3; ring++) {
                ctx.beginPath();
                for (let n = 0; n <= 100; n++) {
                    const t = n / 100 * Math.PI * 2;
                    const p = project(Math.cos(t) * radius, Math.sin(t) * radius * Math.cos(ring * Math.PI / 3), Math.sin(t) * radius * Math.sin(ring * Math.PI / 3));
                    if (!n) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                }
                ctx.strokeStyle = (palette ? [palette.cyan,palette.violet,palette.gold][ring] : '#e0b082') + '55'; ctx.lineWidth = 1; ctx.stroke();
            }
            const points = Array.from({ length: coarse.matches ? 18 : 30 }, (_, i) => {
                const y = 1 - (i + .5) / (coarse.matches ? 18 : 30) * 2;
                const r = Math.sqrt(1 - y * y), a = i * 2.399963;
                return { ...project(Math.cos(a) * r * radius, y * radius, Math.sin(a) * r * radius), i };
            }).sort((a, b) => b.depth - a.depth);
            points.forEach(p => {
                const alpha = Math.max(.16, .6 - p.depth / (radius * 3));
                ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.scale, p.scale);
                const ink = palette ? [palette.cyan,palette.gold,palette.violet,palette.mint][p.i%4] : '#f4c38d';
                ctx.globalAlpha = alpha;
                ctx.fillStyle = ink;
                if (p.i % 5 === 0) {
                    ctx.rotate(Math.sin(time * .3 + p.i) * .18);
                    ctx.fillStyle = palette?.surface || '#243133'; ctx.fillRect(-9, -6, 18, 12);
                    ctx.strokeStyle = ink; ctx.lineWidth = 1;
                    ctx.strokeRect(-9, -6, 18, 12); ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(0, 1); ctx.lineTo(9, -6); ctx.stroke();
                } else { ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            });
        }
        function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = 0; }
        function allowed() { return !destroyed && !suspended && !document.hidden && visible && !reduced.matches; }
        function tick(now) {
            frame = null; if (!allowed()) return;
            if (!last || now - last >= (coarse.matches ? 48 : 32)) { draw(last ? Math.min((now-last)/1000, .07) : 0); last = now; }
            frame = requestAnimationFrame(tick);
        }
        function update() { stop(); if (destroyed || suspended || document.hidden || !visible) return; if (reduced.matches) draw(0); else frame = requestAnimationFrame(tick); }
        function resize() {
            const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
            const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(1200000 / (width * height)));
            canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(0);
        }
        on(canvas.parentElement, 'pointermove', event => { if (coarse.matches || reduced.matches) return; const rect = canvas.getBoundingClientRect(); pointer.tx = (event.clientX - rect.left - width/2) / width * .65; pointer.ty = (event.clientY - rect.top - height/2) / height * .25; });
        on(canvas.parentElement, 'pointerleave', () => { pointer.tx = pointer.ty = 0; });
        on(reduced, 'change', update); on(coarse, 'change', update); on(document, 'visibilitychange', update);
        on(window, 'pagehide', () => { suspended = true; stop(); }); on(window, 'pageshow', () => { suspended = false; update(); });
        const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
        const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }); intersection.observe(canvas);
        const controller = { get frameCount() { return frames; }, get animating() { return frame !== null; }, destroy() { destroyed = true; stop(); listeners.forEach(fn => fn()); themeObserver.disconnect(); resizeObserver.disconnect(); intersection.disconnect(); scenes.delete(canvas); } };
        scenes.set(canvas, controller); resize(); update(); return controller;
    }
    let active = null, tiltFrame = null, targetX = 0, targetY = 0;
    function clearDepth() {
        if (tiltFrame !== null) cancelAnimationFrame(tiltFrame); tiltFrame = null;
        if (active) { active.style.removeProperty('--depth-x'); active.style.removeProperty('--depth-y'); active.removeAttribute('data-depth-active'); } active = null;
    }
    document.addEventListener('pointermove', event => {
        if (reduced.matches || coarse.matches || document.hidden) return;
        const card = event.target.closest?.('.depth-card, .stat-card');
        if (card !== active) { clearDepth(); active = card; }
        if (!active) return;
        const rect = active.getBoundingClientRect(); targetX = -(event.clientY-rect.top-rect.height/2)/rect.height*5; targetY = (event.clientX-rect.left-rect.width/2)/rect.width*5;
        if (tiltFrame !== null) return;
        tiltFrame = requestAnimationFrame(() => { tiltFrame = null; if (!active) return; active.setAttribute('data-depth-active', 'true'); active.style.setProperty('--depth-x', `${targetX}deg`); active.style.setProperty('--depth-y', `${targetY}deg`); });
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', clearDepth);
    window.addEventListener('blur', clearDepth); window.addEventListener('pagehide', clearDepth);
    reduced.addEventListener('change', clearDepth); coarse.addEventListener('change', clearDepth); document.addEventListener('visibilitychange', clearDepth);
    window.AdminMotion = { mountScene };
})();
