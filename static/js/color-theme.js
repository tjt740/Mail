(function () {
    'use strict';

    const STORAGE_KEY = 'mailSystemColorTheme';
    const DEFAULT_THEME = 'clay';
    const THEMES = [
        { key: 'clay', name: '暖陶橙', color: '#C96442', secondary: '#B0552F' },
        { key: 'ocean', name: '海洋蓝', color: '#2563EB', secondary: '#1D4ED8' },
        { key: 'emerald', name: '翡翠绿', color: '#059669', secondary: '#047857' },
        { key: 'violet', name: '紫罗兰', color: '#7C3AED', secondary: '#6D28D9' },
        { key: 'rose', name: '玫瑰红', color: '#E11D48', secondary: '#BE123C' }
    ];
    let currentTheme = readStoredTheme();

    function isSupported(theme) {
        return THEMES.some((item) => item.key === theme);
    }

    function readStoredTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return isSupported(saved) ? saved : DEFAULT_THEME;
        } catch (error) {
            return DEFAULT_THEME;
        }
    }

    function applyTheme(theme, persist) {
        const nextTheme = isSupported(theme) ? theme : DEFAULT_THEME;
        const config = THEMES.find((item) => item.key === nextTheme) || THEMES[0];
        currentTheme = nextTheme;
        document.documentElement.dataset.colorTheme = nextTheme;
        document.querySelectorAll('meta[name="theme-color"], meta[name="msapplication-TileColor"]').forEach((meta) => {
            meta.setAttribute('content', config.color);
        });
        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, nextTheme);
            } catch (error) {
                // The theme still applies to the current page when storage is unavailable.
            }
        }
        syncSwitcher();
    }

    function syncSwitcher() {
        const button = document.getElementById('colorThemeButton');
        const selected = THEMES.find((item) => item.key === currentTheme) || THEMES[0];
        if (button) {
            button.setAttribute('aria-label', `颜色主题: ${selected.name}`);
            button.setAttribute('title', '颜色主题');
        }
        document.querySelectorAll('.color-theme-option').forEach((option) => {
            const active = option.dataset.theme === currentTheme;
            option.classList.toggle('is-active', active);
            option.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function setMenuOpen(open, focusOption) {
        const button = document.getElementById('colorThemeButton');
        const menu = document.getElementById('colorThemeMenu');
        if (!button || !menu) return;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
        if (open && focusOption) {
            (menu.querySelector('.color-theme-option.is-active') || menu.querySelector('.color-theme-option'))?.focus();
        }
    }

    function createSwitcher() {
        if (document.getElementById('colorThemeSwitcher')) return;
        const isFrontend = document.body.classList.contains('frontend-mail-page');
        const isEmbeddedAdmin = document.body.classList.contains('embedded-view') && !isFrontend;
        if (isEmbeddedAdmin) return;

        const headerActions = document.querySelector('.frontend-top-actions, .header-actions');
        const wrapper = document.createElement('div');
        wrapper.id = 'colorThemeSwitcher';
        wrapper.className = `color-theme-switcher${headerActions ? ' color-theme-switcher--header' : ''}`;

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.id = 'colorThemeButton';
        trigger.className = 'color-theme-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'colorThemeMenu');
        trigger.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.6a1.5 1.5 0 0 1 0-3h2.8A5.6 5.6 0 0 0 21 8.8C21 5.6 17 3 12 3Z"></path><circle cx="7.8" cy="9" r=".8" fill="currentColor" stroke="none"></circle><circle cx="11" cy="6.8" r=".8" fill="currentColor" stroke="none"></circle><circle cx="15" cy="7.3" r=".8" fill="currentColor" stroke="none"></circle><circle cx="17.1" cy="10.3" r=".8" fill="currentColor" stroke="none"></circle></svg>';

        const menu = document.createElement('div');
        menu.id = 'colorThemeMenu';
        menu.className = 'color-theme-menu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', '颜色主题');
        menu.hidden = true;

        THEMES.forEach((theme) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'color-theme-option';
            option.dataset.theme = theme.key;
            option.setAttribute('role', 'option');
            option.style.setProperty('--option-color', theme.color);
            option.style.setProperty('--option-secondary', theme.secondary);
            option.innerHTML = `<span class="color-theme-swatch" aria-hidden="true"></span><span class="color-theme-name">${theme.name}</span><span class="color-theme-check" aria-hidden="true">✓</span>`;
            option.addEventListener('click', () => {
                setMenuOpen(false);
                applyTheme(theme.key, true);
                window.dispatchEvent(new CustomEvent('app-color-theme-change', { detail: { theme: theme.key } }));
                trigger.focus();
            });
            menu.appendChild(option);
        });

        trigger.addEventListener('click', () => setMenuOpen(menu.hidden, false));
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setMenuOpen(true, true);
            }
        });
        menu.addEventListener('keydown', (event) => {
            const options = Array.from(menu.querySelectorAll('.color-theme-option'));
            const currentIndex = options.indexOf(document.activeElement);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
            if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = options.length - 1;
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenuOpen(false);
                trigger.focus();
                return;
            }
            if (nextIndex !== currentIndex && nextIndex >= 0) {
                event.preventDefault();
                options[nextIndex].focus();
            }
        });

        wrapper.append(trigger, menu);
        if (headerActions) {
            const languageSwitcher = headerActions.querySelector('#i18nLanguageSwitcher');
            headerActions.insertBefore(wrapper, languageSwitcher || headerActions.firstChild);
        } else {
            document.body.appendChild(wrapper);
        }
        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target)) setMenuOpen(false);
        });
        syncSwitcher();
    }

    function init() {
        applyTheme(currentTheme, false);
        createSwitcher();
        window.addEventListener('storage', (event) => {
            if (event.key === STORAGE_KEY && isSupported(event.newValue)) applyTheme(event.newValue, false);
        });
        window.addEventListener('app-color-theme-change', (event) => {
            if (isSupported(event.detail?.theme) && event.detail.theme !== currentTheme) {
                applyTheme(event.detail.theme, false);
            }
        });
    }

    window.AppColorTheme = {
        get theme() { return currentTheme; },
        themes: THEMES.map((item) => ({ ...item })),
        setTheme(theme) {
            applyTheme(theme, true);
            window.dispatchEvent(new CustomEvent('app-color-theme-change', { detail: { theme } }));
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
