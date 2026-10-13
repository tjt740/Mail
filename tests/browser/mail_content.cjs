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
    print(json.dumps({name: render_template(name, embedded=True, admin_username='test', system_title='Mail', page_title='Mail') for name in ['admin/mailbox.html', 'admin/shoujian.html', 'frontend/index.html']}))
`, root], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
    server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/admin/mailbox' || pathname === '/admin/shoujian' || pathname === '/') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(rendered[pathname === '/' ? 'frontend/index.html' : `${pathname.slice(1)}.html`]);
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

async function showMail(page, admin, html, type = 'html', images = [], attachments = []) {
    await page.evaluate(({ admin, html, type, images, attachments }) => {
        const mail = { id: 'fixture', subject: 'Account invitation', from: 'team@example.com', to: 'reader@example.com',
            body: html, bodyType: type, body_type: type, images, attachments, date: '2026-09-23T08:00:00Z', receivedAt: '2026-09-23T08:00:00Z', folder: 'inbox' };
        if (admin) {
            document.getElementById('receiveModal').classList.add('show');
            document.getElementById('receiveMailboxLabel').textContent = 'reader@example.com';
            receiveState.mails = [mail];
            receiveState.activeMail = mail;
            renderReceiveDetail(mail);
        } else displayMail({ ...mail, images, attachments });
    }, { admin, html, type, images, attachments });
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
                const backBeforeScroll = admin ? await page.locator('.receive-back').boundingBox() : null;
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
                    assert.equal(await page.locator('#receiveDetailView .receive-back').count(), 0);
                    await frame.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await page.evaluate(() => {
                        for (const id of ['receiveDetailView']) {
                            const el = document.getElementById(id);
                            el.scrollTop = el.scrollHeight;
                        }
                        const body = document.querySelector('.receive-body');
                        body.scrollTop = body.scrollHeight;
                    });
                    const backAfterScroll = await page.locator('.receive-back').boundingBox();
                    assert.equal(backAfterScroll.y, backBeforeScroll.y, 'Back must stay in the fixed modal header');
                    assert.ok(await page.locator('.receive-back').evaluate(el => {
                        const box = el.getBoundingClientRect();
                        return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
                    }), 'Mail content must never cover the Back button');
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
                    assert.ok(await page.locator('#receiveDetailToolbar').isHidden());
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
        assert.equal(await frame.locator('form, iframe, [onerror], meta[http-equiv="refresh"]').count(), 0);
        assert.equal(await frame.locator('script').count(), 1, 'Only the trusted height measurement script remains');
        assert.equal(await frame.locator('#unsafe').getAttribute('href'), null);
        assert.equal(await frame.locator('#safe').getAttribute('target'), '_blank');
        assert.equal(await frame.locator('#safe').getAttribute('rel'), 'noopener noreferrer');
        assert.equal(await element.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox allow-scripts');
        assert.equal(await element.getAttribute('referrerpolicy'), 'no-referrer');
        assert.equal(await page.evaluate(() => window.mailCodeRan), undefined);
        assert.equal(page.url(), origin + '/admin/mailbox');
    } finally { await page.close(); }
});

test('mailbox list deduplicates before pagination and preserves group/owner filtering', async () => {
    const page = await browser.newPage();
    try {
        await page.goto(origin + '/admin/mailbox');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => {
            mailboxData = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, email: `user${i}@example.com`, created_by_admin: 'owner-a' }));
            mailboxData.push({ id: 22, email: ' USER0@EXAMPLE.COM ', created_by_admin: 'owner-b' });
            mailboxData.push({ id: 23, email: 'User0@example.com', created_by_admin: 'owner-b' });
            mailboxData.push({ id: 24, email: 'user0@example.com', created_by_admin: 'owner-a' });
            groups = [{ id: ROOT_GROUP_ID, name: '所有分组' }, { id: UNGROUPED_GROUP_ID, name: '未分组' },
                { id: 1, name: 'A' }, { id: 2, name: 'B' }];
            mailboxGroupMappings = [{ mailbox_id: 1, group_id: 1 }, { mailbox_id: 22, group_id: 2 }, { mailbox_id: 23, group_id: 2 }];
            rebuildMailboxGroupMapFromMappings();
            recalculateGroupCounts();
            selectedGroupId = ROOT_GROUP_ID;
            perPage = 20;
            renderMailboxView(1);
        });
        assert.equal(await page.locator('#mailboxTable tbody tr').count(), 20);
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '21');
        await page.evaluate(() => renderMailboxView(2));
        assert.equal(await page.locator('#mailboxTable tbody tr').count(), 1);
        for (const groupId of [1, 2]) {
            await page.evaluate(id => { selectedGroupId = id; renderMailboxView(1); }, groupId);
            assert.equal(await page.locator('#mailboxTable tbody tr').count(), 1);
            assert.equal(await page.locator('#adminMailboxCount').innerText(), '1');
            assert.equal(await page.evaluate(id => getGroupById(id).mailboxCount, groupId), 1);
        }
        await page.evaluate(() => { selectedGroupId = UNGROUPED_GROUP_ID; renderMailboxView(1); });
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '21');
        await page.evaluate(() => { selectedGroupId = ROOT_GROUP_ID; ownerFilter = 'owner-b'; renderMailboxView(1); });
        assert.equal(await page.locator('#mailboxTable tbody tr').count(), 1);
        assert.equal(await page.locator('#adminMailboxCount').innerText(), '1');
    } finally { await page.close(); }
});

for (const width of [390, 1440]) test(`public reader stays inside the inbox with complete images and long mail at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#527f96"/></svg>';
    try {
        await page.route('**/late-banner.svg', async route => {
            await gate;
            await route.fulfill({ contentType: 'image/svg+xml', body: svg });
        });
        await page.goto(origin);
        await page.locator('#emailInput').fill('reader@example.com\nsecond@example.com');
        const before = await page.locator('.mail-workspace').boundingBox();
        const image = { content_id: '<banner>', mime_type: 'image/svg+xml', content: Buffer.from(svg).toString('base64'), filename: 'banner.svg' };
        await showMail(page, false, `<h2>Full message</h2><img id="inline" style="display:block" src="cid:banner"><img id="remote" style="display:block" src="${origin}/late-banner.svg">` +
            '<p>Complete text and formatting stay readable.</p>'.repeat(45) + '<p id="end">End of message</p>', 'html', [image]);
        const element = page.locator('.mail-content-frame');
        const frame = await (await element.elementHandle()).contentFrame();
        await frame.waitForFunction(() => document.getElementById('inline').naturalWidth > 0);
        await page.waitForFunction(() => parseInt(document.querySelector('.mail-content-frame').style.height) > 1000);
        const beforeImage = (await element.boundingBox()).height;
        release();
        await frame.waitForFunction(() => document.getElementById('remote').naturalWidth > 0);
        await page.waitForFunction(height => document.querySelector('.mail-content-frame').getBoundingClientRect().height > height + 80, beforeImage);
        await frame.waitForFunction(() => document.documentElement.scrollHeight <= innerHeight + 1);
        assert.ok(await page.locator('#mailImages').isHidden(), 'Embedded images must not be duplicated in a separate gallery');
        assert.ok(await page.locator('.scene-hero').isVisible());
        assert.ok(await page.locator('.mail-query-panel').isVisible());
        assert.deepEqual(await page.locator('.mail-workspace').boundingBox(), before, 'Reading must not resize or move the inbox');
        assert.equal(await page.evaluate(() => window.scrollY), 0);
        assert.ok(await page.locator('#mailDisplay').evaluate(el => el.scrollHeight > el.clientHeight));
        assert.ok(await page.locator('#mailListPanel').evaluate(el => el.scrollHeight <= el.clientHeight + 1));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1));
        await page.locator('#mailDisplay').evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert.ok(await page.locator('#mailDisplay').evaluate(el => el.scrollTop > 500));
        assert.equal(await page.evaluate(() => window.scrollY), 0);
        assert.ok(await page.locator('.back-btn').evaluate(el => {
            const box = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), 'Back stays reachable inside the inbox when reading the end');
        await page.locator('.back-btn').click();
        assert.ok(await page.locator('.mail-query-panel').isVisible());
        assert.equal(await page.locator('#emailInput').inputValue(), 'reader@example.com\nsecond@example.com');
        assert.equal(await page.evaluate(() => window.scrollY), 0);

        await showMail(page, false, '<p>A short complete message.</p>');
        await page.waitForFunction(() => parseInt(document.querySelector('.mail-content-frame').style.height) === 120);
        assert.equal(await page.locator('#mailDisplay').evaluate(el => el.scrollTop), 0, 'Each new message starts at its beginning');
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'Short messages should fit in one screen');
    } finally { release(); await page.close(); }
});

test('public auto-size bridge permits no mail scripts or forged resize messages', async () => {
    const page = await browser.newPage();
    try {
        await page.goto(origin);
        assert.equal(await page.evaluate(() => extractVerificationCodeFromMail({
            body_type: 'html', body: '<style>.a{color:#123456}</style><script>const code=654321</script><p>验证码：003821</p>'
        })), '003821', 'Only visible mail text participates in verification-code extraction');
        await showMail(page, false, `<script nonce="mail-provided">window.mailCodeRan = true</script>
            <svg onload="window.mailCodeRan = true"></svg><img src="bad" onerror="window.mailCodeRan = true">
            <p id="safe">Safe content</p>`);
        const element = page.locator('.mail-content-frame');
        const frame = await (await element.elementHandle()).contentFrame();
        await frame.locator('#safe').waitFor();
        await page.waitForFunction(() => !!document.querySelector('.mail-content-frame').style.height);
        assert.equal(await frame.locator('script').count(), 1, 'Only the trusted measurement bridge remains');
        assert.equal(await frame.locator('[onload], [onerror], [nonce="mail-provided"]').count(), 0);
        assert.equal(await frame.evaluate(() => window.mailCodeRan), undefined);
        assert.ok(!(await element.getAttribute('sandbox')).includes('allow-same-origin'));
        assert.ok(await frame.evaluate(() => { try { return !parent.document; } catch (_) { return true; } }));
        await frame.evaluate(() => {
            const script = document.createElement('script');
            script.nonce = 'mail-provided';
            script.textContent = 'window.mailCodeRan = true';
            document.body.appendChild(script);
        });
        assert.equal(await frame.evaluate(() => window.mailCodeRan), undefined, 'CSP rejects any script without the bridge nonce');
        const height = await element.evaluate(el => el.style.height);
        await page.evaluate(() => window.postMessage({ type: 'mail-content-height', id: document.querySelector('.mail-content-frame').dataset.mailContentId, height: 99999 }, '*'));
        await page.waitForTimeout(80);
        assert.equal(await element.evaluate(el => el.style.height), height, 'The sender window is validated in addition to the ID');
    } finally { await page.close(); }
});

for (const logs of [false, true]) for (const width of [390, 1440]) {
    test(`${logs ? 'log detail' : 'admin mailbox'} displays complete rich mail and attachments at ${width}px`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160"><rect width="640" height="160" fill="#527f96"/></svg>';
        const images = [{ content_id: 'banner', filename: 'banner.svg', mime_type: 'image/svg+xml', content: Buffer.from(svg).toString('base64') }];
        const attachments = [{ filename: 'report.txt', mime_type: 'text/plain', content: Buffer.from('Complete attachment contents').toString('base64') }];
        const html = fixture.replace('</body>', `<img id="inline" src="cid:banner">${'<p>Long rich message with all content.</p>'.repeat(100)}<p id="end">Final paragraph</p></body>`);
        try {
            await page.goto(origin + (logs ? '/admin/shoujian' : '/admin/mailbox'));
            if (logs) {
                await page.evaluate(({ html, images, attachments }) => renderLogDetail({
                    id: 1, mail_subject: 'Full message', mail_body_type: 'html', mail_body: html,
                    mail_images: images, mail_attachments: attachments, status: 'received'
                }), { html, images, attachments });
            } else await showMail(page, true, html, 'html', images, attachments);
            const element = page.locator(logs ? '#detailMailBodyContent iframe' : '.receive-content-frame');
            const frame = await (await element.elementHandle()).contentFrame();
            await frame.waitForFunction(() => document.getElementById('inline').naturalWidth === 640);
            await page.waitForFunction(selector => parseInt(document.querySelector(selector).style.height) > 2000,
                logs ? '#detailMailBodyContent iframe' : '.receive-content-frame');
            await frame.waitForFunction(() => document.documentElement.scrollHeight <= innerHeight + 1);
            assert.equal(await frame.locator('#end').innerText(), 'Final paragraph');
            assert.equal(await frame.locator('.button a').getAttribute('href'), 'https://example.com/activate');
            assert.equal(await frame.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(241, 238, 229)');
            assert.equal(await page.locator('.mail-resources img').count(), 0, 'CID images appear once in the body');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            const button = page.getByRole('button', { name: '下载 · report.txt' });
            await button.scrollIntoViewIfNeeded();
            const downloadPromise = page.waitForEvent('download');
            await button.click();
            const download = await downloadPromise;
            assert.equal(download.suggestedFilename(), 'report.txt');
            assert.equal(fs.readFileSync(await download.path(), 'utf8'), 'Complete attachment contents');
            assert.ok(await page.locator(logs ? '.log-detail-close' : '.receive-back').isVisible());
            if (process.env.MAIL_SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.MAIL_SCREENSHOT_DIR, { recursive: true });
                await page.evaluate(logs => { document.getElementById(logs ? 'logDetailBody' : 'receiveDetailView').scrollTop = 0; }, logs);
                await page.screenshot({ path: path.join(process.env.MAIL_SCREENSHOT_DIR, `${logs ? 'logs' : 'admin'}-rich-${width}.png`) });
            }
            if (logs) {
                await page.evaluate(() => renderLogDetail({ id: 2, mail_body_type: 'text', mail_body: 'Literal <b>plain</b>\n  indentation' }));
                assert.equal(await page.locator('#detailMailBodyContent').textContent(), 'Literal <b>plain</b>\n  indentation');
                assert.equal(await page.locator('#detailMailBodyContent iframe, .mail-resources section').count(), 0);
                assert.equal(await page.locator('#detailMailBodyContent').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
            }
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
}

test('refetch upgrades cached plain mail to HTML while retaining its ID', async () => {
    const page = await browser.newPage();
    try {
        await page.goto(origin + '/admin/mailbox');
        await page.waitForLoadState('networkidle');
        await page.route('**/api/get_mail', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
            success: true, mails: [{ subject: 'Cached message', from: 'sender@example.com', date: '2026-10-13 08:00:00',
                body_type: 'html', body: '<h2 id="full">Full HTML content</h2>' }]
        }) }));
        await page.evaluate(async () => {
            mailboxData = [{ id: 1, email: 'reader@example.com' }];
            receiveState.mailboxId = 1;
            document.getElementById('receiveModal').classList.add('show');
            saveReceiveStore({ 1: [{ id: 'original-id', subject: 'Cached message', from: 'sender@example.com',
                receivedAt: '2026-10-13 08:00:00', bodyType: 'text', body: 'Old plain preview', folder: 'inbox' }] });
            await fetchMailboxMails();
        });
        const mails = await page.evaluate(() => receiveState.mails);
        assert.equal(mails.length, 1);
        assert.equal(mails[0].id, 'original-id');
        assert.equal(mails[0].bodyType, 'html');
        await page.evaluate(() => openReceiveDetail('original-id'));
        const frame = await (await page.locator('.receive-content-frame').elementHandle()).contentFrame();
        assert.equal(await frame.locator('#full').innerText(), 'Full HTML content');
        await page.reload();
        assert.equal(await page.evaluate(() => loadReceiveStore()[1][0].bodyType), 'html');
    } finally { await page.close(); }
});
