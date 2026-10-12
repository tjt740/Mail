// Isolated UI fixtures only: this suite never opens the application database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { contrastFailures } = require('./theme_contrast.cjs');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
before(async () => {
    const html = execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import sys
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
with app.test_request_context('/'):
    print(render_template('frontend/index.html', embedded=True, system_title='Mail', page_title='Mail'))
`, root], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + pathname);
            if (file.startsWith(root + '/static/') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
                return res.end(fs.readFileSync(file));
            }
            res.statusCode = 404; return res.end();
        }
        if (pathname.startsWith('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            if (pathname === '/api/public-mail-config') return res.end(JSON.stringify({ success: true, key_required: false }));
            return res.end(JSON.stringify({ success: true, language: 'zh', mails: [{ id: 'scene-fixture', subject: 'Scene test letter', from: 'sender@example.com', to: 'reader@example.com', body: 'Your verification code: 123456', body_type: 'text', date: '2026-10-02 10:00:00' }] }));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (pathname === '/shell') return res.end(`<!doctype html><html data-i18n-managed="react"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/static/react/assets/main.css"></head><body><div id="root"></div><script>window.__MAIL_APP_PROPS__={pageTitle:'Mail'};</script><script type="module" src="/static/react/assets/main.js"></script></body></html>`);
        res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function newPage(options = {}) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
    page.setDefaultTimeout(5000);
    await page.goto(origin);
    await page.waitForFunction(() => window.MailScene && window.AppI18n);
    return page;
}

for (const width of [1440, 390]) test(`public theme menu and scene shortcuts stay synchronized in the shell at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        if (width === 390) await page.addInitScript(() => {
            Storage.prototype.getItem = () => { throw Error('Storage blocked'); };
            Storage.prototype.setItem = () => { throw Error('Storage blocked'); };
        });
        else await page.addInitScript(() => {
            // A stale preference from the old scene switcher must not override the theme.
            localStorage.setItem('mailScene', 'day');
        });
        await page.goto(origin + '/shell');
        await page.frameLocator('iframe').locator('#colorThemeButton').waitFor();
        const frame = page.frames().find(frame => frame.url().includes('/legacy/'));
        const timeOrigin = await frame.evaluate(() => performance.timeOrigin);
        await frame.locator('#emailInput').fill('reader@example.com');
        const skies = new Set(), accents = new Set();
        const check = async (theme, scene) => {
            await frame.waitForFunction(({theme,scene}) => document.documentElement.dataset.colorTheme === theme && document.documentElement.dataset.mailScene === scene && MailScene.state.scene === scene, {theme,scene});
            await page.waitForFunction(theme => document.documentElement.dataset.colorTheme === theme, theme);
            assert.equal(await frame.locator(`[data-scene="${scene}"]`).getAttribute('aria-pressed'), 'true');
            assert.equal(await frame.locator(`#colorThemeMenu [data-theme="${theme}"]`).getAttribute('aria-selected'), 'true');
            assert.equal(await frame.locator('#emailInput').inputValue(), 'reader@example.com');
            assert.equal(await frame.evaluate(() => performance.timeOrigin), timeOrigin);
            assert.deepEqual(await contrastFailures(frame, 'body'), []);
            assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        };
        for (const theme of ['sunny','night','rain','clay','ocean','emerald','violet','rose']) {
            await frame.locator('#colorThemeButton').click();
            await frame.locator(`#colorThemeMenu [data-theme="${theme}"]`).click();
            await check(theme, ['night','rain'].includes(theme) ? theme : 'day');
            accents.add(await frame.locator('.get-mail-btn').evaluate(button => getComputedStyle(button).backgroundImage + getComputedStyle(button).backgroundColor));
            if (['sunny','night','rain'].includes(theme)) skies.add(await frame.locator('#sceneCanvas').evaluate(canvas => canvas.toDataURL()));
        }
        assert.equal(accents.size, 8, 'every palette must visibly change the primary action');
        assert.equal(skies.size, 3, 'weather selection must update the rendered canvas, including reduced motion');
        for (const scene of ['night','day','rain']) {
            await frame.locator(`[data-scene="${scene}"]`).click();
            await check(scene === 'day' ? 'sunny' : scene, scene);
        }
        if (width === 1440) {
            await page.reload();
            await page.frameLocator('iframe').locator('[data-scene="rain"][aria-pressed="true"]').waitFor();
            assert.equal(await page.locator('html').getAttribute('data-color-theme'), 'rain');
        }
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `public-theme-sync-${width}.png`), fullPage: true });
        }
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

for (const width of [1440, 390]) test(`all public scene states follow their palette at ${width}px`, async () => {
    const page = await newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let responseState = 'success';
    await page.route('**/api/get_mail', async route => {
        await pending;
        const email = route.request().postDataJSON().email;
        const payload = responseState === 'error' ? { success: false, message: 'Theme fixture request failed' }
            : { success: true, mails: responseState === 'empty' ? [] : [{ id: email, subject: 'Theme letter for ' + email,
                from: 'sender@example.com', to: email, body: 'Verification code: 123456', body_type: 'text', date: '2026-10-06 10:00:00',
                attachments: [{ filename: 'theme-fixture.txt', mime_type: 'text/plain', size: 4, content: 'dGVzdA==' }] }] };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
    });
    const check = async (mode, state) => {
        const failures = await contrastFailures(page, 'body');
        assert.deepEqual(failures, [], JSON.stringify({ width, mode, state, failures }));
        if (process.env.SCREENSHOT_DIR && ['loading', 'mail-detail', 'error'].includes(state)) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `public-${mode}-${state}-${width}.png`), fullPage: true });
        }
    };
    try {
        for (const mode of ['day', 'night', 'rain']) {
            await page.locator(`[data-scene="${mode}"]`).click();
            await check(mode, 'initial-empty');
            await page.locator('#emailInput').focus();
            const focus = await page.locator('#emailInput').evaluate(input => {
                const style = getComputedStyle(input), body = getComputedStyle(document.body);
                const probe = document.createElement('span'); probe.style.color = body.getPropertyValue('--scene-accent'); document.body.appendChild(probe);
                const accent = getComputedStyle(probe).color; probe.remove();
                return { border: style.borderTopColor, accent };
            });
            assert.equal(focus.border, focus.accent, 'input focus must use the current scene accent');
            await page.locator('.i18n-language-trigger').click();
            await page.locator('.i18n-language-menu:not([hidden])').waitFor();
            await check(mode, 'language-menu');
            await page.locator('.i18n-language-trigger').press('Escape');
            await page.locator('.i18n-language-menu').waitFor({ state: 'hidden' });
        }
        await page.locator('#emailInput').fill('reader1@example.com\nreader2@example.com');
        await page.locator('.get-mail-btn').click();
        await page.locator('#loading').waitFor({ state: 'visible' });
        for (const mode of ['day', 'night', 'rain']) {
            await page.locator(`[data-scene="${mode}"]`).click();
            await check(mode, 'loading');
            const loading = await page.locator('#loading').evaluate(element => {
                const style = getComputedStyle(element);
                const probe = document.createElement('span'); probe.style.backgroundColor = 'var(--scene-overlay)'; probe.style.color = 'var(--scene-accent)'; element.appendChild(probe);
                const expected = getComputedStyle(probe); const result = { actual: [style.backgroundColor, style.color], expected: [expected.backgroundColor, expected.color], spinner: getComputedStyle(element.querySelector('.loading-orbit'), '::before').borderTopColor };
                probe.remove(); return result;
            });
            assert.deepEqual(loading.actual, loading.expected);
            assert.equal(loading.spinner, loading.actual[1]);
        }
        release();
        await page.locator('#loading').waitFor({ state: 'hidden' });
        for (const mode of ['day', 'night', 'rain']) {
            await page.locator(`[data-scene="${mode}"]`).click();
            await check(mode, 'mail-list');
            await page.locator('#mailTableBody').getByText('Theme letter for reader1@example.com', { exact: true }).click();
            await page.locator('#mailDisplay.is-visible').waitFor();
            await check(mode, 'mail-detail');
            await page.locator('.attachment-download').hover();
            await check(mode, 'attachment-hover');
            await page.locator('.back-btn').click();
            responseState = 'error';
            await page.locator('.get-mail-btn').click();
            await page.locator('.toast.error.show').last().waitFor();
            await check(mode, 'error');
            responseState = 'empty';
            await page.locator('.get-mail-btn').click();
            await page.locator('.mail-list-empty').waitFor();
            await check(mode, 'empty-result');
            responseState = 'success';
            await page.locator('.get-mail-btn').click();
            await page.locator('#mailTableBody').getByText('Theme letter for reader1@example.com', { exact: true }).waitFor();
        }
        assert.deepEqual(errors, []);
    } finally { release(); await page.close(); }
});

test('scene changes preserve queries, retrieved mail, selection and readable text', async () => {
    const page = await newPage({ reducedMotion: 'reduce' });
    try {
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.locator('#emailInput').fill('reader@example.com');
        await page.locator('.get-mail-btn').click();
        await page.getByText('Scene test letter', { exact: true }).click();
        await page.locator('#mailDisplay.is-visible').waitFor();
        for (const mode of ['night', 'rain', 'day']) {
            await page.locator(`[data-scene="${mode}"]`).click();
            assert.equal(await page.locator(`[data-scene="${mode}"]`).getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('#emailInput').inputValue(), 'reader@example.com');
            assert.equal(await page.locator('#mailSubject').innerText(), 'Scene test letter');
            assert.equal(await page.locator('#mailDisplay').isVisible(), true);
            // Let the browser apply the new scene's colors before comparing them.
            await page.waitForFunction(() => {
                const body = getComputedStyle(document.querySelector('.mail-body--text'));
                const input = getComputedStyle(document.querySelector('.highlight-input'));
                return body.color === input.color && body.backgroundColor === input.backgroundColor;
            });
            const readable = await page.evaluate(() => {
                const body = getComputedStyle(document.querySelector('.mail-body--text'));
                const input = getComputedStyle(document.querySelector('.highlight-input'));
                return body.color === input.color && body.backgroundColor === input.backgroundColor;
            });
            assert.equal(readable, true, `Text mail must use a matching foreground and background in ${mode}`);
        }
        await page.locator('.back-btn').click();
        await page.locator('#mailTableBody').getByText('Scene test letter', { exact: true }).waitFor();
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('scene persists and stale pause preferences cannot stop animation; lifecycle remains supported', async () => {
    const page = await newPage();
    try {
        await page.locator('[data-scene="rain"]').click();
        await page.evaluate(() => localStorage.setItem('mailScenePaused', 'true'));
        await page.reload();
        assert.equal(await page.evaluate(() => MailScene.state.scene), 'rain');
        assert.equal(await page.locator('#scenePause').count(), 0);
        assert.equal(await page.locator('.query-hint').count(), 0);
        assert.equal(await page.evaluate(() => MailScene.state.animating), true);
        let frame = await page.evaluate(() => MailScene.state.frameCount);
        await page.waitForFunction(previous => MailScene.state.frameCount > previous, frame);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !MailScene.state.animating, null, { polling: 50 });
        await page.waitForTimeout(100);
        frame = await page.evaluate(() => MailScene.state.frameCount);
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => MailScene.state.frameCount), frame);
        await page.locator('[data-scene="day"]').click();
        assert.equal(await page.evaluate(() => MailScene.state.scene), 'day');
        assert.equal(await page.evaluate(() => MailScene.state.animating), false);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        // A queued media-query change may draw one static frame after pagehide.
        // Let it settle, then verify that the animation remains stopped.
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => MailScene.state.animating), false);
        frame = await page.evaluate(() => MailScene.state.frameCount);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => MailScene.state.frameCount), frame);
        await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
        assert.equal(await page.evaluate(() => MailScene.state.animating), true);
        await page.evaluate(() => MailScene.destroy());
        frame = await page.evaluate(() => MailScene.state.frameCount);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => MailScene.state.frameCount), frame);
    } finally { await page.close(); }
});

for (const width of [320, 390, 768, 1440]) test(`scenes, translations and controls fit at ${width}px`, async () => {
    const page = await newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 3 });
    try {
        for (const lang of ['zh', 'en', 'vi', 'fil']) {
            await page.evaluate(lang => AppI18n.setLanguage(lang), lang);
            for (const mode of ['day', 'night', 'rain']) {
                await page.locator(`[data-scene="${mode}"]`).click();
                const bounds = await page.evaluate(() => {
                    const hero = document.querySelector('.scene-hero').getBoundingClientRect();
                    const controls = document.querySelector('.scene-controls').getBoundingClientRect();
                    return { overflow: document.documentElement.scrollWidth > innerWidth, controlsInside: controls.left >= hero.left && controls.right <= hero.right && controls.bottom <= hero.bottom,
                        backgroundPixels: document.getElementById('bgCanvas').width * document.getElementById('bgCanvas').height,
                        heroPixels: document.getElementById('sceneCanvas').width * document.getElementById('sceneCanvas').height,
                        emptyBackground: getComputedStyle(document.querySelector('.mail-list-empty')).backgroundColor };
                });
                assert.equal(bounds.overflow, false, JSON.stringify({ lang, mode, bounds }));
                assert.equal(bounds.controlsInside, true, JSON.stringify({ lang, mode, bounds }));
                assert.ok(bounds.backgroundPixels < 1810000 && bounds.heroPixels < 655000, JSON.stringify(bounds));
                assert.equal(bounds.emptyBackground, 'rgba(0, 0, 0, 0)');
            }
        }
    } finally { await page.close(); }
});

test('unavailable storage or Canvas preserves functional scene controls and query form', async () => {
    const page = await browser.newPage();
    try {
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            HTMLCanvasElement.prototype.getContext = () => null;
            Object.defineProperty(window, 'localStorage', { get() { throw Error('Storage blocked'); } });
        });
        await page.goto(origin);
        await page.locator('[data-scene="night"]').click();
        assert.equal(await page.evaluate(() => MailScene.state.scene), 'night');
        assert.equal(await page.evaluate(() => MailScene.state.animating), false);
        await page.locator('#emailInput').fill('reader@example.com');
        assert.equal(await page.locator('#emailInput').inputValue(), 'reader@example.com');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
