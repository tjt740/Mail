import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Dropdown,
  Input,
  Layout,
  Menu,
  Space,
  Typography,
  theme
} from 'antd';
import {
  ApiOutlined,
  BgColorsOutlined,
  CheckOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InboxOutlined,
  KeyOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import '../../static/js/i18n.js';
import '../../static/js/motion.js';
import './styles.css';
import '../../static/css/motion.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const appProps = window.__MAIL_APP_PROPS__ || {};
const COLOR_THEME_STORAGE_KEY = 'mailSystemColorTheme';
const LANGUAGE_OPTIONS = window.AppI18n.languages;
const ANT_LOCALES = { zh: zhCN, en: enUS, vi: viVN };
const COLOR_THEME_OPTIONS = [
  { key: 'clay', labelKey: '暖陶橙', primary: '#C96442', secondary: '#B0552F', soft: '#F3E6DF', background: '#F5F4EE', selected: 'rgba(201, 100, 66, 0.12)', selectedText: '#B14E2E' },
  { key: 'ocean', labelKey: '海洋蓝', primary: '#2563EB', secondary: '#1D4ED8', soft: '#DBEAFE', background: '#F3F7FC', selected: 'rgba(37, 99, 235, 0.11)', selectedText: '#1D4ED8' },
  { key: 'emerald', labelKey: '翡翠绿', primary: '#059669', secondary: '#047857', soft: '#D1FAE5', background: '#F2F8F5', selected: 'rgba(5, 150, 105, 0.11)', selectedText: '#047857' },
  { key: 'violet', labelKey: '紫罗兰', primary: '#7C3AED', secondary: '#6D28D9', soft: '#EDE9FE', background: '#F7F4FC', selected: 'rgba(124, 58, 237, 0.11)', selectedText: '#6D28D9' },
  { key: 'rose', labelKey: '玫瑰红', primary: '#E11D48', secondary: '#BE123C', soft: '#FFE4E6', background: '#FCF4F6', selected: 'rgba(225, 29, 72, 0.11)', selectedText: '#BE123C' }
];

const adminMenuDefinitions = [
  { key: '/admin/home', permission: 'home', icon: <DashboardOutlined />, labelKey: '首页' },
  { key: '/admin/mailbox', permission: 'mailbox', icon: <InboxOutlined />, labelKey: '邮箱管理' },
  { key: '/admin/daili', permission: 'proxies', icon: <ControlOutlined />, labelKey: '代理池' },
  { key: '/admin/kami', permission: 'cards', icon: <KeyOutlined />, labelKey: '卡密管理' },
  { key: '/admin/kamirizhi', permission: 'card_logs', icon: <FileTextOutlined />, labelKey: '卡密日志' },
  { key: '/admin/shoujian', permission: 'mail_logs', icon: <MailOutlined />, labelKey: '收件日志' },
  { key: '/admin/system', icon: <SettingOutlined />, labelKey: '系统设置' },
  { key: '/admin/help', icon: <QuestionCircleOutlined />, labelKey: '帮助中心' }
];

function useAppLanguage() {
  const [language, setLanguageState] = useState(() => window.AppI18n.language);
  useEffect(() => {
    const update = () => setLanguageState(window.AppI18n.language);
    window.addEventListener('app-language-change', update);
    update();
    return () => window.removeEventListener('app-language-change', update);
  }, []);
  return [language, window.AppI18n.setLanguage];
}

function getStoredColorTheme() {
  try {
    const saved = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    return COLOR_THEME_OPTIONS.some((item) => item.key === saved) ? saved : 'clay';
  } catch {
    return 'clay';
  }
}

function applyColorThemeToDocument(colorTheme) {
  const palette = COLOR_THEME_OPTIONS.find((item) => item.key === colorTheme) || COLOR_THEME_OPTIONS[0];
  document.documentElement.dataset.colorTheme = palette.key;
  document.documentElement.style.setProperty('--app-primary', palette.primary);
  document.documentElement.style.setProperty('--app-secondary', palette.secondary);
  document.documentElement.style.setProperty('--app-primary-soft', palette.soft);
  document.documentElement.style.setProperty('--app-background', palette.background);
  document.querySelectorAll('meta[name="theme-color"], meta[name="msapplication-TileColor"]').forEach((meta) => {
    meta.setAttribute('content', palette.primary);
  });
}

function useAppColorTheme() {
  const [colorTheme, setColorThemeState] = useState(getStoredColorTheme);

  useEffect(() => {
    applyColorThemeToDocument(colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === COLOR_THEME_STORAGE_KEY && COLOR_THEME_OPTIONS.some((item) => item.key === event.newValue)) {
        setColorThemeState(event.newValue);
      }
    };
    const onThemeChange = (event) => {
      if (COLOR_THEME_OPTIONS.some((item) => item.key === event.detail?.theme)) {
        setColorThemeState(event.detail.theme);
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('app-color-theme-change', onThemeChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('app-color-theme-change', onThemeChange);
    };
  }, []);

  const setColorTheme = useCallback((nextTheme) => {
    if (!COLOR_THEME_OPTIONS.some((item) => item.key === nextTheme)) return;
    setColorThemeState(nextTheme);
    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still changes for the current page when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent('app-color-theme-change', { detail: { theme: nextTheme } }));
  }, []);

  return [colorTheme, setColorTheme];
}

function translate(language, text) {
  return window.AppI18n.t(text, language);
}

function getSystemTitle(t) {
  const configuredTitle = appProps.systemTitle || '邮件查看系统';
  return configuredTitle === '邮件查看系统' ? t('邮件查看系统') : configuredTitle;
}

function LanguageSwitcher({ language, onChange, t, className = '' }) {
  const currentLanguage = LANGUAGE_OPTIONS.find((item) => item.key === language) || LANGUAGE_OPTIONS[0];
  const items = LANGUAGE_OPTIONS.map((item) => ({
    key: item.key,
    label: (
      <span className={`react-language-option ${item.key === language ? 'is-active' : ''}`}>
        <span className="react-language-mark" aria-hidden="true">{item.mark}</span>
        <span className="react-language-name">{item.name}</span>
        <CheckOutlined className="react-language-check" aria-hidden="true" />
      </span>
    )
  }));

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [language],
        onClick: ({ key }) => onChange(key)
      }}
      placement="bottomRight"
      trigger={['click']}
      overlayClassName="react-language-dropdown"
    >
      <Button
        type="text"
        className={`react-language-button ${className}`.trim()}
        icon={<GlobalOutlined />}
        aria-label={`${t('语言')}: ${currentLanguage.name}`}
        title={t('语言')}
      />
    </Dropdown>
  );
}

function ColorThemeSwitcher({ colorTheme, onChange, t, className = '' }) {
  const selectedTheme = COLOR_THEME_OPTIONS.find((item) => item.key === colorTheme) || COLOR_THEME_OPTIONS[0];
  const items = COLOR_THEME_OPTIONS.map((item) => ({
    key: item.key,
    label: (
      <span className={`react-color-theme-option ${item.key === colorTheme ? 'is-active' : ''}`}>
        <span
          className="react-color-theme-swatch"
          aria-hidden="true"
          style={{ '--swatch-primary': item.primary, '--swatch-secondary': item.secondary }}
        />
        <span className="react-color-theme-name">{t(item.labelKey)}</span>
        <CheckOutlined className="react-color-theme-check" aria-hidden="true" />
      </span>
    )
  }));

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [colorTheme],
        onClick: ({ key }) => onChange(key)
      }}
      placement="bottomRight"
      trigger={['click']}
      overlayClassName="react-color-theme-dropdown"
    >
      <Button
        type="text"
        className={`react-color-theme-button ${className}`.trim()}
        icon={<BgColorsOutlined />}
        aria-label={`${t('颜色主题')}: ${t(selectedTheme.labelKey)}`}
        title={t('颜色主题')}
      />
    </Dropdown>
  );
}

function getCurrentPath() {
  const path = window.location.pathname;
  if (path === '/admin' || path === '/admin/') return '/admin/home';
  return path;
}

function buildLegacyUrl(pathname) {
  const search = window.location.search || '';
  const separator = search ? '&' : '?';
  if (pathname === '/') {
    return `/legacy/${search}${separator}embedded=1`;
  }
  return `/legacy${pathname}${search}${separator}embedded=1`;
}

function LoginPage({ language, onLanguageChange, colorTheme, onColorThemeChange, t }) {
  const [submitting, setSubmitting] = useState(false);
  const error = appProps.loginError;
  const configuredTitle = appProps.adminLoginTitle || '管理员登录';
  const title = configuredTitle === '管理员登录' ? t('管理员登录') : configuredTitle;
  const systemTitle = getSystemTitle(t);

  useEffect(() => {
    document.title = `${title} - ${systemTitle}`;
  }, [title, systemTitle]);

  return (
    <main className="login-page">
      <AmbientCanvas />
      <div className="login-preferences">
        <ColorThemeSwitcher colorTheme={colorTheme} onChange={onColorThemeChange} t={t} />
        <LanguageSwitcher language={language} onChange={onLanguageChange} t={t} />
      </div>
      <Card className="login-card">
        <Space direction="vertical" size={4} className="login-heading">
          <Title level={2}>{title}</Title>
          <Text type="secondary">{systemTitle}</Text>
        </Space>
        {error ? <div className="login-error" role="alert">{t(error)}</div> : null}
        <form
          method="post"
          action="/admin/login"
          onSubmit={() => setSubmitting(true)}
          className="login-form"
        >
          <label>
            <span>{t('用户名')}</span>
            <Input
              name="username"
              size="large"
              prefix={<UserOutlined />}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>{t('密码')}</span>
            <Input.Password
              name="password"
              size="large"
              autoComplete="current-password"
              required
            />
          </label>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            {t('登录')}
          </Button>
        </form>
      </Card>
    </main>
  );
}

function AmbientCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const controller = window.MailMotion?.mount(ref.current, { variant: 'welcome' });
    return () => controller?.destroy();
  }, []);
  return <canvas ref={ref} className="mail-ambient-canvas" aria-hidden="true" />;
}

function LegacyFrame({ title, src, language }) {
  const frameRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = (text) => translate(language, text);

  const syncLanguage = useCallback(() => {
    try {
      frameRef.current?.contentWindow.AppI18n?.setLanguage(language, { persist: false, sync: false });
    } catch { /* A login redirect may temporarily replace the document. */ }
  }, [language]);

  useEffect(syncLanguage, [syncLanguage]);
  useEffect(() => {
    if (loaded) return undefined;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [loaded, attempt]);

  return (
    <div className={`legacy-frame-wrap ${loaded ? 'is-loaded' : 'is-loading'}`} aria-busy={!loaded}>
      {!loaded && <div className="frame-loading" role="status" aria-live="polite">
        <span className="frame-loading-orbit" aria-hidden="true"><MailOutlined /></span>
        <span>{t(slow ? '页面加载时间较长，请重试' : '页面加载中')}</span>
        {slow && <Button onClick={() => { setSlow(false); setAttempt((value) => value + 1); }}>{t('重试')}</Button>}
      </div>}
      <iframe
        key={attempt}
        ref={frameRef}
        title={title}
        className="legacy-frame"
        src={src}
        loading="eager"
        onLoad={() => { syncLanguage(); setLoaded(true); setSlow(false); }}
      />
    </div>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(query).matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = (event) => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', updateMatches);
    return () => mediaQuery.removeEventListener?.('change', updateMatches);
  }, [query]);

  return matches;
}

function AdminShell({ language, onLanguageChange, colorTheme, onColorThemeChange, t }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('reactAdminSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentPath = getCurrentPath();
  const adminMenuItems = useMemo(
    () => adminMenuDefinitions.filter((item) => !item.permission || (appProps.adminPermissions || []).includes(item.permission)).map((item) => ({ ...item, label: t(item.labelKey) })),
    [language]
  );
  const selectedKey = adminMenuItems.some((item) => item.key === currentPath) ? currentPath : '/admin/system';
  const currentItem = adminMenuItems.find((item) => item.key === selectedKey);
  const legacyUrl = useMemo(() => buildLegacyUrl(selectedKey), [selectedKey]);
  const systemTitle = getSystemTitle(t);

  useEffect(() => {
    document.title = `${currentItem?.label || t('后台管理')} - ${systemTitle}`;
  }, [currentItem?.label, language, systemTitle]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [selectedKey]);

  function updateCollapsed(nextValue) {
    setCollapsed(nextValue);
    try {
      localStorage.setItem('reactAdminSidebarCollapsed', nextValue ? '1' : '0');
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  }

  function handleAdminMenuClick(key) {
    setMobileMenuOpen(false);
    if (key !== window.location.pathname) {
      window.history.pushState({}, '', key);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  const adminMenu = (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={adminMenuItems}
      onClick={({ key }) => handleAdminMenuClick(key)}
    />
  );

  return (
    <Layout className="admin-app">
      {!isMobile ? (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={224}
          className="admin-sider"
        >
          <div className="brand">
            <ApiOutlined />
            {!collapsed ? <span>{systemTitle}</span> : null}
          </div>
          {adminMenu}
        </Sider>
      ) : null}
      <Drawer
        placement="left"
        width={280}
        open={isMobile && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        closable={false}
        className="admin-mobile-drawer"
        styles={{ body: { padding: 0 } }}
      >
        <div className="brand admin-mobile-brand">
          <ApiOutlined />
          <span>{systemTitle}</span>
        </div>
        {adminMenu}
      </Drawer>
      <Layout>
        <Header className="admin-header">
          <Button
            type="text"
            icon={isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={isMobile || collapsed ? t('展开菜单') : t('收起菜单')}
            title={isMobile || collapsed ? t('展开菜单') : t('收起菜单')}
            onClick={() => {
              if (isMobile) {
                setMobileMenuOpen(true);
              } else {
                updateCollapsed(!collapsed);
              }
            }}
          />
          <div className="admin-title">
            <Title level={4}>{currentItem?.label || t('后台管理')}</Title>
            <Text type="secondary">{systemTitle}</Text>
          </div>
          <Space className="admin-actions">
            <ColorThemeSwitcher colorTheme={colorTheme} onChange={onColorThemeChange} t={t} />
            <LanguageSwitcher language={language} onChange={onLanguageChange} t={t} />
            <Text className="admin-user">{appProps.adminUsername || t('管理员')}</Text>
            <Button icon={<LogoutOutlined />} href="/admin/logout">
              {t('退出')}
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">
          <LegacyFrame
            key={legacyUrl}
            title={currentItem?.label || t('后台页面')}
            src={legacyUrl}
            language={language}
          />
        </Content>
      </Layout>
    </Layout>
  );
}

function PublicShell({ language }) {
  const title = translate(language, appProps.pageTitle || '邮件查看');
  useEffect(() => { document.title = title; }, [title]);
  return (
    <main className="public-app">
      <LegacyFrame title={title} src={buildLegacyUrl('/')} language={language} />
    </main>
  );
}

function Router({ language, setLanguage, colorTheme, onColorThemeChange }) {
  const [path, setPath] = useState(getCurrentPath());
  const t = useCallback((text) => translate(language, text), [language]);

  useEffect(() => {
    const onPopState = () => setPath(getCurrentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (path === '/admin/login') {
    return <LoginPage language={language} onLanguageChange={setLanguage} colorTheme={colorTheme} onColorThemeChange={onColorThemeChange} t={t} />;
  }
  if (path.startsWith('/admin')) {
    return <AdminShell language={language} onLanguageChange={setLanguage} colorTheme={colorTheme} onColorThemeChange={onColorThemeChange} t={t} />;
  }
  return <PublicShell language={language} />;
}

function MailApp() {
  const [language, setLanguage] = useAppLanguage();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [colorTheme, setColorTheme] = useAppColorTheme();
  const palette = COLOR_THEME_OPTIONS.find((item) => item.key === colorTheme) || COLOR_THEME_OPTIONS[0];

  return (
    <ConfigProvider
      locale={ANT_LOCALES[language]}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          // Changing Ant Design's motion flag inserts a provider and remounts
          // descendants. Keep the tree stable and shorten durations instead.
          motionDurationFast: reducedMotion ? '0.001s' : '0.16s',
          motionDurationMid: reducedMotion ? '0.001s' : '0.24s',
          motionDurationSlow: reducedMotion ? '0.001s' : '0.36s',
          colorPrimary: palette.primary,
          colorInfo: palette.primary,
          colorSuccess: '#10B981',
          colorWarning: '#F97316',
          colorError: '#DC2626',
          borderRadius: 8,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        },
        components: {
          Layout: {
            headerBg: '#FFFFFF',
            siderBg: '#FFFFFF',
            bodyBg: palette.background
          },
          Menu: {
            itemSelectedBg: palette.selected,
            itemSelectedColor: palette.selectedText
          }
        }
      }}
    >
      <AntApp>
        <Router language={language} setLanguage={setLanguage} colorTheme={colorTheme} onColorThemeChange={setColorTheme} />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MailApp />
  </React.StrictMode>
);
