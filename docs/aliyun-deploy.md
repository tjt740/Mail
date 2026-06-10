# 阿里云部署和自动同步指南

这套部署不需要付费数据库，继续使用项目里的 SQLite 文件 `db/mail.sqlite`。

## 你会得到什么

1. 本地 push 代码到 GitHub `main` 后，GitHub Actions 自动把代码同步到阿里云并重启服务。
2. 本地后台新增邮箱、管理员、卡密等数据后，电脑会自动把 `db/mail.sqlite` 同步到阿里云。
3. 数据库不提交到 GitHub，避免邮箱密码和管理员信息泄露。

## 重要限制

当前数据同步是“本地覆盖服务器”。适合你把本地后台当作主控台使用。

不要同时在阿里云后台新增数据，否则下一次本地同步会覆盖服务器上的新增数据。

## 第一步：准备阿里云服务器

建议系统选择 Ubuntu 22.04 或 Debian 12。

在阿里云控制台确认：

1. 安全组放行 `22` 端口，用于 SSH。
2. 安全组放行 `8005` 端口，用于访问项目。
3. 记下公网 IP。

本地测试能否连接：

```bash
ssh root@你的服务器公网IP
```

如果 SSH 端口不是 `22`：

```bash
ssh -p 你的端口 root@你的服务器公网IP
```

## 第二步：在服务器上安装基础环境

登录服务器后执行：

```bash
apt update
apt install -y python3 python3-pip python3-venv git rsync
mkdir -p /opt/mail
```

如果你用的不是 `root` 用户，需要确保这个用户能写入 `/opt/mail`。

## 第三步：配置 GitHub Secrets

打开 GitHub 仓库：

`https://github.com/tjt740/Mail`

进入：

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

添加这些 Secret：

```text
ALIYUN_HOST=你的服务器公网IP
ALIYUN_USER=root
ALIYUN_PORT=22
ALIYUN_DEPLOY_PATH=/opt/mail
ALIYUN_SSH_KEY=你的 SSH 私钥内容
ALIYUN_DEPLOY_COMMAND=bash install.sh && systemctl restart mail-system
```

`ALIYUN_SSH_KEY` 是私钥内容，不是 `.pub` 公钥。服务器上需要提前把对应公钥加入：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 第四步：测试代码自动部署

本地执行一次：

```bash
git push origin main
```

然后到 GitHub 仓库的 `Actions` 页面查看 `Deploy to Aliyun` 是否成功。

成功后访问：

```text
http://你的服务器公网IP:8005/admin
```

## 第五步：配置本地数据库同步

在本地项目目录复制配置：

```bash
cd /Users/t/mail
cp .deploy.env.example .deploy.env
```

编辑 `.deploy.env`：

```bash
nano .deploy.env
```

最常用配置如下：

```bash
ALIYUN_HOST=你的服务器公网IP
ALIYUN_USER=root
ALIYUN_PORT=22
ALIYUN_DEPLOY_PATH=/opt/mail
ALIYUN_SSH_KEY=/Users/t/.ssh/你的私钥文件

LOCAL_DB=db/mail.sqlite
REMOTE_DB=/opt/mail/db/mail.sqlite
REMOTE_STOP_COMMAND='systemctl stop mail-system 2>/dev/null || true'
REMOTE_RESTART_COMMAND='systemctl restart mail-system 2>/dev/null || (cd /opt/mail && ./restart.sh)'
REMOTE_CHOWN_COMMAND=
```

先手动同步测试一次：

```bash
./scripts/sync_sqlite_to_server.sh
```

脚本会先在服务器备份旧库，再覆盖新库并重启服务。

## 第六步：开启本地数据自动同步

如果你只想开一个终端窗口监听：

```bash
cd /Users/t/mail
./scripts/watch_sqlite_and_sync.py
```

保持这个窗口不要关闭。之后你在本地后台新增数据，几秒后会自动同步到阿里云。

如果你希望电脑登录后自动后台同步，执行：

```bash
cd /Users/t/mail
./scripts/install_macos_sqlite_sync_agent.sh
```

查看日志：

```bash
tail -f logs/sqlite-sync.log
tail -f logs/sqlite-sync.err.log
```

停止后台同步：

```bash
./scripts/uninstall_macos_sqlite_sync_agent.sh
```

## 日常使用

本地改代码：

```bash
git add .
git commit -m "你的说明"
git push origin main
```

GitHub Actions 会自动部署代码。

本地后台添加邮箱、管理员、卡密：

保持 `watch_sqlite_and_sync.py` 或 macOS 后台任务运行，它会自动同步数据库。

## 出问题时先看这里

测试 SSH：

```bash
ssh -i /Users/t/.ssh/你的私钥文件 -p 22 root@你的服务器公网IP
```

查看服务器服务：

```bash
systemctl status mail-system
```

查看服务器日志：

```bash
journalctl -u mail-system -n 100 --no-pager
```

手动重启：

```bash
cd /opt/mail
bash install.sh
systemctl restart mail-system
```
