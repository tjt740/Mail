// Full shell and real templates with synthetic mailboxes; never opens a user database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin, writes, mailDelay = 0, mailFailure = false;
const accounts = [1, 2, 3].map(id => ({ id, email: `customer-support-${id}@example.com`, password: 'fixture', server: 'imap.example.com', port: 993, ssl: 1, protocol: 'imap', send_server: 'smtp.example.com', send_port: 465, send_ssl: 1, account_status: 'normal', created_by_admin: 'fixture', remarks: 'Customer support' }));
before(async () => {
    const pages = JSON.parse(execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import json, sys
app=Flask(__name__, template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
with app.test_request_context('/legacy/admin/mailbox'):
 mailbox=render_template('admin/mailbox.html',embedded=True,admin_username='fixture')
with app.test_request_context('/legacy/'):
 public=render_template('frontend/index.html',embedded=True,page_title='我的邮局',frontend_icon='mail')
with app.test_request_context('/'):
 shell=render_template('react_app.html',app_props={'adminUsername':'fixture','adminPermissions':['mailbox'],'systemTitle':'Mail','pageTitle':'Mail'})
print(json.dumps(dict(mailbox=mailbox, public=public, shell=shell)))
`, root], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
    server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (!file.startsWith(root + '/static/') || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
            res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
            return res.end(fs.readFileSync(file));
        }
        if (url.pathname.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            let body = ''; for await (const chunk of req) body += chunk;
            const input = body ? JSON.parse(body) : {};
            if (req.method === 'POST') writes.push({ path: url.pathname, ...input });
            let data = { success: true, language: 'zh', data: [], groups: [{ id: 1, name: '客户服务分组', parent_id: null }], mappings: accounts.map(account => ({ mailbox_id: account.id, group_id: 1 })) };
            if (url.pathname === '/admin/api/mailbox') data.data = url.searchParams.has('id') ? accounts.find(account => account.id === Number(url.searchParams.get('id'))) : accounts;
            if (input.action === 'parse_import') data.data = { email: 'imported@outlook.com', password: 'fixture', auth_type: 'password' };
            if (url.pathname === '/api/get_mail') {
                await new Promise(resolve => setTimeout(resolve, mailDelay));
                if (mailFailure) data = { success: false, message: 'Fixture connection failed' };
                else data.mails = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, subject: `Message ${i + 1}: Your order is ready for collection`, from: 'Customer Service <sender@example.com>', to: input.email, date: '2026-10-12 12:00:00', body: 'Your confirmation code: 123456\n' + 'A readable message. '.repeat(100), body_type: 'text' }));
            }
            return res.end(JSON.stringify(data));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(url.pathname.startsWith('/legacy/admin') ? pages.mailbox : url.pathname.startsWith('/legacy') ? pages.public : pages.shell);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function shot(page, name) {
    if (!process.env.SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, name + '.png') });
}
for (const [width, height] of [[320, 740], [390, 844], [390, 500], [768, 1024], [844, 390]]) test(`mailbox import, edit and reading at ${width}x${height}`, async () => {
    writes = []; mailDelay = 0; mailFailure = false;
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(7000);
    try {
        await page.goto(origin + '/admin/mailbox');
        const frame = page.frameLocator('.legacy-frame');
        await frame.locator('#mailboxTable tbody tr[data-mailbox-id]').first().waitFor();
        await shot(page, `list-${width}`);
        for (const [label, id] of [['单个添加', 'mailboxModal'], ['批量添加', 'batchAddModal']]) {
            await frame.locator('.mailbox-heading-actions .au-dropdown-toggle').tap();
            await frame.getByRole('button', { name: label, exact: true }).tap();
            const modal = frame.locator(`#${id}`);
            await modal.waitFor({ state: 'visible' });
            assert.equal(await modal.evaluate(el => el.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')), false, 'Opening a dialog should not open the keyboard');
            for (const selector of ['.modal-content', '.modal-body']) assert.equal(await modal.locator(selector).evaluate(el => el.scrollWidth > el.clientWidth + 1), false, selector);
            const footer = await modal.locator('.modal-footer').boundingBox();
            assert.ok(footer.y >= 0 && footer.y + footer.height <= height + 1, JSON.stringify(footer));
            if (id === 'mailboxModal') {
                await modal.locator('#singleImportContent').fill('imported@outlook.com----fixture');
                await page.waitForFunction(() => document.querySelector('iframe').contentDocument.getElementById('email').value === 'imported@outlook.com');
                await modal.locator('#groupSelect').selectOption('1');
                await modal.getByRole('button', { name: '保存', exact: true }).tap();
                await modal.waitFor({ state: 'hidden' });
                assert.equal(writes.find(item => item.action === 'add').group_id, 1);
                await frame.locator('.mailbox-heading-actions .au-dropdown-toggle').tap();
                await frame.getByRole('button', { name: label, exact: true }).tap();
            } else {
                await modal.locator('#batchContent').fill('first@outlook.com----fixture\nsecond@outlook.com----fixture');
                assert.equal(await modal.locator('#batchServer').inputValue(), 'outlook.office365.com');
                await modal.locator('summary').tap();
                assert.ok(await modal.locator('details').getAttribute('open') !== null);
            }
            await shot(page, `${id}-${width}`);
            if (id === 'batchAddModal') {
                await modal.getByRole('button', { name: '批量添加', exact: true }).tap();
                await modal.waitFor({ state: 'hidden' });
                assert.equal(writes.find(item => item.action === 'batch_add').batch_content.split('\n').length, 2);
            } else await modal.locator('.modal-close').tap();
        }
        const actions = frame.locator('#mailboxTable tbody tr[data-mailbox-id]').first().locator('.mailbox-actions');
        const editingId = Number(await actions.locator('[data-action="edit"]').getAttribute('data-mailbox-id'));
        await actions.locator('[data-action="more"]').tap();
        await actions.locator('[data-action="edit"]').tap();
        const editModal = frame.locator('#mailboxModal');
        await editModal.waitFor({ state: 'visible' });
        assert.equal(await editModal.locator('#email').inputValue(), accounts.find(account => account.id === editingId).email);
        if (width === 390) {
            await page.setViewportSize({ width, height: 500 });
            await editModal.locator('#password').tap();
            const footer = await editModal.locator('.modal-footer').boundingBox();
            assert.ok(footer.y >= 0 && footer.y + footer.height <= 501, 'Form actions remain visible with a shorter viewport');
            await page.setViewportSize({ width, height });
        }
        await editModal.locator('#password').fill('updated-fixture');
        await editModal.locator('#port').fill('993');
        await editModal.getByRole('button', { name: '保存', exact: true }).tap();
        await editModal.waitFor({ state: 'hidden' });
        assert.equal(writes.find(item => item.action === 'edit').password, 'updated-fixture');
        await frame.locator('[data-action="receive"]').first().tap();
        await frame.locator('#receiveTableBody tr:not(:has(.receive-empty))').first().waitFor();
        assert.equal(await frame.locator('#receiveListView').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        assert.equal(await frame.locator('#receiveModal .modal-body').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        if (width < 600) {
            assert.ok((await frame.locator('.receive-main').boundingBox()).width > width * .9,
                'Short portrait windows retain a full-width message list');
        }
        assert.equal(await frame.locator('#toast-container .toast').filter({ hasText: /收取/ }).count(), 0, 'Retrieval feedback must not cover dialog controls');
        assert.equal(await frame.locator('#toast-container .toast.success').count(), 0, 'Completed form notifications should not cover the next dialog');
        await shot(page, `receive-${width}`);
        await frame.locator('#receiveTableBody tr').nth(9).scrollIntoViewIfNeeded();
        await frame.locator('#receiveTableBody tr').nth(9).tap();
        await frame.locator('#receiveDetailView').waitFor({ state: 'visible' });
        assert.equal(await frame.locator('.receive-sidebar').isVisible(), false);
        assert.equal(await frame.locator('#receiveDetailView').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        assert.ok((await frame.locator('#receiveDetailView').boundingBox()).height > (height - 56) * .7);
        await shot(page, `detail-${width}`);
        await frame.locator('.receive-back').tap();
        const restoredScroll = await frame.locator('#receiveListView').evaluate(el => ({ actual: el.scrollTop, saved: receiveState.listScrollTop }));
        // The browser may scroll a partly visible row into view while tapping it.
        assert.ok(restoredScroll.saved > 0 && Math.abs(restoredScroll.actual - restoredScroll.saved) <= 1, JSON.stringify(restoredScroll));
        mailDelay = 600;
        await frame.locator('#receiveFetchBtn').tap();
        await frame.locator('#receiveTableBody tr').nth(9).tap();
        await frame.locator('#receiveDetailView').evaluate(el => { el.scrollTop = 150; });
        const readingScroll = await frame.locator('#receiveDetailView').evaluate(el => el.scrollTop);
        await page.waitForFunction(() => !document.querySelector('iframe').contentDocument.getElementById('receiveFetchBtn').disabled);
        assert.equal(await frame.locator('#receiveDetailView').isVisible(), true, 'A background refresh must not interrupt reading');
        assert.equal(await frame.locator('#receiveDetailView').evaluate(el => el.scrollTop), readingScroll, 'A refresh should preserve the reading position');
        await frame.locator('.receive-back').tap();
        mailDelay = 0; mailFailure = true;
        await frame.locator('#receiveFetchBtn').tap();
        await frame.locator('#receiveErrorPanel').waitFor({ state: 'visible' });
        assert.match(await frame.locator('#receiveErrorDetail').innerText(), /Fixture connection failed/);
        await frame.locator('#receiveModal .modal-close').tap();
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
for (const width of [320, 390, 768, 1440]) test(`public brand is centered and compact preferences work at ${width}px`, async () => {
    writes = [];
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width <= 768, hasTouch: true, reducedMotion: 'reduce' });
    try {
        await page.goto(origin);
        const frame = page.frameLocator('.legacy-frame');
        await frame.locator('#frontendSettingsButton').waitFor();
        const brand = await frame.locator('.frontend-topbar .header').boundingBox();
        assert.ok(Math.abs(brand.x + brand.width / 2 - width / 2) <= 2, JSON.stringify(brand));
        assert.equal(await frame.locator('#colorThemeButton, #i18nLanguageButton').count(), 0);
        const control = await frame.locator('#frontendSettingsButton').boundingBox();
        assert.equal(control.width, 44);
        assert.equal(control.height, 44);
        await frame.locator('#emailInput').fill('reader@example.com');
        await frame.locator('#frontendSettingsButton').tap();
        await frame.locator('.color-theme-option[data-theme="night"]').tap();
        await frame.locator('#frontendSettingsButton').tap();
        const menu = await frame.locator('#frontendSettingsMenu').boundingBox();
        assert.ok(menu.x >= 0 && menu.x + menu.width <= width + 1);
        assert.ok(menu.y >= 0 && menu.y + menu.height <= 900);
        await frame.locator('.i18n-language-option[data-language="en"]').tap();
        assert.equal(await frame.locator('#frontendSettingsButton').getAttribute('aria-label'), 'Settings');
        await frame.locator('#frontendSettingsButton').press('ArrowDown');
        assert.equal(await frame.locator('#colorThemeMenu [data-theme="night"]').evaluate(el => el === document.activeElement), true);
        await frame.locator('#colorThemeMenu [data-theme="night"]').press('Escape');
        assert.equal(await frame.locator('#frontendSettingsMenu').isVisible(), false);
        assert.equal(await frame.locator('#frontendSettingsButton').evaluate(el => el === document.activeElement), true);
        await frame.locator('#frontendSettingsButton').tap();
        await frame.locator('.frontend-topbar .header').tap();
        assert.equal(await frame.locator('#frontendSettingsMenu').isVisible(), false);
        await frame.locator('#frontendSettingsButton').tap();
        await frame.locator('.i18n-language-option[data-language="zh-TW"]').tap();
        assert.equal(await frame.locator('#frontendSettingsButton').getAttribute('aria-label'), '設定');
        await frame.locator('#frontendSettingsButton').tap();
        assert.equal(await frame.locator('.i18n-language-option[data-language="zh-TW"]').getAttribute('aria-selected'), 'true');
        assert.equal(await frame.locator('#emailInput').inputValue(), 'reader@example.com');
        await shot(page, `public-${width}`);
    } finally { await page.close(); }
});

for (const [width, height] of [[800, 900], [890, 940], [1024, 800], [1100, 800]]) {
    test(`compact receive dialog uses the embedded viewport at ${width}x${height}`, async () => {
        writes = []; mailDelay = 1500; mailFailure = false;
        const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
        page.setDefaultTimeout(7000);
        try {
            await page.goto(origin + '/admin/mailbox');
            const frame = page.frameLocator('.legacy-frame');
            await frame.locator('[data-action="receive"]').first().click();
            await frame.locator('#receiveFetchBtn.is-loading').waitFor();
            const layout = await frame.locator('#receiveModal').evaluate(modal => {
                const box = selector => modal.querySelector(selector).getBoundingClientRect().toJSON();
                const body = modal.querySelector('.receive-body');
                return { viewport: { width: innerWidth, height: innerHeight }, modal: box('.modal-content'),
                    controls: box('.receive-sidebar'), account: box('.receive-account'), count: box('.receive-count-field'),
                    fetch: box('#receiveFetchBtn'), main: box('.receive-main'), list: box('#receiveListView'),
                    folders: [...modal.querySelectorAll('.receive-tab')].map(el => el.getBoundingClientRect().toJSON()),
                    bodyHeight: body.clientHeight, bodyScrollHeight: body.scrollHeight };
            });
            assert.ok(layout.viewport.width > 768 && layout.viewport.width <= 1024, JSON.stringify(layout.viewport));
            assert.ok(layout.modal.top >= 0 && layout.modal.bottom <= layout.viewport.height + 1, 'Dialog fits its iframe');
            assert.ok(layout.controls.height <= 140, JSON.stringify(layout.controls));
            assert.ok(layout.account.bottom <= layout.count.top, 'Mailbox has its own row above retrieval controls');
            assert.ok(Math.abs(layout.count.y - layout.fetch.y) <= 2, 'Count and fetch controls align on one row');
            assert.ok(await frame.locator('.receive-copy-btn').evaluate(el => {
                const label = document.getElementById('receiveMailboxLabel');
                return el.getBoundingClientRect().left - label.getBoundingClientRect().right <= 12;
            }), 'Copy stays next to the address instead of at the far edge');
            assert.equal(await frame.locator('#emailCountInput').evaluate(el => document.activeElement === el), false,
                'Opening received mail does not focus or select the count input');
            assert.equal(layout.folders[0].y, layout.folders[1].y, 'Folders share one row');
            assert.ok(layout.list.height >= layout.bodyHeight * .5, JSON.stringify(layout));
            assert.ok(layout.bodyScrollHeight <= layout.bodyHeight + 1, 'Only the message list should scroll');
            assert.equal(await frame.locator('#toast-container .toast').count(), 0, 'Loading feedback stays inside the dialog');
            await shot(page, `compact-receive-loading-${width}`);
            await frame.locator('#receiveTableBody tr:not(:has(.receive-empty))').first().waitFor();
            await frame.locator('#receiveTableBody tr').nth(9).click();
            assert.equal(await frame.locator('.receive-sidebar').isVisible(), false);
            assert.ok((await frame.locator('#receiveDetailView').boundingBox()).height >= layout.viewport.height * .8);
            for (const selector of ['.receive-back', '#receiveModal .modal-close']) {
                assert.ok(await frame.locator(selector).evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
                }), selector + ' remains reachable');
            }
            await frame.locator('.receive-back').click();
            await page.setViewportSize({ width: 390, height: 740 });
            assert.equal(await frame.locator('#receiveModal .modal-body').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
            await frame.locator('#receiveModal .modal-close').click();
        } finally { mailDelay = 0; await page.close(); }
    });
}
