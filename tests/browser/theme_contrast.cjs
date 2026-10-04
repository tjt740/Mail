// Inspect rendered text, including inherited and translucent surface colors.
// Gradient endpoints are checked conservatively; icons and disabled controls are excluded.
async function contrastFailures(page, scope = 'body') {
    return page.evaluate(scope => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        ctx.canvas.width = ctx.canvas.height = 1;
        if (scope === 'body' && document.querySelector('.modal.show')) scope = '.modal.show';
        const colors = new Map();
        const rgba = value => {
            if (colors.has(value)) return colors.get(value);
            ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
            const result = Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v, i) => i === 3 ? v / 255 : v);
            colors.set(value, result); return result;
        };
        const blend = (a, b) => a.slice(0, 3).map((c, i) => c * a[3] + b[i] * (1 - a[3])).concat(1);
        const lum = a => a.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
        const failures = [], seen = new Set();
        for (const element of document.querySelectorAll(scope + ' *')) {
            if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('[disabled], [aria-disabled="true"], svg, option')) continue;
            const text = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
            if (!text && !element.matches('input:not([type=checkbox]):not([type=radio]), textarea, select')) continue;
            const style = getComputedStyle(element);
            const parents = []; for (let p = element; p; p = p.parentElement) parents.unshift(p);
            let backgrounds = [[255, 255, 255, 1]];
            for (const parent of parents) {
                const css = getComputedStyle(parent), base = rgba(css.backgroundColor);
                backgrounds = backgrounds.map(bg => blend(base, bg));
                if (css.backgroundImage.includes('gradient(')) {
                    const stops = css.backgroundImage.match(/(?:rgba?|color)\([^)]*\)/g) || [];
                    if (stops.length) backgrounds = stops.flatMap(stop => backgrounds.map(bg => blend(rgba(stop), bg)));
                }
                backgrounds = Array.from(new Map(backgrounds.map(bg => [bg.map(Math.round).join(','), bg])).values());
            }
            const color = rgba(style.color);
            const ratio = Math.min(...backgrounds.map(bg => { const a = lum(blend(color, bg)), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }));
            const min = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            const selector = element.id ? '#' + element.id : element.tagName.toLowerCase() + '.' + Array.from(element.classList).join('.');
            if (ratio < min - .03 && !seen.has(selector + style.color)) {
                seen.add(selector + style.color);
                failures.push({ selector, text: (text || element.value || 'input').slice(0, 36), ratio: +ratio.toFixed(2), min, color: style.color, background: backgrounds.map(c => c.slice(0, 3).map(Math.round)) });
            }
        }
        return failures;
    }, scope);
}
module.exports = { contrastFailures };
