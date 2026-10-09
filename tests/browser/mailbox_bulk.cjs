// Synthetic fixtures only; never opens the application database or tests real accounts.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
const statuses = ['banned', 'invalid_credentials', 'network_error', 'test_error', 'pending', 'normal'];
const seed = () => Array.from({ length: 66 }, (_, i) => ({
    id: i + 1, email: `account${i + 1}@example.com`, server: 'imap.example.com', port: 993,
    protocol: 'imap', ssl: 1, created_by_admin: i < 60 ? 'alice' : 'bob', account_status: statuses[i % 6]
}));
let accounts, tested, deleted, active, maxActive, delay, failure, received;
before(async () => {
    const html = execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import sys
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
app.jinja_env.globals['url_for'] = lambda endpoint, **kw: '/static/' + kw['filename'] if endpoint == 'static' else '/' + endpoint
with app.test_request_context('/legacy/admin/mailbox'):
    print(render_template('admin/mailbox.html', embedded=True, admin_username='fixture'))
`, root], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (file.startsWith(root + '/static/') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
                return res.end(fs.readFileSync(file));
            }
            res.statusCode = 404; return res.end();
        }
        if (url.pathname.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            let payload = { success: true, language: 'zh', data: [], groups: [{ id: 1, name: 'Team A', parent_id: null }, { id: 2, name: '客户服务', parent_id: 1 }], mappings: accounts.filter(a => a.id <= 60).map(a => ({ mailbox_id: a.id, group_id: a.id <= 30 ? 2 : 1 })) };
            if (url.pathname === '/api/get_mail') {
                let body = ''; for await (const chunk of req) body += chunk;
                const { email } = JSON.parse(body);
                received.push(email);
                payload = { success: true, mails: [{ subject: `Mail for ${email}`, from: 'sender@example.com', to: email, body: 'Your confirmation code: 123456', body_type: 'text', date: '2026-10-02 12:00:00' }] };
            }
            if (url.pathname === '/admin/api/mailbox') {
                if (req.method === 'POST') {
                    let body = ''; for await (const chunk of req) body += chunk;
                    const data = JSON.parse(body);
                    if (data.action === 'test') {
                        tested.push(data.id); active++; maxActive = Math.max(active, maxActive);
                        await new Promise(resolve => setTimeout(resolve, delay)); active--;
                        if (failure) payload = { success: false, message: '登录状态已失效' };
                        else {
                            const row = accounts.find(a => a.id === data.id);
                            row.account_status = data.id % 3 === 0 ? 'network_error' : data.id % 3 === 1 ? 'normal' : 'invalid_credentials';
                            payload = { success: row.account_status === 'normal', account_status: row.account_status, last_test: '2026-10-02 12:00:00', message: 'Fixture result' };
                        }
                    } else if (data.action === 'batch_delete') {
                        deleted.push(...data.ids);
                        accounts = accounts.filter(a => !data.ids.includes(a.id));
                    }
                } else {
                    const query = url.searchParams.get('search') || '';
                    payload.data = url.searchParams.has('id')
                        ? accounts.find(a => a.id === Number(url.searchParams.get('id')))
                        : accounts.filter(a => a.email.includes(query));
                }
            }
            return res.end(JSON.stringify(payload));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function newPage(viewport = { width: 1440, height: 1000 }) {
    accounts = seed(); tested = []; deleted = []; received = []; active = 0; maxActive = 0; delay = 20; failure = false;
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    if (process.env.DEBUG_UI) {
        page.on('pageerror', error => console.error(error));
        page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    }
    page.setDefaultTimeout(8000);
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelector('#batchTestFilteredBtn').textContent.includes('(66)'));
    return page;
}

for (const width of [1440, 768, 390]) test(`add menu stays visible and priority actions work at ${width}px`, async () => {
    const page = await newPage({ width, height: 1000 });
    try {
        assert.equal(await page.locator('#mailboxBatchProgress').isVisible(), false);
        const menu = page.locator('.mailbox-heading-actions .au-dropdown-menu');
        const toggle = page.locator('.mailbox-heading-actions .au-dropdown-toggle');
        await toggle.click();
        const bounds = await menu.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'the entire add menu must fit the viewport');
        for (const item of await menu.locator('button').all()) {
            assert.equal(await item.evaluate(button => {
                const rect = button.getBoundingClientRect();
                return button.contains(document.elementFromPoint(rect.right - 2, rect.y + rect.height / 2));
            }), true, 'menu items must not be clipped or covered by the filter card');
        }
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `mailbox-add-menu-${width}.png`) });
        }
        await menu.getByRole('button', { name: '服务器地址管理', exact: true }).click();
        assert.equal(await page.locator('#serverModal').isVisible(), true);
        await page.locator('#serverModal .modal-close').click();

        const actions = page.locator('#mailboxTable tbody tr').first().locator('.mailbox-actions');
        const buttons = actions.locator(':scope > button, :scope > .mailbox-actions-more > button');
        assert.deepEqual(await buttons.allTextContents(), ['收件', '测试', '备注', '更多']);
        await buttons.first().scrollIntoViewIfNeeded();
        const boxes = await buttons.evaluateAll(items => items.map(item => {
            const rect = item.getBoundingClientRect();
            const range = document.createRange(); range.selectNodeContents(item);
            const text = range.getBoundingClientRect();
            return { y: rect.y, height: rect.height, textOffset: Math.abs(text.x + text.width / 2 - rect.x - rect.width / 2) };
        }));
        assert.equal(new Set(boxes.map(box => box.y)).size, 1, 'all four action buttons should share a row');
        assert.equal(new Set(boxes.map(box => box.height)).size, 1, 'all four action buttons should have equal height');
        assert.ok(boxes.every(box => box.textOffset < 1), 'button labels should be horizontally centered');

        await actions.locator('[data-action="test"]').click();
        await page.waitForFunction(() => document.querySelector('#mailboxLatestTestResult').textContent.includes('Fixture result'));
        assert.deepEqual(tested, [66]);
        await actions.locator('[data-action="remarks"]').click();
        await page.locator('#remarksModal.show').waitFor();
        assert.equal(await page.locator('#remarksMailboxId').inputValue(), '66');
        await page.locator('#remarksModal .modal-close').click();
        await actions.locator('[data-action="more"]').click();
        assert.deepEqual(await actions.locator('.mailbox-more-menu button').allTextContents(), ['编辑邮箱', '发件', '删除']);
        await actions.locator('[data-action="send"]').click();
        assert.equal(await page.locator('#sendMailModal').isVisible(), true);
    } finally { await page.close(); }
});

test('dashboard status navigation overrides a remembered group', async () => {
    const page = await newPage();
    try {
        await page.evaluate(() => localStorage.setItem('mailboxActiveGroup:fixture', '2'));
        await page.goto(origin + '/?status=invalid&group=all');
        await page.waitForFunction(() => document.querySelector('#batchTestFilteredBtn').textContent.includes('(22)'));
        assert.equal(await page.locator('[data-status-view="invalid"]').getAttribute('aria-pressed'), 'true');
    } finally { await page.close(); }
});

test('mailbox themes update surfaces and multicolor Canvas without resetting filters', async () => {
    const page = await newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.locator('#searchInput').fill('account1');
        const themes = await page.evaluate(() => MailThemes.themes.map(theme => theme.key));
        const backgrounds = new Set();
        const canvases = new Set();
        for (const theme of themes) {
            await page.evaluate(key => AppColorTheme.setTheme(key), theme);
            const result = await page.evaluate(() => {
                const style = element => getComputedStyle(element);
                return {
                    background: style(document.querySelector('.mailbox-workspace-heading')).backgroundImage,
                    colors: [...document.querySelector('.mailbox-actions').querySelectorAll(':scope > button, :scope > .mailbox-actions-more > button')].map(button => style(button).backgroundColor),
                    canvas: document.querySelector('#adminBgCanvas').toDataURL()
                };
            });
            assert.equal(result.background.includes('gradient'), true);
            assert.equal(new Set(result.colors).size, 4, 'receive, test, notes and more must have independent background colors');
            backgrounds.add(result.background);
            canvases.add(result.canvas);
            assert.equal(await page.locator('#searchInput').inputValue(), 'account1');
            assert.equal(await page.locator('#adminMailboxCount').innerText(), '11');
            if (process.env.SCREENSHOT_DIR && ['emerald', 'night', 'rose'].includes(theme)) {
                fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `mailbox-theme-${theme}.png`) });
            }
        }
        assert.equal(backgrounds.size, themes.length, 'each theme must have a distinct heading gradient');
        assert.equal(canvases.size, themes.length, 'Canvas must repaint when the theme changes');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const before = await page.locator('#adminBgCanvas').evaluate(canvas => canvas.toDataURL());
        await page.waitForFunction(previous => document.querySelector('#adminBgCanvas').toDataURL() !== previous, before);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // Let the preference event settle, then verify there are no further animated draws.
        const stable = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(document.querySelector('#adminBgCanvas').toDataURL()))));
        const after = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(document.querySelector('#adminBgCanvas').toDataURL())))));
        assert.equal(after, stable);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mailbox-theme-mobile.png') });
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('invalid filter excludes network/unknown/untested accounts, selects across pages, confirms deletion', async () => {
    const page = await newPage();
    try {
        assert.equal(await page.locator('#deleteNormalAccountsBtn').count(), 0);
        await page.locator('#perPageSelect').selectOption('20');
        await page.locator('#filterInvalidAccountsBtn').click();
        assert.equal(await page.locator('#mailboxTable tbody tr').count(), 20);
        assert.match(await page.locator('#batchTestFilteredBtn').innerText(), /\(22\)/);
        await page.locator('#selectFilteredMailboxesBtn').click();
        assert.equal(await page.locator('#bulkSelectedCount').innerText(), '22');
        page.once('dialog', dialog => { assert.match(dialog.message(), /22.*跨页.*不可撤销/); dialog.dismiss(); });
        await page.locator('#batchDeleteMailboxesBtn').click();
        assert.deepEqual(deleted, []);
        page.once('dialog', dialog => dialog.accept());
        await page.locator('#batchDeleteMailboxesBtn').click();
        await page.waitForFunction(() => document.querySelector('#batchTestFilteredBtn').disabled);
        assert.deepEqual(deleted.sort((a,b) => a-b), seed().filter(a => ['banned', 'invalid_credentials'].includes(a.account_status)).map(a => a.id));
        assert.equal(accounts.length, 44);
    } finally { await page.close(); }
});

test('filtered tests respect owner, group, search and status; freeze targets as results change', async () => {
    const page = await newPage();
    try {
        await page.locator('#searchInput').fill('account1');
        await page.locator('#searchInput').press('Enter');
        await page.waitForFunction(() => document.querySelector('#batchTestFilteredBtn').textContent.includes('(11)'));
        await page.evaluate(() => { selectedGroupId = 1; filterMailboxesByOwner('alice'); });
        await page.locator('#filterInvalidAccountsBtn').click();
        await page.locator('#batchTestFilteredBtn').click();
        await page.waitForFunction(() => document.querySelector('#mailboxBatchProgressText').textContent.startsWith('批量测试完成'));
        assert.deepEqual(tested.sort((a,b) => a-b), [1, 13, 14, 19]);
        assert.equal(maxActive, 3);
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /4 \/ 4\s+正常\s+3\s+无效\s+1\s+待重试\s+0/);
        assert.equal(await page.locator('#stopBatchTestBtn').isVisible(), false);
        const colors = await page.locator('#mailboxBatchProgress .mailbox-test-tag').evaluateAll(tags => tags.map(tag => getComputedStyle(tag).color));
        assert.equal(new Set(colors).size, 3, 'healthy, invalid and retry results must have distinct colors');
        assert.match(await page.locator('#batchTestFilteredBtn').innerText(), /\(1\)/);
        await page.evaluate(() => AppI18n.setLanguage('en'));
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /Batch test complete/);
        assert.match(await page.locator('#mailboxBatchProgress .banned').innerText(), /Invalid\s+1/);
        assert.match(await page.locator('#mailboxBatchProgress .test_error').innerText(), /Retry needed\s+0/);
        await page.evaluate(() => AppI18n.setLanguage('zh'));
        if (process.env.SCREENSHOT_DIR) {
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mailbox-batch-complete.png') });
        }
    } finally { await page.close(); }
});

test('selected testing keeps other accounts untouched; request failures preserve status', async () => {
    const page = await newPage();
    try {
        failure = true;
        await page.locator('.mailbox-checkbox[value="1"]').check();
        await page.locator('.mailbox-checkbox[value="6"]').check();
        await page.locator('#batchTestSelectedBtn').click();
        await page.waitForFunction(() => document.querySelector('#mailboxBatchProgressText').textContent.startsWith('批量测试完成'));
        assert.deepEqual(tested.sort((a,b) => a-b), [1, 6]);
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /待重试\s+2/);
        assert.deepEqual(await page.evaluate(() => mailboxData.filter(a => [1,6].includes(a.id)).map(a => a.account_status)), ['banned', 'normal']);
        assert.equal(await page.locator('#bulkSelectedCount').innerText(), '2');
    } finally { await page.close(); }
});

test('stop waits for active tests, blocks overlapping runs and leaves remaining accounts untouched', async () => {
    const page = await newPage();
    try {
        delay = 400;
        await page.locator('#selectFilteredMailboxesBtn').click();
        await page.locator('#batchTestSelectedBtn').click();
        await page.waitForFunction(() => document.querySelectorAll('[data-action="test"]:disabled').length === 3);
        assert.equal(await page.locator('#batchDeleteMailboxesBtn').isDisabled(), true);
        assert.equal(await page.locator('#batchTestFilteredBtn').isDisabled(), true);
        const alignment = await page.evaluate(() => {
            const button = document.querySelector('#stopBatchTestBtn').getBoundingClientRect();
            const status = document.querySelector('#mailboxBatchProgressText').getBoundingClientRect();
            return Math.abs(button.y + button.height / 2 - status.y - status.height / 2);
        });
        assert.ok(alignment < 1, 'stop button and status summary should be vertically centered');
        if (process.env.SCREENSHOT_DIR) {
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mailbox-batch-running.png') });
        }
        await page.locator('#stopBatchTestBtn').click();
        await page.waitForFunction(() => document.querySelector('#mailboxBatchProgressText').textContent.startsWith('批量测试已停止'));
        assert.equal(tested.length, 3);
        assert.equal(active, 0);
        assert.deepEqual(accounts.slice(3), seed().slice(3));
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /3 \/ 66\s+正常\s+1\s+无效\s+1\s+待重试\s+1/);
        assert.equal(await page.locator('#stopBatchTestBtn').isVisible(), false);
        assert.equal(await page.locator('#batchDeleteMailboxesBtn').isEnabled(), true);
    } finally { await page.close(); }
});

test('mobile tools remain inside viewport and labels translate', async () => {
    const page = await newPage({ width: 390, height: 844 });
    try {
        for (const id of ['batchTestFilteredBtn', 'filterInvalidAccountsBtn', 'selectFilteredMailboxesBtn']) {
            const box = await page.locator(`#${id}`).boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= 390, `${id} must fit mobile screen`);
        }
        await page.evaluate(() => AppI18n.setLanguage('en'));
        assert.match(await page.locator('#batchTestFilteredBtn').innerText(), /Test filtered mailboxes \(66\)/);
        await page.evaluate(() => AppI18n.setLanguage('zh'));
        await page.locator('#selectFilteredMailboxesBtn').click();
        for (const id of ['batchTestSelectedBtn', 'batchDeleteMailboxesBtn']) {
            await page.locator(`#${id}`).scrollIntoViewIfNeeded();
            const box = await page.locator(`#${id}`).boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, `${id} must be accessible on mobile`);
        }
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.evaluate(() => AppI18n.setLanguage('zh'));
            await page.locator('#mailboxBulkBar button').last().click();
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mailbox-bulk-mobile.png'), fullPage: false });
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mailbox-bulk-desktop.png'), fullPage: true });
        }
    } finally { await page.close(); }
});

test('sidebar handle animates reversibly, preserves filters and remembers desktop width state', async () => {
    const page = await newPage();
    try {
        await page.locator('#searchInput').fill('account1');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => document.querySelector('.group-panel-ready'));
        const samples = await page.evaluate(async () => {
            const panel = document.querySelector('.mail-panel');
            const handle = document.querySelector('#groupPanelToggle');
            const x = () => panel.getBoundingClientRect().x;
            const start = x();
            handle.click();
            const during = [];
            const sampleUntil = milliseconds => new Promise(resolve => {
                const began = performance.now();
                function sample(now) {
                    during.push(x());
                    if (now - began < milliseconds) requestAnimationFrame(sample);
                    else resolve();
                }
                requestAnimationFrame(sample);
            });
            await sampleUntil(110);
            const reverseAt = x();
            handle.click();
            await sampleUntil(430);
            return { start, reverseAt, end: x(), during };
        });
        assert.ok(samples.reverseAt < samples.start - 20, 'mail list should expand during the slide');
        assert.ok(Math.abs(samples.end - samples.start) < 1, 'reversing an unfinished slide should restore the expanded sidebar');
        assert.ok(new Set(samples.during.map(Math.round)).size > 3, 'layout should interpolate across frames');
        const handle = page.locator('#groupPanelToggle');
        await handle.click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#groupPanel')).visibility === 'hidden');
        assert.equal(await handle.getAttribute('aria-expanded'), 'false');
        assert.equal(await handle.getAttribute('title'), '展开分组侧栏');
        assert.equal(await page.locator('#groupPanel').evaluate(panel => panel.inert), true);
        assert.equal(await page.locator('.group-panel-header-toggle').getAttribute('aria-label'), '新建分组');
        assert.equal(await page.locator('#searchInput').inputValue(), 'account1');
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '11');
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'sidebar-collapsed.png') });
        await page.reload();
        await page.waitForFunction(() => document.querySelector('.group-panel-ready'));
        assert.equal(await handle.getAttribute('aria-expanded'), 'false');
        await page.evaluate(() => AppI18n.setLanguage('en'));
        assert.equal(await handle.getAttribute('title'), 'Show groups sidebar');
        await handle.click();
        assert.equal(await handle.getAttribute('title'), 'Hide groups sidebar');
        await page.evaluate(() => AppI18n.setLanguage('zh'));
        assert.equal(await handle.getAttribute('title'), '收起分组侧栏');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => document.querySelector('#mobileGroupPanelToggle').getAttribute('aria-expanded') === 'false');
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.waitForFunction(() => document.querySelector('#groupPanelToggle').getAttribute('aria-expanded') === 'true');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await handle.click();
        assert.equal(await page.locator('#groupPanel').isVisible(), false, 'reduced motion should close immediately');
        assert.equal(await page.locator('.content-grid').evaluate(grid => getComputedStyle(grid).transitionDuration), '0s');
    } finally { await page.close(); }
});

test('mobile groups drawer overlays the list, returns focus and closes on selection, Escape or backdrop', async () => {
    const page = await newPage({ width: 390, height: 844 });
    try {
        const trigger = page.locator('#mobileGroupPanelToggle');
        assert.equal(await page.locator('#groupPanel').isVisible(), false);
        const listBefore = await page.locator('.mail-panel').boundingBox();
        await trigger.click();
        assert.equal(await page.locator('#groupSidebar').getAttribute('aria-modal'), 'true');
        assert.equal(await page.locator('#groupSearchInput').evaluate(input => input === document.activeElement), true);
        assert.equal(await page.locator('.mail-panel').evaluate(panel => panel.inert), true);
        const listAfter = await page.locator('.mail-panel').boundingBox();
        assert.deepEqual(listAfter, listBefore, 'opening the drawer must not move the mailbox list');
        await page.locator('#groupPanelToggle').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('.group-panel-header-toggle').evaluate(button => button === document.activeElement), true);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.locator('#groupPanelToggle').evaluate(button => button === document.activeElement), true);
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'sidebar-mobile-open.png') });
        await page.locator('#groupSearchInput').fill('客户');
        await page.locator('.group-item[data-group-id="2"]').click();
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '客户服务');
        assert.equal(await page.locator('#groupPanel').isVisible(), false);
        assert.equal(await trigger.evaluate(button => button === document.activeElement), true);
        assert.equal(await page.locator('.mail-panel').evaluate(panel => panel.inert), false);
        await trigger.click();
        await page.keyboard.press('Escape');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        await trigger.click();
        await page.mouse.click(380, 420);
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('mailbox-groups-open')), false);
    } finally { await page.close(); }
});

test('menus and modals animate out, reopen safely, and keep keyboard focus usable', async () => {
    const page = await newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const trigger = page.locator('.au-dropdown-toggle');
        const menu = page.locator('.au-dropdown-menu');
        await trigger.click();
        await page.waitForFunction(() => !document.querySelector('.au-dropdown-menu').getAnimations().length);
        await page.evaluate(() => document.querySelector('.au-dropdown-toggle').click());
        assert.equal(await menu.evaluate(element => element.inert && element.getAnimations().length > 0), true, 'closed menus must stop accepting input while fading out');
        await page.evaluate(() => document.querySelector('.au-dropdown-toggle').click());
        await menu.getByRole('button', { name: '单个添加', exact: true }).click();
        const modal = page.locator('#mailboxModal');
        assert.equal(await modal.getAttribute('aria-modal'), 'true');
        assert.equal(await modal.evaluate(element => element.contains(document.activeElement)), true);
        await page.evaluate(() => closeModal());
        assert.equal(await modal.evaluate(element => element.classList.contains('is-closing') && element.inert), true);
        await page.evaluate(() => { showAddModal(); document.querySelector('#singleImportContent').value = 'draft@example.com'; });
        await page.waitForFunction(() => !document.querySelector('#mailboxModal').getAnimations().length);
        assert.equal(await modal.getAttribute('aria-hidden'), 'false');
        assert.equal(await page.locator('#singleImportContent').inputValue(), 'draft@example.com', 'an old close callback must not clear a reopened form');
        await modal.locator('.modal-footer button').last().focus();
        await page.keyboard.press('Tab');
        assert.equal(await modal.locator('.modal-close').evaluate(button => button === document.activeElement), true);
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate(button => button === document.activeElement), true);
        await page.locator('#columnConfigBtn').click();
        await page.keyboard.press('Escape');
        await page.locator('#columnConfigMenu').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#columnConfigBtn').evaluate(button => button === document.activeElement), true);
        await page.locator('#mailboxTable [data-action="more"]').first().click();
        await page.keyboard.press('Escape');
        await page.locator('.mailbox-more-menu').first().waitFor({ state: 'hidden' });
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('group and bulk disclosure transitions preserve nodes and finish cleanly after quick reversal', async () => {
    const page = await newPage();
    try {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const heights = await page.evaluate(async () => {
            const item = document.querySelector('.group-item[data-group-id="1"]');
            const button = item.querySelector('.group-toggle');
            const children = item.parentElement.querySelector('.group-children');
            button.click();
            const values = [];
            const began = performance.now();
            await new Promise(resolve => {
                function frame(now) {
                    values.push(children.getBoundingClientRect().height);
                    if (now - began < 95) requestAnimationFrame(frame); else resolve();
                }
                requestAnimationFrame(frame);
            });
            button.click(); button.click();
            return { values, sameNode: item === document.querySelector('.group-item[data-group-id="1"]') };
        });
        assert.equal(heights.sameNode, true, 'expanding children must not rebuild the group tree');
        assert.ok(new Set(heights.values.map(Math.round)).size > 2, 'children must slide open over multiple frames');
        await page.waitForFunction(() => !document.querySelector('.group-children').getAnimations().length);
        assert.equal(await page.locator('.group-item[data-group-id="2"]').isVisible(), true);
        await page.locator('#selectFilteredMailboxesBtn').click();
        await page.waitForFunction(() => !document.querySelector('#mailboxBulkBar').getAnimations().length);
        const barHeight = await page.locator('#mailboxBulkBar').evaluate(bar => bar.getBoundingClientRect().height);
        assert.ok(barHeight > 30);
        await page.evaluate(() => { clearMailboxSelection(); selectFilteredMailboxes(); });
        await page.waitForFunction(() => !document.querySelector('#mailboxBulkBar').getAnimations().length);
        assert.equal(await page.locator('#mailboxBulkBar').evaluate(bar => bar.getBoundingClientRect().height), barHeight);
        await page.evaluate(() => clearMailboxSelection());
        await page.locator('#mailboxBulkBar').waitFor({ state: 'hidden' });
        await page.locator('#searchInput').fill('account1');
        assert.equal(await page.locator('#mailboxTable tbody tr').evaluateAll(rows => rows.every(row => !row.classList.contains('au-row-enter') && getComputedStyle(row).animationName === 'none')), true, 'results should not replay per-row stagger animations');
    } finally { await page.close(); }
});

test('live reduced motion completes pending dismissals and resets modal scroll lock', async () => {
    const page = await newPage({ width: 390, height: 844 });
    try {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { showAddModal(); closeModal(); });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.locator('#mailboxModal').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('mailbox-modal-open')), false);
        await page.evaluate(() => { const id = showToast('Fixture toast', 'success', 0); removeToast(id); });
        assert.equal(await page.locator('.toast').count(), 0);
        await page.locator('#mobileGroupPanelToggle').click();
        await page.locator('.group-panel-header-toggle').click();
        await page.locator('#groupNameInput').fill('Fixture draft');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#groupModal').isVisible(), false);
        assert.equal(await page.locator('#groupPanel').isVisible(), true, 'Escape should only close the top surface');
        assert.equal(await page.locator('.group-panel-header-toggle').evaluate(button => button === document.activeElement), true);
    } finally { await page.close(); }
});

test('group browsing is visible, searchable, remembers the last group and keeps counts stable during mailbox search', async () => {
    const page = await newPage();
    try {
        assert.equal(await page.locator('#groupPanel').isVisible(), true);
        const group = page.locator('.group-item[data-group-id="1"]');
        const toggle = group.locator('.group-toggle');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('.group-item[data-group-id="2"]').isVisible(), true);
        await toggle.press('Enter');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('.group-item[data-group-id="2"]').isVisible(), false);
        const actions = group.locator('.group-actions-button');
        await actions.click();
        assert.equal(await actions.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#groupContextMenu').isVisible(), true);
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'group-arrows.png') });
        }
        await actions.click();
        assert.equal(await actions.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#groupContextMenu').isVisible(), false);
        await actions.click();
        await page.keyboard.press('Escape');
        assert.equal(await actions.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#groupContextMenu').isVisible(), false);
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '所有分组');
        await page.locator('#groupSearchInput').fill('客户');
        await page.locator('.group-item[data-group-id="2"]').click();
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '客户服务');
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '30');
        await page.locator('#searchInput').fill('account1');
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '11');
        assert.match(await page.locator('.group-item[data-group-id="1"] .group-count').innerText(), /60/);
        await page.locator('#ownerFilterSelect').selectOption('bob');
        assert.equal(await page.locator('.mailbox-empty').isVisible(), true);
        await page.locator('#resetMailboxFiltersBtn').click();
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '30');
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '客户服务');
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#adminMailboxCount').textContent === '30');
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '客户服务');
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'workspace-desktop.png'), fullPage: true });
    } finally { await page.close(); }
});

test('addresses and icons copy without receiving; the receive action keeps mailbox navigation in group', async () => {
    const page = await newPage();
    try {
        await page.locator('#groupSearchInput').fill('客户');
        await page.locator('.group-item[data-group-id="2"]').click();
        await page.evaluate(() => { window.writeTextToClipboard = async text => { window.copiedAddress = text; return true; }; });
        await page.locator('tr[data-mailbox-id="30"] .mailbox-email-copy').click();
        assert.equal(await page.evaluate(() => window.copiedAddress), 'account30@example.com');
        assert.equal(await page.locator('#receiveModal').isVisible(), false);
        const cell = page.locator('tr[data-mailbox-id="30"] .mailbox-email-cell');
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.evaluate(() => { window.copiedAddress = null; });
            await cell.locator('.mailbox-email-address').click();
            assert.equal(await page.evaluate(() => window.copiedAddress), 'account30@example.com');
            assert.equal(await page.locator('#receiveModal').isVisible(), false);
            assert.deepEqual(received, [], 'copying an address must not request any email');
            const alignment = await cell.evaluate(element => {
                const address = element.querySelector('.mailbox-email-address').getBoundingClientRect();
                const icon = element.querySelector('.mailbox-email-copy').getBoundingClientRect();
                const group = element.querySelector('.mailbox-email-group').getBoundingClientRect();
                const content = element.querySelector('.mailbox-email-content').getBoundingClientRect();
                const centerY = rect => rect.y + rect.height / 2;
                const row = element.closest('tr');
                const peers = innerWidth > 640
                    ? ['.mailbox-test-tag', '.mailbox-owner-tag'].map(selector => row.querySelector(selector).getBoundingClientRect())
                    : [];
                return { centers: [content, ...peers].map(rect => Math.abs(centerY(rect) - centerY(icon))), left: Math.abs(address.x - group.x), groupBelow: group.y >= address.bottom, groupClear: group.right <= icon.left };
            });
            assert.ok(alignment.centers.every(offset => offset < 1) && alignment.left < 1 && alignment.groupBelow && alignment.groupClear, 'copy icon centers on the full email cell and desktop badges; group stays below the address without overlapping the icon');
            if (process.env.SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
                await cell.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `mailbox-copy-${width}.png`) });
            }
        }
        await page.evaluate(() => { window.copiedAddress = null; });
        await cell.locator('.mailbox-email-address').press('Enter');
        assert.equal(await page.evaluate(() => window.copiedAddress), 'account30@example.com');
        assert.deepEqual(received, []);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('tr[data-mailbox-id="30"] [data-action="receive"]').click();
        await page.waitForFunction(() => document.querySelector('#receiveTableBody').textContent.includes('Mail for account30@example.com'));
        assert.equal(await page.locator('#receivePreviousMailbox').isDisabled(), true);
        await page.locator('#receiveNextMailbox').click();
        await page.waitForFunction(() => document.querySelector('#receiveTableBody').textContent.includes('Mail for account29@example.com'));
        assert.equal(await page.locator('#receiveMailboxPosition').innerText(), '2 / 30');
        await page.locator('#receivePreviousMailbox').click();
        assert.equal(await page.locator('#receiveMailboxLabel').innerText(), 'account30@example.com');
        await page.locator('#receiveModal .modal-close').click();
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '客户服务');
        assert.ok(received.includes('account29@example.com'));
        assert.ok(received.every(email => ['account30@example.com', 'account29@example.com'].includes(email)));
    } finally { await page.close(); }
});

test('selection survives pagination and is cleared when the visible scope changes', async () => {
    const page = await newPage();
    try {
        await page.locator('#perPageSelect').selectOption('20');
        await page.locator('.mailbox-checkbox[value="66"]').check();
        await page.getByRole('button', { name: '下一页 »', exact: true }).click();
        assert.equal(await page.locator('#bulkSelectedCount').innerText(), '1');
        await page.locator('.mailbox-checkbox[value="46"]').check();
        await page.getByRole('button', { name: '« 上一页', exact: true }).click();
        assert.equal(await page.locator('.mailbox-checkbox[value="66"]').isChecked(), true);
        assert.equal(await page.locator('#bulkSelectedCount').innerText(), '2');
        await page.locator('[data-status-view="normal"]').click();
        assert.equal(await page.locator('#bulkSelectedCount').innerText(), '0');
        assert.equal(await page.locator('#mailboxBulkBar').isVisible(), false);
    } finally { await page.close(); }
});

test('mobile group picker and list scrolling keep pagination after the last mailbox', async () => {
    const page = await newPage({ width: 390, height: 844 });
    try {
        await page.locator('#groupFilterSelect').selectOption('2');
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '客户服务');
        await page.locator('#searchInput').fill('account2');
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '11');
        const positions = await page.evaluate(() => ({
            last: document.querySelector('#mailboxTable tbody tr:last-child').getBoundingClientRect().bottom,
            pagination: document.querySelector('#paginationContainer').getBoundingClientRect().top,
            overflow: document.documentElement.scrollWidth > innerWidth
        }));
        assert.ok(positions.pagination >= positions.last, 'pagination must follow, not cover, mobile mailboxes');
        assert.equal(positions.overflow, false);
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'workspace-mobile.png') });
    } finally { await page.close(); }
});

const { contrastFailures } = require('./theme_contrast.cjs');
for (const width of [1440, 390]) test(`all eight palettes keep lists, menus, receive states and forms readable at ${width}px`, async () => {
    const page = await newPage({ width, height: 1000 });
    const failures = [];
    try {
        const themes = await page.evaluate(() => MailThemes.themes.map(theme => theme.key));
        for (const theme of themes) {
            await page.evaluate(theme => { MailThemes.apply(theme); document.dispatchEvent(new CustomEvent('color-theme-change')); }, theme);
            const check = async label => failures.push(...(await contrastFailures(page)).map(item => ({ theme, state: label, ...item })));
            await check('mailbox');
            await page.locator('#filterInvalidAccountsBtn').click();
            await page.locator('#selectFilteredMailboxesBtn').click();
            await page.locator('#mailboxBulkBar.visible').waitFor();
            const bulkSurface = await page.locator('#mailboxBulkBar').evaluate(bar => {
                const probe = document.createElement('span');
                probe.style.backgroundColor = 'var(--surface-2)';
                bar.appendChild(probe);
                const expected = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return { actual: getComputedStyle(bar).backgroundColor, expected };
            });
            assert.equal(bulkSurface.actual, bulkSurface.expected, `${theme}: the selected-mailbox toolbar must use the current theme surface`);
            const bulkColors = await page.locator('#mailboxBulkBar .btn').evaluateAll(buttons => buttons.map(button => getComputedStyle(button).color));
            assert.equal(new Set(bulkColors).size, 5, `${theme}: copy, grouping, testing, deletion and cancel must remain visually distinct`);
            await check('invalid-selected');
            for (const button of await page.locator('#mailboxBulkBar .btn').all()) {
                await button.hover();
                failures.push(...(await contrastFailures(page, '#mailboxBulkBar')).map(item => ({ theme, state: 'bulk-hover', ...item })));
            }
            const bulkBounds = await page.locator('#mailboxBulkBar').boundingBox();
            assert.ok(bulkBounds.x >= 0 && bulkBounds.x + bulkBounds.width <= width, 'bulk actions must fit the viewport');
            if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `bulk-${theme}-${width}.png`) });
            await page.locator('#mailboxBulkBar').getByRole('button', { name: '批量分组', exact: true }).click();
            await page.locator('#batchGroupModal.show').waitFor();
            await check('batch-group-form');
            await page.locator('#batchGroupModal .modal-close').click();
            await page.locator('#mailboxBulkBar').getByRole('button', { name: '取消选择', exact: true }).click();
            await page.locator('[data-status-view="retry"]').click();
            await check('retry-filter');
            await page.locator('#resetMailboxFiltersBtn').click();
            if (width > 640) {
                await page.locator('#columnConfigBtn').click();
                await check('columns-menu');
                await page.keyboard.press('Escape');
            }
            if (width > 1000) {
                await page.locator('.group-actions-button').first().click();
                await check('group-menu');
                await page.keyboard.press('Escape');
            }
            await page.locator('.mailbox-heading-actions .au-dropdown-toggle').click();
            await check('add-menu');
            await page.getByRole('button', { name: '单个添加', exact: true }).click();
            await page.locator('#mailboxModal.show').waitFor();
            await check('add-form');
            await page.locator('#mailboxModal .modal-close').click();
            const fetched = page.waitForResponse(response => response.url().endsWith('/api/get_mail'));
            await page.locator('#mailboxTable tbody tr').first().locator('[data-action="receive"]').click();
            await fetched;
            await page.waitForFunction(() => !receiveState.isFetching && receiveState.mails.length > 0);
            await page.evaluate(() => {
                receiveState.mails = Array.from({ length: 12 }, (_, i) => ({ id: String(i), folder: 'inbox', subject: 'Theme fixture — 邮件标题 ' + i, from: 'sender@example.com', to: 'reader@example.com', receivedAt: '2026-10-04T08:00:00Z', body: 'Confirmation code: 123456\n这是一封用于检查主题的示例邮件。', bodyType: 'text' }));
                receiveState.perPage = 10;
                renderReceiveList();
            });
            await check('receive-list');
            // Match the reported mixed state: cached messages plus a failed refresh.
            await page.evaluate(() => {
                const panel = document.querySelector('.receive-error-panel');
                panel.classList.remove('is-hidden'); panel.style.display = 'block'; panel.hidden = false;
                panel.querySelector('.receive-error-title').textContent = 'Microsoft OAuth 登录失败';
                panel.querySelector('.receive-error-detail').textContent = '登录凭据已过期，请重新登录。Fixture diagnostic only.';
            });
            await check('receive-error');
            assert.equal(await page.locator('#receiveErrorPanel').isVisible(), true);
            assert.equal(await page.locator('#receiveTableBody tr').count(), 10);
            const modal = await page.locator('#receiveModal .modal-content').boundingBox();
            assert.ok(modal.x >= 0 && modal.x + modal.width <= width);
            if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `receive-${theme}-${width}.png`) });
            await page.locator('#receiveTableBody tr').first().click();
            await check('receive-detail');
            if (process.env.SCREENSHOT_DIR && ['rain', 'clay'].includes(theme)) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `receive-detail-${theme}-${width}.png`) });
            await page.locator('#receiveModal .modal-close').click();
        }
        if (process.env.CONTRAST_REPORT) fs.writeFileSync(process.env.CONTRAST_REPORT + width, JSON.stringify(failures, null, 2));
        assert.equal(failures.length, 0, JSON.stringify(failures.slice(0, 15)));
    } finally { await page.close(); }
});
