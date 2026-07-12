/* ============================================================
   admin-help-ui.js — 帮助抽屉 + 字段 tooltip 运行时
   依赖 window.AdminHelp（admin-help.js）。仅在后台页面生效。
   ============================================================ */
(function () {
    'use strict';

    function getPageKey() {
        const path = window.location.pathname || '';
        const m = path.match(/\/admin\/(\w+)/);
        if (!m) return null;
        const key = m[1];
        return (window.AdminHelp && window.AdminHelp.pages[key]) ? key : null;
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function buildDrawer(pageKey) {
        const help = window.AdminHelp;
        const page = help.pages[pageKey];
        const mask = document.createElement('div');
        mask.className = 'ah-drawer-mask';

        const sections = (page.sections || []).map(function (sec) {
            return '<div class="ah-section"><h4>' + esc(sec.h) + '</h4><ul>' +
                sec.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') +
                '</ul></div>';
        }).join('');

        const faq = (help.faq || []).map(function (f) {
            return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
        }).join('');

        mask.innerHTML =
            '<div class="ah-drawer" role="dialog" aria-label="使用说明">' +
                '<div class="ah-drawer-header">' +
                    '<span class="ah-drawer-title">' + esc(page.title) + ' · 使用说明</span>' +
                    '<button class="ah-drawer-close" type="button" aria-label="关闭">×</button>' +
                '</div>' +
                '<div class="ah-drawer-body">' +
                    '<div class="ah-drawer-intro">' + esc(page.intro) + '</div>' +
                    sections +
                    '<div class="ah-section"><h4>常见问题</h4><div class="ah-faq">' + faq + '</div></div>' +
                '</div>' +
                '<div class="ah-drawer-footer"><a href="/admin/help" target="_top">前往帮助中心查看全部说明 →</a></div>' +
            '</div>';

        document.body.appendChild(mask);

        function close() { mask.classList.remove('open'); mask.querySelector('.ah-drawer').classList.remove('open'); }
        function open() { mask.classList.add('open'); mask.querySelector('.ah-drawer').classList.add('open'); }

        mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
        mask.querySelector('.ah-drawer-close').addEventListener('click', close);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

        return { open: open, close: close };
    }

    function injectHelpButton(pageKey, drawer) {
        const header = document.querySelector('.card-header');
        if (!header) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ah-help-btn';
        btn.innerHTML = '<span class="anticon"><svg aria-hidden="true"><use href="#ai-info-circle"></use></svg></span> 使用说明';
        btn.addEventListener('click', drawer.open);
        // 放到 card-header 右侧
        header.style.display = header.style.display || 'flex';
        header.style.alignItems = header.style.alignItems || 'center';
        header.style.justifyContent = 'space-between';
        header.appendChild(btn);
    }

    // ---- 字段 tooltip：委托 hover/focus/click ----
    function initTooltips() {
        let tip = null;
        function ensureTip() {
            if (!tip) {
                tip = document.createElement('div');
                tip.className = 'ah-tooltip';
                document.body.appendChild(tip);
            }
            return tip;
        }
        function show(anchor) {
            const key = anchor.getAttribute('data-help');
            const text = (window.AdminHelp && window.AdminHelp.fields[key]) || anchor.getAttribute('data-help-text');
            if (!text) return;
            const t = ensureTip();
            t.textContent = text;
            t.classList.add('show');
            const r = anchor.getBoundingClientRect();
            let top = r.bottom + 8;
            let left = Math.min(r.left, window.innerWidth - t.offsetWidth - 12);
            if (top + t.offsetHeight > window.innerHeight - 8) top = r.top - t.offsetHeight - 8;
            t.style.top = Math.max(8, top) + 'px';
            t.style.left = Math.max(8, left) + 'px';
        }
        function hide() { if (tip) tip.classList.remove('show'); }

        document.addEventListener('mouseover', function (e) {
            const a = e.target.closest('.ah-q');
            if (a) show(a);
        });
        document.addEventListener('mouseout', function (e) {
            if (e.target.closest('.ah-q')) hide();
        });
        document.addEventListener('click', function (e) {
            const a = e.target.closest('.ah-q');
            if (a) { e.stopPropagation(); if (tip && tip.classList.contains('show')) hide(); else show(a); }
            else hide();
        });
    }

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        if (!window.AdminHelp) return;
        initTooltips();
        const pageKey = getPageKey();
        if (!pageKey) return;
        const drawer = buildDrawer(pageKey);
        injectHelpButton(pageKey, drawer);
    });
})();
