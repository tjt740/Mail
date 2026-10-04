// Real shell and templates with isolated fixtures; never calls live mail APIs.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
before(async () => {
    const html = execFileSync(path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import json, sys
app=Flask(__name__,template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
result={}
for name in ['home','mailbox','system','daili','kami','kamirizhi','shoujian','help']:
 with app.test_request_context('/legacy/admin/'+name):
  result[name]=render_template('admin/'+name+'.html', embedded=True, admin_username='fixture', admin_permissions=['home','mailbox','settings','mail_logs'], system_title='Mail', admin_users=[], admin_master_key_set=False)
print(json.dumps(result))
`, root], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
    const pages = JSON.parse(html);
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/static/')) {
            const file = path.resolve(root, '.' + url.pathname);
            if (file.startsWith(root + '/static/') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
                return res.end(fs.readFileSync(file));
            }
            res.statusCode = 404; return res.end();
        }
        if (url.pathname.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            if (url.pathname.endsWith('/dashboard')) return res.end(JSON.stringify({ success: true, updated_at: '2026-10-02 16:00:00', mailboxes: { total: 100, health: { normal: 70, banned: 5, invalid_credentials: 5, network_error: 5, test_error: 5, pending: 10 } }, trend: Array.from({ length: 7 }, (_, i) => ({ day: '2026-10-0' + (i+1), received: 15 + i*7, failed: i*2, processed: 0 })), recent_failures: [], cards: null, proxies: null, poller: null }));
            return res.end(JSON.stringify({ success: true, language: 'zh', data: [], groups: [], mappings: [] }));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (url.pathname.startsWith('/legacy/admin/')) return res.end(pages[url.pathname.split('/').pop()] || pages.home);
        res.end(`<!doctype html><html data-i18n-managed="react"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/static/react/assets/main.css"></head><body><div id="root"></div><script>window.__MAIL_APP_PROPS__={adminUsername:'fixture',adminPermissions:['home','mailbox','settings','mail_logs'],systemTitle:'Mail'};</script><script type="module" src="/static/react/assets/main.js"></script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function choose(page, label) {
    await page.locator('.react-color-theme-button').click();
    await page.getByRole('menuitem', { name: new RegExp(label) }).click();
    await page.locator('.react-color-theme-dropdown').waitFor({ state: 'hidden' });
}
async function themeState(page, key) {
    await page.waitForFunction(key => document.documentElement.dataset.colorTheme === key && document.querySelector('iframe')?.contentDocument?.documentElement.dataset.colorTheme === key, key);
}
test('scene themes synchronize, persist and keep live iframe forms intact', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(origin + '/admin/home'); await themeState(page, 'sunny');
        const frame = page.frames().find(frame => frame.url().includes('/legacy/'));
        const timeOrigin = await frame.evaluate(() => performance.timeOrigin);
        for (const [key, label] of [['sunny','晴天'],['night','夜间'],['rain','雨夜'],['clay','暖陶橙'],['ocean','海洋蓝'],['emerald','翡翠绿'],['violet','紫罗兰'],['rose','玫瑰红']]) {
            await choose(page, label); await themeState(page, key);
            assert.equal(await frame.evaluate(() => performance.timeOrigin), timeOrigin);
            const styles = await frame.locator('.monitor-metric').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundImage));
            assert.equal(new Set(styles).size, 4);
            assert.deepEqual(await contrastFailures(page, '.admin-header'), []);
            if (process.env.SCREENSHOT_DIR) {
                fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, key+'.png'), fullPage: true });
            }
        }
        await choose(page, '雨夜'); await themeState(page, 'rain');
        await page.reload(); await themeState(page, 'rain');
        await page.goto(origin + '/admin/mailbox'); await themeState(page, 'rain');
        const mailbox = page.frames().find(frame => frame.url().includes('/legacy/'));
        await mailbox.locator('#searchInput').fill('keep-this-search');
        await choose(page, '夜间'); await themeState(page, 'night');
        assert.equal(await mailbox.locator('#searchInput').inputValue(), 'keep-this-search');
        await page.goto(origin + '/admin/system'); await themeState(page, 'night');
        const settings = page.frames().find(frame => frame.url().includes('/legacy/'));
        await settings.locator('a[href="#sec-systitle"]').click();
        await settings.locator('#systemTitle').fill('unsaved-title');
        await choose(page, '晴天'); await themeState(page, 'sunny');
        assert.equal(await settings.locator('#systemTitle').inputValue(), 'unsaved-title');
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
test('theme sync works without local storage and on a narrow screen', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('storage disabled'); }; Storage.prototype.setItem = () => { throw new Error('storage disabled'); }; });
        await page.goto(origin + '/admin/home'); await themeState(page, 'sunny');
        await choose(page, '雨夜'); await themeState(page, 'rain');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const frame = page.frames().find(frame => frame.url().includes('/legacy/'));
        assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'rain-mobile.png'), fullPage: true });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await frame.waitForFunction(() => MailDashboard.scene?.animating);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await frame.waitForFunction(() => !MailDashboard.scene.animating);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

test('rain animates both weather layers, remains bounded and freezes for reduced motion', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(origin + '/admin/home'); await themeState(page, 'sunny');
        await choose(page, '雨夜'); await themeState(page, 'rain');
        const frame = page.frames().find(frame => frame.url().includes('/legacy/'));
        await frame.waitForFunction(() => MailDashboard.scene?.frameCount > 15);
        for (const id of ['adminBgCanvas', 'monitorScene']) {
            const before = await frame.locator('#' + id).evaluate(canvas => canvas.toDataURL());
            await frame.waitForFunction(({ id, before }) => document.getElementById(id).toDataURL() !== before, { id, before });
            assert.equal(await frame.locator('#' + id).evaluate(canvas => canvas.width * canvas.height <= 2404000), true);
        }
        if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'rain-wind-active.png'), fullPage: true });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await frame.waitForFunction(() => !MailDashboard.scene.animating);
        const snapshots = await frame.evaluate(() => ['adminBgCanvas', 'monitorScene'].map(id => document.getElementById(id).toDataURL()));
        const settled = await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(['adminBgCanvas', 'monitorScene'].map(id => document.getElementById(id).toDataURL()))))));
        assert.deepEqual(settled, snapshots);
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});

const { contrastFailures } = require('./theme_contrast.cjs');
test('all palettes keep every admin page readable', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    const failures = [];
    try {
        for (const name of ['home', 'system', 'daili', 'kami', 'kamirizhi', 'shoujian', 'help']) {
            await page.goto(origin + '/legacy/admin/' + name);
            await page.waitForFunction(() => window.MailThemes);
            // Wait for synthetic API responses and the page's initial render.
            await page.waitForLoadState('networkidle');
            for (const theme of ['sunny','night','rain','clay','ocean','emerald','violet','rose']) {
                await page.evaluate(theme => MailThemes.apply(theme), theme);
                failures.push(...(await contrastFailures(page, '.content')).map(item => ({ page: name, theme, ...item })));
            }
        }
        if (process.env.CONTRAST_REPORT) fs.writeFileSync(process.env.CONTRAST_REPORT, JSON.stringify(failures, null, 2));
        assert.equal(failures.length, 0, JSON.stringify(failures.slice(0, 15)));
    } finally { await page.close(); }
});
