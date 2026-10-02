/* Decorative public mailbox scenes: no mail content or credentials enter the renderer. */
(function () {
    'use strict';
    const root = document.documentElement;
    const hero = document.querySelector('.scene-hero');
    if (!hero) return;
    const modes = ['day', 'night', 'rain'];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = matchMedia('(pointer: coarse)');
    const colorScheme = matchMedia('(prefers-color-scheme: dark)');
    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
    };
    let scene = modes.includes(storage.get('mailScene')) ? storage.get('mailScene') : (colorScheme.matches ? 'night' : 'day');
    let destroyed = false, suspended = false, raf = null, last = 0, time = 0, frameCount = 0;
    const weights = Object.fromEntries(modes.map(mode => [mode, mode === scene ? 1 : 0]));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const cleanups = [];
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), z: .2 + Math.random() * .8, phase: Math.random() * Math.PI * 2 }));
    const rain = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), z: .25 + Math.random() * .75 }));
    const dust = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), phase: Math.random() * 6.28 }));
    const ripples = Array.from({ length: 9 }, (_, index) => ({ x: .08 + Math.random() * .84, y: .72 + Math.random() * .25, phase: index / 9 }));
    const on = (target, type, handler, options = { passive: true }) => {
        target.addEventListener(type, handler, options);
        cleanups.push(() => target.removeEventListener(type, handler, options));
    };
    function layer(id, maxPixels) {
        const canvas = document.getElementById(id);
        const ctx = canvas?.getContext('2d');
        return ctx ? { canvas, ctx, width: 1, height: 1, maxPixels, skies: {} } : null;
    }
    const backdrop = layer('bgCanvas', 1800000);
    const foreground = layer('sceneCanvas', 650000);
    const layers = [backdrop, foreground].filter(Boolean);
    const palette = {
        day: { top: '#e3edf9', bottom: '#f4f6fa', glow: 'rgba(255,219,164,.55)', glowEnd: 'rgba(255,219,164,0)', rgb: '100,146,207' },
        night: { top: '#101a34', bottom: '#0c1526', glow: 'rgba(111,116,219,.2)', glowEnd: 'rgba(111,116,219,0)', rgb: '170,194,250' },
        rain: { top: '#112a38', bottom: '#0c1b29', glow: 'rgba(83,156,180,.16)', glowEnd: 'rgba(83,156,180,0)', rgb: '151,209,225' }
    };
    // Small cached soft sprites avoid allocating gradients for each particle/frame.
    function glowSprite(rgb) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, `rgba(${rgb},.8)`); g.addColorStop(.3, `rgba(${rgb},.3)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return canvas;
    }
    const glows = { day: glowSprite('255,255,255'), night: glowSprite('123,143,242'), rain: glowSprite('107,184,205') };
    function resizeLayer(l) {
        const rect = l.canvas.getBoundingClientRect();
        l.width = Math.max(1, rect.width); l.height = Math.max(1, rect.height);
        const ratio = Math.min(devicePixelRatio || 1, coarse.matches ? 1.25 : 1.75, Math.sqrt(l.maxPixels / (l.width * l.height)));
        l.canvas.width = Math.max(1, Math.round(l.width * ratio)); l.canvas.height = Math.max(1, Math.round(l.height * ratio));
        l.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (l === backdrop) modes.forEach(mode => {
            const sky = document.createElement('canvas'); sky.width = l.canvas.width; sky.height = l.canvas.height;
            const ctx = sky.getContext('2d');
            if (!ctx) return;
            const gradient = ctx.createLinearGradient(0, 0, 0, sky.height);
            gradient.addColorStop(0, palette[mode].top); gradient.addColorStop(1, palette[mode].bottom);
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, sky.width, sky.height);
            const glow = ctx.createRadialGradient(sky.width * .8, sky.height * .08, 0, sky.width * .8, sky.height * .08, sky.width * .65);
            glow.addColorStop(0, palette[mode].glow); glow.addColorStop(1, palette[mode].glowEnd);
            ctx.fillStyle = glow; ctx.fillRect(0, 0, sky.width, sky.height);
            l.skies[mode] = sky;
        });
    }
    function drawSky(l) {
        const { ctx, width: w, height: h } = l;
        ctx.clearRect(0, 0, w, h);
        if (l === backdrop) {
            // Additive compositing makes the weighted crossfade sum to an opaque sky.
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            modes.forEach(mode => { if (l.skies[mode] && weights[mode] > .001) { ctx.globalAlpha = weights[mode]; ctx.drawImage(l.skies[mode], 0, 0, w, h); } });
            ctx.restore();
        }
        modes.forEach(mode => {
            if (weights[mode] < .001) return;
            ctx.save(); ctx.globalAlpha = weights[mode];
            const rgb = palette[mode].rgb;
            if (mode === 'day') drawDay(l, rgb);
            else drawNight(l, rgb, mode === 'rain');
            ctx.restore();
        });
    }
    function drawDay(l, rgb) {
        const { ctx, width: w, height: h } = l;
        const alpha = ctx.globalAlpha;
        const sunX = w * .88 + pointer.x * 6, sunY = l === foreground ? 42 : h * .13;
        ctx.fillStyle = 'rgba(246,198,124,.4)'; ctx.beginPath(); ctx.arc(sunX, sunY, l === foreground ? 20 : 36, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(236,185,112,.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sunX, sunY, l === foreground ? 29 : 48, 0, Math.PI * 2); ctx.stroke();
        if (glows.day) for (let i = 0; i < 4; i++) {
            const size = l === foreground ? 250 : 520;
            const x = w * (i / 3) + Math.sin(time * .07 + i * 2) * 40;
            const y = h * (.1 + (i % 2) * .4);
            ctx.globalAlpha = alpha * .55;
            ctx.drawImage(glows.day, x - size / 2, y - size / 5, size, size * .4);
        }
        ctx.globalAlpha = alpha;
        for (const p of dust.slice(0, coarse.matches ? 18 : 36)) {
            const x = ((p.x + time * (.003 + p.z * .004)) % 1) * w + pointer.x * p.z * 9;
            const y = p.y * h + Math.sin(time * .4 + p.phase) * 10;
            ctx.fillStyle = `rgba(${rgb},${.15 + p.z * .2})`; ctx.beginPath(); ctx.arc(x, y, 1 + p.z, 0, Math.PI * 2); ctx.fill();
        }
    }
    function drawNight(l, rgb, isRain) {
        const { ctx, width: w, height: h } = l;
        const alpha = ctx.globalAlpha;
        const glow = glows[isRain ? 'rain' : 'night'];
        if (glow) {
            ctx.globalAlpha = alpha * .38;
            ctx.drawImage(glow, w * .48 + Math.sin(time * .09) * 30, -h * .45, w * .7, h * 1.4);
            ctx.globalAlpha = alpha;
        }
        const moonX = w * .88 + pointer.x * 5, moonY = l === foreground ? 42 : h * .13;
        ctx.fillStyle = isRain ? 'rgba(183,218,231,.25)' : 'rgba(223,234,255,.8)';
        ctx.beginPath(); ctx.arc(moonX, moonY, l === foreground ? 16 : 24, 0, Math.PI * 2); ctx.fill();
        if (!isRain) {
            for (const s of stars.slice(0, coarse.matches ? 50 : 140)) {
                const opacity = .25 + .4 * (.5 + .5 * Math.sin(time * .7 + s.phase));
                ctx.fillStyle = `rgba(${rgb},${opacity})`;
                ctx.beginPath(); ctx.arc(s.x * w + pointer.x * s.z * 12, s.y * h + pointer.y * s.z * 7, .45 + s.z * 1.1, 0, Math.PI * 2); ctx.fill();
            }
            // One unhurried shooting star per 16-second cycle, with a soft trail.
            const progress = (time % 16) / 2.2;
            if (progress < 1) {
                const x = w * (.48 + progress * .3), y = h * (.12 + progress * .26);
                ctx.strokeStyle = `rgba(${rgb},${Math.sin(progress * Math.PI) * .45})`;
                ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 52, y - 19); ctx.stroke();
            }
        } else {
            const count = coarse.matches ? 45 : 120;
            for (let i = 0; i < count; i++) {
                const p = rain[i], speed = 110 + p.z * 230;
                const y = (p.y * (h + 40) + time * speed) % (h + 40) - 20;
                const x = ((p.x * w - time * (20 + p.z * 20)) % (w + 40) + w + 40) % (w + 40) - 20;
                ctx.strokeStyle = `rgba(${rgb},${.12 + p.z * .22})`; ctx.lineWidth = .5 + p.z * .7;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3 - p.z * 3, y + 9 + p.z * 16); ctx.stroke();
            }
            for (const ripple of ripples) {
                const p = (time * .45 + ripple.phase) % 1;
                ctx.strokeStyle = `rgba(${rgb},${(1 - p) * .2})`; ctx.lineWidth = .7;
                ctx.beginPath(); ctx.ellipse(ripple.x * w, ripple.y * h, 2 + p * 26, 1 + p * 6, 0, 0, Math.PI * 2); ctx.stroke();
            }
        }
    }
    function drawOrbits(l) {
        const { ctx, width: w, height: h } = l;
        const cx = w * (w < 560 ? .83 : .76), cy = h * .53;
        const radius = Math.min(w * .24, h * .83);
        const angle = time * .11;
        const project = (a, ring) => {
            const x = Math.cos(a) * radius, y = Math.sin(a) * radius * .34;
            const z = Math.sin(a) * radius * .75;
            const depth = 650 / (650 - z);
            const tilt = ring ? .42 : -.3;
            return { x: cx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * depth + pointer.x * depth * 5,
                y: cy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * depth + pointer.y * 4, depth };
        };
        const dark = weights.night + weights.rain;
        const rgb = dark > .5 ? '159,193,237' : '124,159,211';
        for (let ring = 0; ring < 2; ring++) {
            ctx.beginPath();
            for (let n = 0; n <= 80; n++) {
                const p = project(n / 80 * Math.PI * 2, ring);
                n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
            }
            ctx.strokeStyle = `rgba(${rgb},.16)`; ctx.lineWidth = .7; ctx.stroke();
            for (let i = 0; i < 4; i++) {
                const p = project(angle * (ring ? -1 : 1) + i * Math.PI / 2, ring);
                ctx.fillStyle = `rgba(${rgb},${.3 + (p.depth - .7) * .5})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, 2.1 * p.depth, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
    function render(dt) {
        time += dt; frameCount++;
        const easing = 1 - Math.exp(-dt * 4);
        const still = reduced.matches;
        modes.forEach(mode => { weights[mode] += ((mode === scene ? 1 : 0) - weights[mode]) * (still ? 1 : easing); });
        pointer.x += (pointer.tx - pointer.x) * (still ? 1 : easing);
        pointer.y += (pointer.ty - pointer.y) * (still ? 1 : easing);
        hero.style.setProperty('--scene-tilt-x', `${still ? 0 : pointer.x * 10}deg`);
        hero.style.setProperty('--scene-tilt-y', `${still ? 0 : -pointer.y * 7}deg`);
        layers.forEach(drawSky);
        if (foreground) drawOrbits(foreground);
    }
    function canAnimate() { return !destroyed && !reduced.matches && !document.hidden && !suspended && layers.length > 0; }
    function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; last = 0; }
    function tick(now) {
        raf = null;
        if (!canAnimate()) return;
        const elapsed = last ? now - last : 0;
        if (!last || !coarse.matches || elapsed >= 32) { render(last ? Math.min(elapsed / 1000, .05) : 0); last = now; }
        raf = requestAnimationFrame(tick);
    }
    function update() {
        stop();
        root.dataset.sceneRunning = String(canAnimate());
        if (destroyed) return;
        render(0);
        if (canAnimate()) raf = requestAnimationFrame(tick);
    }
    function setScene(mode, persist = true) {
        if (!modes.includes(mode) || destroyed) return;
        scene = mode;
        root.dataset.mailScene = mode;
        document.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === mode)));
        if (persist) storage.set('mailScene', mode);
        update();
    }
    document.querySelectorAll('[data-scene]').forEach(button => on(button, 'click', () => setScene(button.dataset.scene)));
    on(hero, 'pointermove', event => {
        if (coarse.matches || reduced.matches) return;
        const rect = hero.getBoundingClientRect();
        pointer.tx = (event.clientX - rect.left) / rect.width * 2 - 1;
        pointer.ty = (event.clientY - rect.top) / rect.height * 2 - 1;
    });
    on(hero, 'pointerleave', () => { pointer.tx = pointer.ty = 0; });
    on(window, 'blur', () => { pointer.tx = pointer.ty = 0; });
    on(document, 'visibilitychange', update);
    on(window, 'pagehide', () => { suspended = true; update(); });
    on(window, 'pageshow', () => { suspended = false; update(); });
    on(reduced, 'change', update);
    on(colorScheme, 'change', () => { if (!modes.includes(storage.get('mailScene'))) setScene(colorScheme.matches ? 'night' : 'day', false); });
    on(window, 'storage', event => {
        if (event.key === 'mailScene') setScene(modes.includes(event.newValue) ? event.newValue : (colorScheme.matches ? 'night' : 'day'), false);
    });
    function resize() { if (!destroyed) { layers.forEach(resizeLayer); render(0); } }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (observer) layers.forEach(l => observer.observe(l.canvas));
    else on(window, 'resize', resize);
    on(coarse, 'change', resize);
    window.MailScene = {
        setScene,
        get state() { return { scene, animating: canAnimate(), frameCount }; },
        destroy() {
            destroyed = true; stop(); observer?.disconnect(); cleanups.forEach(remove => remove());
            root.dataset.sceneRunning = 'false';
            layers.forEach(l => { l.ctx.clearRect(0, 0, l.width, l.height); l.skies = {}; });
        }
    };
    resize(); setScene(scene, false);
})();
