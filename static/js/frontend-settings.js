(function () {
    'use strict';

    function init() {
        const actions = document.querySelector('.frontend-top-actions');
        if (!actions || document.getElementById('frontendSettings')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'frontendSettings';
        wrapper.innerHTML = `
            <button type="button" id="frontendSettingsButton" aria-label="设置" title="设置"
                aria-haspopup="dialog" aria-expanded="false" aria-controls="frontendSettingsMenu">
                <svg aria-hidden="true" viewBox="0 0 1024 1024"><use href="#ai-setting"></use></svg>
            </button>
            <div id="frontendSettingsMenu" role="dialog" aria-label="设置" hidden>
                <div class="frontend-settings-header">
                    <h2 class="frontend-settings-title">设置</h2>
                    <button type="button" class="frontend-settings-close" aria-label="关闭">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                    </button>
                </div>
                <section class="frontend-settings-section" aria-labelledby="frontendThemeLabel">
                    <h3 id="frontendThemeLabel">颜色主题</h3>
                    <div id="colorThemeMenu" class="frontend-settings-options" role="listbox" aria-labelledby="frontendThemeLabel"></div>
                </section>
                <section class="frontend-settings-section" aria-labelledby="frontendLanguageLabel">
                    <h3 id="frontendLanguageLabel">语言</h3>
                    <div id="i18nLanguageMenu" class="frontend-settings-options" role="listbox" aria-labelledby="frontendLanguageLabel"></div>
                </section>
            </div>`;
        const trigger = wrapper.querySelector('#frontendSettingsButton');
        const panel = wrapper.querySelector('#frontendSettingsMenu');
        const themeMenu = wrapper.querySelector('#colorThemeMenu');
        const languageMenu = wrapper.querySelector('#i18nLanguageMenu');

        function setOpen(open, focusOption = false, immediate = false) {
            window.FrontendMotion.popup(panel, open, immediate);
            trigger.setAttribute('aria-expanded', String(open));
            if (open && focusOption) themeMenu.querySelector('[aria-selected="true"]')?.focus();
        }

        function select(apply, kind) {
            window.FrontendMotion.change(() => {
                setOpen(false, false, true);
                apply();
                trigger.focus({ preventScroll: true });
            }, kind);
        }

        window.AppColorTheme.themes.forEach(theme => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'color-theme-option';
            option.dataset.theme = theme.key;
            option.setAttribute('role', 'option');
            option.style.setProperty('--option-color', theme.color);
            option.style.setProperty('--option-secondary', theme.secondary);
            const palette = window.MailThemes.get(theme.key);
            option.style.setProperty('--option-preview', palette.hero);
            option.style.setProperty('--option-surface', palette.surface);
            option.innerHTML = '<span class="frontend-theme-preview" aria-hidden="true"></span><span class="frontend-settings-name"></span><span class="frontend-settings-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8 3 3 6-6"/></svg></span>';
            option.querySelector('.frontend-settings-name').textContent = theme.name;
            option.addEventListener('click', () => select(() => window.AppColorTheme.setTheme(theme.key), 'theme'));
            themeMenu.appendChild(option);
        });

        window.AppI18n.languages.forEach(language => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'i18n-language-option';
            option.dataset.language = language.key;
            option.setAttribute('role', 'option');
            option.setAttribute('translate', 'no');
            option.innerHTML = '<span class="frontend-language-mark" aria-hidden="true"></span><span class="frontend-settings-name"></span><span class="frontend-settings-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8 3 3 6-6"/></svg></span>';
            option.querySelector('.frontend-language-mark').textContent = language.mark;
            option.querySelector('.frontend-settings-name').textContent = language.name;
            option.addEventListener('click', () => select(() => window.AppI18n.setLanguage(language.key), 'language'));
            languageMenu.appendChild(option);
        });

        function syncSelection() {
            themeMenu.querySelectorAll('[data-theme]').forEach(option => {
                const active = option.dataset.theme === window.AppColorTheme.theme;
                option.setAttribute('aria-selected', String(active));
                option.classList.toggle('is-active', active);
            });
            languageMenu.querySelectorAll('[data-language]').forEach(option => {
                const active = option.dataset.language === window.AppI18n.language;
                option.setAttribute('aria-selected', String(active));
                option.classList.toggle('is-active', active);
            });
        }

        trigger.addEventListener('click', () => setOpen(trigger.getAttribute('aria-expanded') !== 'true'));
        wrapper.querySelector('.frontend-settings-close').addEventListener('click', () => {
            setOpen(false);
            trigger.focus();
        });
        trigger.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true, true);
            }
        });
        wrapper.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !panel.hidden) {
                event.preventDefault();
                setOpen(false);
                trigger.focus();
                return;
            }
            const list = event.target.closest('[role="listbox"]');
            if (!list) return;
            const options = Array.from(list.querySelectorAll('[role="option"]'));
            const index = options.indexOf(document.activeElement);
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % options.length;
            if (event.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
            if (event.key === 'ArrowDown') next = (index + 2) % options.length;
            if (event.key === 'ArrowUp') next = (index - 2 + options.length) % options.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = options.length - 1;
            if (next !== undefined) {
                event.preventDefault();
                options[next].focus();
            }
        });
        document.addEventListener('click', event => {
            if (!wrapper.contains(event.target)) setOpen(false);
        });
        wrapper.addEventListener('focusout', event => {
            if (!wrapper.contains(event.relatedTarget)) setOpen(false);
        });
        window.addEventListener('app-color-theme-change', syncSelection);
        window.addEventListener('app-language-change', syncSelection);
        actions.prepend(wrapper);
        syncSelection();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
