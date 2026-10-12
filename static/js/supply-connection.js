/* Connection illustration. Only real request results may change its status. */
(function () {
    'use strict';
    window.createSupplyConnectionScene = function (panel) {
        const canvas = panel.querySelector('canvas');
        const scene = canvas?.parentElement;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return { setState() {} };
        const section = panel.closest('.card');
        const hub = panel.querySelector('.supply-scene-hub');
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let motionReduced = reduced.matches;
        let state = 'untested', width = 0, height = 0, frame = 0, lastFrame = 0;
        let visible = false, suspended = false, accent = '#62718f', grid = '#d5e3ef';
        let stateAt = performance.now(), feedbackAt = -Infinity, feedback = '', pointer = null, focus = null;
        let resultAnimation = null;
        const tau = Math.PI * 2;

        function circle(x, y, radius, alpha, fill = true) {
            ctx.globalAlpha = alpha;
            ctx.beginPath(); ctx.arc(x, y, radius, 0, tau);
            if (fill) ctx.fill(); else ctx.stroke();
        }
        function point(t, direction) {
            const left = width * .16, span = width * .68, bend = Math.min(height * .36, 66);
            // Same cubic curve as the visible lanes, with a distinct outbound/return direction.
            return { x: left + span * (3 * (1-t) * (1-t) * t * .28 + 3 * (1-t) * t * t * .72 + t*t*t),
                y: height * .4 + direction * bend * 3 * t * (1-t) };
        }
        function lane(direction, alpha, dashed = false) {
            const left = width * .16, span = width * .68, y = height * .4;
            const bend = direction * Math.min(height * .36, 66);
            ctx.globalAlpha = alpha; ctx.setLineDash(dashed ? [3, 6] : []);
            ctx.beginPath(); ctx.moveTo(left, y);
            ctx.bezierCurveTo(left + span * .28, y + bend, left + span * .72, y + bend, left + span, y);
            ctx.stroke(); ctx.setLineDash([]);
        }
        function signal(progress, direction, returning = false, opacity = 1) {
            const t = returning ? 1 - progress : progress;
            const p = point(t, direction);
            // A fading comet trail makes travel direction visible even on narrow screens.
            for (let i = 10; i > 0; i--) {
                const tailT = t + (returning ? 1 : -1) * i * .012;
                if (tailT < 0 || tailT > 1) continue;
                const tail = point(tailT, direction);
                circle(tail.x, tail.y, 2.4 - i * .13, (1-i/11) * .32 * opacity);
            }
            circle(p.x, p.y, 9, .07 * opacity);
            circle(p.x, p.y, 5.5, .12 * opacity);
            circle(p.x, p.y, 2.7, .95 * opacity);
        }
        function wave(x, y, time, duration, phase = 0, opacity = 1) {
            const progress = (time / duration + phase) % 1;
            circle(x, y, 23 + progress * 23, (1-progress) * .26 * opacity, false);
        }
        function draw(now) {
            if (!width || !height) return;
            const time = motionReduced ? 0 : (now-stateAt) / 1000;
            const y = height * .4, left = width * .16, right = width * .84, center = width / 2;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = grid;
            for (let x = 12; x < width; x += 20) for (let yy = 9; yy < height; yy += 20) circle(x, yy, .8, .5);
            if (focus && !motionReduced) {
                const glow = ctx.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, 72);
                glow.addColorStop(0, accent); glow.addColorStop(1, 'transparent');
                ctx.globalAlpha = .13; ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
            }
            ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 1.3;
            const checking = state === 'checking', connected = state === 'connected', failed = state === 'failed';
            // Lower lane stays quiet while checking: no response is claimed before the server returns.
            lane(-1, checking ? .36 : connected ? .3 : .13, failed);
            lane(1, connected ? .3 : .1, !connected);
            ctx.globalAlpha = connected ? .24 : .16;
            ctx.setLineDash(connected ? [] : [3, 6]);
            ctx.lineDashOffset = checking && !motionReduced ? -time * 16 : 0;
            ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(center - 36, y);
            ctx.moveTo(center + 36, y); ctx.lineTo(right, y); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            if (checking || connected) {
                const speed = checking ? .62 : .25;
                for (let i = 0; i < 3; i++) signal((time * speed + i/3) % 1, -1);
                if (connected) {
                    for (let i = 0; i < 3; i++) signal((time * .25 + i/3 + .16) % 1, 1, true, .85);
                }
                if (!motionReduced) {
                    wave(left, y, time, checking ? 1.6 : 3.2);
                    wave(right, y, time, checking ? 1.6 : 3.2, .5);
                    if (checking) {
                        // The Supply endpoint scans while the actual request is pending.
                        ctx.globalAlpha = .48; ctx.lineWidth = 1.7;
                        ctx.beginPath(); ctx.arc(right, y, 29, time * 2.8, time * 2.8 + Math.PI * .65); ctx.stroke();
                        ctx.lineWidth = 1.3;
                    }
                }
            }
            if (failed) {
                // A broken link remains still after its short failure acknowledgement.
                ctx.globalAlpha = .6; ctx.lineWidth = 1.8;
                for (const x of [center-41, center+41]) {
                    ctx.beginPath(); ctx.moveTo(x-2, y-4); ctx.lineTo(x+2, y+4); ctx.stroke();
                }
                ctx.lineWidth = 1.3;
            }
            const elapsed = (now-feedbackAt) / (feedback === 'connected' ? 1500 : 900);
            if (!motionReduced && elapsed >= 0 && elapsed < 1) {
                const ease = 1 - (1-elapsed) ** 3;
                if (feedback === 'connected') {
                    for (let i = 0; i < 2; i++) circle(center, y, 32 + ease * (45 + i*19), (1-elapsed) * (.35-i*.1), false);
                    for (let i = 0; i < 12; i++) {
                        const a = i / 12 * tau, r = 38 + ease * 37;
                        circle(center + Math.cos(a)*r, y + Math.sin(a)*r, 2*(1-elapsed), (1-elapsed)*.7);
                    }
                } else {
                    circle(center, y, 32 + ease * 27, (1-elapsed)*.25, false);
                    // Failed signals retreat toward the endpoints rather than looping as if retrying.
                    signal(.5*(1-ease), -1, false, 1-elapsed);
                    signal(.5 + .5*ease, 1, false, 1-elapsed);
                }
            }
            ctx.globalAlpha = 1;
        }
        function active() { return visible && !section.hidden && !document.hidden && !suspended && width > 0; }
        function animated(now) {
            return !motionReduced && (state === 'checking' || state === 'connected' || pointer ||
                now-feedbackAt < (feedback === 'connected' ? 1500 : 900));
        }
        function tick(now) {
            frame = 0;
            if (!active()) { refresh(); return; }
            // Cap drawing at 30 fps, independent of display refresh rate.
            if (now-lastFrame >= 32) {
                if (pointer) {
                    if (!focus) focus = { ...pointer };
                    focus.x += (pointer.x-focus.x)*.18; focus.y += (pointer.y-focus.y)*.18;
                }
                draw(now); lastFrame = now;
            }
            if (animated(now)) frame = requestAnimationFrame(tick);
            else draw(now); // Clear the final transient frame when a failure settles.
            canvas.dataset.animating = frame ? 'true' : 'false';
        }
        function refresh() {
            cancelAnimationFrame(frame); frame = 0;
            const running = active() && !motionReduced;
            scene.style.setProperty('--supply-play-state', running ? 'running' : 'paused');
            canvas.dataset.motion = !visible ? 'offscreen' : suspended || document.hidden || section.hidden ? 'paused' : motionReduced ? 'reduced' : 'full';
            canvas.dataset.animating = 'false';
            if (resultAnimation) {
                if (motionReduced) { resultAnimation.cancel(); resultAnimation = null; }
                else if (!running && resultAnimation.playState === 'running') resultAnimation.pause();
                else if (running && resultAnimation.playState === 'paused') resultAnimation.play();
            }
            if (!active()) return;
            const now = performance.now();
            draw(now);
            if (animated(now)) { frame = requestAnimationFrame(tick); canvas.dataset.animating = 'true'; }
        }
        function resize() {
            const rect = scene.getBoundingClientRect();
            width = rect.width; height = rect.height;
            if (!width || !height) { refresh(); return; }
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            refresh();
        }
        function palette() {
            const style = getComputedStyle(panel);
            accent = style.getPropertyValue('--supply-tone').trim() || '#62718f';
            grid = style.getPropertyValue('--border').trim() || '#d5e3ef';
            refresh();
        }
        new ResizeObserver(resize).observe(scene);
        new IntersectionObserver(entries => {
            visible = entries[entries.length-1].isIntersecting;
            refresh();
        }).observe(scene);
        new MutationObserver(resize).observe(section, { attributes: true, attributeFilter: ['hidden'] });
        new MutationObserver(palette).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme-mode', 'data-color-theme'] });
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('pagehide', () => { suspended = true; refresh(); });
        window.addEventListener('pageshow', () => { suspended = false; refresh(); });
        reduced.addEventListener('change', event => {
            motionReduced = event.matches; focus = null; pointer = null;
            refresh();
        });
        scene.addEventListener('pointermove', event => {
            if (motionReduced || event.pointerType === 'touch') return;
            const rect = scene.getBoundingClientRect();
            pointer = { x: event.clientX-rect.left, y: event.clientY-rect.top };
            if (!frame) refresh();
        });
        scene.addEventListener('pointerleave', () => { pointer = null; focus = null; refresh(); });
        palette(); resize();
        return {
            setState(next) {
                if (next === state) return;
                const result = state === 'checking' && ['connected', 'failed'].includes(next);
                resultAnimation?.cancel(); resultAnimation = null;
                state = next; stateAt = performance.now();
                feedback = result ? next : ''; feedbackAt = result ? stateAt : -Infinity;
                canvas.dataset.feedback = feedback;
                if (result && !motionReduced && active()) {
                    const transforms = next === 'connected' ?
                        ['translate(-50%, -50%) scale(.84)', 'translate(-50%, -50%) scale(1.15)', 'translate(-50%, -50%) scale(1)'] :
                        ['translate(-50%, -50%)', 'translate(calc(-50% - 5px), -50%)', 'translate(calc(-50% + 5px), -50%)', 'translate(calc(-50% - 3px), -50%)', 'translate(-50%, -50%)'];
                    resultAnimation = hub.animate(transforms.map(transform => ({ transform })), { duration: next === 'connected' ? 600 : 420, easing: 'ease-out' });
                }
                palette();
            }
        };
    };
})();
