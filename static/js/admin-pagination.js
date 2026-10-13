(function (global) {
    'use strict';

    const PAGE_SIZES = Object.freeze([20, 50, 100, 200, 500, 1000]);
    const MAX_PAGE_SIZE = 10000;
    const t = text => global.AppI18n?.t(text) || text;

    function parsePageSize(value) {
        const text = String(value).trim();
        if (!/^\d+$/.test(text)) return null;
        const size = Number(text);
        return Number.isInteger(size) && size >= 1 && size <= MAX_PAGE_SIZE ? size : null;
    }

    // Shared by the template pages and React so every list has the same controls.
    function mountSizeControl(container, { value, onChange, id = 'perPageSelect', disabled = false }) {
        const current = parsePageSize(value) || PAGE_SIZES[0];
        container.replaceChildren();
        container.classList.add('admin-page-size');
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = t('每页');
        const select = document.createElement('select');
        select.id = id;
        select.disabled = disabled;
        PAGE_SIZES.forEach(size => select.add(new Option(String(size), String(size))));
        select.add(new Option(t('自定义'), 'custom'));
        select.value = PAGE_SIZES.includes(current) ? String(current) : 'custom';

        const custom = document.createElement('span');
        custom.className = 'admin-page-size-custom';
        custom.hidden = select.value !== 'custom';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = String(MAX_PAGE_SIZE);
        input.step = '1';
        input.inputMode = 'numeric';
        input.required = true;
        input.value = String(current);
        input.disabled = disabled;
        input.setAttribute('aria-label', t('自定义每页条数'));
        input.title = t('请输入 1–10000 之间的整数');
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.textContent = t('应用');
        apply.disabled = disabled;

        function applyCustom() {
            const size = parsePageSize(input.value);
            input.setCustomValidity(size === null ? t('请输入 1–10000 之间的整数') : '');
            if (!input.reportValidity()) return;
            onChange(size);
        }
        select.addEventListener('change', () => {
            custom.hidden = select.value !== 'custom';
            if (!custom.hidden) input.focus();
            else {
                input.value = select.value;
                onChange(Number(select.value));
            }
        });
        input.addEventListener('input', () => input.setCustomValidity(''));
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyCustom();
            }
        });
        apply.addEventListener('click', applyCustom);
        custom.append(input, apply);
        container.append(label, select, custom);
    }

    global.AdminPagination = { PAGE_SIZES, MAX_PAGE_SIZE, parsePageSize, mountSizeControl };
})(window);
