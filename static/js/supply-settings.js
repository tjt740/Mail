(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const get = id => document.getElementById(id);
        if (!get('supplyTokenForm')) return;
        const health = get('supplyHealth');
        const scene = window.createSupplyConnectionScene?.(health);
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const presets = [...document.querySelectorAll('.supply-limit-preset')];
        const tokenInput = get('supplyTokenInput');
        const tokenToggle = get('supplyTokenToggle');
        const uiText = new Map();
        function setText(element, source) {
            // Update only the label so loading states and locale changes retain icons.
            element = element.querySelector('[data-button-label]') || element;
            element.setAttribute('data-i18n-ignore', '');
            uiText.set(element, source);
            element.textContent = window.AppI18n?.t(source) || source;
        }
        window.addEventListener('app-language-change', () => {
            uiText.forEach((source, element) => {
                if (element.isConnected) element.textContent = window.AppI18n?.t(source) || source;
                else uiText.delete(element);
            });
            renderConnection();
            updateTokenToggle();
        });
        let configured = false;
        let ready = false;
        let loading = true;
        let busy = false;
        let actionToast = null;
        let revealPending = false;
        let revealController = null;
        let revealVersion = 0;
        let showingSavedToken = false;
        let connection = { status: 'untested' };
        const controls = ['supplyTokenSubmit', 'supplyLimitSubmit', 'supplyTestButton', 'supplyPreviewButton', 'supplyConnectionHub'];
        function updateControls() {
            controls.forEach(id => { get(id).disabled = busy || loading || revealPending || (id === 'supplyLimitSubmit' && !ready) ||
                (['supplyTestButton', 'supplyPreviewButton', 'supplyConnectionHub'].includes(id) && !configured); });
            get('supplyMailLimit').disabled = busy || loading || revealPending || !ready;
            presets.forEach(button => { button.disabled = busy || loading || revealPending || !ready; });
            tokenInput.readOnly = revealPending;
            updateTokenToggle();
            updateSceneAction();
        }
        function updateSceneAction() {
            const checking = connection.status === 'checking';
            const label = checking ? '等待响应…' : configured ?
                (connection.status === 'failed' ? '点击重试' : '点击检测') : '待检测';
            setText(get('supplySceneStatus'), label);
            const hub = get('supplyConnectionHub');
            hub.setAttribute('aria-busy', String(checking));
            const action = checking ? '等待响应…' : connection.status === 'failed' ? '重新测试连通' : '测试连通';
            hub.title = window.AppI18n?.t(action) || action;
            hub.setAttribute('aria-label', hub.title);
        }
        function updateTokenToggle() {
            const visible = tokenInput.type === 'text';
            const label = revealPending ? '正在读取 Token…' : visible ? '隐藏 Token' :
                configured && !tokenInput.value ? '查看已保存的 Token' : '显示 Token';
            const translated = window.AppI18n?.t(label) || label;
            tokenToggle.setAttribute('aria-label', translated);
            tokenToggle.title = translated;
            tokenToggle.setAttribute('aria-pressed', String(visible));
            tokenToggle.setAttribute('aria-busy', String(revealPending));
            tokenToggle.querySelector('use').setAttribute('href', visible ? '#ai-eye-invisible' : '#ai-eye');
            tokenToggle.disabled = busy || loading || revealPending || (!configured && !tokenInput.value);
        }
        function hideToken() {
            revealVersion++;
            revealController?.abort();
            revealController = null;
            revealPending = false;
            tokenInput.type = 'password';
            if (showingSavedToken) tokenInput.value = '';
            showingSavedToken = false;
            updateControls();
        }
        function updatePresets() {
            presets.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.limit) === Number(get('supplyMailLimit').value))));
        }
        function setConfigured(value) {
            configured = value;
            setText(get('supplyTokenStatus'), configured ? '已配置 Supply Token' : '尚未配置 Supply Token');
            updateControls();
        }
        function renderConnection() {
            const state = get('supplyConnectionStatus');
            state.dataset.state = connection.status;
            health.dataset.state = connection.status;
            health.setAttribute('aria-busy', String(connection.status === 'checking'));
            scene?.setState(connection.status);
            updateSceneAction();
            setText(state, { connected: '已连通', failed: '连接失败', checking: '检测中…' }[connection.status] || '待检测');
            get('supplyConnectionMeta').hidden = !connection.checked_at;
            if (connection.checked_at) {
                get('supplyCheckedAt').dataset.i18nDate = connection.checked_at;
                get('supplyCheckedAt').textContent = window.AppI18n?.formatDate(connection.checked_at) || connection.checked_at;
                get('supplyLatency').textContent = connection.latency_ms == null ? '—' : `${connection.latency_ms} ms`;
                setText(get('supplyCheckStage'), connection.stage === 'mail' ? '邮箱收件' : 'Token 校验');
            }
        }
        function clearPreview() {
            get('supplyPreviewResults').replaceChildren();
            setText(get('supplyPreviewStatus'), '');
            uiText.forEach((_, element) => { if (!element.isConnected) uiText.delete(element); });
        }
        function mailNode(tag, text, untranslated = false) {
            const element = document.createElement(tag);
            element.textContent = String(text || '');
            if (untranslated) element.setAttribute('translate', 'no');
            else setText(element, String(text || ''));
            return element;
        }
        function renderPreview(data) {
            const mails = Array.isArray(data.mails) ? data.mails : [];
            get('supplyPreviewResults').replaceChildren();
            setText(get('supplyPreviewStatus'), mails.length ? `成功获取 ${mails.length} 封邮件` : '邮箱中暂无邮件');
            mails.forEach((mail, index) => {
                const detail = document.createElement('details');
                detail.style.setProperty('--supply-delay', `${Math.min(index, 6) * 45}ms`);
                detail.open = index === 0;
                const subject = mailNode('summary', mail.subject || '(无主题)', true);
                detail.appendChild(subject);
                const meta = document.createElement('div');
                meta.className = 'supply-mail-meta';
                for (const [label, value] of [['发件人', mail.from], ['收件人', mail.to]]) {
                    const line = document.createElement('div');
                    line.append(mailNode('span', label), document.createTextNode('：'), mailNode('span', value || '—', true));
                    meta.appendChild(line);
                }
                const date = document.createElement('time');
                date.textContent = window.AppI18n?.formatDate(mail.date) || mail.date || '—';
                if (mail.date) date.dataset.i18nDate = mail.date;
                meta.appendChild(date);
                const content = document.createElement('div');
                content.className = 'supply-mail-content';
                const body = mail.body_type === 'html' ? window.MailContent.createFrame(mail.body || '', {
                    title: `邮件正文：${mail.subject || '无主题'}`,
                    className: 'supply-mail-frame',
                    images: mail.images || [],
                    attachments: mail.attachments || []
                }) : mailNode('pre', mail.body || '(邮件内容为空)', true);
                content.append(meta, body);
                detail.appendChild(content);
                get('supplyPreviewResults').appendChild(detail);
            });
        }
        function previewLoading() {
            setText(get('supplyPreviewStatus'), '正在获取邮件…');
            get('supplyPreviewResults').setAttribute('aria-busy', 'true');
            for (let i = 0; i < Math.min(Number(get('supplyMailLimit').value) || 3, 3); i++) {
                const row = document.createElement('div');
                row.className = 'supply-skeleton';
                row.setAttribute('aria-hidden', 'true');
                row.append(document.createElement('span'), document.createElement('span'));
                get('supplyPreviewResults').appendChild(row);
            }
        }
        async function post(payload) {
            const response = await fetch('/admin/api/supply-token', {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.connection) { connection = data.connection; renderConnection(); }
            if (!response.ok || !data.success) throw new Error(data.message || '请求失败');
            if (typeof data.configured === 'boolean') setConfigured(data.configured);
            return data;
        }
        async function run(action, button, task) {
            if (busy || revealPending) return;
            hideToken();
            actionToast?.remove();
            actionToast = null;
            const previousConnection = connection;
            busy = true;
            updateControls();
            button.setAttribute('aria-busy', 'true');
            delete button.dataset.result;
            setText(button, action === 'preview' ? '正在获取邮件…' : action === 'settings' ? '保存中…' : '正在验证…');
            if (action !== 'settings') { connection = { status: 'checking' }; renderConnection(); }
            if (action === 'preview') previewLoading();
            try {
                await task();
                button.dataset.result = 'success';
                if (!reducedMotion.matches) button.animate([
                    { transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: .45 }, { transform: 'scale(1)' }
                ], { duration: 320, easing: 'ease-out' });
            }
            catch (error) {
                button.dataset.result = 'error';
                if (connection.status === 'checking') {
                    // A browser/network failure has no verified upstream connectivity result.
                    connection = { status: 'failed', checked_at: new Date().toISOString(), latency_ms: null, stage: 'token' };
                    renderConnection();
                }
                if (action === 'settings') setText(get('supplyLimitStatus'), '保存失败');
                if (action === 'preview') setText(get('supplyPreviewStatus'), error.message || '获取邮件失败');
                actionToast = window.showToast(error.message || '请求失败', 'error');
            } finally {
                button.setAttribute('aria-busy', 'false');
                if (action === 'preview') {
                    get('supplyPreviewResults').setAttribute('aria-busy', 'false');
                    get('supplyPreviewResults').querySelectorAll('.supply-skeleton').forEach(row => row.remove());
                }
                if (action === 'save') get('supplyTokenInput').value = '';
                if (connection.status === 'checking') { connection = previousConnection; renderConnection(); }
                setText(button, { save: '验证并保存 Token', test: '测试连通', settings: '保存数量', preview: '预览邮件' }[action]);
                busy = false;
                updateControls();
            }
        }
        get('supplyTokenForm').addEventListener('submit', event => {
            event.preventDefault();
            const candidate = tokenInput.value.trim();
            run('save', get('supplyTokenSubmit'), async () => {
                await post({ action: 'save', token: candidate });
                clearPreview();
                actionToast = window.showToast('Supply Token 已验证并保存', 'success');
            });
        });
        tokenToggle.addEventListener('click', async () => {
            if (busy || loading || revealPending) return;
            if (tokenInput.type === 'text') { hideToken(); return; }
            if (tokenInput.value) {
                tokenInput.type = 'text';
                updateTokenToggle();
                return;
            }
            if (!configured) return;
            const version = ++revealVersion;
            revealController = new AbortController();
            revealPending = true;
            updateControls();
            try {
                const response = await fetch('/admin/api/supply-token', {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal' }),
                    signal: revealController.signal
                });
                const data = await response.json();
                if (version !== revealVersion) return;
                if (!response.ok || !data.success || typeof data.token !== 'string' || !data.token) {
                    throw new Error(data.message || 'Token 读取失败');
                }
                tokenInput.value = data.token;
                tokenInput.type = 'text';
                showingSavedToken = true;
            } catch (error) {
                if (version !== revealVersion || error.name === 'AbortError') return;
                actionToast?.remove();
                actionToast = window.showToast(error.message || 'Token 读取失败', 'error');
            } finally {
                if (version === revealVersion) {
                    revealPending = false;
                    revealController = null;
                    updateControls();
                }
            }
        });
        tokenInput.addEventListener('input', () => { showingSavedToken = false; updateTokenToggle(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) hideToken(); });
        window.addEventListener('pagehide', hideToken);
        new MutationObserver(() => { if (get('sec-supply').hidden) hideToken(); })
            .observe(get('sec-supply'), { attributes: true, attributeFilter: ['hidden'] });
        get('supplyTestButton').addEventListener('click', () => {
            run('test', get('supplyTestButton'), () => post({ action: 'test' }));
        });
        get('supplyConnectionHub').addEventListener('click', () => get('supplyTestButton').click());
        get('supplyLimitForm').addEventListener('submit', event => {
            event.preventDefault();
            run('settings', get('supplyLimitSubmit'), async () => {
                const data = await post({ action: 'settings', email_limit: Number(get('supplyMailLimit').value) });
                get('supplyMailLimit').value = data.email_limit;
                updatePresets();
                setText(get('supplyLimitStatus'), '已保存');
            });
        });
        get('supplyMailLimit').addEventListener('input', () => { setText(get('supplyLimitStatus'), ''); updatePresets(); });
        presets.forEach(button => button.addEventListener('click', () => {
            get('supplyMailLimit').value = button.dataset.limit;
            setText(get('supplyLimitStatus'), '');
            updatePresets();
        }));
        get('supplyPreviewForm').addEventListener('submit', event => {
            event.preventDefault();
            if (busy) return;
            clearPreview();
            run('preview', get('supplyPreviewButton'), async () => {
                const data = await post({ action: 'preview', email: get('supplyPreviewEmail').value.trim(),
                    email_limit: Number(get('supplyMailLimit').value) });
                renderPreview(data);
            });
        });
        updateControls();
        (async () => {
            try {
                const response = await fetch('/admin/api/supply-token', { cache: 'no-store', credentials: 'same-origin' });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error();
                get('supplyMailLimit').value = data.email_limit || 5;
                updatePresets();
                ready = true;
                connection = data.connection || { status: 'untested' };
                renderConnection();
                setConfigured(data.configured);
            } catch {
                setText(get('supplyTokenStatus'), '暂时无法读取邮件服务配置，请刷新重试');
            } finally {
                loading = false;
                updateControls();
            }
        })();
    });
})();
