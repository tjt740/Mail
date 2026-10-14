// Render real templates against synthetic APIs; no application database is opened.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { contrastFailures } = require('./theme_contrast.cjs');
const root = path.resolve(__dirname, '../..');
let browser, server, origin;
before(async () => {
    const pages = JSON.parse(execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
import json, sys
from flask import Flask, render_template
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
app.jinja_env.globals['url_for'] = lambda name, **kw: '/static/' + kw['filename'] if name == 'static' else '/' + name
with app.test_request_context('/legacy/admin/kami'):
 print(json.dumps({name: render_template('admin/' + name + '.html', embedded=True, admin_username='fixture', system_title='Mail', admin_users=[]) for name in ['kami', 'daili', 'mailbox', 'system', 'kamirizhi', 'shoujian']}))
`, root], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }));
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (!file.startsWith(root + '/static/') || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
            res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
            return res.end(fs.readFileSync(file));
        }
        const name = url.pathname.split('/').pop();
        if (url.pathname.startsWith('/legacy/') && pages[name]) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(pages[name]);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, data: [], groups: [], mappings: [], language: 'zh', counts: {}, stats: {}, config: {}, pagination: { page: 1, per_page: 100, total: 0, pages: 0 } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function open(name, width = 1440, height = 900) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('mailSystemLanguage', 'zh'));
    await page.goto(origin + '/legacy/admin/' + name);
    return page;
}
async function screenshot(page, name) {
    if (!process.env.ADMIN_CONTROLS_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.ADMIN_CONTROLS_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.ADMIN_CONTROLS_SCREENSHOT_DIR, name + '.png') });
}

for (const [width, height] of [[1440, 900], [1440, 600], [768, 800], [320, 700]]) {
    test(`card toolbar preserves complete buttons and search at ${width}x${height}`, async () => {
        const page = await open('kami', width, height);
        try {
            for (const theme of ['sunny', 'night', 'rain']) {
                await page.evaluate(theme => MailThemes.apply(theme), theme);
                const controls = await page.locator('.kami-toolbar .btn:visible').evaluateAll(buttons => buttons.map(button => {
                    const b = button.getBoundingClientRect(), toolbar = button.closest('.kami-toolbar').getBoundingClientRect(), style = getComputedStyle(button);
                    return { text: button.textContent.trim(), radius: style.borderRadius, height: b.height, border: style.borderTopWidth, inside: b.top >= toolbar.top && b.bottom <= toolbar.bottom + 1 && b.left >= 0 && b.right <= innerWidth };
                }));
                for (const control of controls) {
                    assert.equal(control.radius, '10px', control.text);
                    assert.ok(control.height >= (width <= 768 ? 44 : 40), JSON.stringify(control));
                    assert.equal(control.border, '1px', control.text);
                    assert.equal(control.inside, true, JSON.stringify(control));
                }
                assert.deepEqual(await contrastFailures(page, '.kami-toolbar'), []);
                await screenshot(page, `kami-${theme}-${width}-${height}`);
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        } finally { await page.close(); }
    });
}

test('admin form and mail-detail dialogs share their surface, title and close control', async () => {
    const cases = [
        ['kami', 'showGenerateModal()', '#generateModal', '.modal-content', '.modal-title', '.modal-close'],
        ['kami', 'showBatchGenerateModal()', '#batchGenerateModal', '.modal-content', '.modal-title', '.modal-close'],
        ['daili', "showAddProxyModal('http')", '#proxyModal', '.modal-content', '.modal-title', '.modal-close'],
        ['mailbox', "AdminUI.modal.open('groupModal')", '#groupModal', '.modal-content', '.modal-title', '.modal-close'],
        ['shoujian', "document.getElementById('logDetailModal').classList.add('show')", '#logDetailModal', '.log-detail-content', '.log-detail-title', '.log-detail-close']
    ];
    for (const [name, action, modal, content, title, close] of cases) {
        const page = await open(name);
        try {
            await page.evaluate(action);
            for (const theme of ['sunny', 'night', 'rain']) {
                await page.evaluate(theme => MailThemes.apply(theme), theme);
                const styles = await page.locator(modal).evaluate((element, { content, title, close }) => {
                    const css = selector => getComputedStyle(element.querySelector(selector));
                    const probe = document.createElement('span'); probe.style.background = 'var(--surface)'; element.appendChild(probe);
                    const result = { radius: css(content).borderRadius, surface: css(content).backgroundColor, expected: getComputedStyle(probe).backgroundColor, title: css(title).fontSize, close: css(close).borderRadius };
                    probe.remove(); return result;
                }, { content, title, close });
                assert.deepEqual(styles, { radius: '16px', surface: styles.expected, expected: styles.expected, title: '18px', close: '10px' }, name);
            }
            await screenshot(page, `${name}-${modal.slice(1)}-rain`);
        } finally { await page.close(); }
    }
});

test('confirmations cancel safely, contain focus, escape nested dialogs and restore focus', async () => {
    const page = await open('kami', 320, 700);
    const nativeDialogs = []; page.on('dialog', async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
    try {
        const trigger = page.getByRole('button', { name: '生成卡密', exact: true }).first();
        await trigger.click();
        await page.locator('#generateModal .modal-close').focus();
        await page.evaluate(() => { window.decision = AdminUI.confirm('<img src=x onerror=alert(1)>', { danger: true }); });
        const dialog = page.getByRole('alertdialog');
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 16 && bounds.x + bounds.width <= 304, JSON.stringify(bounds));
        assert.equal(await dialog.locator('img').count(), 0);
        assert.equal(await dialog.locator('.admin-confirm-message').textContent(), '<img src=x onerror=alert(1)>');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.decision), 'cancel');
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press('Tab');
            assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
        }
        assert.equal(await page.evaluate(() => AdminUI.confirm('duplicate')), false);
        assert.equal(await dialog.count(), 1);
        for (const theme of ['sunny', 'night', 'rain']) {
            await page.evaluate(theme => MailThemes.apply(theme), theme);
            assert.deepEqual(await contrastFailures(page, '.admin-confirm'), []);
        }
        await screenshot(page, 'confirm-rain-320');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.decision), false);
        assert.equal(await page.locator('#generateModal').isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement.matches('#generateModal .modal-close')), true);
        await page.locator('#generateModal .modal-close').click();
        await page.evaluate(() => { window.decision = AdminUI.confirm('Confirm once'); });
        await dialog.getByRole('button', { name: '确认', exact: true }).click();
        assert.equal(await page.evaluate(() => window.decision), true);
        assert.equal(await dialog.count(), 0);
        assert.deepEqual(nativeDialogs, []);
    } finally { await page.close(); }
});

test('card batch deletion waits for confirmation and keeps the originally confirmed selection', async () => {
    const page = await open('kami');
    const writes = [];
    await page.route('**/admin/api/cards', async route => {
        if (route.request().method() === 'DELETE') writes.push(route.request().postDataJSON());
        await route.fulfill({ json: { success: true, data: [] } });
    });
    try {
        await page.evaluate(() => { selectedCards.add(11); selectedCards.add(22); batchDeleteCards(); });
        const dialog = page.getByRole('alertdialog');
        await dialog.waitFor();
        assert.deepEqual(writes, []);
        await dialog.getByRole('button', { name: '取消', exact: true }).click();
        assert.deepEqual(writes, []);
        await page.evaluate(() => { batchDeleteCards(); });
        await dialog.waitFor();
        await page.evaluate(() => { selectedCards.clear(); selectedCards.add(33); });
        const requested = page.waitForRequest(request => request.method() === 'DELETE');
        await dialog.getByRole('button', { name: '确认', exact: true }).click();
        await requested;
        assert.deepEqual(writes, [{ action: 'batch_delete', ids: [11, 22] }]);
    } finally { await page.close(); }
});

test('a confirmation takes keyboard priority over the mailbox modal focus handler', async () => {
    const page = await open('mailbox');
    try {
        await page.evaluate(() => MailboxInteractions.openModal('groupModal'));
        await page.locator('#groupModal .modal-close').focus();
        await page.evaluate(() => { window.decision = AdminUI.confirm('Nested confirmation'); });
        const dialog = page.getByRole('alertdialog');
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.decision), false);
        assert.equal(await page.locator('#groupModal').isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement.matches('#groupModal .modal-close')), true);
    } finally { await page.close(); }
});
