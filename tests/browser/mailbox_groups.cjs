// Synthetic fixtures only; never opens a business database or contacts a mail server.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.MAILBOX_TEST_ROOT || path.resolve(__dirname, '../..');
let server, browser, origin, groups, accounts, mappings, writes, rejectGroup;

before(async () => {
    const html = execFileSync(process.env.PYTHON_BIN || path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import sys
app = Flask(__name__, template_folder=sys.argv[1] + '/templates')
app.jinja_env.globals['url_for'] = lambda endpoint, **kw: '/static/' + kw['filename'] if endpoint == 'static' else '/' + endpoint
with app.test_request_context('/legacy/admin/mailbox'):
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
            res.statusCode = 404;
            return res.end();
        }
        if (url.pathname.includes('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            let payload = { success: true, language: 'zh', data: [], groups, mappings };
            if (req.method === 'POST') {
                let body = '';
                for await (const chunk of req) body += chunk;
                const data = JSON.parse(body);
                writes.push({ path: url.pathname, ...data });
                if (url.pathname === '/admin/api/mailbox-groups' && data.action === 'add') {
                    if (rejectGroup) payload = { success: false, message: '父分组不存在或无权使用' };
                    else {
                        const id = Math.max(...groups.map(group => group.id)) + 1;
                        groups.push({ id, name: data.name, parent_id: data.parent_id });
                        payload = { success: true, group_id: id };
                    }
                } else if (url.pathname === '/admin/api/mailbox' && ['add', 'batch_add'].includes(data.action)) {
                    const id = Math.max(...accounts.map(account => account.id)) + 1;
                    accounts.push({ id, email: data.email || 'batch@example.com', server: 'imap.example.com', port: 993, protocol: 'imap', account_status: 'pending' });
                    if (data.group_id) mappings.push({ mailbox_id: id, group_id: data.group_id });
                }
            } else if (url.pathname === '/admin/api/mailbox') payload.data = accounts;
            return res.end(JSON.stringify(payload));
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});

after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
});

async function newPage(width = 1440) {
    groups = [{ id: 1, name: 'Capcut', parent_id: null }, { id: 2, name: '已有子组', parent_id: 1 }, { id: 3, name: '独立分组', parent_id: null }];
    accounts = [1, 2].map(id => ({ id, email: `account${id}@example.com`, server: 'imap.example.com', port: 993, protocol: 'imap', account_status: 'pending' }));
    mappings = [{ mailbox_id: 1, group_id: 1 }, { mailbox_id: 2, group_id: 2 }];
    writes = [];
    rejectGroup = false;
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelector('#adminMailboxCount').textContent === '2');
    return page;
}

const forms = [
    { kind: 'single', open: 'showAddModal', modal: 'mailboxModal', select: 'groupSelect', input: 'mailboxNewGroupName', feedback: 'mailboxGroupFeedback', create: 'mailboxCreateGroupBtn', save: 'saveMailbox', prefix: '' },
    { kind: 'batch', open: 'showBatchAddModal', modal: 'batchAddModal', select: 'batchGroupSelect', input: 'batchNewGroupName', feedback: 'batchGroupFeedback', create: 'batchCreateGroupBtn', save: 'saveBatchMailboxes', prefix: 'batch' }
];

for (const width of [1440, 390]) for (const form of forms) {
    test(`${form.kind} add at ${width}px: save under selected parent, retain ancestors, assign and reload`, async () => {
        const page = await newPage(width);
        try {
            await page.evaluate(() => setSelectedGroup(1));
            await page.evaluate(name => window[name](), form.open);
            assert.equal(await page.locator(`#${form.select}`).inputValue(), '1', 'a parent with children must remain selectable');
            assert.match(await page.locator(`#${form.feedback}`).innerText(), /将在“Capcut”下添加子分组/);
            await page.locator(`#${form.input}`).fill('新子组');
            await page.locator(`#${form.input}`).press('Enter');
            await page.waitForFunction(id => document.getElementById(id).value === '4', form.select);
            assert.equal(groups.find(group => group.id === 4).parent_id, 1);
            assert.equal(await page.locator(`#${form.select} option:checked`).innerText(), 'Capcut\\新子组');
            assert.equal(await page.locator('#groupTree .group-item[data-group-id="1"] .group-toggle').getAttribute('aria-expanded'), 'true');
            assert.equal(await page.locator('#groupTree li').filter({ has: page.locator(':scope > .group-item[data-group-id="1"]') }).locator('.group-children .group-item[data-group-id="4"]').count(), 1);
            assert.equal(await page.locator(`#${form.select} option[value="1"]`).count(), 1);

            // The newly selected child can itself become a parent; both ancestors must open.
            await page.locator(`#${form.input}`).fill('孙级分组');
            await page.locator(`#${form.create}`).click();
            await page.waitForFunction(id => document.getElementById(id).value === '5', form.select);
            assert.equal(groups.find(group => group.id === 5).parent_id, 4);
            assert.equal(await page.locator(`#${form.select} option:checked`).innerText(), 'Capcut\\新子组\\孙级分组');
            assert.equal(await page.locator('#groupTree .group-item[data-group-id="4"] .group-toggle').getAttribute('aria-expanded'), 'true');
            assert.equal(await page.locator(`#${form.select} option[value="4"]`).count(), 1);

            if (form.kind === 'single') {
                await page.locator('#email').fill('new@example.com');
                await page.locator('#password').fill('fixture-password');
            } else await page.locator('#batchContent').fill('batch@example.com----fixture-password');
            const field = name => form.prefix ? form.prefix + name[0].toUpperCase() + name.slice(1) : name;
            await page.locator(`#${field('server')}`).fill('imap.example.com');
            await page.locator(`#${field('sendServer')}`).fill('smtp.example.com');
            await page.evaluate(name => window[name](), form.save);
            await page.locator(`#${form.modal}`).waitFor({ state: 'hidden' });
            assert.equal(writes.find(write => write.action === (form.kind === 'single' ? 'add' : 'batch_add') && write.path === '/admin/api/mailbox').group_id, 5);
            await page.reload();
            await page.waitForFunction(() => document.querySelector('#adminMailboxCount').textContent === '3');
            if (width < 1000) await page.locator('#mobileGroupPanelToggle').click();
            assert.equal(await page.locator('.group-item[data-group-id="5"]').isVisible(), true);
            assert.match(await page.locator('.group-item[data-group-id="1"] .group-count').innerText(), /3/);
            await page.locator('.group-item[data-group-id="5"]').click();
            assert.equal(await page.locator('#adminMailboxCount').innerText(), '1');
            assert.equal(groups.find(group => group.id === 3).parent_id, null, 'existing top-level groups stay independent');
            if (process.env.SCREENSHOT_DIR && width === 1440 && form.kind === 'single') {
                fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mailbox-subgroups-desktop.png') });
            }
        } finally { await page.close(); }
    });
}

for (const form of forms) test(`${form.kind}: explicit top-level creation, duplicate validation and rejected parent`, async () => {
    const page = await newPage();
    try {
        await page.evaluate(name => window[name](), form.open);
        assert.match(await page.locator(`#${form.feedback}`).innerText(), /顶级分组/);
        await page.locator(`#${form.input}`).fill('新顶级组');
        await page.locator(`#${form.create}`).click();
        await page.waitForFunction(id => document.getElementById(id).value === '4', form.select);
        assert.equal(groups.find(group => group.id === 4).parent_id, null);
        await page.locator(`#${form.input}`).fill('CAPCUT');
        assert.equal(await page.locator(`#${form.create}`).isDisabled(), true);
        await page.locator(`#${form.select}`).selectOption('2');
        await page.locator(`#${form.input}`).fill('无权新增');
        assert.match(await page.locator(`#${form.feedback}`).innerText(), /Capcut\\已有子组/);
        rejectGroup = true;
        await page.locator(`#${form.create}`).click();
        await page.waitForFunction(id => document.getElementById(id).textContent.includes('无权使用'), form.feedback);
        assert.equal(groups.length, 4);
        assert.equal(await page.locator(`#${form.select}`).inputValue(), '2');
        assert.equal(await page.locator('.group-item[data-group-id="5"]').count(), 0);
        await page.evaluate(() => AppI18n.setLanguage('en'));
        await page.locator(`#${form.input}`).fill('translated child');
        await page.waitForFunction(id => document.getElementById(id).textContent.includes('A subgroup will be added under'), form.feedback);
        assert.match(await page.locator(`#${form.feedback}`).innerText(), /Capcut/);
    } finally { await page.close(); }
});

test('sidebar child creation reveals and restores the new child through collapsed ancestors', async () => {
    const page = await newPage();
    try {
        await page.locator('.group-item[data-group-id="1"] .group-actions-button').click();
        await page.locator('#groupContextMenu [data-action="add-child"]').click();
        await page.locator('#groupNameInput').fill('侧栏子组');
        await page.locator('#groupModal .modal-footer .btn-primary').click();
        await page.locator('#groupModal').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.group-item[data-group-id="4"]').isVisible(), true);
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), '侧栏子组');
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#adminCurrentGroup').textContent === '侧栏子组');
        assert.equal(await page.locator('.group-item[data-group-id="4"]').isVisible(), true);
    } finally { await page.close(); }
});

for (const width of [1440, 390]) test(`group menus create children while the header creates top-level groups at ${width}px`, async () => {
    const page = await newPage(width);
    const menu = page.locator('#groupContextMenu');
    const modal = page.locator('#groupModal');
    const openPanel = async () => {
        if (width < 1000 && !await page.locator('#groupPanel').isVisible()) await page.locator('#mobileGroupPanelToggle').click();
    };
    try {
        await page.evaluate(() => setSelectedGroup(1));
        await openPanel();
        await page.locator('.group-item[data-group-id="1"] .group-actions-button').click();
        assert.equal(await menu.locator('[data-action="add"]').isVisible(), false);
        assert.deepEqual(await menu.locator('button:visible:not(:disabled)').evaluateAll(buttons => buttons.map(button => button.dataset.action)), ['add-child', 'edit', 'delete']);
        await page.evaluate(() => handleGroupAction('add'));
        assert.equal(await modal.isVisible(), false, 'a group action must not create a top-level group');
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.evaluate(() => MailThemes.apply('rain'));
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `group-actions-${width}.png`) });
        }
        await menu.locator('[data-action="add-child"]').click();
        assert.equal(await modal.locator('#groupModalTitle').innerText(), '添加下级分组');
        assert.equal(await modal.locator('#groupParentName').inputValue(), 'Capcut');
        await modal.locator('#groupNameInput').fill('菜单子分组');
        await modal.locator('.modal-footer .btn-primary').click();
        await modal.waitFor({ state: 'hidden' });
        assert.equal(groups.find(group => group.name === '菜单子分组').parent_id, 1);

        // Right-clicking a child follows the same rule, including deeper nesting.
        await openPanel();
        await page.locator('.group-item[data-group-id="4"]').click({ button: 'right' });
        assert.equal(await menu.locator('[data-action="add"]').isVisible(), false);
        await menu.locator('[data-action="add-child"]').click();
        assert.equal(await modal.locator('#groupParentName').inputValue(), '菜单子分组');
        await modal.locator('.modal-close').click();

        // The header plus remains an explicit top-level entry even with a child selected.
        await page.locator('#groupPanel .group-panel-header-toggle').click();
        assert.equal(await modal.locator('#groupModalTitle').innerText(), '添加分组');
        assert.equal(await modal.locator('#groupParentName').inputValue(), '主分组');
        await modal.locator('#groupNameInput').fill('独立顶级组');
        await modal.locator('.modal-footer .btn-primary').click();
        await modal.waitFor({ state: 'hidden' });
        assert.equal(groups.find(group => group.name === '独立顶级组').parent_id, null);

        for (const groupId of ['all_groups', 'ungrouped']) {
            await openPanel();
            await page.locator(`.group-item[data-group-id="${groupId}"] .group-actions-button`).click();
            assert.equal(await menu.locator('[data-action="add"]').isVisible(), true, 'switching context restores the top-level action');
            assert.equal(await menu.locator('[data-action="add-child"]').isDisabled(), true);
            await menu.locator('[data-action="add"]').click();
            assert.equal(await modal.locator('#groupParentName').inputValue(), '主分组');
            await modal.locator('.modal-close').click();
        }
        const additions = writes.filter(write => write.path === '/admin/api/mailbox-groups' && write.action === 'add');
        assert.deepEqual(additions.map(write => write.parent_id), [1, null]);
    } finally { await page.close(); }
});


for (const width of [1440, 1024, 390]) test(`nested group branches at ${width}px separate selection, expansion and settings`, async () => {
    const page = await newPage(width);
    try {
        groups.push({ id: 4, name: '孙级分组', parent_id: 2 });
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#adminMailboxCount').textContent === '2');
        await page.evaluate(() => setSelectedGroup(1));
        if (width < 1000) await page.locator('#mobileGroupPanelToggle').click();
        const parent = page.locator('.group-item[data-group-id="1"]');
        const child = page.locator('.group-item[data-group-id="2"]');
        const grandchild = page.locator('.group-item[data-group-id="4"]');
        const sibling = page.locator('.group-item[data-group-id="3"]');
        await parent.locator('.group-toggle').click();
        await child.locator('.group-toggle').click();
        await page.mouse.move(0, 0);
        const boxes = await Promise.all([parent, child, grandchild, sibling].map(row => row.boundingBox()));
        assert.ok(boxes[1].x >= boxes[0].x + 20 && boxes[1].width <= boxes[0].width - 20, 'a child row is physically inset, not just its text');
        assert.ok(boxes[2].x >= boxes[1].x + 20 && boxes[2].width <= boxes[1].width - 20, 'every descendant gains another level of indentation');
        assert.ok(boxes[2].height <= 44, 'the desktop sidebar leaves room for a short grandchild name and count');
        assert.equal(boxes[3].x, boxes[0].x, 'independent groups remain at the root');
        assert.ok(boxes[3].y >= boxes[2].y + boxes[2].height, 'the entire branch appears before the next root');
        assert.equal(await grandchild.locator('.group-toggle').count(), 0);
        const style = await child.evaluate(row => ({
            background: getComputedStyle(row).backgroundColor,
            border: getComputedStyle(row).borderTopColor,
            connector: getComputedStyle(row, '::before').height,
            branch: getComputedStyle(row.parentElement.parentElement).borderLeftWidth
        }));
        assert.equal(style.background, 'rgba(0, 0, 0, 0)', 'unselected descendants use a lightweight tree row');
        assert.equal(style.border, 'rgba(0, 0, 0, 0)');
        assert.equal(style.connector, '1px');
        assert.equal(style.branch, '1px');
        const controls = await child.evaluate(row => {
            const arrow = row.querySelector('.group-toggle').getBoundingClientRect();
            const name = row.querySelector('.group-name').getBoundingClientRect();
            const settings = row.querySelector('.group-actions-button').getBoundingClientRect();
            return { arrowRight: arrow.right, nameLeft: name.left, nameRight: name.right, settingsLeft: settings.left };
        });
        assert.ok(controls.arrowRight <= controls.nameLeft && controls.nameRight <= controls.settingsLeft);
        const actions = child.locator('.group-actions-button');
        await actions.click();
        assert.equal(await page.locator('#groupContextMenu').isVisible(), true);
        assert.equal(await child.locator('.group-toggle').getAttribute('aria-expanded'), 'true', 'settings must not collapse the branch');
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), 'Capcut', 'settings must not select a different group');
        await page.keyboard.press('Escape');
        assert.equal(await actions.evaluate(node => node === document.activeElement), true);
        await page.mouse.move(0, 0);
        if (process.env.SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `nested-tree-${width}.png`) });
        }
        await parent.locator('.group-toggle').click();
        await child.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#adminCurrentGroup').innerText(), 'Capcut');
        await parent.locator('.group-toggle').press('Enter');
        await grandchild.waitFor({ state: 'visible' });
        assert.equal(await page.locator('#groupTree').evaluate(node => node.scrollWidth > node.clientWidth), false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(writes.length, 0, 'browsing never changes saved group relationships');
    } finally { await page.close(); }
});

test('nested branches animate smoothly, reverse in progress and respect reduced motion', async () => {
    const page = await newPage();
    try {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const parent = page.locator('.group-item[data-group-id="1"]');
        const toggle = parent.locator('.group-toggle');
        const branch = page.locator('#mailbox-group-children-1');
        const opening = await toggle.evaluate(button => {
            button.click();
            const list = document.getElementById(button.getAttribute('aria-controls'));
            const animation = list.getAnimations()[0];
            animation.pause(); animation.currentTime = 100;
            return { frames: animation.effect.getKeyframes(), height: list.getBoundingClientRect().height };
        });
        assert.equal(opening.frames[0].height, '0px');
        assert.ok(opening.height > 0 && opening.height < parseFloat(opening.frames.at(-1).height));
        await toggle.evaluate(button => button.click());
        await branch.waitFor({ state: 'hidden' });
        assert.equal(await branch.evaluate(node => node.inert), true);
        await toggle.click();
        await page.waitForFunction(() => !document.getElementById('mailbox-group-children-1').getAnimations().length);
        assert.equal(await branch.isVisible(), true);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await toggle.click();
        assert.equal(await branch.isVisible(), false);
        assert.equal(await branch.evaluate(node => node.getAnimations().length), 0);
    } finally { await page.close(); }
});
