/* Shared, decorative Canvas motion. No user content is read by the renderer. */
(function () {
    'use strict';
    const instances = new Map();
    const palettes = {
        clay: [201, 100, 66], ocean: [37, 99, 235], emerald: [5, 150, 105],
        violet: [124, 58, 237], rose: [225, 29, 72],
        sunny: [38, 120, 206], night: [163, 175, 255], rain: [104, 216, 224]
    };

    // Stable per-drop seeds avoid flicker; every new fall gets a different starting point.
    const rainFields = new WeakMap();
    const fraction = value => value - Math.floor(value);
    const rainNoise = seed => fraction(Math.sin(seed * 127.1 + 311.7) * 43758.5453);
    function windAt(time) {
        return 74 + 68 * Math.sin(time * .53) + 34 * Math.sin(time * 1.37 + 1.1) + 46 * Math.sin(time * .19 + 2.4);
    }
    function windTravel(time) {
        return 74 * time - 68 / .53 * Math.cos(time * .53) - 34 / 1.37 * Math.cos(time * 1.37 + 1.1) - 46 / .19 * Math.cos(time * .19 + 2.4);
    }
    function drawRain(ctx, width, height, time, { hero, coarse }) {
        const count = Math.min(coarse ? 64 : 170, Math.max(coarse ? 32 : 64, Math.round(width * height / (hero ? 2300 : 8500))));
        let drops = rainFields.get(ctx);
        if (!drops || drops.length !== count) {
            drops = Array.from({ length: count }, (_, i) => {
                const depth = .28 + rainNoise(i + 3) * .72;
                return { seed: i + 1, depth, phase: rainNoise(i + 71), speed: 180 + depth * 370 + rainNoise(i + 29) * 140,
                    length: 9 + depth * 23 + rainNoise(i + 47) * 11, alpha: .07 + depth * .2, width: .45 + depth * .9 };
            });
            rainFields.set(ctx, drops);
        }
        const wind = windAt(time);
        // Low, wind-driven banks of mist, stretched horizontally rather than a full-screen blur.
        const mistCount = coarse ? 2 : 3;
        for (let i = 0; i < mistCount; i++) {
            const x = width * (.18 + i * .36) + Math.sin(time * .17 + i * 2.3) * width * .2;
            const y = height * (.2 + i * .28) + Math.sin(time * .23 + i) * height * .06;
            const radius = Math.max(90, Math.min(width * .48, 520));
            ctx.save(); ctx.translate(x, y); ctx.scale(1, hero ? .28 : .4);
            const mist = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            const opacity = (hero ? .11 : .055) * (.75 + Math.sin(time * .31 + i) * .25);
            mist.addColorStop(0, `rgba(130,181,201,${opacity})`);
            mist.addColorStop(1, 'rgba(130,181,201,0)');
            ctx.fillStyle = mist; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
        }
        ctx.lineCap = 'round';
        drops.forEach(drop => {
            const period = (height + 100) / drop.speed;
            const clock = time / period + drop.phase;
            const cycle = Math.floor(clock);
            const age = fraction(clock) * period;
            const y = -50 + fraction(clock) * (height + 100);
            const drift = (windTravel(time) - windTravel(time - age)) * drop.depth;
            const span = width + 240;
            const x = fraction(rainNoise(drop.seed + cycle * 19.73) + drift / span) * span - 120;
            const turbulence = Math.sin(time * 2.7 + drop.seed * 1.9) * 13;
            const slant = (wind * drop.depth + turbulence) / drop.speed;
            const length = drop.length * (1 + Math.abs(wind) / 850);
            // Slowly moving showers create dense patches and gaps, without blinking drops.
            const shower = .63 + .37 * Math.sin(x / Math.max(width, 1) * 5.7 - time * .72 + drop.phase);
            ctx.strokeStyle = `rgba(169,215,237,${drop.alpha * shower * (hero ? 1.3 : 1)})`;
            ctx.lineWidth = drop.width;
            ctx.beginPath(); ctx.moveTo(x - slant * length, y - length); ctx.lineTo(x, y); ctx.stroke();
        });
        // Staggered impacts in a shallow ground plane. Positions change between rain cycles.
        const impacts = coarse ? 5 : hero ? 14 : 18;
        for (let i = 0; i < impacts; i++) {
            const clock = time * (.42 + rainNoise(i + 301) * .55) + rainNoise(i + 401);
            const cycle = Math.floor(clock), age = fraction(clock);
            if (age > .68) continue;
            const progress = age / .68;
            const x = rainNoise(i + cycle * 31.7 + 501) * width;
            const y = height * (.77 + rainNoise(i + cycle * 13.1 + 601) * .2);
            const radius = 2 + progress * (10 + rainNoise(i + 701) * 15);
            ctx.lineWidth = .6;
            ctx.strokeStyle = `rgba(157,215,226,${Math.sin(progress * Math.PI) * (hero ? .23 : .14)})`;
            ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .22, 0, 0, Math.PI * 2); ctx.stroke();
            if (progress < .3) {
                const splash = Math.sin(progress / .3 * Math.PI) * 5;
                ctx.beginPath(); ctx.moveTo(x - 3, y - splash); ctx.lineTo(x, y); ctx.lineTo(x + 3 + wind * .015, y - splash * .75); ctx.stroke();
            }
        }
    }

    function drawWeather(ctx, width, height, time, scene, { hero = false, coarse = false } = {}) {
        if (!['sunny', 'night', 'rain'].includes(scene)) return;
        ctx.save();
        if (scene === 'rain') {
            drawRain(ctx, width, height, time, { hero, coarse });
        } else if (scene === 'night') {
            for (let i=0; i < (coarse ? 18 : 36); i++) {
                const x = (i * 137.5 + 43) % width, y = (i * 83.7 + 23) % height;
                ctx.fillStyle = `rgba(225,226,255,${.2 + (1 + Math.sin(time*.6+i))*.17})`;
                ctx.beginPath(); ctx.arc(x,y,i%5===0?1.6:.8,0,Math.PI*2); ctx.fill();
            }
        }
        if (scene !== 'rain') {
            const x = width * .87, y = hero ? height*.28 : height*.12, radius = hero ? 21 : 30;
            const glow = ctx.createRadialGradient(x,y,0,x,y,radius*3.2);
            glow.addColorStop(0,scene==='sunny'?'rgba(255,211,107,.55)':'rgba(220,210,255,.2)'); glow.addColorStop(1,'rgba(220,210,255,0)');
            ctx.fillStyle=glow;ctx.fillRect(x-radius*3.2,y-radius*3.2,radius*6.4,radius*6.4);
            ctx.fillStyle=scene==='sunny'?'#ffe5a0':'#e4defa';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
            if(scene==='sunny') {
                ctx.fillStyle='rgba(255,255,255,.3)';
                for(let i=0;i<3;i++){const xx=width*(.55+i*.15)+Math.sin(time*.08+i)*12;ctx.beginPath();ctx.ellipse(xx,height*.23+i*12,38,9,0,0,Math.PI*2);ctx.fill();}
            }
        }
        ctx.restore();
    }

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
        const readGradientColors = () => {
            const theme = window.MailThemes?.get(document.documentElement.dataset.colorTheme);
            return (theme ? [theme.primary, theme.mint, theme.violet, theme.coral] : ['#c96442', '#168364', '#7851c2', '#c45869'])
                .map(hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)));
        };
        let targetGradientColors = readGradientColors();
        let gradientColors = targetGradientColors.map(value => [...value]);
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
            // Four overlapping color fields flow on the existing, bounded Canvas loop.
            if (variant === 'admin') {
                const blend = reduced.matches ? 1 : Math.min(1, dt * 3);
                gradientColors = gradientColors.map((rgb, i) => rgb.map((value, channel) => value + (targetGradientColors[i][channel] - value) * blend));
                const positions = [[.12, .08], [.82, .2], [.18, .85], [.88, .88]];
                gradientColors.forEach((rgb, i) => {
                    const x = width * (positions[i][0] + Math.sin(time * .14 + i * 1.7) * .18);
                    const y = height * (positions[i][1] + Math.cos(time * .12 + i * 2.1) * .14);
                    const radius = Math.min(900, Math.max(width, height) * (.62 + Math.sin(time * .1 + i) * .06));
                    const ink = rgb.map(Math.round).join(',');
                    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
                    glow.addColorStop(0, `rgba(${ink},.30)`);
                    glow.addColorStop(.45, `rgba(${ink},.14)`);
                    glow.addColorStop(1, `rgba(${ink},0)`);
                    ctx.fillStyle = glow;
                    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                });
            }
            for (let i = 0; variant !== 'admin' && i < 3; i++) {
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
            drawWeather(ctx, width, height, time, document.documentElement.dataset.colorTheme, { coarse: coarse.matches });
            // Let the weather fill the rainy workspace; orbital particles belong to the other scenes.
            if (document.documentElement.dataset.colorTheme === 'rain') { ripples.length = 0; return; }
            if (variant === 'admin') {
                // Three tilted orbital paths add depth without another animation loop.
                for (let orbit = 0; orbit < 3; orbit++) {
                    ctx.save();
                    ctx.translate(width * (orbit % 2 ? .85 : .12), height * (.25 + orbit * .25));
                    ctx.rotate(time * .025 + orbit * .9);
                    ctx.scale(1, .38 + orbit * .08);
                    ctx.beginPath(); ctx.arc(0, 0, 80 + orbit * 30, 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(.09); ctx.lineWidth = 1; ctx.stroke();
                    const angle = time * .22 + orbit * 2;
                    ctx.beginPath(); ctx.arc(Math.cos(angle) * (80 + orbit * 30), Math.sin(angle) * (80 + orbit * 30), 3, 0, Math.PI * 2);
                    ctx.fillStyle = rgba(.25); ctx.fill(); ctx.restore();
                }
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
            if (!last || elapsed >= (coarse.matches ? 48 : variant === 'admin' ? 32 : 22)) {
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
            targetGradientColors = readGradientColors();
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
    window.MailMotion = { mount, reveal, drawWeather };
})();
