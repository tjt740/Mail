/* Decorative public mailbox scenes: no mail content or credentials enter the renderer. */
(function () {
    'use strict';
    const root = document.documentElement;
    const hero = document.querySelector('.scene-hero');
    if (!hero) return;
    const modes = ['day', 'night', 'rain'];
    const themeForScene = { day: 'sunny', night: 'night', rain: 'rain' };
    const sceneForTheme = theme => ['night', 'rain'].includes(theme) ? theme : 'day';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = matchMedia('(pointer: coarse)');
    let scene = sceneForTheme(root.dataset.colorTheme), appliedTheme = null;
    let destroyed = false, suspended = false, raf = null, last = 0, time = 0, frameCount = 0;
    const weights = Object.fromEntries(modes.map(mode => [mode, mode === scene ? 1 : 0]));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const cleanups = [];
    const on = (target, type, handler, options = { passive: true }) => {
        target.addEventListener(type, handler, options);
        cleanups.push(() => target.removeEventListener(type, handler, options));
    };
    const envelope = hero.querySelector('.scene-envelope-trigger');
    const envelopeArt = hero.querySelector('.scene-art');
    const notice = hero.querySelector('.scene-envelope-notice');
    let envelopeOpen = false, envelopeAnimations = null, noticeAnimation = null, pendingNotice = false;
    const envelopeDuration = 1050;
    function createEnvelopeAnimations() {
        const tracks = [
            ['.scene-envelope-flap', [
                { transform: 'translateZ(2px) rotateX(0deg)', offset: 0, easing: 'cubic-bezier(.4,0,.2,1)' },
                { transform: 'translateZ(2px) rotateX(180deg)', offset: .62 },
                { transform: 'translateZ(2px) rotateX(180deg)', offset: 1 }
            ]],
            ['.scene-letter', [
                { transform: 'translate3d(0, 0, 1px)', offset: 0 },
                { transform: 'translate3d(0, 0, 1px)', offset: .42, easing: 'cubic-bezier(.22,.75,.25,1)' },
                { transform: 'translate3d(0, -42px, 3px)', offset: 1 }
            ]],
            ['.scene-envelope-seal', [
                { transform: 'translateZ(5px) scale(1)', opacity: 1, offset: 0, easing: 'ease-out' },
                { transform: 'translateZ(9px) scale(.94)', opacity: 0, offset: .14 },
                { transform: 'translateZ(9px) scale(.94)', opacity: 0, offset: 1 }
            ]]
        ];
        return tracks.map(([selector, keyframes]) => {
            const animation = envelope.querySelector(selector).animate(keyframes, { duration: envelopeDuration, fill: 'both' });
            animation.pause();
            animation.currentTime = 0;
            return animation;
        });
    }
    function syncEnvelopeMotion() {
        if (!envelopeAnimations) return;
        envelopeAnimations.forEach(animation => {
            if (reduced.matches) {
                animation.pause();
                animation.currentTime = envelopeOpen ? envelopeDuration : 0;
            } else if (document.hidden || suspended) {
                animation.pause();
            } else {
                // Reverse the existing timeline rather than starting delayed
                // transitions again. The paper returns before the lid closes.
                animation.updatePlaybackRate(envelopeOpen ? 1 : -1);
                const time = animation.currentTime || 0;
                if (envelopeOpen ? time < envelopeDuration : time > 0) animation.play();
            }
        });
    }
    function stopNotice() {
        noticeAnimation?.cancel();
        noticeAnimation = null;
    }
    function setEnvelopeOpen(open) {
        if (envelopeOpen === open) return;
        envelopeOpen = open;
        if (!envelope) return;
        envelope.setAttribute('aria-expanded', String(open));
        envelope.setAttribute('aria-label', open ? '合上信封' : '打开信封');
        if (open) envelopeArt.classList.remove('has-new-mail');
        envelopeAnimations ||= createEnvelopeAnimations();
        syncEnvelopeMotion();
    }
    function notifyNewMail() {
        if (destroyed || !notice) return;
        envelopeArt.classList.add('has-new-mail');
        if (document.hidden || suspended) { pendingNotice = true; return; }
        pendingNotice = false;
        // One damped wobble for a batch. Neither the ambient float nor scene
        // changes can restart it; reduced motion keeps only the notification dot.
        if (reduced.matches || noticeAnimation) return;
        noticeAnimation = notice.animate([
            { transform: 'translateY(0) rotateZ(0deg)', offset: 0 },
            { transform: 'translateY(-5px) rotateZ(-9deg)', offset: .16 },
            { transform: 'translateY(-5px) rotateZ(8deg)', offset: .32 },
            { transform: 'translateY(-3px) rotateZ(-6deg)', offset: .47 },
            { transform: 'translateY(-2px) rotateZ(4deg)', offset: .62 },
            { transform: 'translateY(-1px) rotateZ(-2deg)', offset: .77 },
            { transform: 'translateY(0) rotateZ(0deg)', offset: 1 }
        ], { duration: 1100, easing: 'ease-in-out', iterations: 1 });
        noticeAnimation.onfinish = () => { noticeAnimation = null; };
    }
    if (envelope) {
        on(envelope, 'pointerenter', event => {
            if (event.pointerType === 'touch') return;
            setEnvelopeOpen(true);
        });
        on(envelope, 'pointerleave', event => { if (event.pointerType !== 'touch') setEnvelopeOpen(false); });
        on(envelope, 'click', event => {
            // A mouse click follows pointerenter; it must not immediately undo
            // the hover animation. Touch and keyboard still toggle the lid.
            setEnvelopeOpen(event.detail > 0 && event.pointerType !== 'touch' && !coarse.matches ? true : !envelopeOpen);
        });
        on(envelope, 'keydown', event => {
            if (event.key === 'Escape') setEnvelopeOpen(false);
        });
        on(envelope, 'blur', () => setEnvelopeOpen(false));
    }
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
        rain: { top: '#15283e', bottom: '#080f1c', glow: 'rgba(123,151,205,.16)', glowEnd: 'rgba(123,151,205,0)', rgb: '151,209,225' }
    };
    const daylight = palette.day;
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
        window.MailMotion?.drawWeather(ctx, w, h, time, 'sunny', { hero: l === foreground, coarse: coarse.matches, motion: !reduced.matches });
    }
    function drawNight(l, rgb, isRain) {
        const { ctx, width: w, height: h } = l;
        if (isRain) {
            window.MailMotion?.drawWeather(ctx, w, h, time, 'rain', { hero: l === foreground, coarse: coarse.matches, lightning: l === backdrop, motion: !reduced.matches });
            return;
        }
        window.MailMotion?.drawWeather(ctx, w, h, time, 'night', { hero: l === foreground, coarse: coarse.matches, motion: !reduced.matches });
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
        syncEnvelopeMotion();
        if (document.hidden || suspended || reduced.matches) stopNotice();
        if (!document.hidden && !suspended && pendingNotice) notifyNewMail();
        root.dataset.sceneRunning = String(canAnimate());
        if (destroyed) return;
        render(0);
        if (canAnimate()) raf = requestAnimationFrame(tick);
    }
    function setScene(mode, persist = true) {
        if (!modes.includes(mode) || destroyed) return;
        // Scene buttons are shortcuts to the same preference as the theme menu.
        if (persist && window.AppColorTheme) {
            window.AppColorTheme.setTheme(themeForScene[mode]);
            return;
        }
        scene = mode;
        root.dataset.mailScene = mode;
        document.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === mode)));
        update();
    }
    function applyTheme(theme) {
        const p = window.MailThemes.get(theme);
        if (destroyed || appliedTheme === p.key) return;
        appliedTheme = p.key;
        // Keep public reading surfaces and weather on the shared palette. Using
        // concrete values avoids cycles with the legacy --surface/--text aliases.
        const variables = {
            bg: p.background, surface: `color-mix(in srgb, ${p.surface} 92%, transparent)`,
            inner: p.surface2, input: p.surface, text: p.text, muted: p.muted, border: p.border,
            accent: p.primary, secondary: p.secondary, 'on-accent': p.dark ? '#102130' : '#ffffff',
            success: p.mint, danger: p.coral, warning: p.gold, soft: p.soft,
            overlay: `color-mix(in srgb, ${p.surface2} 96%, transparent)`,
            backdrop: p.dark ? 'rgba(2,8,21,.80)' : 'rgba(17,36,63,.55)'
        };
        Object.entries(variables).forEach(([name, value]) => document.body.style.setProperty(`--scene-${name}`, value));
        palette.day = p.key === 'sunny' ? daylight : {
            ...daylight, top: p.background, bottom: p.surface2, glow: p.soft + '88', glowEnd: p.soft + '00'
        };
        resize();
        setScene(sceneForTheme(p.key), false);
    }
    document.querySelectorAll('[data-scene]').forEach(button => on(button, 'click', () => setScene(button.dataset.scene)));
    on(hero, 'pointermove', event => {
        if (coarse.matches || reduced.matches) return;
        const rect = hero.getBoundingClientRect();
        pointer.tx = (event.clientX - rect.left) / rect.width * 2 - 1;
        pointer.ty = (event.clientY - rect.top) / rect.height * 2 - 1;
    });
    on(hero, 'pointerleave', () => { pointer.tx = pointer.ty = 0; });
    on(window, 'blur', () => { pointer.tx = pointer.ty = 0; setEnvelopeOpen(false); });
    on(document, 'visibilitychange', update);
    on(window, 'pagehide', () => { suspended = true; update(); });
    on(window, 'pageshow', () => { suspended = false; update(); });
    on(reduced, 'change', update);
    function resize() { if (!destroyed) { layers.forEach(resizeLayer); render(0); } }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (observer) layers.forEach(l => observer.observe(l.canvas));
    else on(window, 'resize', resize);
    on(coarse, 'change', resize);
    window.MailScene = {
        setScene, applyTheme, notifyNewMail,
        get state() { return { scene, animating: canAnimate(), frameCount }; },
        destroy() {
            destroyed = true; stop(); stopNotice(); pendingNotice = false; observer?.disconnect(); cleanups.forEach(remove => remove());
            setEnvelopeOpen(false); envelopeArt?.classList.remove('has-new-mail');
            envelopeAnimations?.forEach(animation => animation.cancel());
            root.dataset.sceneRunning = 'false';
            layers.forEach(l => { l.ctx.clearRect(0, 0, l.width, l.height); l.skies = {}; });
        }
    };
    applyTheme(window.AppColorTheme?.theme || root.dataset.colorTheme);
})();
