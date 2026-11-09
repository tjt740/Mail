# CC Bot 快捷登录（2026-11-10）

原因：tjt740 和 pink 已经登录 CC Bot 后仍需再次输入邮局密码。新增受服务密钥保护的凭证接口，让这两名用户直接进入邮局同名账号，保留保存的账号 ID、权限等级、邮箱范围和 session_version。其他登录流程不变。邮局 React 后台同时识别 /email 挂载前缀，保持菜单、旧页面内嵌和退出路径，避免嵌入时被误识别为首页。既有根路径 API 仍沿用当前 Nginx 的邮局路径恢复规则或桌面代理。

配套 CC Bot 版本须支持 `/api/mailbox/login`、加载桥接与撤销会话。邮局提供 `/auth/ccbot` 页面及 issue、consume、status、revoke 接口。凭证有效 60 秒且只能消费一次，数据文件只记录摘要，SQLite 事务保证并发请求最多成功一次。已建立的会话最长到 CC Bot 登录到期或 7 天；短期凭证过期不会立即退出后台。

## 服务配置

通过服务进程环境传入，应用不会自动读取 `.env`：

```dotenv
CCBOT_SSO_SECRET=<独立随机密钥，至少32字符，与CC Bot的MAILBOX_SSO_SECRET相同>
CCBOT_SSO_PARENT_ORIGINS=https://heihei.it,https://47.106.176.71
CCBOT_SSO_DB=/home/admin/mail/db/ccbot-sso.sqlite
```

将实际配置保存在服务器私有文件（例如 `/home/admin/mail/.env.ccbot-sso`，权限 600），不要提交到仓库。在 systemd 的 `/etc/systemd/system/mail-system.service.d/ccbot-sso.conf` 添加：

```ini
[Service]
EnvironmentFile=/home/admin/mail/.env.ccbot-sso
```

在明确获准发布后才重载服务配置并重启服务。普通部署脚本不包含密钥且不覆盖该 drop-in。CC Bot 的后端也须配置相同服务密钥，并使用最终 HTTPS 邮局地址，避免鉴权请求重定向。

允许来源只填写协议、主机及可选端口，不包含路径。桌面 http://localhost 与 http://127.0.0.1 的回环端口默认允许；网页建议与 CC Bot 同站点以兼容第三方 Cookie 限制。`/email` 等挂载前缀由桥接相对路径保留。

## 校验

```sh
python -m unittest discover -s tests
```

`test_ccbot_sso.py` 使用临时邮箱库和凭证账本，验证两个同名账号、权限保持、60 秒到期、并发单次消费、来源校验、删除/改密/权限撤销及 CC Bot 退出。双项目浏览器回归在 CC Bot 仓库：

```sh
MAILBOX_TEST_SOURCE=/path/to/mail python frontend/tests/mailbox-sso.browser.py
```

## 风险与限制

- 服务密钥允许受信后端为这两名账号签发登录凭证；须与原 AUTH_SECRET 分离，仅保存在受保护的后台配置，泄露后应轮换两端密钥并清理已建立的桥接会话。
- 账本默认位于 `db/ccbot-sso.sqlite`，权限 600，不写入账号数据库；多进程必须共享同一文件。当前不支持各服务器各自保存账本的多节点部署。
- CC Bot 退出会尽力发起撤销，断网、浏览器强制退出或原登录已过期时不能保证请求送达。会话仍有上限，后台每次请求检查账本，并保留邮局账号版本检查。
- 同一浏览器同一邮局地址共用 Cookie。桥接在加载后和每 15 秒检查身份，发现被其他登录替换时提示重试；需要同时操作不同账号时使用独立浏览器配置。
- 未配置密钥时拒绝快捷登录，原密码登录可继续使用。清空密钥会使已建立的桥接会话在下一次请求失效。
