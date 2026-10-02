// Inspect the real built brand component with isolated page fixtures.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
before(async () => {
    server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + pathname);
            if (file.startsWith(root + '/static/') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css');
                return res.end(fs.readFileSync(file));
            }
            res.statusCode = 404; return res.end();
        }
        if (pathname.includes('/api/')) { res.setHeader('Content-Type', 'application/json'); return res.end('{"success":true,"language":"zh"}'); }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (pathname.startsWith('/legacy/')) return res.end('<p>Fixture</p>');
        res.end('<!doctype html><html data-i18n-managed="react"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/static/react/assets/main.css"></head><body><div id="root"></div><script>window.__MAIL_APP_PROPS__={adminUsername:"fixture",adminPermissions:["home"],systemTitle:"Mail"};</script><script type="module" src="/static/react/assets/main.js"></script></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

for (const dpr of [1, 2, 3]) test(`paper clears the lid throughout the loop and compact brand fits at DPR ${dpr}`, async () => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => { localStorage.setItem('mailSystemColorTheme', 'rain'); localStorage.setItem('reactAdminSidebarCollapsed', '1'); });
        await page.goto(origin + '/admin/home');
        await page.locator('.mailbox-logo-hinge').waitFor();
        const result = await page.locator('.mailbox-brand').evaluate(logo => {
            const animations = logo.getAnimations({ subtree: true });
            animations.forEach(animation => animation.pause());
            const intersections = [];
            let highestPaper = 0, widestAngle = 0;
            for (let time = 0; time <= 6000; time += 30) {
                animations.forEach(animation => animation.currentTime = time);
                const letter = new DOMMatrix(getComputedStyle(logo.querySelector('.mailbox-logo-letter')).transform);
                const lid = new DOMMatrix(getComputedStyle(logo.querySelector('.mailbox-logo-hinge')).transform);
                const angle = (Math.atan2(lid.m23, lid.m22) * 180 / Math.PI + 360) % 360;
                highestPaper = Math.min(highestPaper, letter.m42);
                widestAngle = Math.max(widestAngle, angle);
                if (letter.m42 < -.01 && (angle < 175 || angle > 190)) intersections.push({ time, angle });
            }
            const rect = logo.getBoundingClientRect(), brand = logo.closest('.brand').getBoundingClientRect();
            return { intersections, animations: animations.length, highestPaper, widestAngle, width: rect.width, centered: Math.abs(rect.x + rect.width/2 - brand.x - brand.width/2) < .5 };
        });
        assert.equal(result.animations, 4);
        assert.equal(result.highestPaper, -14);
        assert.ok(result.widestAngle > 184 && result.widestAngle < 186);
        assert.deepEqual(result.intersections, []);
        assert.equal(result.width, 36); assert.equal(result.centered, true);
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            // Magnified phase sheet for spotting subpixel gaps and occlusion visually.
            await page.evaluate(() => {
                const original = document.querySelector('.mailbox-brand');
                const grid = document.createElement('div');
                grid.id = 'brand-phase-sheet'; grid.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--surface);display:grid;grid-template-columns:repeat(4,180px);grid-auto-rows:170px;gap:10px;padding:20px;align-content:start';
                document.body.append(grid);
                for (const [label, time] of [['Closed',0],['Opening',1260],['Open',1920],['Rising',2340],['Raised',2880],['Returning',3600],['Closing',4620],['Closed again',5400]]) {
                    const cell = document.createElement('div'); cell.style.cssText='position:relative;color:var(--text);font:13px system-ui'; cell.textContent=label;
                    const clone=original.cloneNode(true);clone.style.cssText='position:absolute;top:45px;left:35px;transform:scale(3);transform-origin:top left';
                    cell.append(clone);grid.append(cell);
                    clone.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=time;});
                }
            });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `brand-phases-${dpr}x.png`), clip: { x: 0, y: 0, width: 800, height: 390 } });
        }
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
test('reduced motion retains a closed envelope and stops animation', async () => {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    try {
        await page.goto(origin + '/admin/home'); await page.locator('.mailbox-logo-hinge').waitFor();
        assert.equal(await page.locator('.mailbox-brand').evaluate(logo => logo.getAnimations({subtree:true}).length), 0);
        assert.equal(await page.locator('.mailbox-logo-letter').evaluate(letter => new DOMMatrix(getComputedStyle(letter).transform).m42), 0);
    } finally { await page.close(); }
});
