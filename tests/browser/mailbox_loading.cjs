// Real shell and templates, synthetic responses only; never opens an application database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
const accounts = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, email: `account${i + 1}@example.com`, created_at: '2026-10-22 12:00:00', created_by_admin: 'fixture', account_status: 'normal' }));
before(async () => {
    const pages = JSON.parse(execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import json,sys
app=Flask(__name__,template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
with app.test_request_context('/'):
 print(json.dumps(dict(mailbox=render_template('admin/mailbox.html',embedded=True,admin_username='fixture'),shell=render_template('react_app.html',app_props={'adminUsername':'fixture','adminPermissions':['mailbox'],'systemTitle':'邮件查看系统'}))))
`, root], { encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 }));
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (!file.startsWith(root + '/static/') || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
            res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream');
            return res.end(fs.readFileSync(file));
        }
        if (url.pathname.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, language: 'zh', data: url.pathname === '/admin/api/mailbox' ? accounts : [], groups: [{ id: 1, name: 'Team', parent_id: null }], mappings: accounts.map(account => ({ mailbox_id: account.id, group_id: 1 })) }));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(url.pathname.startsWith('/legacy/') ? pages.mailbox : pages.shell);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    const engine = process.env.BROWSER_ENGINE || 'chromium';
    browser = await playwright[engine].launch({ headless: true,
        ...(engine === 'chromium' && process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
        ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
});
after(async () => {
    await browser?.close();
    if (server) { const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed; }
});
async function ready(page) {
    await page.waitForFunction(() => document.querySelector('#mailboxListLoading').hidden && document.querySelectorAll('#mailboxTable tbody tr[data-mailbox-id]').length === 100);
}

test('initial list and groups load in parallel once, with the public loader until both finish', async () => {
    const page = await browser.newPage();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const pending = [];
    try {
        await page.route('**/admin/api/mailbox**', async route => { pending.push(route.request().url()); await gate; await route.continue(); });
        await page.goto(origin + '/legacy/admin/mailbox');
        await page.waitForFunction(() => window.MailLoading?.state.active);
        await page.waitForTimeout(150);
        assert.equal(pending.length, 2, 'list and full group metadata must already be in flight together');
        assert.equal(pending.filter(url => url.includes('mailbox-groups')).length, 1);
        assert.equal(await page.locator('#mailboxListLoading').isVisible(), true);
        assert.equal(await page.locator('.mailbox-empty-row').count(), 0, 'loading must not flash an empty result');
        assert.equal(await page.evaluate(() => MailLoading.state.animating), true);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !MailLoading.state.animating);
        release();
        await ready(page);
        assert.equal(await page.evaluate(() => MailLoading.state.active || MailLoading.state.animating), false);
        assert.equal(pending.length, 2, 'first render must not refetch mappings');
        assert.match(await page.locator('.group-item[data-group-id="1"] .group-count').innerText(), /100/);
    } finally { release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.close(); }
});

test('list failures offer retry; a later reload cancels stale data and keeps the current view', async () => {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    let release;
    try {
        await page.route('**/admin/api/mailbox?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) }), { times: 1 });
        await page.goto(origin + '/legacy/admin/mailbox');
        await page.locator('#mailboxListError').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => MailLoading.state.active), false);
        await page.locator('#mailboxListError button').click();
        await ready(page);
        const gate = new Promise(resolve => { release = resolve; });
        let requests = 0;
        await page.route('**/admin/api/mailbox?*', async route => {
            const first = ++requests === 1;
            if (first) await gate;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ ...accounts[0], email: first ? 'stale@example.com' : 'latest@example.com' }] }) });
        });
        await page.evaluate(() => { window.firstReload = loadMailboxes(); });
        await page.waitForTimeout(100);
        await page.evaluate(() => loadMailboxes());
        release();
        await page.evaluate(() => window.firstReload);
        assert.equal(await page.locator('.mailbox-email-address').innerText(), 'latest@example.com');
        assert.equal(await page.locator('#mailboxListLoading').isVisible(), false);
        assert.equal(await page.locator('#mailboxListError').isVisible(), false);
    } finally { release?.(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.close(); }
});

for (const [width, height] of [[320, 740], [390, 844], [844, 390]]) test(`phone scroll, compact actions and modal return at ${width}x${height}`, async () => {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(origin + '/admin/mailbox');
        const frame = page.frames().find(frame => frame.url().includes('/legacy/')) || await (async () => { await page.locator('.legacy-frame-wrap.is-loaded').waitFor(); return page.frames().find(frame => frame.url().includes('/legacy/')); })();
        await ready(frame);
        assert.equal(await page.locator('.admin-title .ant-typography').count(), 1, 'only the page title remains');
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1), false, 'the shell must not scroll around the iframe');
        if (width < 640) {
            const buttons = frame.locator('#mailboxTable tr[data-mailbox-id]').first().locator('.mailbox-actions > button, .mailbox-actions-more > button');
            const bounds = await buttons.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { top: r.top, height: r.height }; }));
            assert.equal(new Set(bounds.map(box => box.top)).size, 1);
            assert.ok(bounds.every(box => box.height >= 34 && box.height <= 38));
            if ((process.env.BROWSER_ENGINE || 'chromium') === 'chromium') {
                await buttons.first().scrollIntoViewIfNeeded();
                const button = await buttons.first().boundingBox();
                const session = await page.context().newCDPSession(page);
                const start = await frame.evaluate(() => document.scrollingElement.scrollTop);
                const x = button.x + button.width / 2, y = button.y + button.height / 2;
                await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                for (let step = 1; step <= 8; step++) {
                    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - Math.min(180, y - 70) * step / 8 }] });
                    await page.waitForTimeout(20);
                }
                await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await frame.waitForFunction(before => document.scrollingElement.scrollTop > before + 10, start);
                // Finish native inertial scrolling before measuring dialog return positions.
                await page.waitForTimeout(500);
                assert.equal(await frame.locator('#receiveModal').isVisible(), false, 'a swipe over receive must scroll instead of opening mail');
                await session.detach();
            }
        }
        const row = frame.locator('#mailboxTable tr[data-mailbox-id]').nth(60);
        await row.scrollIntoViewIfNeeded();
        const scroll = () => frame.evaluate(() => document.scrollingElement.scrollTop);
        const before = await scroll();
        assert.ok(before > 0, 'the document can scroll to later accounts');
        await row.locator('[data-action="remarks"]').click();
        await frame.locator('#remarksModal').waitFor({ state: 'visible' });
        await frame.locator('#remarksModal .modal-close').click();
        await frame.locator('#remarksModal').waitFor({ state: 'hidden' });
        assert.ok(Math.abs(await scroll() - before) <= 2, 'closing a dialog preserves the list position');
        await row.locator('.mailbox-checkbox').check();
        const selected = await frame.locator('#bulkSelectedCount').innerText();
        const scrolling = await scroll();
        await frame.evaluate(() => loadMailboxes(currentPage, searchQuery));
        assert.equal(await frame.locator('#bulkSelectedCount').innerText(), selected);
        assert.ok(Math.abs(await scroll() - scrolling) <= 2, 'refreshing data does not jump the list');
        await frame.locator('#paginationContainer').scrollIntoViewIfNeeded();
        const bottom = await frame.locator('#paginationContainer').boundingBox();
        assert.ok(bottom.y >= 0 && bottom.y + bottom.height <= height + 1, JSON.stringify(bottom));
        assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `mailbox-compact-${width}.png`) });
        }
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
