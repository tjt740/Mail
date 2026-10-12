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
    if (process.env.SCREENSHOT_DIR) fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
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
    await page.waitForFunction(() => window.MailScene && window.AppI18n && !document.body.classList.contains('preload'));
    return page;
}

test('canvas mail loader rotates only during retrieval, follows themes and respects motion/lifecycle settings', async () => {
    const page = await newPage({ deviceScaleFactor: 3 });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    try {
        await page.route('**/api/get_mail', async route => {
            await gate;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, mails: [] }) });
        });
        assert.equal(await page.evaluate(() => MailLoading.state.animating), false);
        await page.locator('#emailInput').fill('reader@example.com');
        await page.locator('.get-mail-btn').click();
        await page.locator('#loading').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => MailLoading.state.animating), true);
        const pixels = () => page.locator('#mailLoadingCanvas').evaluate(canvas => canvas.toDataURL());
        const first = await pixels();
        await page.waitForTimeout(180);
        assert.notEqual(await pixels(), first);
        assert.ok(await page.locator('#mailLoadingCanvas').evaluate(canvas => canvas.width * canvas.height <= 180000));
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'canvas-loading-desktop.png'), fullPage: true });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !MailLoading.state.animating);
        const still = await pixels();
        await page.waitForTimeout(120);
        assert.equal(await pixels(), still);
        await page.locator('[data-scene="night"]').click();
        await page.waitForTimeout(80);
        assert.notEqual(await pixels(), still);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => MailLoading.state.animating);
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        const paused = await page.evaluate(() => MailLoading.state.frameCount);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => MailLoading.state.frameCount), paused);
        await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
        await page.waitForFunction(previous => MailLoading.state.frameCount > previous, paused);
        release();
        await page.locator('#loading').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => MailLoading.state.active || MailLoading.state.animating), false);
        const stopped = await page.evaluate(() => MailLoading.state.frameCount);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => MailLoading.state.frameCount), stopped);
    } finally { release(); await page.close(); }
});

for (const width of [320, 390, 1440]) test(`single-mailbox results fill the panel and totals keep side spacing at ${width}px`, async () => {
    const page = await newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    let fail = false;
    try {
        assert.equal(await page.locator('#mailboxSwitcher').isVisible(), false);
        await page.route('**/api/get_mail', async route => {
            await new Promise(resolve => setTimeout(resolve, 120));
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: !fail, message: 'Fixture failure', mails: fail ? [] : [{ id: 'one', subject: 'UI fixture letter', from: 'sender@example.com', to: 'reader@example.com', body: 'Message body' }] }) });
        });
        for (const count of [1, 2, 1]) {
            await page.locator('#emailInput').fill(count === 1 ? 'reader@example.com' : 'reader@example.com, second@example.com');
            await page.locator('.get-mail-btn').click();
            await page.locator('#loading').waitFor({ state: 'visible' });
            assert.equal(await page.locator('#folderPanel').isVisible(), count > 1);
            if (count === 1) assert.equal(await page.locator('#mailboxSwitcher').isVisible(), false);
            await page.locator('#loading').waitFor({ state: 'hidden' });
            assert.equal(await page.locator('#folderPanel').isVisible(), count > 1);
            assert.equal(await page.locator('#mailboxSwitcher').isVisible(), count > 1);
            const bounds = await page.evaluate(() => {
                const panel = document.getElementById('mailListPanel').getBoundingClientRect();
                const layout = document.querySelector('.mail-layout').getBoundingClientRect();
                const total = document.querySelector('.pagination-info').getBoundingClientRect();
                return { left: panel.left - layout.left, gap: panel.right - total.right, overflow: document.documentElement.scrollWidth > innerWidth };
            });
            if (count === 1) assert.ok(Math.abs(bounds.left) < 2, JSON.stringify(bounds));
            assert.ok(bounds.gap >= 20, JSON.stringify(bounds));
            assert.equal(bounds.overflow, false);
        }
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `single-mailbox-${width}.png`), fullPage: true });
        await page.locator('#mailTableBody tr[data-mail-id]').click();
        await page.locator('#mailDisplay.is-visible').waitFor();
        await page.locator('.back-btn').click();
        fail = true;
        await page.locator('.get-mail-btn').click();
        await page.locator('#loading').waitFor({ state: 'visible' });
        await page.locator('#loading').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => MailLoading.state.active || MailLoading.state.animating), false);
        assert.equal(await page.locator('#folderPanel').isVisible(), false);
    } finally { await page.close(); }
});

for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) test(`50 mailboxes and 250 messages remain reachable at ${width}x${height}`, async () => {
    const page = await newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const addresses = Array.from({ length: 50 }, (_, i) => `mailbox${i + 1}@example.com`);
    let empty = false;
    let release;
    const singleRequest = new Promise(resolve => { release = resolve; });
    try {
        await page.route('**/api/get_mail', async route => {
            const email = route.request().postDataJSON().email;
            if (email === 'solo@example.com') await singleRequest;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true,
                mails: empty ? [] : Array.from({ length: 5 }, (_, i) => ({ id: String(i), subject: `Letter ${i + 1} for ${email}`, from: 'sender@example.com', to: email, body: 'Batch fixture message' })) }) });
        });
        await page.locator('#emailInput').fill(addresses.join('\n'));
        await page.locator('.get-mail-btn').click();
        await page.waitForFunction(() => document.querySelectorAll('#mailTableBody tr[data-mail-id]').length === 250);
        const sizes = await page.evaluate(() => {
            const chipList = document.getElementById('mailboxChipList');
            const panel = document.getElementById('mailListPanel');
            const list = document.querySelector('.mail-list-wrapper');
            return { chips: chipList.clientHeight, chipScroll: chipList.scrollHeight,
                panel: panel.clientHeight, list: list.clientHeight, listScroll: list.scrollHeight,
                overflowX: document.documentElement.scrollWidth > innerWidth };
        });
        assert.ok(sizes.chips <= 104 && sizes.chipScroll > sizes.chips, JSON.stringify(sizes));
        assert.ok(sizes.panel >= 360 && sizes.panel <= 760 && sizes.listScroll > sizes.list, JSON.stringify(sizes));
        assert.equal(sizes.overflowX, false);
        // The outer page must remain scrollable, including beside the nested lists.
        await page.mouse.move(3, 40);
        await page.mouse.wheel(0, 650);
        await page.waitForFunction(() => document.scrollingElement.scrollTop > 0).catch(async () => {
            assert.fail('Page did not scroll: ' + JSON.stringify(await page.evaluate(() => [document.documentElement, document.body, document.getElementById('frontendApp')].map(el => ({
                tag: el.tagName, height: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop,
                overflow: getComputedStyle(el).overflowY, cssHeight: getComputedStyle(el).height
            })))));
        });
        const last = page.locator('.mailbox-chip[data-mailbox="mailbox50@example.com"]');
        await last.scrollIntoViewIfNeeded();
        const before = await page.locator('#mailboxChipList').evaluate(el => el.scrollTop);
        assert.ok(before > 0);
        await last.click();
        assert.equal(await last.getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#mailTableBody tr[data-mail-id]').count(), 5);
        assert.equal(await page.locator('#mailboxChipList').evaluate(el => el.scrollTop), before);
        const all = page.locator('.mailbox-chip[data-mailbox="all"]');
        await all.scrollIntoViewIfNeeded();
        await all.click();
        const list = page.locator('.mail-list-wrapper');
        await list.scrollIntoViewIfNeeded();
        const box = await list.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 100));
        await page.mouse.wheel(0, 900);
        await page.waitForFunction(() => document.querySelector('.mail-list-wrapper').scrollTop > 0);
        await page.locator('#mailTableBody tr[data-mail-id]').last().click();
        await page.locator('#mailDisplay.is-visible').waitFor();
        assert.match(await page.locator('#mailSubject').innerText(), /mailbox50@example.com/);
        await page.locator('.back-btn').click();
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `batch-mailbox-${width}.png`), fullPage: true });
        empty = true;
        await page.locator('.get-mail-btn').click();
        await page.locator('.mail-list-empty').waitFor();
        assert.equal(await page.locator('.mailbox-chip').count(), 51);
        assert.ok(await page.locator('#mailboxChipList').evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight <= 104));
        assert.ok(await page.locator('#mailListPanel').evaluate(el => el.clientHeight >= 360));
        empty = false;
        await page.locator('#emailInput').fill('solo@example.com');
        await page.locator('.get-mail-btn').click();
        await page.locator('#loading').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#mailboxSwitcher').isVisible(), false);
        assert.equal(await page.locator('#folderPanel').isVisible(), false);
        release();
        await page.locator('#loading').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#mailboxSwitcher').isVisible(), false);
        assert.equal(await page.locator('#mailTableBody tr[data-mail-id]').count(), 5);
    } finally { release(); await page.close(); }
});

test('envelope unfolds on hover, closes on leave and supports keyboard and touch', async () => {
    const page = await newPage({ reducedMotion: 'no-preference' });
    try {
        const trigger = page.locator('.scene-envelope-trigger');
        const paperY = () => page.locator('.scene-letter').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
        assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), false);
        assert.equal(await paperY(), 0);
        // Sample rendered frames in the page, not a wall-clock instant that can
        // arrive late when other browser tests are taking screenshots.
        await page.locator('.scene-letter').evaluate(el => {
            window.paperTravel = [];
            const started = performance.now();
            const sample = () => {
                const y = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
                window.paperTravel.push(y);
                if (y > -42 && performance.now() - started < 2000) requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
        await trigger.hover();
        await page.waitForFunction(() => document.querySelector('.scene-envelope-trigger').getAttribute('aria-expanded') === 'true');
        await page.waitForFunction(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.scene-letter')).transform).m42 === -42);
        assert.equal(await page.evaluate(() => window.paperTravel.some(y => y < 0 && y > -42)), true, 'paper must render intermediate positions');
        assert.equal(await paperY(), -42);
        if (process.env.SCREENSHOT_DIR) await page.locator('.scene-hero').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'envelope-open-desktop.png') });
        await page.mouse.move(4, 4);
        await page.waitForFunction(() => document.querySelector('.scene-envelope-trigger').getAttribute('aria-expanded') === 'false');
        await page.waitForTimeout(950);
        assert.equal(await paperY(), 0);
        await trigger.focus();
        await trigger.press('Enter');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        await trigger.press('Escape');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    } finally { await page.close(); }
    const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    try {
        const trigger = mobile.locator('.scene-envelope-trigger');
        await trigger.tap();
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.equal(await mobile.locator('.scene-letter').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42), -42);
        if (process.env.SCREENSHOT_DIR) await mobile.locator('.scene-hero').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'envelope-open-mobile.png') });
        await trigger.tap();
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    } finally { await mobile.close(); }
});

test('envelope lid folds toward the viewer before the paper lifts and reverses without resetting', async () => {
    const page = await newPage({ reducedMotion: 'no-preference', deviceScaleFactor: 2 });
    try {
        await page.locator('.scene-envelope-trigger').hover();
        await page.evaluate(() => {
            window.foldTracks = [...document.querySelectorAll('.scene-envelope-flap, .scene-letter, .scene-envelope-seal')]
                .map(el => el.getAnimations()[0]);
        });
        const poseAt = async progress => page.evaluate(progress => {
            foldTracks.forEach(animation => { animation.pause(); animation.currentTime = animation.effect.getTiming().duration * progress; });
            const flap = document.querySelector('.scene-envelope-flap');
            const matrix = new DOMMatrixReadOnly(getComputedStyle(flap).transform);
            const paper = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.scene-letter')).transform);
            return { tipDepth: matrix.m23 * flap.offsetHeight + matrix.m43, paperY: paper.m42, hingeDepth: matrix.m43, flapY: matrix.m42, flipped: matrix.m22 };
        }, progress);
        const early = await poseAt(.13);
        assert.ok(early.tipDepth > 15, 'The lid must travel in front of the envelope, not disappear behind it');
        assert.equal(early.paperY, 0, 'The letter waits for the lid to clear the pocket');
        if (process.env.SCREENSHOT_DIR) await page.locator('.scene-hero').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'envelope-opening.png') });
        const open = await poseAt(1);
        assert.equal(open.flipped, -1, 'The fully open flap lies flat behind the letter');
        assert.equal(open.hingeDepth, early.hingeDepth, 'The fold does not slide away from its hinge');
        assert.equal(open.flapY, early.flapY);
        if (process.env.SCREENSHOT_DIR) await page.locator('.scene-hero').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'envelope-open-seam.png') });
        const midway = await poseAt(.55);
        const reversed = await page.evaluate(() => {
            const trigger = document.querySelector('.scene-envelope-trigger');
            trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
            return new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.scene-letter')).transform).m42;
        });
        assert.ok(Math.abs(reversed - midway.paperY) < .1, 'Leaving must reverse from the rendered position without a jump');
        await page.waitForFunction(() => foldTracks.every(animation => animation.playbackRate < 0 && animation.currentTime < 550));
        const continued = await page.evaluate(() => {
            const trigger = document.querySelector('.scene-envelope-trigger');
            const paper = document.querySelector('.scene-letter');
            const before = new DOMMatrixReadOnly(getComputedStyle(paper).transform).m42;
            trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
            return { before, after: new DOMMatrixReadOnly(getComputedStyle(paper).transform).m42,
                sameTracks: foldTracks.every(animation => animation.effect.target.getAnimations().includes(animation)) };
        });
        assert.ok(Math.abs(continued.before - continued.after) < .1);
        assert.ok(continued.sameTracks);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => foldTracks.every(animation => Math.abs(animation.currentTime - animation.effect.getTiming().duration) < .1 && ['paused', 'finished'].includes(animation.playState)));
        await page.locator('.scene-envelope-trigger').press('Escape');
        assert.equal(await page.locator('.scene-letter').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42), 0);
    } finally { await page.close(); }
});

test('new mail gives one arrival cue per batch and repeated, failed or empty queries do not replay it', async () => {
    const page = await newPage();
    let items = [{ id: 'a', subject: 'First letter' }, { id: 'b', subject: 'Second letter' }], success = true;
    try {
        await page.evaluate(() => {
            window.arrivalStarts = 0;
            const animate = Element.prototype.animate;
            Element.prototype.animate = function (...args) {
                if (this.matches('.scene-envelope-notice')) window.arrivalStarts++;
                return animate.apply(this, args);
            };
        });
        await page.route('**/api/get_mail', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success, mails: items }) }));
        await page.locator('#emailInput').fill('reader@example.com');
        const fetchMail = async () => {
            const response = page.waitForResponse(response => response.url().endsWith('/api/get_mail'));
            await page.locator('.get-mail-btn').click();
            await response;
            await page.waitForFunction(() => !document.querySelector('.get-mail-btn').disabled);
        };
        const count = () => page.evaluate(() => window.arrivalStarts);
        await fetchMail();
        assert.equal(await count(), 1);
        assert.equal(await page.locator('.scene-art').evaluate(el => el.classList.contains('has-new-mail')), true);
        assert.equal(await page.locator('.scene-envelope-notice').evaluate(el => el.getAnimations()[0].effect.getTiming().iterations), 1);
        await page.waitForTimeout(1300);
        assert.equal(await page.locator('.scene-envelope-notice').evaluate(el => el.getAnimations().length), 0);
        items.reverse();
        await fetchMail();
        assert.equal(await count(), 1);
        await page.locator('[data-scene="night"]').click();
        await page.locator('.scene-envelope-trigger').hover();
        assert.equal(await page.locator('.scene-art').evaluate(el => el.classList.contains('has-new-mail')), false);
        await page.mouse.move(4, 4);
        items.push({ id: 'c', subject: 'New letter' }, { id: 'd', subject: 'Another new letter' });
        await fetchMail();
        assert.equal(await count(), 2);
        await page.waitForTimeout(1200);
        success = false;
        await fetchMail();
        success = true; const savedItems = items; items = [];
        await fetchMail();
        items = savedItems;
        await fetchMail();
        assert.equal(await count(), 2);
        // Missing provider IDs must not use the random IDs assigned to table rows.
        items = [{ subject: 'No provider ID', date: '2026-10-12', body: 'Stable message body' }];
        await fetchMail();
        assert.equal(await count(), 3);
        await page.waitForTimeout(1200);
        await fetchMail();
        assert.equal(await count(), 3);
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        items = [{ id: 'background', subject: 'While hidden' }];
        await fetchMail();
        assert.equal(await count(), 3);
        await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
        assert.equal(await count(), 4);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        items = [{ id: 'reduced', subject: 'Quiet notification' }];
        await fetchMail();
        assert.equal(await count(), 4);
        assert.equal(await page.locator('.scene-envelope-notice').evaluate(el => el.getAnimations().length), 0);
        assert.equal(await page.locator('.scene-art').evaluate(el => el.classList.contains('has-new-mail')), true);
        await page.evaluate(() => MailScene.destroy());
        assert.equal(await page.locator('.scene-art').evaluate(el => el.classList.contains('has-new-mail')), false);
    } finally { await page.close(); }
});

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
        await page.frameLocator('iframe').locator('#frontendSettingsButton').waitFor();
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
            await frame.locator('#frontendSettingsButton').click();
            await frame.locator(`#colorThemeMenu [data-theme="${theme}"]`).click();
            await check(theme, ['night','rain'].includes(theme) ? theme : 'day');
            accents.add(await frame.locator('.get-mail-btn').evaluate(button => getComputedStyle(button).backgroundImage + getComputedStyle(button).backgroundColor));
            if (['sunny','night','rain'].includes(theme)) skies.add(await frame.locator('#sceneCanvas').evaluate(canvas => canvas.toDataURL()));
            if (process.env.SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
                await frame.locator('.scene-hero').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `envelope-${theme}-${width}.png`) });
            }
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
            await page.locator('#frontendSettingsButton').click();
            await page.locator('#frontendSettingsMenu:not([hidden])').waitFor();
            await check(mode, 'language-menu');
            await page.locator('#frontendSettingsButton').press('Escape');
            await page.locator('#frontendSettingsMenu').waitFor({ state: 'hidden' });
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
                const expected = getComputedStyle(probe); const result = { actual: [style.backgroundColor, style.color], expected: [expected.backgroundColor, expected.color], canvas: !!element.querySelector('#mailLoadingCanvas') };
                probe.remove(); return result;
            });
            assert.deepEqual(loading.actual, loading.expected);
            assert.equal(loading.canvas, true);
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
            await page.locator('#frontendSettingsButton').click();
            await page.locator(`#colorThemeMenu [data-theme="${mode === 'day' ? 'sunny' : mode}"]`).click();
            assert.equal(await page.locator(`[data-scene="${mode}"]`).getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('#emailInput').inputValue(), 'reader@example.com');
            assert.equal(await page.locator('#mailSubject').innerText(), 'Scene test letter');
            assert.equal(await page.locator('#mailDisplay').isVisible(), true);
            // Let the browser apply the new scene's colors before comparing them.
            await page.waitForFunction(() => {
                const body = getComputedStyle(document.querySelector('.mail-body--text'));
                const input = getComputedStyle(document.querySelector('.highlight-input'));
                return body.color === input.color;
            });
            assert.deepEqual(await contrastFailures(page, '#mailDisplay'), [], `Text mail must remain readable on the continuous reading surface in ${mode}`);
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
    let release;
    const gate = new Promise(resolve => { release = resolve; });
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
        await page.route('**/api/get_mail', async route => {
            await gate;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, mails: [] }) });
        });
        await page.locator('.get-mail-btn').click();
        await page.locator('#loading').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.mail-loading-fallback').isVisible(), true);
        assert.equal(await page.evaluate(() => MailLoading.state.animating), false);
        release();
        await page.locator('#loading').waitFor({ state: 'hidden' });
        assert.deepEqual(errors, []);
    } finally { release(); await page.close(); }
});
