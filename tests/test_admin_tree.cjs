const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { layout } = require('../static/js/admin-tree.js');
const root = path.join(__dirname, '..');
const fixture = [
    { id: 1, username: 'tjt740', parent_admin_id: null, admin_level: 1, is_builtin_admin: true, has_children: true },
    { id: 2, username: 'lhm', parent_admin_id: 1, admin_level: 2, is_builtin_admin: true, has_children: true },
    { id: 3, username: 'pink', parent_admin_id: 1, admin_level: 2, is_builtin_admin: true },
    { id: 4, username: 'child', parent_admin_id: 2, admin_level: 3, can_manage: true, permissions: [], created_at: '2026-09-15 10:00:00' },
    { id: 5, username: 'direct-child', parent_admin_id: 1, admin_level: 3, can_manage: true, permissions: [] }
];

test('hierarchy layout preserves parent edges and level 3 rank even under the root', () => {
    const graph = layout(fixture);
    const find = id => graph.nodes.find(node => node.id === id);
    assert.equal(find(4).y, find(5).y);
    assert.ok(find(4).y > find(2).y);
    assert.deepEqual(graph.edges.map(({ parent, child }) => [parent.id, child.id]).sort(), [[1,2], [1,3], [1,5], [2,4]].sort());
    for (const a of graph.nodes) for (const b of graph.nodes) {
        if (a.id !== b.id && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= 280);
    }
    assert.equal(layout(fixture, new Set(['2'])).nodes.some(node => node.id === 4), false);
    assert.deepEqual(layout(fixture, new Set(['1'])).nodes.map(node => node.id), [1]);
});

test('empty, detached and malformed parent relationships stay renderable', () => {
    assert.equal(layout([]).height, 0);
    assert.equal(layout([]).width, 0);
    const nodes = [{ id: 1, parent_admin_id: 2, admin_level: 1 }, { id: 2, parent_admin_id: 1, admin_level: 2 },
        { id: 3, parent_admin_id: 999, admin_level: 3 }];
    const graph = layout(nodes);
    assert.equal(graph.nodes.length, 3);
    assert.equal(graph.edges.length, 1);
    assert.ok(graph.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test('browser: hierarchy updates, actions, safe labels, translation, pan, zoom and mobile layout', {
    skip: !process.env.RUN_BROWSER_TESTS,
    timeout: 30000
}, async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const http = require('node:http');
    const server = http.createServer((req, res) => {
        if (req.url === '/api/language') { res.setHeader('Content-Type', 'application/json'); res.end('{"success":true,"language":"zh"}'); return; }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
            * { box-sizing:border-box; } body { margin:0; font-family:Arial,sans-serif; } main { max-width:1100px; padding:16px; margin:auto; }
            ${fs.readFileSync(path.join(root, 'static/css/admin-tree.css'), 'utf8')}
            </style></head><body><main><div id="tree"></div><input id="draft" /></main></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.addScriptTag({ path: path.join(root, 'static/js/i18n.js') });
        await page.addScriptTag({ path: path.join(root, 'static/js/admin-tree.js') });
        await page.evaluate(data => {
            window.AppI18n.setLanguage('zh');
            window.accounts = data;
            window.actions = [];
            window.tree = AdminHierarchy.create(document.getElementById('tree'), {
                permissions: node => actions.push(['permissions', node.id]),
                reset: node => actions.push(['reset', node.id]),
                remove: node => actions.push(['remove', node.id])
            });
            tree.setData(accounts, [], 1);
        }, fixture);
        assert.equal(await page.locator('.admin-tree-node').count(), 5);
        await page.locator('[data-admin-id="4"] .admin-tree-node-main').click();
        await page.getByRole('button', { name: '功能授权', exact: true }).click();
        await page.getByRole('button', { name: '重置密码', exact: true }).click();
        await page.getByRole('button', { name: '删除', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => actions), [['permissions', 4], ['reset', 4], ['remove', 4]]);
        await page.locator('[data-admin-id="2"] .admin-tree-toggle').click();
        assert.equal(await page.locator('[data-admin-id="4"]').count(), 0);
        await page.evaluate(() => {
            accounts.push({ id: 6, username: '<img src=x onerror=alert(1)>', parent_admin_id: 2, admin_level: 3, can_manage: true });
            tree.setData(accounts, [], 1, { focusId: 6 });
        });
        assert.equal(await page.locator('.admin-tree-node').count(), 6);
        assert.equal(await page.locator('.admin-tree-node.is-selected').getAttribute('data-admin-id'), '6');
        assert.equal(await page.locator('#tree img').count(), 0);
        assert.equal(await page.locator('.admin-tree-edges path[data-parent-id="2"][data-child-id="6"]').count(), 1);
        await page.locator('#draft').fill('unsaved value');
        await page.evaluate(() => AppI18n.setLanguage('vi'));
        assert.equal(await page.locator('.admin-tree-heading h3').innerText(), 'Cây phân cấp quản trị viên');
        assert.equal(await page.locator('.admin-tree-node.is-selected').getAttribute('data-admin-id'), '6');
        assert.equal(await page.locator('#draft').inputValue(), 'unsaved value');
        await page.evaluate(() => AppI18n.setLanguage('en'));
        assert.equal(await page.locator('.admin-tree-heading h3').innerText(), 'Administrator hierarchy');
        const beforeZoom = await page.locator('.admin-tree-zoom').innerText();
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        assert.notEqual(await page.locator('.admin-tree-zoom').innerText(), beforeZoom);
        const beforePan = await page.locator('.admin-tree-scene').getAttribute('style');
        const box = await page.locator('.admin-tree-viewport').boundingBox();
        await page.mouse.move(box.x + 15, box.y + 15); await page.mouse.down();
        await page.mouse.move(box.x + 95, box.y + 55, { steps: 8 }); await page.mouse.up();
        assert.notEqual(await page.locator('.admin-tree-scene').getAttribute('style'), beforePan);
        await page.getByRole('button', { name: 'Fit to view', exact: true }).click();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        assert.equal(await page.locator('.admin-tree-scene').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Fit to view', exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        // Removing a selected node resets selection; a restricted branch only has its supplied ancestor context.
        await page.evaluate(() => {
            accounts = accounts.filter(node => node.id !== 6);
            tree.setData(accounts, [], 1);
        });
        assert.equal(await page.locator('[data-admin-id="6"]').count(), 0);
        assert.equal(await page.locator('.admin-tree-node.is-selected').getAttribute('data-admin-id'), '1');
        await page.evaluate(() => tree.setData(accounts.filter(node => [2,4].includes(node.id)), [{id:1,username:'tjt740',admin_level:1,parent_admin_id:null}], 2));
        assert.equal(await page.locator('.admin-tree-node').count(), 3);
        await page.locator('[data-admin-id="1"] .admin-tree-node-main').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.admin-tree-actions button').count(), 0);
        assert.equal(await page.locator('.admin-tree-readonly').innerText(), 'Parent relationship only');
        await page.evaluate(() => tree.setData([], [], 0));
        assert.equal(await page.locator('.admin-tree-empty').isVisible(), true);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
