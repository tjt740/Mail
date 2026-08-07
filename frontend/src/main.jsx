import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
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
import './styles.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const appProps = window.__MAIL_APP_PROPS__ || {};
const LANGUAGE_STORAGE_KEY = 'mailSystemLanguage';
const COLOR_THEME_STORAGE_KEY = 'mailSystemColorTheme';
const SUPPORTED_LANGUAGES = ['zh', 'en', 'vi'];
const LANGUAGE_OPTIONS = [
  { key: 'zh', name: '中文', mark: '中' },
  { key: 'en', name: 'English', mark: 'EN' },
  { key: 'vi', name: 'Tiếng Việt', mark: 'VI' }
];
const COLOR_THEME_OPTIONS = [
  { key: 'clay', labelKey: '暖陶橙', primary: '#C96442', secondary: '#B0552F', soft: '#F3E6DF', background: '#F5F4EE', selected: 'rgba(201, 100, 66, 0.12)', selectedText: '#B14E2E' },
  { key: 'ocean', labelKey: '海洋蓝', primary: '#2563EB', secondary: '#1D4ED8', soft: '#DBEAFE', background: '#F3F7FC', selected: 'rgba(37, 99, 235, 0.11)', selectedText: '#1D4ED8' },
  { key: 'emerald', labelKey: '翡翠绿', primary: '#059669', secondary: '#047857', soft: '#D1FAE5', background: '#F2F8F5', selected: 'rgba(5, 150, 105, 0.11)', selectedText: '#047857' },
  { key: 'violet', labelKey: '紫罗兰', primary: '#7C3AED', secondary: '#6D28D9', soft: '#EDE9FE', background: '#F7F4FC', selected: 'rgba(124, 58, 237, 0.11)', selectedText: '#6D28D9' },
  { key: 'rose', labelKey: '玫瑰红', primary: '#E11D48', secondary: '#BE123C', soft: '#FFE4E6', background: '#FCF4F6', selected: 'rgba(225, 29, 72, 0.11)', selectedText: '#BE123C' }
];

const translations = {
  zh: {},
  en: {
    '邮件查看系统': 'Mail Viewer System',
    '管理员登录': 'Admin Login',
    '用户名': 'Username',
    '密码': 'Password',
    '登录': 'Log In',
    '首页': 'Home',
    '邮箱管理': 'Mailboxes',
    '代理池': 'Proxy Pool',
    '卡密管理': 'Card Keys',
    '卡密日志': 'Card Logs',
    '收件日志': 'Mail Logs',
    '系统设置': 'System Settings',
    '帮助中心': 'Help Center',
    '后台管理': 'Admin Console',
    '后台页面': 'Admin Page',
    '管理员': 'Administrator',
    '退出': 'Log Out',
    '语言': 'Language',
    '颜色主题': 'Color Theme',
    '暖陶橙': 'Warm Clay',
    '海洋蓝': 'Ocean Blue',
    '翡翠绿': 'Emerald Green',
    '紫罗兰': 'Violet',
    '玫瑰红': 'Rose Red',
    '展开菜单': 'Expand menu',
    '收起菜单': 'Collapse menu',
    '用户名或密码错误': 'Incorrect username or password'
  },
  vi: {
    '邮件查看系统': 'Hệ thống xem thư',
    '管理员登录': 'Đăng nhập quản trị',
    '用户名': 'Tên đăng nhập',
    '密码': 'Mật khẩu',
    '登录': 'Đăng nhập',
    '首页': 'Trang chủ',
    '邮箱管理': 'Quản lý hộp thư',
    '代理池': 'Nhóm proxy',
    '卡密管理': 'Quản lý mã',
    '卡密日志': 'Nhật ký mã',
    '收件日志': 'Nhật ký nhận thư',
    '系统设置': 'Cài đặt hệ thống',
    '帮助中心': 'Trung tâm trợ giúp',
    '后台管理': 'Bảng quản trị',
    '后台页面': 'Trang quản trị',
    '管理员': 'Quản trị viên',
    '退出': 'Đăng xuất',
    '语言': 'Ngôn ngữ',
    '颜色主题': 'Chủ đề màu sắc',
    '暖陶橙': 'Cam đất ấm',
    '海洋蓝': 'Xanh đại dương',
    '翡翠绿': 'Xanh ngọc lục bảo',
    '紫罗兰': 'Tím violet',
    '玫瑰红': 'Đỏ hoa hồng',
    '展开菜单': 'Mở rộng menu',
    '收起菜单': 'Thu gọn menu',
    '用户名或密码错误': 'Tên đăng nhập hoặc mật khẩu không đúng'
  }
};

const adminMenuDefinitions = [
  { key: '/admin/home', icon: <DashboardOutlined />, labelKey: '首页' },
  { key: '/admin/mailbox', icon: <InboxOutlined />, labelKey: '邮箱管理' },
  { key: '/admin/daili', icon: <ControlOutlined />, labelKey: '代理池' },
  { key: '/admin/kami', icon: <KeyOutlined />, labelKey: '卡密管理' },
  { key: '/admin/kamirizhi', icon: <FileTextOutlined />, labelKey: '卡密日志' },
  { key: '/admin/shoujian', icon: <MailOutlined />, labelKey: '收件日志' },
  { key: '/admin/system', icon: <SettingOutlined />, labelKey: '系统设置' },
  { key: '/admin/help', icon: <QuestionCircleOutlined />, labelKey: '帮助中心' }
];

function getStoredLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function useAppLanguage() {
  const [language, setLanguageState] = useState(() => getStoredLanguage() || 'zh');

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  }, [language]);

  useEffect(() => {
    if (getStoredLanguage()) return undefined;
    let cancelled = false;
    fetch('/api/language', { headers: { Accept: 'application/json' } })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.success && SUPPORTED_LANGUAGES.includes(data.language) && !getStoredLanguage()) {
          setLanguageState(data.language);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === LANGUAGE_STORAGE_KEY && SUPPORTED_LANGUAGES.includes(event.newValue)) {
        setLanguageState(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // Language still changes for the current page when storage is unavailable.
    }
  }, []);

  return [language, setLanguage];
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
  return translations[language]?.[text] || text;
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
      <div className="login-preferences">
        <ColorThemeSwitcher colorTheme={colorTheme} onChange={onColorThemeChange} t={t} />
        <LanguageSwitcher language={language} onChange={onLanguageChange} t={t} />
      </div>
      <Card className="login-card">
        <Space direction="vertical" size={4} className="login-heading">
          <Title level={2}>{title}</Title>
          <Text type="secondary">{systemTitle}</Text>
        </Space>
        {error ? <div className="login-error">{t(error)}</div> : null}
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

function LegacyFrame({ title, src, language }) {
  return (
    <div className="legacy-frame-wrap">
      <iframe
        key={language}
        title={title}
        className="legacy-frame"
        src={src}
        loading="eager"
      />
    </div>
  );
}

function AdminShell({ language, onLanguageChange, colorTheme, onColorThemeChange, t }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('reactAdminSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const currentPath = getCurrentPath();
  const adminMenuItems = useMemo(
    () => adminMenuDefinitions.map((item) => ({ ...item, label: t(item.labelKey) })),
    [language]
  );
  const selectedKey = adminMenuItems.some((item) => item.key === currentPath) ? currentPath : '/admin/home';
  const currentItem = adminMenuItems.find((item) => item.key === selectedKey);
  const legacyUrl = useMemo(() => buildLegacyUrl(selectedKey), [selectedKey]);
  const systemTitle = getSystemTitle(t);

  useEffect(() => {
    document.title = `${currentItem?.label || t('后台管理')} - ${systemTitle}`;
  }, [currentItem?.label, language, systemTitle]);

  function updateCollapsed(nextValue) {
    setCollapsed(nextValue);
    try {
      localStorage.setItem('reactAdminSidebarCollapsed', nextValue ? '1' : '0');
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  }

  return (
    <Layout className="admin-app">
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
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={adminMenuItems}
          onClick={({ key }) => {
            if (key !== window.location.pathname) {
              window.history.pushState({}, '', key);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={collapsed ? t('展开菜单') : t('收起菜单')}
            title={collapsed ? t('展开菜单') : t('收起菜单')}
            onClick={() => updateCollapsed(!collapsed)}
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
  return (
    <main className="public-app">
      <LegacyFrame title={appProps.pageTitle || '邮件查看'} src={buildLegacyUrl('/')} language={language} />
    </main>
  );
}

function Router({ colorTheme, onColorThemeChange }) {
  const [path, setPath] = useState(getCurrentPath());
  const [language, setLanguage] = useAppLanguage();
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
  const [colorTheme, setColorTheme] = useAppColorTheme();
  const palette = COLOR_THEME_OPTIONS.find((item) => item.key === colorTheme) || COLOR_THEME_OPTIONS[0];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
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
        <Router colorTheme={colorTheme} onColorThemeChange={setColorTheme} />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MailApp />
  </React.StrictMode>
);
