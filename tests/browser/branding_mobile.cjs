// Render real templates against isolated fixtures; no user database or mail server is touched.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin, settings, writes;
before(async () => {
    const pages = JSON.parse(execFileSync(path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask,render_template
import json,sys
app=Flask(__name__,template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
pages={}
for name in ['home','mailbox','system','daili','kami','kamirizhi','shoujian','help']:
 with app.test_request_context('/legacy/admin/'+name):
  pages[name]=render_template('admin/'+name+'.html',embedded=True,admin_username='tjt740',admin_permissions=['home','mailbox','settings','mail_logs','master_key'],can_manage_site_brand=True,can_manage_public_mail_key=True,system_title='Mail')
with app.test_request_context('/legacy/'):
 pages['public']=render_template('frontend/index.html',embedded=True,page_title='移动端邮局标题展示验证',frontend_icon='rocket')
print(json.dumps(pages))
`, root], { encoding: 'utf8', maxBuffer: 6 * 1024 * 1024 }));
    settings = { admin_username: 'tjt740', system_title: 'Mail', frontend_page_title: '我的邮局', api_page_title: 'API', admin_login_title: '管理员登录', frontend_icon: 'mail', frontend_icon_image: '', database_type: 'sqlite', admin_users: [], permissions: ['settings'], public_mail_key_required: false };
    writes = [];
    server = http.createServer(async (req, res) => {
        const name = new URL(req.url, 'http://localhost').pathname;
        if (name.startsWith('/static/')) {
            const file = path.resolve(root, '.' + name);
            if (!file.startsWith(root + '/static/') || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
            res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
            return res.end(fs.readFileSync(file));
        }
        if (name.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            if (name === '/admin/api/system-config') {
                if (req.method === 'POST') { let body = ''; for await (const chunk of req) body += chunk; const data = JSON.parse(body); writes.push(data); Object.assign(settings, data); }
                return res.end(JSON.stringify({ success: true, data: settings }));
            }
            if (name === '/api/public-mail-config') return res.end('{"success":true,"key_required":false}');
            if (name === '/api/get_mail') return res.end(JSON.stringify({ success: true, mails: [{ id: 'one', subject: 'A very long message subject '.repeat(8), from: 'longsender@example.com', to: 'reader@example.com', date: '2026-10-12 12:00:00', body: 'Body', body_type: 'text' }] }));
            return res.end('{"success":true,"language":"zh","data":[],"groups":[],"mappings":[]}');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(pages[name.split('/').pop()] || pages.public);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function shot(page, name) {
    if (!process.env.SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, name + '.png'), fullPage: true });
}
for (const width of [320, 390, 768, 1440]) test(`public input, single-line results and actions fit at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 769, hasTouch: width < 769, reducedMotion: 'reduce' });
    try {
        await page.goto(origin);
        await page.waitForFunction(() => window.AppI18n);
        for (const lang of ['zh', 'en', 'vi', 'fil']) {
            await page.evaluate(lang => AppI18n.setLanguage(lang), lang);
            const dimensions = await page.locator('#emailInput').evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth }));
            assert.ok(dimensions.height >= 100 && dimensions.scroll <= dimensions.height && dimensions.scrollWidth <= dimensions.width, JSON.stringify({ width, lang, dimensions }));
            assert.equal(await page.locator('.frontend-subtitle').count(), 0);
            if (width <= 560) assert.equal(await page.locator('.mail-table thead').isVisible(), false);
            assert.equal(await page.locator('.header h1').evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
            const controls = await page.evaluate(() => [...document.querySelectorAll('#emailInput, .query-count-field, .get-mail-btn, .frontend-top-actions')].map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
            assert.ok(controls.every(r => r.left >= 0 && r.right <= width), JSON.stringify({ lang, controls }));
        }
        await page.locator('#emailCountInput').fill('12');
        await page.locator('#emailCountInput').hover();
        await page.mouse.wheel(0, 200);
        assert.equal(await page.locator('#emailCountInput').inputValue(), '12');
        await page.locator('#emailInput').fill('reader@example.com');
        await page.locator('.get-mail-btn').click();
        await page.locator('#mailTableBody tr:not(:has(.mail-list-empty))').waitFor();
        assert.equal(await page.locator('.mail-table thead').isVisible(), true);
        assert.equal(await page.locator('#mailTableBody td').first().evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await shot(page, 'public-mobile-' + width);
    } finally { await page.close(); }
});
for (const width of [320, 390, 768]) test(`admin panels stay within ${width}px and branding saves after upload`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        for (const name of ['home', 'mailbox', 'daili', 'kami', 'kamirizhi', 'shoujian', 'help', 'system']) {
            await page.goto(origin + '/' + name);
            await page.waitForFunction(() => window.AppI18n);
            const overflow = await page.evaluate(() => [...document.querySelectorAll('.content, .main-content, .card, .table-container')].filter(el => el.getClientRects().length).map(el => ({ class: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(r => r.left < -1 || r.right > innerWidth + 1));
            assert.deepEqual(overflow, [], JSON.stringify({ width, name, overflow }));
            const searchBounds = await page.locator('.search-box input').evaluateAll(inputs => inputs.filter(el => el.getClientRects().length).map(el => ({ left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })));
            assert.ok(searchBounds.every(r => r.left >= 0 && r.right <= width), JSON.stringify({ name, searchBounds }));
            if (name === 'mailbox') assert.equal(await page.locator('.mailbox-status-views').evaluate(el => getComputedStyle(el).flexWrap), 'nowrap');
            await shot(page, 'admin-' + name + '-' + width);
        }
        await page.locator('a[href="#sec-pagetitle"]').click();
        await page.waitForFunction(() => document.getElementById('frontendPageTitle').value === '我的邮局');
        await page.locator('#frontendPageTitle').fill('测试品牌');
        await page.locator('#frontendIcon').selectOption('rocket');
        await page.locator('#frontendIconFile').setInputFiles(path.join(root, 'static/img/favicons/favicon-32x32.png'));
        await page.waitForFunction(() => document.getElementById('frontendIconImage').value.startsWith('data:image/png;base64,'));
        assert.equal(await page.locator('.brand-preview-icon svg').isVisible(), false);
        assert.equal(await page.locator('#frontendIconPreviewImage').isVisible(), true);
        await page.locator('#pageTitlesSubmit').click();
        await page.waitForFunction(() => document.body.textContent.includes('标题与图标已保存'));
        assert.equal(writes.at(-1).frontend_page_title, '测试品牌');
        await page.reload();
        await page.waitForFunction(() => document.getElementById('frontendPageTitle').value === '测试品牌');
        assert.equal(await page.locator('#frontendIcon').inputValue(), 'rocket');
        assert.ok((await page.locator('#frontendIconImage').inputValue()).startsWith('data:image/png;base64,'));
        await shot(page, 'branding-' + width);
        settings.frontend_page_title = '我的邮局';
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
test('scroll gestures do not activate actions or dismiss modal; deliberate taps still work', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    try {
        await page.goto(origin + '/system');
        await page.evaluate(() => {
            const modal = document.createElement('div'); modal.id = 'touchModal'; modal.className = 'modal';
            modal.innerHTML = '<div class="modal-content"><button id="touchAction">Delete</button></div>';
            document.body.appendChild(modal); window.actionCount = 0;
            document.getElementById('touchAction').addEventListener('click', () => window.actionCount++);
            AdminUI.modal.open('touchModal');
            const button = document.getElementById('touchAction');
            const fire = (type, y) => button.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 10, pointerType: 'touch', clientX: 100, clientY: y }));
            fire('pointerdown', 100); fire('pointermove', 180); fire('pointerup', 180);
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
        });
        assert.equal(await page.evaluate(() => actionCount), 0);
        await page.locator('#touchAction').tap();
        assert.equal(await page.evaluate(() => actionCount), 1);
        await page.evaluate(() => {
            const button = document.getElementById('touchAction'), modal = document.getElementById('touchModal');
            button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, pointerType: 'touch' }));
            modal.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11, pointerType: 'touch' }));
            modal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
        });
        assert.equal(await page.locator('#touchModal').evaluate(el => el.classList.contains('show')), true);
        await page.locator('#touchModal').tap({ position: { x: 2, y: 2 } });
        assert.equal(await page.locator('#touchModal').evaluate(el => el.classList.contains('show')), false);
    } finally { await page.close(); }
});
