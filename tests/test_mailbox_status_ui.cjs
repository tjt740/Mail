const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../templates/admin/mailbox.html'), 'utf8');
function declaration(name, kind = 'function') {
    const pattern = kind === 'function'
        ? new RegExp(`    (?:async )?function ${name}\\([^]*?\\n    }`)
        : new RegExp(`    const ${name} = [^]*?\\n    [}\\]];`);
    const match = source.match(pattern);
    assert.ok(match, `Missing ${name}`);
    return match[0];
}

function setup() {
    const elements = {
        mailboxId: { value: '1' }, email: { value: 'new@example.com' },
        mailboxLatestTestResult: { hidden: true }, mailboxFormTestResult: { hidden: true },
        mailboxForm: {}
    };
    const context = vm.createContext({
        document: {
            getElementById: id => elements[id],
            createElement: () => ({
                textContent: '',
                get innerHTML() {
                    return String(this.textContent).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }
            })
        },
        mailboxData: [{ id: '1', email: 'test@example.com', account_status: 'pending' }],
        currentPage: 1, renderCount: 0,
        renderMailboxView: () => context.renderCount++,
        getStoredPreference: () => '["email","actions"]',
        MAILBOX_COLUMN_STORAGE_KEY: 'columns',
        getTestButton: () => ({}), setTestingState: () => {},
        readJsonResponse: async response => response, showToast: () => {},
        summarizeMailboxTestMessage: message => message,
        ensureSingleMailboxImportParsed: async () => true,
        FormData: class {
            get(key) { return ({ email: 'new@example.com', password: 'dummy', server: 'imap.example.com', port: '993' })[key]; }
        },
        console: { error() {} }
    });
    const constants = ['MAILBOX_STATUS_META', 'MAILBOX_COLUMNS'].map(name => declaration(name, 'const'));
    const functions = [
        'getMailboxTestStatus', 'renderMailboxStatusBadge', 'renderMailboxTestPanel',
        'showMailboxTestOutcome', 'updateMailboxTestResult', 'testMailbox',
        'getDefaultVisibleMailboxColumns', 'getVisibleMailboxColumnKeys', 'escapeHtml', 'escapeAttribute'
    ].map(name => declaration(name));
    vm.runInContext([...constants, ...functions].join('\n'), context);
    return { context, elements };
}

test('all inline scripts parse', () => {
    for (const [, script] of source.matchAll(/<script\b[^>]*>([^]*?)<\/script>/g)) {
        new vm.Script(script.replace(/\{\{[^]*?\}\}/g, 'null'));
    }
});

test('account status stays visible with old saved column preferences', () => {
    assert.ok(setup().context.getVisibleMailboxColumnKeys().includes('test_status'));
});

for (const [status, label] of Object.entries({
    normal: '正常', banned: '封禁', invalid_credentials: '凭据失效',
    network_error: '网络异常', test_error: '检测异常', pending: '未检测'
})) {
    test(`structured ${status} renders its label and colored SVG without a timestamp`, () => {
        const { context } = setup();
        assert.equal(context.getMailboxTestStatus({ account_status: status }).className, status);
        const badge = context.renderMailboxStatusBadge({ account_status: status });
        assert.ok(badge.includes(label));
        assert.ok(badge.includes(`<span class="mailbox-test-tag ${status}"`));
        assert.ok(badge.includes('<svg'));
    });
    if (status === 'pending') continue;
    test(`manual test immediately updates string IDs, list and modal for ${status}`, async () => {
        const { context, elements } = setup();
        context.fetch = async () => ({ success: status === 'normal', account_status: status, message: 'API detail', last_test: '2026-09-04 10:00:00' });
        await context.testMailbox(1);
        assert.equal(context.mailboxData[0].account_status, status);
        assert.equal(context.renderCount, 1);
        for (const id of ['mailboxLatestTestResult', 'mailboxFormTestResult']) {
            assert.equal(elements[id].hidden, false);
            assert.ok(elements[id].innerHTML.includes(label));
            assert.ok(elements[id].innerHTML.includes('API detail'));
        }
    });
}

test('legacy unsuccessful auth is not normal, actual success remains normal', () => {
    const { context } = setup();
    assert.equal(context.getMailboxTestStatus({ test_result: 'authentication unsuccessful' }).className, 'invalid_credentials');
    assert.equal(context.getMailboxTestStatus({ test_result: '请检查服务器是否正常运行' }).className, 'test_error');
    assert.equal(context.getMailboxTestStatus({ test_result: '✅ 邮箱连接测试成功！(通过直连)' }).className, 'normal');
    assert.equal(context.getMailboxTestStatus({ account_status: 'network_error', test_result: '连接成功' }).className, 'network_error');
});

test('unsaved mailbox tests leave persistent feedback without mutating the list', async () => {
    const { context, elements } = setup();
    elements.mailboxId.value = '';
    context.fetch = async () => ({ success: false, account_status: 'invalid_credentials', message: 'Token expired' });
    await context.testMailbox();
    assert.ok(elements.mailboxFormTestResult.innerHTML.includes('凭据失效'));
    assert.ok(elements.mailboxFormTestResult.innerHTML.includes('保存前'));
    assert.equal(context.mailboxData[0].account_status, 'pending');
});

test('request and login failures display feedback without overwriting saved status', async () => {
    const { context, elements } = setup();
    context.mailboxData[0].account_status = 'normal';
    context.fetch = async () => ({ success: false, message: '登录状态已失效' });
    await context.testMailbox(1);
    assert.equal(context.mailboxData[0].account_status, 'normal');
    assert.ok(elements.mailboxLatestTestResult.innerHTML.includes('已保存的账号状态未更改'));
    context.fetch = async () => { throw new Error('Failed to fetch'); };
    await context.testMailbox(1);
    assert.equal(context.mailboxData[0].account_status, 'normal');
    assert.ok(elements.mailboxLatestTestResult.innerHTML.includes('Failed to fetch'));
});

test('result details are escaped and another mailbox modal is not overwritten', () => {
    const { context, elements } = setup();
    elements.mailboxId.value = '2';
    context.updateMailboxTestResult(1, { account_status: 'test_error', message: '<img src=x onerror="alert(1)">' });
    assert.ok(elements.mailboxLatestTestResult.innerHTML.includes('&lt;img'));
    assert.ok(!elements.mailboxLatestTestResult.innerHTML.includes('<img'));
    assert.equal(elements.mailboxFormTestResult.hidden, true);
});
