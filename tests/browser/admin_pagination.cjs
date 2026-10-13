// Synthetic lists only; Flask renders templates without opening the application database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const sizes = [20, 50, 100, 200, 500, 1000];
const rows = Array.from({ length: 1107 }, (_, i) => ({
    id: i + 1, email: `pagination${i + 1}@example.com`, username: `user-${i + 1}`,
    server: 'imap.example.com', port: 993, status: 'received', account_status: 'normal', auth_type: 'password',
    created_at: '2026-10-14 08:00:00', mail_subject: 'fixture', card_key: `card-${i + 1}`,
    name: `proxy-${i + 1}`, host: '127.0.0.1', usage_limit: 10, used_count: 0, groups: []
}));
const pages = [
    ['mailbox', '#perPageSelect', '#mailboxTable tbody tr[data-mailbox-id]', '#paginationContainer'],
    ['kami', '#perPageSelect', '#cardListBody tr', '#paginationContainer'],
    ['kamirizhi', '#logPerPageSelect', '#cardLogBody tr', '#logPagination'],
    ['daili', '#proxyPerPageSelect', '#proxyTable tbody tr', '#proxyPaginationContainer'],
    ['shoujian', '#mailLogPerPageSelect', '#mailLogsAccordion .log-group', '.pagination']
];
let server, browser, origin;
before(async () => {
    const rendered = JSON.parse(execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
import json, sys
from flask import Flask, render_template
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
app.jinja_env.globals['url_for'] = lambda name, **kw: '/static/' + kw['filename'] if name == 'static' else '/' + name
with app.test_request_context('/admin/mailbox'):
    print(json.dumps({name: render_template('admin/' + name + '.html', embedded=True, admin_username='fixture', system_title='Mail', page_title='Mail') for name in ['mailbox', 'kami', 'kamirizhi', 'daili', 'shoujian']}))
`, root], { encoding: 'utf8', maxBuffer: 6 * 1024 * 1024 }));
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (!file.startsWith(root + '/static/') || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
            res.setHeader('Content-Type', { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
            return res.end(fs.readFileSync(file));
        }
        const name = url.pathname.replace('/admin/', '');
        if (rendered[name]) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(rendered[name]); }
        res.setHeader('Content-Type', 'application/json');
        let data = { success: true, data: [], stats: {}, config: {}, groups: [], mappings: [], language: 'zh', poller: {} };
        if (['/admin/api/mailbox', '/admin/api/cards', '/admin/api/card-logs', '/admin/api/mail-logs', '/admin/api/proxies/http', '/admin/api/proxies/socks5'].includes(url.pathname)) {
            const list = url.pathname.endsWith('/socks5') ? [] : rows;
            const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 20);
            data = { ...data, data: list.slice((page - 1) * per_page, page * per_page), pagination: { page, per_page, total: list.length, pages: Math.ceil(list.length / per_page) } };
        }
        res.end(JSON.stringify(data));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

for (const [name, selector, rowSelector, paginationSelector] of pages) {
    test(`${name} supports every size, custom validation, last page and mobile layout`, async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        page.setDefaultTimeout(12000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.addInitScript(() => localStorage.setItem('mailSystemLanguage', 'zh'));
            await page.goto(origin + '/admin/' + name);
            await page.locator(selector).waitFor();
            assert.equal(await page.locator(selector).inputValue(), '100');
            assert.equal(await page.locator(rowSelector).count(), 100);
            assert.deepEqual(await page.locator(`${selector} option`).evaluateAll(options => options.map(option => option.value)), [...sizes.map(String), 'custom']);
            for (const size of sizes) {
                await page.locator(selector).selectOption(String(size));
                await page.waitForFunction(({ rowSelector, size }) => document.querySelectorAll(rowSelector).length === size, { rowSelector, size });
            }
            await page.locator(paginationSelector).getByRole('button', { name: /下一页/ }).click();
            await page.waitForFunction(selector => document.querySelectorAll(selector).length === 107, rowSelector);
            const control = page.locator('.admin-page-size');
            await page.locator(selector).selectOption('custom');
            const input = control.getByRole('spinbutton');
            for (const invalid of ['', '0', '-1', '1.5', '10001']) {
                await input.fill(invalid);
                await control.getByRole('button', { name: '应用', exact: true }).click();
                assert.equal(await input.evaluate(el => el.checkValidity()), false);
                assert.equal(await page.locator(rowSelector).count(), 107);
            }
            await input.fill('137');
            await input.press('Enter');
            await page.waitForFunction(selector => document.querySelectorAll(selector).length === 137, rowSelector);
            await page.locator(paginationSelector).getByRole('button', { name: /下一页/ }).click();
            await page.waitForFunction(selector => document.querySelector(selector).textContent.includes('第 2'), paginationSelector);
            assert.equal(await page.locator(selector).inputValue(), 'custom');
            assert.equal(await control.getByRole('spinbutton').inputValue(), '137');
            await page.setViewportSize({ width: 320, height: 700 });
            await control.scrollIntoViewIfNeeded();
            const geometry = await control.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth }; });
            assert.ok(geometry.left >= 0 && geometry.right <= geometry.width + 1, JSON.stringify(geometry));
            assert.equal(await control.getByRole('button', { name: '应用', exact: true }).isVisible(), true);
            if (process.env.PAGINATION_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.PAGINATION_SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.PAGINATION_SCREENSHOT_DIR, `${name}-320.png`) });
            }
            for (const theme of ['sunny', 'night', 'rain']) {
                await page.evaluate(theme => window.MailThemes.apply(theme), theme);
                const colors = await control.evaluate(el => {
                    const probe = document.createElement('span');
                    probe.style.cssText = 'background:var(--surface);color:var(--text)';
                    el.append(probe);
                    const expected = getComputedStyle(probe);
                    const result = { expected: [expected.backgroundColor, expected.color], actual: [...el.querySelectorAll('select,input,button')].map(item => { const style = getComputedStyle(item); return [style.backgroundColor, style.color]; }) };
                    probe.remove(); return result;
                });
                colors.actual.forEach(color => assert.deepEqual(color, colors.expected, `${name}: ${theme}`));
            }
            await page.reload();
            await page.locator(selector).waitFor();
            assert.equal(await page.locator(selector).inputValue(), '100', 'Mobile also defaults to 100');
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

test('proxy loading follows all API pages and preserves encoded search text', async () => {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    try {
        await page.goto(origin + '/admin/daili');
        await page.locator('#proxyPerPageSelect').waitFor();
        const result = await page.evaluate(async () => {
            const requests = [];
            const originalFetch = window.fetch;
            window.fetch = async (url, options) => { requests.push(String(url)); return originalFetch(url, options); };
            const rows = await loadProxyType('http', 'a&b #c', new AbortController().signal);
            window.fetch = originalFetch;
            return { count: rows.length, requests };
        });
        assert.equal(result.count, 1107);
        assert.equal(result.requests.length, 2);
        assert.ok(result.requests.every(url => new URL(url, origin).searchParams.get('search') === 'a&b #c'));
    } finally { await page.close(); }
});

for (const [name, endpoint, select, rowSelector] of [
    ['kami', 'cards', '#perPageSelect', '#cardListBody tr'],
    ['kamirizhi', 'card-logs', '#logPerPageSelect', '#cardLogBody tr']
]) {
    test(`${name} ignores a slow response after a newer page size is selected`, async () => {
        const page = await browser.newPage({ reducedMotion: 'reduce' });
        try {
            await page.addInitScript(() => localStorage.setItem('mailSystemLanguage', 'zh'));
            await page.goto(origin + '/admin/' + name);
            await page.locator(select).waitFor();
            let releaseSlow;
            const slowResponse = new Promise(resolve => { releaseSlow = resolve; });
            await page.route(`**/admin/api/${endpoint}?*`, async route => {
                if (new URL(route.request().url()).searchParams.get('per_page') === '1000') await slowResponse;
                await route.continue();
            });
            const slowRequest = page.waitForRequest(req => req.url().includes(`/${endpoint}?`) && new URL(req.url()).searchParams.get('per_page') === '1000');
            await page.locator(select).selectOption('1000');
            await slowRequest;
            await page.locator(select).selectOption('50');
            await page.waitForFunction(selector => document.querySelectorAll(selector).length === 50, rowSelector);
            const finished = page.waitForEvent('requestfinished', req => req.url().includes(`/${endpoint}?`) && new URL(req.url()).searchParams.get('per_page') === '1000');
            releaseSlow();
            await finished;
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await page.locator(rowSelector).count(), 50);
            assert.equal(await page.locator(select).inputValue(), '50');
        } finally { await page.close(); }
    });
}

test('mail log refresh preserves a custom size draft', async () => {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    try {
        await page.addInitScript(() => localStorage.setItem('mailSystemLanguage', 'zh'));
        await page.goto(origin + '/admin/shoujian');
        await page.locator('#mailLogPerPageSelect').waitFor();
        await page.locator('#mailLogPerPageSelect').selectOption('custom');
        const input = page.locator('.admin-page-size input');
        await input.fill('153');
        // Keep the refresh promise reachable while Chromium evaluates the updated list.
        await page.evaluate(() => { window.paginationRefresh = loadMailLogs(); });
        await page.waitForFunction(() => !isLoadingMailLogs);
        assert.equal(await input.inputValue(), '153');
        assert.equal(await input.isVisible(), true);
    } finally { await page.close(); }
});
