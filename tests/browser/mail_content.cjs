// Run with Playwright installed: node --test tests/browser/mail_content.cjs
// PYTHON_BIN may point to the project's Flask virtualenv; no application database is used.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const fixture = `<!doctype html><html><head><style>
    body { background: #f1eee5; font: 16px/1.5 Arial, sans-serif; }
    .receive-detail-header, .receive-detail-toolbar { display: none !important; }
    .modal-content { width: 3000px !important; }
    td { padding: 0; }
    .message { width: 640px; background: white; }
    .copy { padding: 32px; }
    .button td { background: black; padding: 12px 20px; border-radius: 4px; }
    .button a { color: white; text-decoration: none; }
    @media (max-width: 560px) { .copy { padding: 16px; } }
    </style></head><body><table role="presentation" width="100%"><tr><td align="center">
    <table class="message" width="640" role="presentation"><tr><td class="copy">
    <h2>Welcome to your account</h2><p>Hi Isabella,</p>
    <p>Welcome to our community. Confirm your email and create a password to get started.</p>
    <table class="button" role="presentation"><tr><td><a href="https://example.com/activate">Create your account</a></td></tr></table>
    <p>Need help? Learn more about creating your account.</p>
    <img width="1200" height="120" alt="banner" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='120'%3E%3Crect width='1200' height='120' fill='%23f1eee5'/%3E%3C/svg%3E">
    <p>${'long-unbroken-token'.repeat(20)}</p>
    </td></tr></table></td></tr></table></body></html>`;

let browser, server, origin;
before(async () => {
    const python = process.env.PYTHON_BIN || path.join(root, '.venv/bin/python');
    const rendered = JSON.parse(execFileSync(python, ['-c', `
import json, sys
from flask import Flask, render_template
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
app.jinja_env.globals['url_for'] = lambda name, **kw: '/static/' + kw['filename'] if name == 'static' else '/' + name
with app.test_request_context('/admin/mailbox'):
    print(json.dumps({name: render_template(name, embedded=True, admin_username='test', system_title='Mail', page_title='Mail') for name in ['admin/mailbox.html', 'frontend/index.html']}))
`, root], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
    server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/admin/mailbox' || pathname === '/') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(rendered[pathname === '/' ? 'frontend/index.html' : 'admin/mailbox.html']);
        }
        if (pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + pathname);
            if (file.startsWith(root + '/static/') && fs.existsSync(file)) {
                const type = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)];
                if (type) res.setHeader('Content-Type', type);
                return res.end(fs.readFileSync(file));
            }
            res.statusCode = 404;
            return res.end();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, data: [], groups: [], mappings: [], total: 0, language: 'zh' }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
});

async function showMail(page, admin, html, type = 'html') {
    await page.evaluate(({ admin, html, type }) => {
        const mail = { id: 'fixture', subject: 'Account invitation', from: 'team@example.com', to: 'reader@example.com',
            body: html, bodyType: type, body_type: type, date: '2026-09-23T08:00:00Z', receivedAt: '2026-09-23T08:00:00Z', folder: 'inbox' };
        if (admin) {
            document.getElementById('receiveModal').classList.add('show');
            document.getElementById('receiveMailboxLabel').textContent = 'reader@example.com';
            receiveState.mails = [mail];
            receiveState.activeMail = mail;
            renderReceiveDetail(mail);
        } else displayMail(mail);
    }, { admin, html, type });
}

for (const admin of [true, false]) {
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
        test(`${admin ? 'admin' : 'public'} HTML mail remains isolated and readable at ${width}px`, async () => {
            const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
            try {
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.goto(origin + (admin ? '/admin/mailbox' : '/'));
                await showMail(page, admin, fixture);
                const frameElement = page.locator(admin ? '.receive-content-frame' : '.mail-content-frame');
                await frameElement.waitFor({ state: 'visible' });
                await frameElement.scrollIntoViewIfNeeded();
                const frame = await (await frameElement.elementHandle()).contentFrame();
                await frame.locator('.button').waitFor();
                assert.deepEqual(errors, []);
                const size = await frameElement.boundingBox();
                assert.ok(size.width > 200 && size.width <= width, JSON.stringify(size));
                assert.ok(size.height >= 300);
                const dimensions = await frame.evaluate(() => ({
                    viewport: document.documentElement.clientWidth,
                    content: document.documentElement.scrollWidth,
                    message: document.querySelector('.message').getBoundingClientRect().width,
                    button: document.querySelector('.button').getBoundingClientRect().width,
                    background: getComputedStyle(document.body).backgroundColor
                }));
                assert.ok(dimensions.content <= dimensions.viewport + 1, JSON.stringify(dimensions));
                assert.ok(dimensions.message <= 640 && dimensions.message <= dimensions.viewport, JSON.stringify(dimensions));
                assert.ok(dimensions.button < 260, 'CTA table must not stretch to the full message width');
                assert.equal(dimensions.background, 'rgb(241, 238, 229)');
                if (admin) {
                    assert.ok(await page.locator('.receive-detail-header').isVisible());
                    assert.ok(await page.locator('.receive-back').isVisible());
                    assert.ok(await page.locator('#receiveDetailSubject').innerText() === 'Account invitation');
                }
                if (process.env.MAIL_SCREENSHOT_DIR) {
                    fs.mkdirSync(process.env.MAIL_SCREENSHOT_DIR, { recursive: true });
                    await page.screenshot({ path: path.join(process.env.MAIL_SCREENSHOT_DIR, `${admin ? 'admin' : 'public'}-${width}.png`) });
                }
                const plain = '  Plain text\n    <b>keep literal</b>\n' + 'x'.repeat(300);
                await showMail(page, admin, plain, 'text');
                assert.equal(await frameElement.count(), 0);
                const body = page.locator(admin ? '#receiveDetailBody' : '#mailBody');
                assert.equal(await body.textContent(), plain);
                assert.equal(await body.evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
                if (admin) {
                    await page.locator('.receive-back').click();
                    assert.ok(await page.locator('#receiveListView').isVisible());
                }
            } finally { await page.close(); }
        });
    }
}

test('HTML scripts, event handlers and navigation cannot escape the mail frame', async () => {
    const page = await browser.newPage();
    try {
        await page.goto(origin + '/admin/mailbox');
        await showMail(page, true, `<meta http-equiv="refresh" content="0;url=https://example.com">
            <script>parent.mailCodeRan = true</script><img src="x" onerror="parent.mailCodeRan = true">
            <a id="unsafe" href="java&#10;script:alert(1)">unsafe</a><a id="safe" href="https://example.com">safe</a>
            <form action="https://example.com"><input name="secret"></form><iframe src="https://example.com"></iframe>`);
        const element = page.locator('.receive-content-frame');
        const frame = await (await element.elementHandle()).contentFrame();
        await frame.locator('#safe').waitFor();
        assert.equal(await frame.locator('script, form, iframe, [onerror], meta[http-equiv="refresh"]').count(), 0);
        assert.equal(await frame.locator('#unsafe').getAttribute('href'), null);
        assert.equal(await frame.locator('#safe').getAttribute('target'), '_blank');
        assert.equal(await frame.locator('#safe').getAttribute('rel'), 'noopener noreferrer');
        assert.equal(await element.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox');
        assert.equal(await element.getAttribute('referrerpolicy'), 'no-referrer');
        assert.equal(await page.evaluate(() => window.mailCodeRan), undefined);
        assert.equal(page.url(), origin + '/admin/mailbox');
    } finally { await page.close(); }
});
