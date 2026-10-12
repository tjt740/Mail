/* A finite scan on focus; continuous movement only during a real request. */
(function () {
    'use strict';
    const visual = document.querySelector('.query-search-visual');
    const input = document.getElementById('emailInput');
    if (!visual || !input) return;
    const lens = visual.querySelector('.query-search-lens');
    const beam = visual.querySelector('.query-search-beam');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let scanning = [], returning = null, beamFade = null, active = false, suspended = false, resultTimer = null;
    const canMove = () => !reduced.matches && !document.hidden && !suspended && !!lens.animate;

    function cancelScan() {
        scanning.forEach(animation => animation.cancel());
        scanning = [];
    }
    function clearResult() {
        clearTimeout(resultTimer);
        delete visual.dataset.result;
    }
    function scan(loop = false) {
        if (!canMove()) return;
        if (scanning[0]?.playState === 'running') {
            if (loop) scanning.forEach(animation => animation.effect.updateTiming({ iterations: Infinity }));
            return;
        }
        const from = getComputedStyle(lens).transform;
        returning?.cancel();
        beamFade?.cancel();
        cancelScan();
        const timing = { duration: 1600, iterations: loop ? Infinity : 1, easing: 'ease-in-out' };
        scanning = [
            lens.animate([
                { transform: from },
                { transform: 'translate(-19px, -10px) rotate(-8deg)', offset: .32 },
                { transform: 'translate(-3px, -14px) rotate(4deg)', offset: .66 },
                { transform: 'none' }
            ], timing),
            beam.animate([
                { opacity: 0, transform: 'translateY(0)' },
                { opacity: .65, offset: .18 },
                { opacity: .65, offset: .7 },
                { opacity: 0, transform: 'translateY(29px)' }
            ], timing)
        ];
    }
    function rest() {
        const from = getComputedStyle(lens).transform;
        const beamStyle = getComputedStyle(beam);
        const beamFrom = { opacity: beamStyle.opacity, transform: beamStyle.transform };
        returning?.cancel();
        beamFade?.cancel();
        cancelScan();
        if (!canMove()) return;
        returning = lens.animate([{ transform: from }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
        beamFade = beam.animate([beamFrom, { ...beamFrom, opacity: 0 }], { duration: 180 });
    }
    function preview() {
        if (active) return;
        clearResult();
        scan();
    }
    function sync() {
        returning?.cancel();
        beamFade?.cancel();
        cancelScan();
        if (active) scan(true);
    }
    input.addEventListener('focus', preview);
    visual.closest('label').addEventListener('pointerenter', preview);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => { suspended = true; clearResult(); sync(); });
    window.addEventListener('pageshow', () => { suspended = false; sync(); });
    window.MailQueryMotion = {
        start() {
            active = true;
            visual.dataset.state = 'loading';
            clearResult();
            scan(true);
        },
        finish(outcome) {
            active = false;
            visual.dataset.state = 'idle';
            rest();
            clearResult();
            if (!suspended && !document.hidden) {
                visual.dataset.result = outcome;
                resultTimer = setTimeout(clearResult, 1500);
            }
        }
    };
})();
