const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '..');

class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    dispatchEvent(event) { this.listeners.get(event.type)?.forEach(listener => listener(event)); }
}
function environment({ saved, blocked = false, languages = ['en-US'], parent } = {}) {
    const document = new Events();
    document.documentElement = Object.assign(new Events(), { dataset: { i18nManaged: 'react' } });
    document.readyState = 'loading';
    document.hidden = false;
    const frames = [];
    document.querySelectorAll = () => frames;
    const window = new Events();
    window.parent = parent || window;
    let stored = saved;
    const localStorage = {
        getItem: () => { if (blocked) throw Error('Storage unavailable'); return stored; },
        setItem: (_, value) => { if (blocked) throw Error('Storage unavailable'); stored = value; }
    };
    const media = new Map();
    window.matchMedia = query => {
        if (!media.has(query)) media.set(query, Object.assign(new Events(), { matches: false }));
        return media.get(query);
    };
    let frameId = 0;
    const scheduled = new Map();
    const context = vm.createContext({
        window, document, localStorage, navigator: { languages }, Intl, Date, console,
        queueMicrotask, setTimeout, clearTimeout,
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        fetch: async () => ({ ok: true, json: async () => ({ success: true, language: 'en' }) }),
        requestAnimationFrame: fn => { scheduled.set(++frameId, fn); return frameId; },
        cancelAnimationFrame: id => scheduled.delete(id),
        MutationObserver: class { observe() {} disconnect() {} },
        ResizeObserver: class { observe() {} disconnect() {} },
        IntersectionObserver: class { observe() {} disconnect() {} }
    });
    return { context, window, document, frames, media, scheduled, stored: () => stored,
        load(file) { vm.runInContext(fs.readFileSync(path.join(root, 'static/js', file), 'utf8'), context); },
        step(time) { const callbacks = [...scheduled.values()]; scheduled.clear(); callbacks.forEach(fn => fn(time)); }
    };
}

test('locale fallback recognizes regional browser languages and honors saved preferences', () => {
    for (const [options, expected] of [
        [{ languages: ['vi-VN'] }, 'vi'], [{ languages: ['zh-TW'] }, 'zh'],
        [{ languages: ['fr-FR'] }, 'en'], [{ saved: 'vi', languages: ['zh-CN'] }, 'vi'],
        [{ saved: 'invalid', languages: ['en-GB'] }, 'en']
    ]) {
        const env = environment(options); env.load('i18n.js');
        assert.equal(env.window.AppI18n.language, expected);
    }
});

test('language changes sync both directions with an iframe even when storage is blocked', () => {
    const parent = environment({ blocked: true }); parent.load('i18n.js');
    const child = environment({ blocked: true, parent: parent.window }); child.load('i18n.js');
    parent.frames.push({ contentWindow: child.window });
    parent.window.AppI18n.setLanguage('vi');
    assert.equal(child.window.AppI18n.language, 'vi');
    child.window.AppI18n.setLanguage('zh');
    assert.equal(parent.window.AppI18n.language, 'zh');
    assert.equal(parent.document.documentElement.lang, 'zh-CN');
    assert.equal(parent.stored(), undefined);
});

test('late detection cannot override a manual language selection without localStorage', async () => {
    const env = environment({ blocked: true });
    let complete;
    env.context.fetch = () => new Promise(resolve => { complete = resolve; });
    env.load('i18n.js');
    env.document.dispatchEvent({ type: 'DOMContentLoaded' });
    env.window.AppI18n.setLanguage('vi');
    complete({ ok: true, json: async () => ({ success: true, language: 'en' }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(env.window.AppI18n.language, 'vi');
});

test('translations cover shell, status symbols, multiline feedback and fallback text', () => {
    const env = environment(); env.load('i18n.js');
    const { t } = env.window.AppI18n;
    assert.equal(t('帮助中心'), 'Help Center');
    assert.equal(t('⚠️ 凭据失效'), '⚠️ Invalid credentials');
    assert.equal(t('API detail\n当前为保存前的测试结果。'), 'API detail\nThis test was run before saving.');
    assert.equal(t('1 封'), '1 message');
    assert.equal(t('2 封'), '2 messages');
    assert.equal(t('自定义名称'), '自定义名称');
    assert.equal(t('语言', 'vi'), 'Ngôn ngữ');
    assert.equal(t('语言', 'zh'), '语言');
    assert.equal(t('每行一个邮箱，自动识别多种格式：\nexample'), 'One mailbox per line. Multiple formats are auto-detected:\nuser@example.com----password\nuser@hotmail.com----password----client_id----refresh_token----Graph API\nemail=user@example.com password=password client_id=... refresh_token=... auth_type=graph\nSupports ---- / colon / pipe / comma / JSON / key=value / Graph API');
});

test('dates preserve Beijing database timestamps and explicit offsets in every locale', () => {
    const env = environment(); env.load('i18n.js');
    const api = env.window.AppI18n;
    for (const language of ['zh', 'en', 'vi']) {
        api.setLanguage(language);
        assert.equal(api.formatDate('2026-09-14 16:30:00'), api.formatDate('2026-09-14T08:30:00Z'));
        assert.equal(api.formatDate('bad date'), 'bad date');
        assert.equal(api.formatDate(null), '-');
        assert.equal(api.formatNumber(12345), new Intl.NumberFormat(api.locale).format(12345));
    }
});

function canvasFixture(env) {
    let draws = 0;
    const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient'
        ? () => ({ addColorStop() {} }) : () => { if (key === 'clearRect') draws++; }, set: () => true });
    return { canvas: { getContext: () => context, getBoundingClientRect: () => ({ width: 3840, height: 2160, left: 0, top: 0 }) }, draws: () => draws };
}

test('Canvas mounts once, bounds Retina pixels and completely stops after destruction', () => {
    const env = environment(); env.window.devicePixelRatio = 3; env.load('motion.js');
    const { canvas, draws } = canvasFixture(env);
    const controller = env.window.MailMotion.mount(canvas);
    assert.equal(env.window.MailMotion.mount(canvas), controller);
    assert.ok(canvas.width * canvas.height < 2410000);
    assert.equal(env.scheduled.size, 1);
    env.step(100); env.step(140); assert.ok(draws() > 1);
    controller.destroy(); controller.destroy();
    assert.equal(env.scheduled.size, 0);
    env.document.dispatchEvent({ type: 'visibilitychange' });
    env.window.dispatchEvent({ type: 'pageshow' });
    assert.equal(env.scheduled.size, 0);
});

test('Canvas pauses in hidden pages and responds live to reduced motion and page restoration', () => {
    const env = environment(); env.load('motion.js');
    const { canvas, draws } = canvasFixture(env);
    const reduced = env.media.get('(prefers-reduced-motion: reduce)');
    const controller = env.window.MailMotion.mount(canvas);
    env.document.hidden = true; env.document.dispatchEvent({ type: 'visibilitychange' });
    assert.equal(env.scheduled.size, 0);
    env.document.hidden = false; env.document.dispatchEvent({ type: 'visibilitychange' });
    assert.equal(env.scheduled.size, 1);
    reduced.matches = true; reduced.dispatchEvent({ type: 'change' });
    const staticDraws = draws(); env.step(1000);
    assert.equal(env.scheduled.size, 0); assert.equal(draws(), staticDraws);
    reduced.matches = false; reduced.dispatchEvent({ type: 'change' });
    assert.equal(env.scheduled.size, 1);
    env.window.dispatchEvent({ type: 'pagehide' }); assert.equal(env.scheduled.size, 0);
    env.window.dispatchEvent({ type: 'pageshow' }); assert.equal(env.scheduled.size, 1);
    controller.destroy();
});

test('Canvas gracefully tolerates unavailable 2D contexts', () => {
    const env = environment(); env.load('motion.js');
    assert.equal(env.window.MailMotion.mount(null), null);
    assert.equal(env.window.MailMotion.mount({ getContext: () => null }), null);
    assert.equal(env.scheduled.size, 0);
});

// Optional real-browser regression against the built React shell and shared
// locale code. No Flask instance, application database or email API is used.
test('browser: language and reduced-motion changes preserve state and dropdown positioning', {
    skip: !process.env.RUN_BROWSER_TESTS,
    timeout: 30000
}, async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const http = require('node:http');
    const assets = {
        '/static/main.js': ['static/react/assets/main.js', 'text/javascript'],
        '/static/main.css': ['static/react/assets/main.css', 'text/css'],
        '/static/i18n.js': ['static/js/i18n.js', 'text/javascript']
    };
    const server = http.createServer((request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const asset = assets[pathname];
        if (asset) {
            response.setHeader('Content-Type', asset[1]);
            response.end(fs.readFileSync(path.join(root, asset[0]))); return;
        }
        if (pathname === '/api/language') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ success: true, language: 'en' })); return;
        }
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (pathname === '/legacy/') {
            response.end(`<!doctype html><html><body>
                <textarea id="draft" placeholder="请输入邮箱地址 (例: user@example.com)"></textarea>
                <select id="group"><option value="未分组">未分组</option></select>
                <p id="message" translate="no">删除</p><p id="label">邮箱管理</p>
                <script src="/static/i18n.js"></script></body></html>`); return;
        }
        response.end(`<!doctype html><html data-i18n-managed="react"><head>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <link rel="stylesheet" href="/static/main.css"></head><body><div id="root"></div>
            <script type="module" src="/static/main.js"></script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, locale: 'en-US' });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const url = `http://127.0.0.1:${server.address().port}`;
        await page.goto(url);
        await page.locator('.legacy-frame-wrap.is-loaded').waitFor();
        const frame = page.frames().find(item => item.url().includes('/legacy/'));
        const origin = await frame.evaluate(() => performance.timeOrigin);
        await frame.locator('#draft').fill('draft@example.com');
        for (const language of ['vi', 'zh', 'en']) {
            await page.evaluate(lang => window.AppI18n.setLanguage(lang), language);
            assert.equal(await frame.locator('#draft').inputValue(), 'draft@example.com');
            assert.equal(await frame.locator('#group').inputValue(), '未分组');
            assert.equal(await frame.locator('#message').innerText(), '删除');
            assert.equal(await frame.evaluate(() => performance.timeOrigin), origin);
        }
        assert.equal(await frame.locator('#label').innerText(), 'Mailboxes');
        assert.match(await frame.locator('#draft').getAttribute('placeholder'), /Enter/);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await frame.locator('#draft').inputValue(), 'draft@example.com');
        await page.goto(`${url}/admin/login`);
        await page.locator('input[name=username]').fill('preserved-admin');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('input[name=username]').inputValue(), 'preserved-admin');
        await page.locator('.react-language-button').click();
        await page.getByRole('menuitem', { name: /Tiếng Việt/ }).click();
        await page.getByRole('heading', { name: 'Đăng nhập quản trị' }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('input[name=username]').inputValue(), 'preserved-admin');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
});
