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
with app.test_request_context('/'):
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
                    payload.data = accounts.filter(a => a.email.includes(query));
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
    page.setDefaultTimeout(8000);
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelector('#batchTestFilteredBtn').textContent.includes('(66)'));
    return page;
}

test('dashboard status navigation overrides a remembered group', async () => {
    const page = await newPage();
    try {
        await page.evaluate(() => localStorage.setItem('mailboxActiveGroup:fixture', '2'));
        await page.goto(origin + '/?status=invalid&group=all');
        await page.waitForFunction(() => document.querySelector('#batchTestFilteredBtn').textContent.includes('(22)'));
        assert.equal(await page.locator('[data-status-view="invalid"]').getAttribute('aria-pressed'), 'true');
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
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /4 \/ 4；正常 3，无效 1，待重试 0/);
        assert.match(await page.locator('#batchTestFilteredBtn').innerText(), /\(1\)/);
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
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /待重试 2/);
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
        await page.locator('#stopBatchTestBtn').click();
        await page.waitForFunction(() => document.querySelector('#mailboxBatchProgressText').textContent.startsWith('批量测试已停止'));
        assert.equal(tested.length, 3);
        assert.equal(active, 0);
        assert.deepEqual(accounts.slice(3), seed().slice(3));
        assert.match(await page.locator('#mailboxBatchProgressText').innerText(), /3 \/ 66；正常 1，无效 1，待重试 1/);
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

test('group browsing is visible, searchable, remembers the last group and keeps counts stable during mailbox search', async () => {
    const page = await newPage();
    try {
        assert.equal(await page.locator('#groupPanel').isVisible(), true);
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

test('opening an address reads mail, next and previous stay in group, and copy is a separate action', async () => {
    const page = await newPage();
    try {
        await page.locator('#groupSearchInput').fill('客户');
        await page.locator('.group-item[data-group-id="2"]').click();
        await page.evaluate(() => { window.writeTextToClipboard = async text => { window.copiedAddress = text; return true; }; });
        await page.locator('tr[data-mailbox-id="30"] .mailbox-email-copy').click();
        assert.equal(await page.evaluate(() => window.copiedAddress), 'account30@example.com');
        assert.equal(await page.locator('#receiveModal').isVisible(), false);
        await page.locator('tr[data-mailbox-id="30"] .mailbox-email-open').click();
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
