/* Shared by the React shell and embedded pages, including storage-free sessions. */
(function () {
    const themes = [
        { key: 'sunny', name: '晴天', description: '天蓝 · 杏黄 · 薄荷绿', primary: '#2678ce', secondary: '#1c619c', soft: '#dceffa', background: '#eff6fb', surface: '#ffffff', surface2: '#f5f9fd', surface3: '#e6f0f8', text: '#20344c', muted: '#5d7288', border: '#d5e3ef', cyan: '#007f9d', mint: '#168364', gold: '#a56b08', violet: '#7851c2', coral: '#c45869', hero: 'linear-gradient(115deg, #e0f3ff 0%, #c9e8fc 48%, #e6efde 78%, #ffe8af 100%)', heroText: '#193d63', dark: false },
        { key: 'night', name: '夜间', description: '深蓝 · 星紫 · 月光金', primary: '#a3afff', secondary: '#c3a6fa', soft: '#2e3457', background: '#0c1223', surface: '#171f35', surface2: '#1d2740', surface3: '#29344f', text: '#e7edff', muted: '#a5b4d2', border: '#34415e', cyan: '#6fd8ef', mint: '#72deb9', gold: '#f4ce83', violet: '#bfabff', coral: '#f7a0b5', hero: 'radial-gradient(ellipse at 78% 20%, #51417a 0%, transparent 60%), linear-gradient(115deg, #182442, #242c57 62%, #383666)', heroText: '#edf0ff', dark: true },
        { key: 'rain', name: '雨夜', description: '蓝灰 · 青绿 · 霓虹玫红', primary: '#68d8e0', secondary: '#62acd9', soft: '#173d4c', background: '#0a1822', surface: '#122a36', surface2: '#183440', surface3: '#224553', text: '#e0f2f6', muted: '#9ebcc7', border: '#325361', cyan: '#6bdfea', mint: '#79e1bb', gold: '#ecca85', violet: '#b5b1ff', coral: '#f59abc', hero: 'radial-gradient(ellipse at 90% 100%, #49395d 0%, transparent 55%), linear-gradient(115deg, #102f40, #18445a 55%, #25354e)', heroText: '#def7ff', dark: true },
        { key: 'clay', name: '暖陶橙', primary: '#C96442', secondary: '#B0552F', soft: '#F3E6DF', background: '#F5F4EE' },
        { key: 'ocean', name: '海洋蓝', primary: '#2563EB', secondary: '#1D4ED8', soft: '#DBEAFE', background: '#F3F7FC' },
        { key: 'emerald', name: '翡翠绿', primary: '#059669', secondary: '#047857', soft: '#D1FAE5', background: '#F2F8F5' },
        { key: 'violet', name: '紫罗兰', primary: '#7C3AED', secondary: '#6D28D9', soft: '#EDE9FE', background: '#F7F4FC' },
        { key: 'rose', name: '玫瑰红', primary: '#E11D48', secondary: '#BE123C', soft: '#FFE4E6', background: '#FCF4F6' }
    ].map(value => ({ surface: '#fff', surface2: '#f8fafc', surface3: '#edf1f6', text: '#263548', muted: '#63748a', border: '#dce3eb', cyan: '#007f9d', mint: '#168364', gold: '#a56b08', violet: '#7851c2', coral: '#c45869', hero: 'linear-gradient(115deg, #e4effe, #dcf3ed 60%, #fff0cf)', heroText: '#243d56', dark: false, ...value }));
    const get = key => themes.find(item => item.key === key) || themes[0];
    function apply(key) {
        const p = get(key), root = document.documentElement;
        root.dataset.colorTheme = p.key;
        root.dataset.themeMode = p.dark ? 'dark' : 'light';
        root.style.colorScheme = p.dark ? 'dark' : 'light';
        const variables = {
            'app-primary': p.primary, 'app-secondary': p.secondary, 'app-primary-soft': p.soft, 'app-background': p.background,
            'primary-color': p.primary, 'secondary-color': p.secondary, 'primary-soft': p.soft, 'primary-bg': p.soft,
            'primary-ring': `color-mix(in srgb, ${p.primary} 22%, transparent)`,
            'app-bg': p.background, surface: p.surface, 'surface-2': p.surface2, 'surface-3': p.surface3,
            text: p.text, 'text-muted': p.muted, border: p.border, 'border-strong': p.border,
            'accent-cyan': p.cyan, 'accent-mint': p.mint, 'accent-gold': p.gold, 'accent-violet': p.violet, 'accent-coral': p.coral,
            'scene-hero-bg': p.hero, 'scene-hero-text': p.heroText,
            'chart-grid': p.border, 'chart-text': p.muted,
            success: p.mint, danger: p.coral, warning: p.gold
        };
        Object.entries(variables).forEach(([name, value]) => root.style.setProperty(`--${name}`, value));
        return p;
    }
    window.MailThemes = { themes, get, apply, defaultTheme: 'sunny' };
})();
