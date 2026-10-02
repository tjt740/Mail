// Isolated UI fixtures only: this suite never opens the application database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
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
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
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
        await page.waitForTimeout(150);
        let frame = await page.evaluate(() => MailScene.state.frameCount);
        await page.waitForTimeout(150);
        assert.ok(await page.evaluate(() => MailScene.state.frameCount) > frame);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(100);
        frame = await page.evaluate(() => MailScene.state.frameCount);
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => MailScene.state.frameCount), frame);
        await page.locator('[data-scene="day"]').click();
        assert.equal(await page.evaluate(() => MailScene.state.scene), 'day');
        assert.equal(await page.evaluate(() => MailScene.state.animating), false);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
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
        for (const lang of ['zh', 'en', 'vi']) {
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
