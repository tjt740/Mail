// Real public shell and templates with isolated mail fixtures; no business database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
// Filter the source, preserving earlier vh declarations in the same rule.
// CSSOM serialization would discard those fallbacks before the test runs.
function legacyCss(css) {
    return css.replace(/[^{}]*:has\([^{}]*\{[^{}]*\}/g, '')
        .replace(/[^{};]+:[^;{}]*dvh[^;{}]*(;|(?=\s*\}))/g, '');
}
before(async () => {
    const pages = JSON.parse(execFileSync(path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import json, sys
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
with app.test_request_context('/'):
 print(json.dumps({
  'public': render_template('frontend/index.html', embedded=True, page_title='安卓邮局'),
  'shell': render_template('react_app.html', app_props={'pageTitle': '安卓邮局'})
 }))
`, root], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
    server = http.createServer(async (req, res) => {
        const name = new URL(req.url, 'http://localhost').pathname;
        if (name.startsWith('/static/')) {
            const file = path.resolve(root, '.' + name);
            if (!file.startsWith(root + '/static/') || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
            res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
            const content = fs.readFileSync(file);
            return res.end(req.headers['x-legacy-css'] && name.endsWith('.css') ? legacyCss(content.toString()) : content);
        }
        if (name.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            if (name === '/api/public-mail-config') return res.end('{"success":true,"key_required":false}');
            if (name === '/api/get_mail') {
                let body = ''; for await (const chunk of req) body += chunk;
                const { email } = JSON.parse(body);
                return res.end(JSON.stringify({ success: true, mails: Array.from({ length: 5 }, (_, i) => ({
                    id: String(i), subject: `Android letter ${i + 1}`, from: 'sender@example.com', to: email,
                    date: '2026-10-22 12:00:00', body: 'Complete Android message', body_type: 'text'
                })) }));
            }
            return res.end('{"success":true,"language":"zh"}');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const html = name.startsWith('/legacy/') ? pages.public : pages.shell;
        res.end(req.headers['x-legacy-css'] ? html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${legacyCss(css)}</style>`) : html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => {
    await browser?.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

async function swipe(page, box, axis) {
    const session = await page.context().newCDPSession(page);
    const x = box.x + box.width * .8, y = box.y + Math.min(box.height * .5, 80);
    try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 10; i++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
                x: x - (axis === 'x' ? box.width * .6 * i / 10 : 0),
                y: y - (axis === 'y' ? Math.min(box.height * .4, 100) * i / 10 : 0)
            }] });
            await page.waitForTimeout(20);
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await session.detach(); }
}

for (const legacy of [false, true]) for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
    test(`Android public inbox and native swipes at ${width}x${height}, legacy CSS=${legacy}`, async () => {
        const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true,
            extraHTTPHeaders: legacy ? { 'x-legacy-css': '1' } : {},
            userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
            reducedMotion: 'reduce' });
        page.setDefaultTimeout(6000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(origin);
            await page.frameLocator('.legacy-frame').locator('#emailInput').waitFor();
            const frame = page.frames().find(item => item.url().includes('/legacy/'));
            await frame.locator('#emailInput').fill('reader@example.com');
            await frame.locator('.get-mail-btn').tap();
            await frame.waitForFunction(() => document.querySelectorAll('#mailTableBody tr[data-mail-id]').length === 5);
            const list = frame.locator('.mail-list-wrapper');
            const bounds = await list.boundingBox();
            assert.ok(bounds.height >= 40 && bounds.y + bounds.height <= height + 1, JSON.stringify(bounds));
            assert.equal(await frame.locator('#mailTableBody tr').count(), 5);
            assert.ok(await frame.locator('.pagination-info').isVisible());
            assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1), false);
            if (width < 561) {
                await swipe(page, bounds, 'x');
                await frame.waitForFunction(() => document.querySelector('.mail-list-wrapper').scrollLeft > 20);
                assert.equal(await frame.locator('#mailDisplay').isVisible(), false, 'A horizontal swipe must not open a message');
                const rightmost = await list.evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft; });
                assert.ok(rightmost > 100, 'The recipient and date columns must remain reachable');
                await list.evaluate(el => { el.scrollLeft = 0; });
            }
            if (await list.evaluate(el => el.scrollHeight > el.clientHeight + 10)) {
                await swipe(page, bounds, 'y');
                await frame.waitForFunction(() => document.querySelector('.mail-list-wrapper').scrollTop > 5);
                assert.equal(await frame.locator('#mailDisplay').isVisible(), false, 'Vertical scrolling must not open a message');
                await list.evaluate(el => { el.scrollTop = 0; });
            }
            if (process.env.SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `android-${width}-${height}-${legacy}.png`) });
            }
            await frame.locator('#mailTableBody tr').first().tap();
            await frame.locator('#mailDisplay.is-visible').waitFor();
            assert.equal(await frame.locator('#mailSubject').innerText(), 'Android letter 1');
            await frame.locator('.back-btn').tap();
            await frame.locator('#mailListView').waitFor({ state: 'visible' });
            // Rotation or browser chrome/keyboard resizing must not collapse the inbox.
            await page.setViewportSize({ width: height, height: width });
            const rotated = await list.boundingBox();
            assert.ok(rotated.height >= 30 && rotated.y + rotated.height <= width + 1, JSON.stringify(rotated));
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

test('older Android supports key-protected batches, empty results and reader return', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        extraHTTPHeaders: { 'x-legacy-css': '1' }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(6000);
    let empty = false;
    try {
        await page.route('**/api/public-mail-config', route => route.fulfill({ contentType: 'application/json',
            body: '{"success":true,"key_required":true}' }));
        await page.route('**/api/get_mail', async route => {
            assert.equal(route.request().postDataJSON().master_key, 'fixture-key');
            if (empty) return route.fulfill({ contentType: 'application/json', body: '{"success":true,"mails":[]}' });
            await route.continue();
        });
        await page.goto(origin);
        await page.frameLocator('.legacy-frame').locator('#publicMailKeyInput:enabled').waitFor();
        const frame = page.frames().find(item => item.url().includes('/legacy/'));
        assert.equal(await frame.locator('.mail-table thead').isVisible(), false);
        const key = await frame.locator('#publicMailKeyInput').boundingBox();
        const input = await frame.locator('#emailInput').boundingBox();
        assert.ok(key.y + key.height <= input.y && key.x >= 0 && key.x + key.width <= 390);
        await frame.locator('#publicMailKeyInput').fill('fixture-key');
        await frame.locator('#emailInput').fill('one@example.com\ntwo@example.com');
        await frame.locator('.get-mail-btn').tap();
        await frame.waitForFunction(() => document.querySelectorAll('#mailTableBody tr[data-mail-id]').length === 10);
        assert.equal(await frame.locator('#mailboxSwitcher').isVisible(), true);
        assert.equal(await frame.locator('#folderPanel').isVisible(), true);
        assert.ok((await frame.locator('.mail-list-wrapper').boundingBox()).height > 40);
        await swipe(page, await frame.locator('#mailboxChipList').boundingBox(), 'x');
        await frame.waitForFunction(() => document.getElementById('mailboxChipList').scrollLeft > 20);
        assert.equal(await frame.locator('#mailTableBody tr').count(), 10, 'Swiping mailbox tabs must not change the selected mailbox');
        await frame.locator('#mailTableBody tr').first().tap();
        await frame.locator('.back-btn').tap();
        empty = true;
        await frame.locator('.get-mail-btn').tap();
        await frame.locator('.mail-list-empty').waitFor();
        assert.equal(await frame.locator('.mail-table thead').isVisible(), false);
        assert.equal(await frame.locator('.mail-list-wrapper').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    } finally { await page.close(); }
});
