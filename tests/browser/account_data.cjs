// Tests the built React page against synthetic accounts; no real database is opened.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const accounts = Array.from({ length: 22 }, (_, index) => ({
    id: index + 1, email: `account${index + 1}@example.com`, username: `login-${index + 1}`,
    password: `fixture-password-${index + 1}`, auth_type: index % 2 ? 'password' : 'oauth',
    oauth_client_id: index % 2 ? '' : `fixture-client-${index + 1}`,
    oauth_refresh_token: index % 2 ? '' : 'fixture-token-'.repeat(120),
    created_by_admin: index % 2 ? 'bob' : 'alice', created_at: `2026-09-${index % 2 ? '28' : '29'} 12:00:00`,
    groups: index % 2 ? [] : [{ id: 1, name: 'Category A' }], server: 'imap.example.com', port: 993,
    protocol: 'imap', ssl: 1, send_server: '', send_port: 0, send_ssl: 0, account_status: 'normal',
    remarks: '<img src=x onerror="window.detailXss=true">'
}));
['pink', 'tjt740', 'lhm', 'operations-administrator-with-a-long-name'].forEach((owner, index) => {
    accounts[index + 2].created_by_admin = owner;
});
for (const [index, status] of ['banned', 'pending', 'invalid_credentials', 'network_error', 'test_error'].entries()) {
    accounts.push({ ...accounts[1], id: 23 + index, email: `status-${status}@example.com`, account_status: status });
}
let server, browser, origin;
before(async () => {
    server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (file.startsWith(root + '/static/') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
                return res.end(fs.readFileSync(file));
            }
            res.statusCode = 404; return res.end();
        }
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/api/')) {
            res.setHeader('Content-Type', 'application/json');
            let data = { success: true, language: 'zh' };
            if (url.pathname.endsWith('/account-data/filters')) data = { ...data, owners: [...new Set(accounts.map(row => row.created_by_admin))], groups: [{ id: 1, name: 'Category A', parent_id: null }] };
            else if (url.pathname.endsWith('/account-data/copy')) {
                let body = ''; for await (const chunk of req) body += chunk;
                const { ids } = JSON.parse(body);
                data = { ...data, count: ids.length, text: ids.map(id => {
                    const row = accounts.find(item => item.id === id);
                    return [row.email, row.password, row.oauth_client_id, row.oauth_refresh_token].join('----');
                }).join('\n') };
            } else if (url.pathname.endsWith('/account-data')) {
                const q = url.searchParams;
                let filtered = accounts.filter(row => (!q.get('search') || row.email.includes(q.get('search')) || row.username.includes(q.get('search')))
                    && (!q.has('owner') || row.created_by_admin === q.get('owner'))
                    && (!q.get('auth_type') || row.auth_type === q.get('auth_type'))
                    && (!q.get('account_status') || row.account_status === q.get('account_status'))
                    && (!q.get('group_id') || (q.get('group_id') === 'ungrouped' ? !row.groups.length : row.groups.some(group => String(group.id) === q.get('group_id'))))
                    && (!q.get('start_date') || row.created_at.slice(0, 10) >= q.get('start_date'))
                    && (!q.get('end_date') || row.created_at.slice(0, 10) <= q.get('end_date')));
                const page = Number(q.get('page') || 1), per_page = Number(q.get('per_page') || 20);
                data = { ...data, data: filtered.slice((page - 1) * per_page, page * per_page), pagination: { page, per_page, total: filtered.length } };
            } else if (url.pathname === '/admin/api/mailbox') data.data = accounts.find(row => row.id === Number(url.searchParams.get('id')));
            return res.end(JSON.stringify(data));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (url.pathname.startsWith('/legacy/')) return res.end('<p>Mailbox management fixture</p>');
        res.end(`<!doctype html><html data-i18n-managed="react"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/static/react/assets/main.css"></head><body><div id="root"></div><script>window.__MAIL_APP_PROPS__ = { adminUsername: 'fixture', adminPermissions: ['mailbox'], systemTitle: 'Mail' };</script><script type="module" src="/static/react/assets/main.js"></script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function newPage(width = 1440, initialPath = '/admin/account-data') {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 640 : width === 390 ? 844 : 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    await page.addInitScript(() => {
        localStorage.setItem('mailSystemLanguage', 'zh');
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.fixtureClipboard = text; } } });
    });
    await page.goto(origin + initialPath);
    await page.waitForFunction(() => window.AppI18n);
    await page.evaluate(() => window.AppI18n.setLanguage('zh'));
    if (initialPath.endsWith('account-data')) await page.locator('[data-account-id="1"]').waitFor();
    return page;
}
const record = (page, id) => page.locator(`[data-account-id="${id}"]`);

for (const width of [390, 1440]) {
    test(`Filipino translates account controls and calendar without losing state at ${width}px`, async () => {
        const page = await newPage(width);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.getByRole('textbox', { name: '账号搜索', exact: true }).fill('draft@example.com');
            await record(page, 1).getByRole('checkbox').check();
            await page.evaluate(() => window.AppI18n.setLanguage('fil'));
            assert.equal(await page.getByRole('textbox', { name: 'Paghahanap ng account', exact: true }).inputValue(), 'draft@example.com');
            assert.equal(await record(page, 1).getByRole('checkbox').isChecked(), true);
            await page.getByRole('button', { name: /Kopyahin ang napili/ }).waitFor();
            assert.equal(await page.locator('.account-pagination .ant-pagination-next').getAttribute('title'), 'Susunod na pahina');
            const startDate = page.getByPlaceholder('Petsa ng simula', { exact: true });
            await startDate.fill('2026-10-01');
            await startDate.press('Enter');
            await startDate.click();
            await page.locator('.account-date-range-popup').waitFor({ state: 'visible' });
            assert.equal(await page.locator('.ant-picker-month-btn').first().innerText(), 'Okt');
            assert.match(await page.locator('.ant-picker-content thead').first().innerText(), /Lu/);
            assert.equal(await page.locator('.ant-picker-header-next-btn').first().getAttribute('aria-label'), 'Susunod na buwan (PageDown)');
            await startDate.press('Escape');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            assert.equal(await page.locator('.account-data-page').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

for (const width of [1440, 768, 390, 320]) {
    test(`independent menu, full account lines and individual details work at ${width}px`, async () => {
        const page = await newPage(width, '/admin/mailbox');
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            if (width <= 768) await page.getByRole('button', { name: '展开菜单' }).click();
            await page.getByRole('menuitem', { name: /账号资料/ }).click();
            await record(page, 1).waitFor();
            assert.ok(page.url().endsWith('/admin/account-data'));
            assert.equal(await page.locator('iframe').count(), 0);
            const expected = [accounts[0].email, accounts[0].password, accounts[0].oauth_client_id, accounts[0].oauth_refresh_token].join('----');
            assert.equal(await record(page, 1).locator('pre').textContent(), expected);
            await record(page, 1).getByRole('button', { name: /复制/, exact: false }).click();
            await page.waitForFunction(text => window.fixtureClipboard === text, expected);
            await page.getByRole('switch', { name: '显示凭据' }).click();
            assert.ok(!(await record(page, 1).locator('pre').textContent()).includes(accounts[0].password));
            if (process.env.ACCOUNT_DATA_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.ACCOUNT_DATA_SCREENSHOT_DIR, { recursive: true });
                await page.locator('.account-data-page').evaluate(el => { el.scrollTop = 0; });
                await page.screenshot({ path: path.join(process.env.ACCOUNT_DATA_SCREENSHOT_DIR, `account-data-${width}.png`) });
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
            assert.equal(await page.locator('.account-data-page').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
            assert.equal(await page.locator('.account-record').evaluateAll(rows => rows.some(el => el.scrollWidth > el.clientWidth + 1)), false);
            await page.getByPlaceholder('开始日期', { exact: true }).click();
            await page.locator('.account-date-range-popup').waitFor({ state: 'visible' });
            await page.waitForFunction(() => {
                const rect = document.querySelector('.account-date-range-popup').getBoundingClientRect();
                return rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1;
            });
            await page.getByPlaceholder('开始日期', { exact: true }).press('Escape');
            if (process.env.ACCOUNT_DATA_SCREENSHOT_DIR) {
                await record(page, 3).scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(process.env.ACCOUNT_DATA_SCREENSHOT_DIR, `account-records-${width}.png`) });
            }
            await record(page, 1).getByRole('button', { name: /详\s*情/ }).click();
            await page.getByRole('dialog').getByText('fixture-client-1', { exact: true }).waitFor();
            assert.equal(await page.getByRole('dialog').locator('img').count(), 0);
            const secret = page.getByRole('dialog').locator('.ant-descriptions-row').filter({ hasText: 'refresh_token' });
            await secret.getByRole('button', { name: /显\s*示/ }).click();
            assert.equal(await secret.locator('pre').textContent(), accounts[0].oauth_refresh_token);
            assert.equal(await page.getByRole('dialog').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
            await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

test('cross-page selection copies complete lines and applying filters clears selection', async () => {
    const page = await newPage();
    try {
        await record(page, 1).getByRole('checkbox').check();
        await page.locator('.account-pagination').getByTitle('2', { exact: true }).click();
        await record(page, 21).waitFor();
        await record(page, 22).getByRole('checkbox').check();
        await page.getByRole('button', { name: /复制所选/ }).click();
        const lines = [accounts[0], accounts[21]].map(row => [row.email, row.password, row.oauth_client_id, row.oauth_refresh_token].join('----')).join('\n');
        await page.waitForFunction(text => window.fixtureClipboard === text, lines);
        await page.getByRole('textbox', { name: '账号搜索', exact: true }).fill('account2@');
        await page.getByRole('button', { name: /筛选/, exact: false }).click();
        await record(page, 2).waitFor();
        assert.equal(await page.locator('.account-record').count(), 1);
        assert.equal(await page.getByRole('button', { name: /复制所选/ }).isDisabled(), true);
        await page.getByRole('checkbox', { name: '全选本页' }).check();
        assert.equal(await record(page, 2).getByRole('checkbox').isChecked(), true);
        await page.getByRole('button', { name: /重\s*置/ }).click();
        await record(page, 1).waitFor();
        assert.equal(await page.locator('.account-record').count(), 20);
    } finally { await page.close(); }
});

test('creator, category, authentication and dates combine in the filter request', async () => {
    const page = await newPage();
    try {
        for (const [label, option] of [['创建人', 'alice'], ['分类（邮箱分组）', 'Category A'], ['认证方式', 'OAuth']]) {
            await page.getByRole('combobox', { name: label, exact: true }).click();
            await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: option }).click();
        }
        await page.getByRole('textbox', { name: '账号搜索', exact: true }).fill('account1@');
        await page.getByPlaceholder('开始日期', { exact: true }).fill('2026-09-29');
        await page.getByPlaceholder('开始日期', { exact: true }).press('Tab');
        await page.getByPlaceholder('结束日期', { exact: true }).fill('2026-09-29');
        await page.getByPlaceholder('结束日期', { exact: true }).press('Tab');
        const request = page.waitForRequest(req => req.url().includes('/account-data?') && req.url().includes('owner=alice'));
        await page.getByRole('button', { name: /筛选/ }).click();
        const params = new URL((await request).url()).searchParams;
        assert.deepEqual(Object.fromEntries(params), { page: '1', per_page: '20', search: 'account1@', owner: 'alice', group_id: '1', auth_type: 'oauth', account_status: 'normal', start_date: '2026-09-29', end_date: '2026-09-29' });
        await page.waitForFunction(() => document.querySelectorAll('.account-record').length === 1);
        await page.evaluate(() => window.AppI18n.setLanguage('en'));
        assert.equal(await page.getByRole('button', { name: /Copy selected/ }).count(), 1);
    } finally { await page.close(); }
});

test('failed refresh removes old credentials and disables copying', async () => {
    const page = await newPage();
    try {
        await record(page, 1).getByRole('checkbox').check();
        await page.route('**/admin/api/mailbox/account-data?*', route => route.fulfill({ status: 403, json: { success: false, message: '未获上级授权使用此功能' } }));
        await page.getByRole('button', { name: /刷新/ }).click();
        await page.getByRole('alert').filter({ hasText: '未获上级授权使用此功能' }).waitFor();
        assert.equal(await page.locator('.account-record').count(), 0);
        assert.equal(await page.getByRole('button', { name: /复制所选/ }).isDisabled(), true);
    } finally { await page.close(); }
});

test('status defaults to normal, supports all/individual statuses, and reset restores normal', async () => {
    const page = await newPage();
    try {
        const statusSelect = page.getByRole('combobox', { name: '账号状态', exact: true });
        assert.match(await statusSelect.locator('xpath=ancestor::label').textContent(), /正常/);
        assert.match(await page.locator('.account-results-toolbar').textContent(), /筛选结果\s*22/);
        for (const [label, status, count] of [['全部状态', '', 27], ['封禁', 'banned', 1], ['未检测', 'pending', 1],
            ['凭据失效', 'invalid_credentials', 1], ['网络异常', 'network_error', 1], ['检测异常', 'test_error', 1]]) {
            await statusSelect.click();
            await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: label }).click();
            const request = page.waitForRequest(req => {
                const url = new URL(req.url());
                return url.pathname === '/admin/api/mailbox/account-data' && (url.searchParams.get('account_status') || '') === status;
            });
            await page.getByRole('button', { name: /筛选/ }).click();
            await request;
            await page.waitForFunction(expected => document.querySelector('.account-results-toolbar').textContent.includes(`筛选结果 ${expected}`), count);
            if (status) {
                await page.getByText(`status-${status}@example.com`, { exact: true }).waitFor();
                assert.equal(await page.locator('.account-record').count(), 1);
                assert.equal(await page.locator('.account-record strong').textContent(), `status-${status}@example.com`);
            }
        }
        await page.locator('.account-record').getByRole('checkbox').check();
        await page.getByRole('button', { name: /重\s*置/ }).click();
        await record(page, 1).waitFor();
        assert.match(await statusSelect.locator('xpath=ancestor::label').textContent(), /正常/);
        assert.match(await page.locator('.account-results-toolbar').textContent(), /筛选结果\s*22/);
        assert.equal(await page.getByRole('button', { name: /复制所选/ }).isDisabled(), true);
    } finally { await page.close(); }
});

const { contrastFailures } = require('./theme_contrast.cjs');
test('account records and detail dialogs remain readable across all palettes', async () => {
    const page = await newPage();
    const failures = [];
    try {
        for (const [key, label] of [['sunny','晴天'],['night','夜间'],['rain','雨夜'],['clay','暖陶橙'],['ocean','海洋蓝'],['emerald','翡翠绿'],['violet','紫罗兰'],['rose','玫瑰红']]) {
            await page.locator('.react-color-theme-button').click();
            await page.getByRole('menuitem', { name: new RegExp(label) }).click();
            await page.locator('.react-color-theme-dropdown').waitFor({ state: 'hidden' });
            await page.waitForFunction(key => document.documentElement.dataset.colorTheme === key, key);
            failures.push(...(await contrastFailures(page, '.account-data-page')).map(item => ({ theme: key, ...item })));
            await record(page, 1).getByRole('button', { name: /详\s*情/ }).click();
            await page.getByRole('dialog').getByText('fixture-client-1', { exact: true }).waitFor();
            failures.push(...(await contrastFailures(page, '.ant-modal-content')).map(item => ({ theme: key, ...item })));
            await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
        }
        assert.equal(failures.length, 0, JSON.stringify(failures.slice(0, 12)));
    } finally { await page.close(); }
});
