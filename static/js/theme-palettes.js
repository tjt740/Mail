/* Shared by the React shell and embedded pages, including storage-free sessions. */
(function () {
    const themes = [
        { key: 'sunny', name: '晴天', description: '天蓝 · 杏黄 · 薄荷绿', primary: '#1f62a9', secondary: '#1c619c', soft: '#dceffa', background: '#eff6fb', surface: '#ffffff', surface2: '#f5f9fd', surface3: '#e6f0f8', text: '#20344c', muted: '#4c5d70', border: '#d5e3ef', cyan: '#006881', mint: '#126b52', gold: '#875807', violet: '#62429f', coral: '#a14856', hero: 'linear-gradient(115deg, #e0f3ff 0%, #c9e8fc 48%, #e6efde 78%, #ffe8af 100%)', heroText: '#193d63', dark: false },
        { key: 'night', name: '夜间', description: '深蓝 · 星紫 · 月光金', primary: '#a3afff', secondary: '#c3a6fa', soft: '#2e3457', background: '#0c1223', surface: '#171f35', surface2: '#1d2740', surface3: '#29344f', text: '#e7edff', muted: '#a5b4d2', border: '#34415e', cyan: '#6fd8ef', mint: '#72deb9', gold: '#f4ce83', violet: '#bfabff', coral: '#f7a0b5', hero: 'radial-gradient(ellipse at 78% 20%, #51417a 0%, transparent 60%), linear-gradient(115deg, #182442, #242c57 62%, #383666)', heroText: '#edf0ff', dark: true },
        { key: 'rain', name: '雨夜', description: '蓝灰 · 青绿 · 霓虹玫红', primary: '#68d8e0', secondary: '#62acd9', soft: '#173d4c', background: '#0a1822', surface: '#122a36', surface2: '#183440', surface3: '#224553', text: '#e0f2f6', muted: '#9ebcc7', border: '#325361', cyan: '#6bdfea', mint: '#79e1bb', gold: '#ecca85', violet: '#b5b1ff', coral: '#f59abc', hero: 'radial-gradient(ellipse at 90% 100%, #49395d 0%, transparent 55%), linear-gradient(115deg, #102f40, #18445a 55%, #25354e)', heroText: '#def7ff', dark: true },
        { key: 'clay', name: '暖陶橙', primary: '#984a2e', secondary: '#B0552F', soft: '#F3E6DF', background: '#faf3eb', surface2: '#fff8f0', surface3: '#f5e8db', border: '#e8d6c7', cyan: '#1b6577', mint: '#2a6347', gold: '#7d5309', violet: '#6e4384', coral: '#9b4050', hero: 'linear-gradient(120deg, #ffe1c7, #f9decf 42%, #eee0f3 75%, #dcefe0)', heroText: '#674330' },
        { key: 'ocean', name: '海洋蓝', primary: '#1e51c1', secondary: '#1D4ED8', soft: '#DBEAFE', background: '#eef4ff', surface2: '#f2f7ff', surface3: '#e4edff', border: '#ceddf5', cyan: '#07647f', mint: '#0b6959', gold: '#7c5407', violet: '#5f43a3', coral: '#9e3e69', hero: 'linear-gradient(120deg, #cfddff, #cceefa 42%, #dcf4e9 72%, #e9dcff)', heroText: '#233f78' },
        { key: 'emerald', name: '翡翠绿', primary: '#04734f', secondary: '#047857', soft: '#D1FAE5', background: '#edf8f2', surface2: '#f1faf5', surface3: '#ddf1e6', border: '#cae6d8', cyan: '#126379', mint: '#076348', gold: '#775810', violet: '#674694', coral: '#9b4360', hero: 'linear-gradient(120deg, #c7f1dd, #cdf2ed 42%, #e4e4fa 74%, #fff0c9)', heroText: '#1a5147' },
        { key: 'violet', name: '紫罗兰', primary: '#6630c2', secondary: '#6D28D9', soft: '#EDE9FE', background: '#f5effc', surface2: '#f9f4ff', surface3: '#ede2fa', border: '#e0d1f0', cyan: '#1e627d', mint: '#1b6658', gold: '#7d540d', violet: '#6336a1', coral: '#9b3d6b', hero: 'linear-gradient(120deg, #e5d3fc, #f3dcef 42%, #e0e7ff 74%, #d8f3eb)', heroText: '#573a7b' },
        { key: 'rose', name: '玫瑰红', primary: '#b8183b', secondary: '#BE123C', soft: '#FFE4E6', background: '#fff1f5', surface2: '#fff6f8', surface3: '#fae3eb', border: '#efd0dc', cyan: '#1e6379', mint: '#1d6b54', gold: '#7d520f', violet: '#704399', coral: '#9e3355', hero: 'linear-gradient(120deg, #ffd7e3, #ffe4d6 42%, #eedcfa 74%, #dcebf9)', heroText: '#78384e' }
    ].map(value => ({ surface: '#fff', surface2: '#f8fafc', surface3: '#edf1f6', text: '#263548', muted: '#526176', border: '#dce3eb', cyan: '#007f9d', mint: '#168364', gold: '#a56b08', violet: '#7851c2', coral: '#c45869', hero: 'linear-gradient(115deg, #e4effe, #dcf3ed 60%, #fff0cf)', heroText: '#243d56', dark: false, ...value }));
    const get = key => themes.find(item => item.key === key) || themes[0];
    function apply(key) {
        const p = get(key), root = document.documentElement;
        root.dataset.colorTheme = p.key;
        root.dataset.themeMode = p.dark ? 'dark' : 'light';
        root.style.colorScheme = p.dark ? 'dark' : 'light';
        const variables = {
            'app-primary': p.primary, 'app-secondary': p.secondary, 'app-primary-soft': p.soft, 'app-background': p.background,
            'primary-color': p.primary, 'secondary-color': p.secondary, 'primary-soft': p.soft, 'primary-bg': p.soft,
            'on-primary': p.dark ? '#102130' : '#ffffff',
            'select-arrow': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='${p.muted.replace('#', '%23')}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
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
