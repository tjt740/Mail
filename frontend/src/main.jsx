import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
  Input,
  Layout,
  Menu,
  Space,
  Typography,
  theme
} from 'antd';
import {
  ApiOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileTextOutlined,
  InboxOutlined,
  KeyOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons';
import './styles.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const appProps = window.__MAIL_APP_PROPS__ || {};

const adminMenuItems = [
  { key: '/admin/home', icon: <DashboardOutlined />, label: '首页' },
  { key: '/admin/mailbox', icon: <InboxOutlined />, label: '邮箱管理' },
  { key: '/admin/daili', icon: <ControlOutlined />, label: '代理池' },
  { key: '/admin/kami', icon: <KeyOutlined />, label: '卡密管理' },
  { key: '/admin/kamirizhi', icon: <FileTextOutlined />, label: '卡密日志' },
  { key: '/admin/shoujian', icon: <MailOutlined />, label: '收件日志' },
  { key: '/admin/system', icon: <SettingOutlined />, label: '系统设置' }
];

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

function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const error = appProps.loginError;
  const title = appProps.adminLoginTitle || '管理员登录';
  const systemTitle = appProps.systemTitle || '邮件查看系统';

  return (
    <main className="login-page">
      <Card className="login-card">
        <Space direction="vertical" size={4} className="login-heading">
          <Title level={2}>{title}</Title>
          <Text type="secondary">{systemTitle}</Text>
        </Space>
        {error ? <div className="login-error">{error}</div> : null}
        <form
          method="post"
          action="/admin/login"
          onSubmit={() => setSubmitting(true)}
          className="login-form"
        >
          <label>
            <span>用户名</span>
            <Input
              name="username"
              size="large"
              prefix={<UserOutlined />}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>密码</span>
            <Input.Password
              name="password"
              size="large"
              autoComplete="current-password"
              required
            />
          </label>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            登录
          </Button>
        </form>
      </Card>
    </main>
  );
}

function LegacyFrame({ title, src }) {
  return (
    <div className="legacy-frame-wrap">
      <iframe
        title={title}
        className="legacy-frame"
        src={src}
        loading="eager"
      />
    </div>
  );
}

function AdminShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('reactAdminSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const currentPath = getCurrentPath();
  const selectedKey = adminMenuItems.some((item) => item.key === currentPath) ? currentPath : '/admin/home';
  const currentItem = adminMenuItems.find((item) => item.key === selectedKey);
  const legacyUrl = useMemo(() => buildLegacyUrl(selectedKey), [selectedKey]);

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
          {!collapsed ? <span>{appProps.systemTitle || '邮件查看系统'}</span> : null}
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
            onClick={() => updateCollapsed(!collapsed)}
          />
          <div className="admin-title">
            <Title level={4}>{currentItem?.label || '后台管理'}</Title>
            <Text type="secondary">{appProps.systemTitle || '邮件查看系统'}</Text>
          </div>
          <Space className="admin-actions">
            <Text className="admin-user">{appProps.adminUsername || '管理员'}</Text>
            <Button icon={<LogoutOutlined />} href="/admin/logout">
              退出
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">
          <LegacyFrame title={currentItem?.label || '后台页面'} src={legacyUrl} />
        </Content>
      </Layout>
    </Layout>
  );
}

function PublicShell() {
  return (
    <main className="public-app">
      <LegacyFrame title={appProps.pageTitle || '邮件查看'} src={buildLegacyUrl('/')} />
    </main>
  );
}

function Router() {
  const [path, setPath] = useState(getCurrentPath());

  React.useEffect(() => {
    const onPopState = () => setPath(getCurrentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (path === '/admin/login') return <LoginPage />;
  if (path.startsWith('/admin')) return <AdminShell />;
  return <PublicShell />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#C96442',
          colorInfo: '#C96442',
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
            bodyBg: '#F6F3EA'
          },
          Menu: {
            itemSelectedBg: 'rgba(201, 100, 66, 0.12)',
            itemSelectedColor: '#B14E2E'
          }
        }
      }}
    >
      <AntApp>
        <Router />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
