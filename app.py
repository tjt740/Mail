#!/usr/bin/env python3
"""
邮件查看系统 - Flask 应用主文件（完整增强版）
基于原有 PHP 版本完全重构，保持所有功能和 UI 一致
支持多数据库、完整的邮箱管理、代理池、卡密系统等功能
"""

import os
import sqlite3
import secrets
import json
import csv
import subprocess
import sys
import time
import requests
import threading
import logging
import smtplib
import socket
import ssl
import errno
import ipaddress
import re
import html
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.message import EmailMessage
from email.utils import formataddr
from datetime import datetime, timezone, timedelta
from flask import Flask, render_template, request, session, redirect, url_for, flash, jsonify, g
from werkzeug.security import check_password_hash, generate_password_hash

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Columns used for fast mailbox listing (avoid fetching large blobs/passwords)
FAST_MAILBOX_COLUMNS = "id, email, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, status, remarks, created_by_admin, last_test, test_result, created_at, updated_at"
MAIL_LOG_BODY_MAX_LENGTH = 200000
MAIL_LOG_LIST_BODY_PREVIEW_LENGTH = 1200
MAIL_LOG_LIST_PER_EMAIL_LIMIT = 30

# EAI error code constant (Name or service not known)
# This is not a standard errno, but an EAI (getaddrinfo) error code
# Used when DNS resolution fails - prefer socket.EAI_NONAME if available
EAI_NONAME = getattr(socket, 'EAI_NONAME', -2)

# SMTP connection timeout (seconds)
SMTP_CONNECT_TIMEOUT = 20
# Proxy socket default timeout (seconds)
PROXY_CONNECT_TIMEOUT = 30

# Beijing timezone helper function
def get_beijing_time():
    """获取北京时间 (UTC+8)"""
    beijing_tz = timezone(timedelta(hours=8))
    return datetime.now(beijing_tz).strftime('%Y-%m-%d %H:%M:%S')

def safe_int(value, default=0):
    """安全转换为整数"""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def get_default_smtp_port(send_protocol='smtp', send_ssl=True):
    """
    Determine the default SMTP port for the given protocol hint.

    Args:
        send_protocol (str): Protocol value such as 'smtp', 'smtp_starttls', 'smtp_ssl', or aliases.
                             Empty or None values fall back to 'smtp'.
        send_ssl (bool): Whether implicit SSL is requested when protocol is plain 'smtp'
                         (ignored for explicit STARTTLS protocols).

    Returns:
        int: Suggested SMTP port.
    """
    protocol = (send_protocol or 'smtp').lower()
    if protocol in ('smtp_starttls', 'starttls'):
        return 587
    if protocol in ('smtp_ssl', 'smtps'):
        return 465
    # Plain 'smtp' relies on the SSL flag to choose between implicit SSL and plaintext.
    if protocol == 'smtp':
        return 465 if send_ssl else 25
    logging.getLogger(__name__).debug("Unknown SMTP protocol '%s', defaulting to port 25", protocol)
    return 25

def normalize_smtp_port(raw_port, send_protocol, send_ssl):
    """
    Clamp SMTP port to a positive value, defaulting based on protocol when needed.

    Args:
        raw_port: Port value from user input or persisted data (may be None or invalid).
        send_protocol (str): Protocol hint passed to get_default_smtp_port.
        send_ssl (bool): Whether implicit SSL is requested when protocol is 'smtp'.

    Returns:
        int: A positive SMTP port number derived from the provided values.
    """
    default_port = get_default_smtp_port(send_protocol, send_ssl)
    port = safe_int(raw_port, default_port)
    return port if port > 0 else default_port

def translate_network_error(error, server_name=None, server_port=None):
    """
    Translate network error to user-friendly Chinese message.
    
    Args:
        error: The exception object
        server_name: Optional server name for more specific error messages
        server_port: Optional server port for more specific error messages
    
    Returns:
        str: Translated error message in Chinese
    """
    error_msg = str(error)
    
    # Check for specific errno values first
    if isinstance(error, OSError) and hasattr(error, 'errno'):
        if error.errno == errno.ENETUNREACH:
            if server_name and server_port:
                return f'网络不可达: 无法连接到 {server_name}:{server_port}，请检查网络连接'
            return '网络不可达: 请检查网络连接'
        elif error.errno == errno.EHOSTUNREACH:
            if server_name and server_port:
                return f'无路由到主机: 无法到达 {server_name}:{server_port}'
            return '无路由到主机'
        elif error.errno == errno.ECONNREFUSED:
            if server_name and server_port:
                return f'连接被拒绝: 服务器 {server_name}:{server_port} 拒绝连接'
            return '连接被拒绝'
    
    # Check for DNS resolution errors
    if isinstance(error, socket.gaierror) or 'Name or service not known' in error_msg or '[Errno -2]' in error_msg:
        if server_name:
            return f'DNS解析失败: 无法解析服务器地址 {server_name}'
        return 'DNS解析失败'
    
    # Check for timeout errors
    if isinstance(error, socket.timeout) or 'timed out' in error_msg.lower() or 'timeout' in error_msg.lower():
        if server_name and server_port:
            return f'连接超时: 服务器 {server_name}:{server_port} 响应超时'
        return '连接超时'
    
    # String-based fallback checks (less reliable but handles edge cases)
    if '[Errno 101]' in error_msg or 'Network is unreachable' in error_msg:
        return '网络不可达: 请检查网络连接或SMTP服务器配置'
    elif 'Connection refused' in error_msg or '[Errno 111]' in error_msg:
        if server_name and server_port:
            return f'连接被拒绝: SMTP服务器 {server_name}:{server_port} 不可访问'
        return '连接被拒绝'
    
# Return original error message if no specific translation found
    return error_msg

def get_persistent_secret_key():
    """保持 Flask session secret 跨重启稳定，避免后台页面请求被重定向到登录页。"""
    env_secret = os.environ.get('SECRET_KEY', '').strip()
    if env_secret:
        return env_secret

    secret_path = os.path.join(os.path.dirname(__file__), 'db', 'flask_secret.key')
    try:
        if os.path.exists(secret_path):
            with open(secret_path, 'r', encoding='utf-8') as secret_file:
                saved_secret = secret_file.read().strip()
                if saved_secret:
                    return saved_secret

        os.makedirs(os.path.dirname(secret_path), exist_ok=True)
        new_secret = secrets.token_hex(32)
        with open(secret_path, 'w', encoding='utf-8') as secret_file:
            secret_file.write(new_secret)
        try:
            os.chmod(secret_path, 0o600)
        except Exception:
            pass
        return new_secret
    except Exception as e:
        logger.warning(f"Failed to persist Flask secret key: {e}")
        return secrets.token_hex(32)

app = Flask(__name__)

# 配置
app.config['SECRET_KEY'] = get_persistent_secret_key()
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['DATABASE'] = os.path.join(os.path.dirname(__file__), 'db', 'mail.sqlite')
app.config['DATABASE_TYPE'] = os.environ.get('DATABASE_TYPE', 'sqlite')  # sqlite, mysql, postgresql

# 邮件自动轮询配置
MAIL_POLL_MIN_INTERVAL = 30
MAIL_POLL_DEFAULT_INTERVAL = 300
MAIL_POLL_FETCH_LIMIT = min(max(safe_int(os.environ.get('MAIL_POLL_FETCH_LIMIT'), 5), 1), 50)
MAIL_POLL_TIMEOUT = min(max(safe_int(os.environ.get('MAIL_POLL_TIMEOUT'), 45), 10), 180)
MAIL_POLL_WORKERS = min(max(safe_int(os.environ.get('MAIL_POLL_WORKERS'), 4), 1), 10)
MAIL_POLL_DAYS_FILTER = min(max(safe_int(os.environ.get('MAIL_POLL_DAYS_FILTER'), 7), 1), 90)
MAIL_POLLER_STARTED = False
MAIL_POLLER_THREAD = None
MAIL_POLLER_RUN_LOCK = threading.Lock()
MAIL_POLLER_STATE_LOCK = threading.Lock()
MAIL_POLLER_STATE = {
    'started': False,
    'running': False,
    'last_started_at': '',
    'last_finished_at': '',
    'last_message': '邮件自动轮询尚未启动',
    'last_checked_count': 0,
    'last_new_count': 0,
    'last_failed_count': 0,
    'interval': MAIL_POLL_DEFAULT_INTERVAL,
    'auto_poll_enabled': True,
    'next_run_at': '',
    'backoff': []
}
# 失败退避：连续失败的邮箱按指数跳过若干轮，避免反复空耗子进程与超时
MAIL_POLL_BACKOFF_LOCK = threading.Lock()
MAIL_POLL_BACKOFF = {}  # email -> {'failures', 'skip_remaining', 'last_error', 'last_failed_at'}

# IP language detection cache. Country lookups are only used when the reverse
# proxy/CDN did not already provide a country header.
IP_COUNTRY_CACHE = {}
IP_COUNTRY_CACHE_LOCK = threading.Lock()
IP_COUNTRY_CACHE_TTL = 24 * 60 * 60

# 确保数据库目录存在
os.makedirs(os.path.dirname(app.config['DATABASE']), exist_ok=True)

def get_db():
    """获取数据库连接（支持多数据库）- 优化版本"""
    db = getattr(g, '_database', None)
    if db is None:
        db_type = app.config['DATABASE_TYPE']
        
        try:
            if db_type == 'sqlite':
                db = g._database = sqlite3.connect(
                    app.config['DATABASE'],
                    timeout=30.0,  # 30秒超时
                    check_same_thread=False
                )
                db.row_factory = sqlite3.Row
                # 启用WAL模式提高并发性能
                db.execute('PRAGMA journal_mode=WAL')
                db.execute('PRAGMA synchronous=NORMAL')
                db.execute('PRAGMA cache_size=10000')
                db.execute('PRAGMA temp_store=MEMORY')
                db.execute('PRAGMA mmap_size=134217728')
            elif db_type == 'mysql':
                # MySQL连接池优化（需要安装 mysql-connector-python）
                import mysql.connector
                from mysql.connector import pooling
                
                config = {
                    'host': os.environ.get('MYSQL_HOST', 'localhost'),
                    'user': os.environ.get('MYSQL_USER', 'root'),
                    'password': os.environ.get('MYSQL_PASSWORD', ''),
                    'database': os.environ.get('MYSQL_DATABASE', 'mail_system'),
                    'charset': 'utf8mb4',
                    'use_unicode': True,
                    'autocommit': False,
                    'connect_timeout': 30,
                    'sql_mode': 'STRICT_TRANS_TABLES',
                }
                
                # 创建连接池（如果不存在）
                if not hasattr(app, '_mysql_pool'):
                    app._mysql_pool = pooling.MySQLConnectionPool(
                        pool_name="mail_pool",
                        pool_size=5,
                        pool_reset_session=True,
                        **config
                    )
                
                db = g._database = app._mysql_pool.get_connection()
                
            elif db_type == 'postgresql':
                # PostgreSQL连接优化（需要安装 psycopg2-binary）
                import psycopg2
                from psycopg2.extras import RealDictCursor
                from psycopg2 import pool
                
                # 创建连接池（如果不存在）
                if not hasattr(app, '_postgres_pool'):
                    app._postgres_pool = psycopg2.pool.SimpleConnectionPool(
                        1, 10,  # 最小1个，最大10个连接
                        host=os.environ.get('POSTGRES_HOST', 'localhost'),
                        user=os.environ.get('POSTGRES_USER', 'postgres'),
                        password=os.environ.get('POSTGRES_PASSWORD', ''),
                        database=os.environ.get('POSTGRES_DATABASE', 'mail_system'),
                        cursor_factory=RealDictCursor
                    )
                
                db = g._database = app._postgres_pool.getconn()
        
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise Exception(f"数据库连接失败: {str(e)}")
            
    return db


def _get_active_proxy(db, db_type):
    """
    获取当前启用的代理配置（如果未启用代理则返回None）
    """
    try:
        if db_type == 'sqlite':
            config_rows = db.execute('SELECT * FROM proxy_config').fetchall()
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM proxy_config')
            config_rows = cursor.fetchall()
        config = {}
        for row in config_rows:
            if db_type == 'sqlite':
                config[row['config_key']] = row['config_value']
            else:
                config[row[1]] = row[2]
        if config.get('proxy_enabled') != '1':
            return None
        proxy_type = config.get('active_proxy_type', '')
        proxy_id = safe_int(config.get('active_proxy_id', '0'))
        if not proxy_type or proxy_id <= 0:
            return None
        if proxy_type not in ('socks5', 'http'):
            return None
        if db_type == 'sqlite':
            if proxy_type == 'socks5':
                proxy_row = db.execute('SELECT * FROM socks5_proxies WHERE id = ?', (proxy_id,)).fetchone()
            else:
                proxy_row = db.execute('SELECT * FROM http_proxies WHERE id = ?', (proxy_id,)).fetchone()
            proxy = dict(proxy_row) if proxy_row else None
        else:
            cursor = db.cursor()
            if proxy_type == 'socks5':
                cursor.execute('SELECT * FROM socks5_proxies WHERE id = %s', (proxy_id,))
            else:
                cursor.execute('SELECT * FROM http_proxies WHERE id = %s', (proxy_id,))
            proxy_row = cursor.fetchone()
            if not proxy_row:
                return None
            columns = [desc[0] for desc in cursor.description]
            proxy = dict(zip(columns, proxy_row))
        if proxy:
            proxy['proxy_type'] = proxy_type
        return proxy
    except Exception as e:
        logger.warning("读取代理配置失败: %s", e)
        return None


@contextmanager
def smtp_proxy_context(proxy):
    """
    上下文管理器：当启用代理时将SMTP流量通过代理发送
    返回 (proxy_enabled, connector) 其中 connector(address, timeout) 创建到目标的socket。
    """
    if not proxy:
        # Direct connection with better error handling
        def direct_connector(address, timeout=None):
            """Create direct connection with improved error handling"""
            try:
                return socket.create_connection(address, timeout=timeout or 30)
            except socket.gaierror as e:
                # DNS resolution error
                raise Exception(f"DNS解析失败: 无法解析服务器地址 {address[0]}")
            except socket.timeout:
                raise Exception(f"连接超时: 服务器 {address[0]}:{address[1]} 响应超时")
            except ConnectionRefusedError:
                raise Exception(f"连接被拒绝: 服务器 {address[0]}:{address[1]} 拒绝连接")
            except OSError as e:
                if e.errno == errno.ENETUNREACH:  # Network is unreachable
                    raise Exception(f"网络不可达: 无法连接到 {address[0]}:{address[1]}，请检查网络连接")
                elif e.errno == errno.EHOSTUNREACH:  # No route to host
                    raise Exception(f"无路由到主机: 无法到达 {address[0]}:{address[1]}")
                else:
                    raise Exception(f"网络错误 (errno {e.errno}): {str(e)}")
            except Exception as e:
                error_msg = str(e)
                if 'Network is unreachable' in error_msg:
                    raise Exception(f"网络不可达: 无法连接到 {address[0]}:{address[1]}，请检查网络连接")
                else:
                    raise Exception(f"连接失败: {error_msg}")
        
        yield False, direct_connector
        return
    try:
        import socks
    except ImportError:
        raise ImportError("发件需要代理时，请安装 pysocks 依赖 (pip install pysocks)")
    proxy_type = (proxy.get('proxy_type') or '').lower()
    proxy_host = (proxy.get('host') or '').strip()
    proxy_port = safe_int(proxy.get('port'), 0)
    proxy_username = (proxy.get('username') or '') or None
    proxy_password = (proxy.get('password') or '') or None
    if not proxy_host or proxy_port <= 0:
        # Fallback to direct connection if proxy not properly configured
        def direct_connector(address, timeout=None):
            try:
                return socket.create_connection(address, timeout=timeout or 30)
            except OSError as e:
                if e.errno == errno.ENETUNREACH:
                    raise Exception(f"网络不可达: 无法连接到 {address[0]}:{address[1]}，请检查网络连接")
                else:
                    raise
        yield False, direct_connector
        return
    try:
        socks_type = socks.SOCKS5 if proxy_type == 'socks5' else socks.HTTP
        # Note: rdns parameter in set_default_proxy is not always used by socks library
        # The actual remote DNS resolution is controlled by proxy_rdns in create_connection
        socks.set_default_proxy(
            socks_type,
            proxy_host,
            proxy_port,
            username=proxy_username,
            password=proxy_password,
            rdns=True
        )
        
        def safe_connector(address, timeout=None):
            """Create proxy connection with better error handling"""
            try:
                # For SOCKS5, use remote DNS resolution to avoid local DNS issues
                # The proxy configuration was already set via set_default_proxy above
                # We only need to specify proxy_rdns=True to force remote DNS
                return socks.create_connection(
                    address,
                    timeout=timeout or PROXY_CONNECT_TIMEOUT,
                    proxy_type=socks_type,
                    proxy_addr=proxy_host,
                    proxy_port=proxy_port,
                    proxy_username=proxy_username,
                    proxy_password=proxy_password,
                    proxy_rdns=True  # Force remote DNS resolution - this is the key fix
                )
            except socket.gaierror as e:
                # 远程DNS解析失败时，尝试本地解析后再通过代理连接
                try:
                    addr_info = socket.getaddrinfo(address[0], address[1], socket.AF_UNSPEC, socket.SOCK_STREAM)
                    last_fallback_error = None
                    for info in addr_info:
                        if len(info) < 5:
                            continue
                        _, _, _, _, sockaddr = info
                        if isinstance(sockaddr, (list, tuple)) and sockaddr and sockaddr[0]:
                            fallback_ip = sockaddr[0]
                            try:
                                return socks.create_connection(
                                    (fallback_ip, address[1]),
                                    timeout=timeout or PROXY_CONNECT_TIMEOUT,
                                    proxy_type=socks_type,
                                    proxy_addr=proxy_host,
                                    proxy_port=proxy_port,
                                    proxy_username=proxy_username,
                                    proxy_password=proxy_password,
                                    proxy_rdns=False  # 使用已解析好的IP，通过代理直连
                                )
                            except Exception as conn_err:
                                last_fallback_error = conn_err
                                continue
                    if last_fallback_error:
                        raise last_fallback_error
                except socket.gaierror as local_dns_error:
                    raise Exception(f"DNS解析失败 (通过代理): {str(e)}; 本地解析也失败: {local_dns_error}")
                except Exception:
                    # 其他错误（例如代理连接失败）直接抛出给上层统一处理
                    raise
                # 如果没有可用的解析结果，保留原始错误
                raise Exception(f"DNS解析失败 (通过代理): {str(e)}")
            except socks.ProxyConnectionError as e:
                # Proxy connection error
                raise Exception(f"代理连接失败: {str(e)}")
            except OSError as e:
                if e.errno == errno.ENETUNREACH:  # Network is unreachable
                    raise Exception(f"网络不可达 (通过代理): 请检查代理服务器 {proxy_host}:{proxy_port}")
                elif hasattr(e, 'errno') and e.errno == EAI_NONAME:  # EAI_NONAME on some systems
                    # Note: EAI_NONAME is not a standard errno, it's an EAI error code
                    raise Exception(f"域名解析失败 (通过代理): 无法解析 {address[0]}，代理可能不支持远程DNS")
                else:
                    raise Exception(f"网络错误 (通过代理, errno {e.errno}): {str(e)}")
            except Exception as e:
                # Other errors - check error message for known patterns
                error_msg = str(e)
                if '[Errno 101]' in error_msg or 'Network is unreachable' in error_msg:
                    raise Exception(f"网络不可达 (通过代理): 请检查代理服务器配置")
                elif '[Errno -2]' in error_msg or 'Name or service not known' in error_msg:
                    raise Exception(f"域名解析失败 (通过代理): {address[0]}")
                else:
                    raise Exception(f"连接失败 (通过代理): {error_msg}")
        
        connector = safe_connector
        yield True, connector
    finally:
        socks.setdefaultproxy()

def init_db():
    """初始化数据库（支持多数据库）- 优化版本"""
    with app.app_context():
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        try:
            # 使用事务确保原子性
            if db_type != 'sqlite':
                db.autocommit = False
                
            # 读取并执行初始化SQL
            init_sql_path = os.path.join(os.path.dirname(__file__), 'db', 'init.sql')
            if os.path.exists(init_sql_path):
                with open(init_sql_path, 'r', encoding='utf-8') as f:
                    sql_content = f.read()
                    
                    # 根据数据库类型调整SQL语句
                    if db_type == 'mysql':
                        sql_content = sql_content.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY')
                        sql_content = sql_content.replace('DATETIME DEFAULT CURRENT_TIMESTAMP', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
                        sql_content = sql_content.replace('INSERT OR IGNORE', 'INSERT IGNORE')
                        sql_content = sql_content.replace('INSERT OR REPLACE', 'INSERT INTO ... ON DUPLICATE KEY UPDATE')
                    elif db_type == 'postgresql':
                        sql_content = sql_content.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
                        sql_content = sql_content.replace('DATETIME', 'TIMESTAMP')
                        sql_content = sql_content.replace('INSERT OR IGNORE', 'INSERT ... ON CONFLICT DO NOTHING')
                        sql_content = sql_content.replace('INSERT OR REPLACE', 'INSERT ... ON CONFLICT ... DO UPDATE SET')
                    
                    # 执行SQL
                    if db_type == 'sqlite':
                        db.executescript(sql_content)
                    else:
                        cursor = db.cursor()
                        # 分割并执行每个语句
                        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
                        for statement in statements:
                            try:
                                cursor.execute(statement)
                            except Exception as e:
                                logger.warning(f"SQL statement failed (continuing): {statement[:100]}... Error: {e}")
                        cursor.close()
            
            # 数据库迁移：为现有代理表添加unified_id列
            migrate_proxy_tables(db, db_type)
            
            # 数据库迁移：为cards表添加新字段
            migrate_cards_table(db, db_type)
            
            # 数据库迁移：为mail_accounts表添加发件相关字段
            migrate_mail_accounts_table(db, db_type)

            # 创建卡密多邮箱绑定表，并迁移旧的单邮箱绑定字段
            create_card_email_bindings_table(db, db_type)
            
            # 数据库迁移：移除email字段的UNIQUE约束以支持邮箱多分组
            migrate_remove_email_unique_constraint(db, db_type)
            
            # 数据库迁移：为server_addresses表添加发件相关字段
            migrate_server_addresses_table(db, db_type)
            
            # 数据库迁移：为card_logs表添加邮件主题字段
            migrate_card_logs_table(db, db_type)

            # 数据库迁移：为mail_logs表添加自动轮询需要的字段和索引
            migrate_mail_logs_table(db, db_type)
            
            # 创建邮箱分组管理表
            create_mailbox_groups_tables(db, db_type)
            
            # 数据库迁移：为mailbox_groups表添加mailbox_count字段
            migrate_mailbox_groups_table(db, db_type)
            
            # 创建管理员用户表（兼容原有PHP版本）
            create_admin_table(db, db_type)
            
            # 创建管理员邮件访问日志表
            create_admin_mail_logs_table(db, db_type)
            
            # 创建卡密回收站表
            create_recycle_bin_table(db, db_type)
            
            # 创建系统配置表
            create_system_config_table(db, db_type)
            
            # 数据库迁移：确保系统标题配置存在
            migrate_system_title_config(db, db_type)
            
            # 数据库迁移：确保管理员万能秘钥配置存在
            migrate_admin_master_key_config(db, db_type)

            # 针对大量邮箱数据的索引优化
            ensure_mail_account_indexes(db, db_type)
            
            # 创建额外的性能优化索引
            ensure_performance_indexes(db, db_type)
            
            # 检查是否有默认管理员，如果没有则创建
            create_default_admin(db, db_type)

            # 创建管理员邮箱可见范围表，并绑定 tjt740 -> lhm 的管理关系
            create_admin_mailbox_scope_tables(db, db_type)
            
            # 提交事务
            if db_type != 'sqlite':
                db.commit()
            else:
                db.commit()
                
            logger.info("Database initialization completed successfully")
            
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            # 回滚事务
            if db_type != 'sqlite':
                try:
                    db.rollback()
                except:
                    pass
            raise

def create_recycle_bin_table(db, db_type):
    """创建卡密回收站表"""
    try:
        if db_type == 'sqlite':
            db.execute('''
                CREATE TABLE IF NOT EXISTS card_recycle_bin (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_card_id INTEGER NOT NULL,
                    card_key TEXT NOT NULL,
                    usage_limit INTEGER NOT NULL DEFAULT 1,
                    used_count INTEGER NOT NULL DEFAULT 0,
                    expired_at DATETIME DEFAULT NULL,
                    bound_email_id INTEGER DEFAULT NULL,
                    email_days_filter INTEGER DEFAULT 1,
                    sender_filter TEXT DEFAULT '',
                    remarks TEXT DEFAULT '',
                    status INTEGER NOT NULL DEFAULT 1,
                    recycle_type TEXT NOT NULL DEFAULT 'deleted',
                    reason TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        elif db_type == 'mysql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS card_recycle_bin (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    original_card_id INT NOT NULL,
                    card_key VARCHAR(255) NOT NULL,
                    usage_limit INT NOT NULL DEFAULT 1,
                    used_count INT NOT NULL DEFAULT 0,
                    expired_at DATETIME DEFAULT NULL,
                    bound_email_id INT DEFAULT NULL,
                    email_days_filter INT DEFAULT 1,
                    sender_filter TEXT DEFAULT '',
                    remarks TEXT DEFAULT '',
                    status INT NOT NULL DEFAULT 1,
                    recycle_type ENUM('deleted', 'expired') NOT NULL DEFAULT 'deleted',
                    reason TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_recycle_type (recycle_type),
                    INDEX idx_card_key (card_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            cursor.close()
        elif db_type == 'postgresql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS card_recycle_bin (
                    id SERIAL PRIMARY KEY,
                    original_card_id INTEGER NOT NULL,
                    card_key VARCHAR(255) NOT NULL,
                    usage_limit INTEGER NOT NULL DEFAULT 1,
                    used_count INTEGER NOT NULL DEFAULT 0,
                    expired_at TIMESTAMP DEFAULT NULL,
                    bound_email_id INTEGER DEFAULT NULL,
                    email_days_filter INTEGER DEFAULT 1,
                    sender_filter TEXT DEFAULT '',
                    remarks TEXT DEFAULT '',
                    status INTEGER NOT NULL DEFAULT 1,
                    recycle_type VARCHAR(50) NOT NULL DEFAULT 'deleted',
                    reason TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_recycle_type ON card_recycle_bin (recycle_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_card_key ON card_recycle_bin (card_key)')
            cursor.close()
    except Exception as e:
        logger.error(f"Failed to create recycle bin table: {e}")
        raise

def create_admin_mail_logs_table(db, db_type):
    """创建管理员邮件访问日志表"""
    try:
        if db_type == 'sqlite':
            db.execute('''
                CREATE TABLE IF NOT EXISTS admin_mail_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_username TEXT NOT NULL,
                    email TEXT NOT NULL,
                    user_ip TEXT DEFAULT '',
                    action TEXT DEFAULT 'admin_get_mail',
                    result TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        elif db_type == 'mysql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admin_mail_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_username VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    user_ip VARCHAR(255) DEFAULT '',
                    action VARCHAR(255) DEFAULT 'admin_get_mail',
                    result TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            cursor.close()
        elif db_type == 'postgresql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admin_mail_logs (
                    id SERIAL PRIMARY KEY,
                    admin_username VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    user_ip VARCHAR(255) DEFAULT '',
                    action VARCHAR(255) DEFAULT 'admin_get_mail',
                    result TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.close()
    except Exception as e:
        logger.error(f"Failed to create admin mail logs table: {e}")
        raise

def migrate_mail_logs_table(db, db_type):
    """迁移收件日志表，补充轮询去重和来源字段"""
    try:
        if db_type == 'sqlite':
            result = db.execute("PRAGMA table_info(mail_logs)").fetchall()
            columns = [col[1] for col in result]

            if 'message_id' not in columns:
                db.execute("ALTER TABLE mail_logs ADD COLUMN message_id TEXT DEFAULT ''")
                logger.info("Added message_id column to mail_logs table")
            if 'folder' not in columns:
                db.execute("ALTER TABLE mail_logs ADD COLUMN folder TEXT DEFAULT 'inbox'")
                logger.info("Added folder column to mail_logs table")
            if 'source' not in columns:
                db.execute("ALTER TABLE mail_logs ADD COLUMN source TEXT DEFAULT 'manual'")
                logger.info("Added source column to mail_logs table")
            if 'admin_username' not in columns:
                db.execute("ALTER TABLE mail_logs ADD COLUMN admin_username TEXT DEFAULT ''")
                logger.info("Added admin_username column to mail_logs table")
            if 'mail_body_type' not in columns:
                db.execute("ALTER TABLE mail_logs ADD COLUMN mail_body_type TEXT DEFAULT 'text'")
                logger.info("Added mail_body_type column to mail_logs table")
            if 'mail_body' not in columns:
                db.execute("ALTER TABLE mail_logs ADD COLUMN mail_body TEXT DEFAULT ''")
                logger.info("Added mail_body column to mail_logs table")

            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_logs_message_id ON mail_logs(message_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_logs_status_created ON mail_logs(status, created_at DESC)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_logs_email_message ON mail_logs(email, message_id)')
        else:
            cursor = db.cursor()
            try:
                if db_type == 'mysql':
                    columns_to_add = {
                        'message_id': "ALTER TABLE mail_logs ADD COLUMN message_id VARCHAR(255) DEFAULT ''",
                        'folder': "ALTER TABLE mail_logs ADD COLUMN folder VARCHAR(64) DEFAULT 'inbox'",
                        'source': "ALTER TABLE mail_logs ADD COLUMN source VARCHAR(64) DEFAULT 'manual'",
                        'admin_username': "ALTER TABLE mail_logs ADD COLUMN admin_username VARCHAR(255) DEFAULT ''",
                        'mail_body_type': "ALTER TABLE mail_logs ADD COLUMN mail_body_type VARCHAR(32) DEFAULT 'text'",
                        'mail_body': "ALTER TABLE mail_logs ADD COLUMN mail_body LONGTEXT"
                    }
                    for column_name, alter_sql in columns_to_add.items():
                        cursor.execute(f"SHOW COLUMNS FROM mail_logs LIKE '{column_name}'")
                        if not cursor.fetchone():
                            cursor.execute(alter_sql)
                            logger.info("Added %s column to mail_logs table", column_name)
                    for index_sql in (
                        'CREATE INDEX idx_mail_logs_message_id ON mail_logs(message_id)',
                        'CREATE INDEX idx_mail_logs_status_created ON mail_logs(status, created_at)',
                        'CREATE INDEX idx_mail_logs_email_message ON mail_logs(email, message_id)'
                    ):
                        try:
                            cursor.execute(index_sql)
                        except Exception:
                            pass
                elif db_type == 'postgresql':
                    cursor.execute("ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS message_id TEXT DEFAULT ''")
                    cursor.execute("ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS folder VARCHAR(64) DEFAULT 'inbox'")
                    cursor.execute("ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS source VARCHAR(64) DEFAULT 'manual'")
                    cursor.execute("ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255) DEFAULT ''")
                    cursor.execute("ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS mail_body_type VARCHAR(32) DEFAULT 'text'")
                    cursor.execute("ALTER TABLE mail_logs ADD COLUMN IF NOT EXISTS mail_body TEXT DEFAULT ''")
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_mail_logs_message_id ON mail_logs(message_id)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_mail_logs_status_created ON mail_logs(status, created_at DESC)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_mail_logs_email_message ON mail_logs(email, message_id)')
            finally:
                cursor.close()
    except Exception as e:
        logger.error(f"Error during mail_logs table migration: {e}")
        raise

def create_system_config_table(db, db_type):
    """创建系统配置表"""
    try:
        if db_type == 'sqlite':
            db.execute('''
                CREATE TABLE IF NOT EXISTS system_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    config_key TEXT NOT NULL UNIQUE,
                    config_value TEXT NOT NULL,
                    config_type TEXT DEFAULT 'string',
                    description TEXT DEFAULT '',
                    is_system INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        elif db_type == 'mysql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_config (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    config_key VARCHAR(255) NOT NULL UNIQUE,
                    config_value TEXT NOT NULL,
                    config_type VARCHAR(50) DEFAULT 'string',
                    description TEXT DEFAULT '',
                    is_system TINYINT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_config_key (config_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            cursor.close()
        elif db_type == 'postgresql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_config (
                    id SERIAL PRIMARY KEY,
                    config_key VARCHAR(255) NOT NULL UNIQUE,
                    config_value TEXT NOT NULL,
                    config_type VARCHAR(50) DEFAULT 'string',
                    description TEXT DEFAULT '',
                    is_system INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_config_key ON system_config (config_key)')
            cursor.close()
    except Exception as e:
        logger.error(f"Failed to create system config table: {e}")
        raise

def migrate_system_title_config(db, db_type):
    """迁移系统标题配置：确保system_title配置项存在"""
    try:
        # 检查是否已存在system_title配置
        if db_type == 'sqlite':
            result = db.execute('SELECT COUNT(*) FROM system_config WHERE config_key = ?', ('system_title',)).fetchone()
            exists = result[0] > 0
        else:
            cursor = db.cursor()
            cursor.execute('SELECT COUNT(*) FROM system_config WHERE config_key = %s', ('system_title',))
            result = cursor.fetchone()
            exists = result[0] > 0
            cursor.close()
        
        if not exists:
            # 插入默认的system_title配置
            now = get_beijing_time()
            if db_type == 'sqlite':
                db.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('system_title', '邮件查看系统', 'string', '系统页面标题', 0, ?, ?)
                ''', (now, now))
            else:
                cursor = db.cursor()
                cursor.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('system_title', %s, 'string', '系统页面标题', 0, %s, %s)
                ''', ('邮件查看系统', now, now))
                cursor.close()
            
            logger.info("Added system_title configuration to system_config table")
        else:
            logger.info("System_title configuration already exists")
            
    except Exception as e:
        logger.error(f"Failed to migrate system_title config: {e}")
        raise

def migrate_admin_master_key_config(db, db_type):
    """迁移管理员万能秘钥配置：确保配置项存在以兼容旧数据库"""
    try:
        if db_type == 'sqlite':
            result = db.execute('SELECT COUNT(*) FROM system_config WHERE config_key = ?', ('admin_master_key',)).fetchone()
            exists = result[0] > 0
        else:
            cursor = db.cursor()
            cursor.execute('SELECT COUNT(*) FROM system_config WHERE config_key = %s', ('admin_master_key',))
            result = cursor.fetchone()
            exists = result[0] > 0
            cursor.close()
        
        if not exists:
            now = get_beijing_time()
            if db_type == 'sqlite':
                db.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('admin_master_key', '', 'secret', '管理员万能秘钥', 0, ?, ?)
                ''', (now, now))
            else:
                cursor = db.cursor()
                cursor.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES (%s, %s, 'secret', '管理员万能秘钥', 0, %s, %s)
                ''', ('admin_master_key', '', now, now))
                cursor.close()
            
            logger.info("Added admin_master_key configuration to system_config table")
    except Exception as e:
        logger.error(f"Failed to migrate admin master key config: {e}")
        raise

def create_admin_table(db, db_type):
    """创建管理员用户表"""
    try:
        if db_type == 'sqlite':
            db.execute('''
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        elif db_type == 'mysql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            cursor.close()
        elif db_type == 'postgresql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admin_users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.close()
    except Exception as e:
        logger.error(f"Failed to create admin table: {e}")
        raise

def create_admin_mailbox_scope_tables(db, db_type):
    """创建管理员邮箱范围控制、单邮箱授权与分组授权表。"""
    try:
        if db_type == 'sqlite':
            db.execute('''
                CREATE TABLE IF NOT EXISTS admin_mailbox_scope_managers (
                    manager_admin_id INTEGER PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (manager_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS admin_mailbox_scopes (
                    restricted_admin_id INTEGER PRIMARY KEY,
                    manager_admin_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (restricted_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                    FOREIGN KEY (manager_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS admin_mailbox_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id INTEGER NOT NULL,
                    mailbox_id INTEGER NOT NULL,
                    granted_by_admin_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                    FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (granted_by_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                    UNIQUE(admin_id, mailbox_id)
                )
            ''')
            db.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_permissions_admin ON admin_mailbox_permissions(admin_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_permissions_mailbox ON admin_mailbox_permissions(mailbox_id)')
            db.execute('''
                CREATE TABLE IF NOT EXISTS admin_mailbox_group_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id INTEGER NOT NULL,
                    group_id INTEGER NOT NULL,
                    granted_by_admin_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                    FOREIGN KEY (group_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                    FOREIGN KEY (granted_by_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                    UNIQUE(admin_id, group_id)
                )
            ''')
            db.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_group_permissions_admin ON admin_mailbox_group_permissions(admin_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_group_permissions_group ON admin_mailbox_group_permissions(group_id)')
            manager = db.execute('SELECT id FROM admin_users WHERE LOWER(username) = LOWER(?)', ('tjt740',)).fetchone()
            restricted = db.execute('SELECT id FROM admin_users WHERE LOWER(username) = LOWER(?)', ('lhm',)).fetchone()
            should_seed_default_scope = False
            if manager:
                now = get_beijing_time()
                registered_manager = db.execute('''
                    SELECT 1 FROM admin_mailbox_scope_managers WHERE manager_admin_id = ?
                ''', (manager['id'],)).fetchone()
                should_seed_default_scope = not bool(registered_manager)
                if should_seed_default_scope:
                    db.execute('''
                        INSERT INTO admin_mailbox_scope_managers (manager_admin_id, created_at)
                        VALUES (?, ?)
                    ''', (manager['id'], now))
            if manager and restricted and should_seed_default_scope:
                now = get_beijing_time()
                db.execute('''
                    INSERT INTO admin_mailbox_scopes
                        (restricted_admin_id, manager_admin_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(restricted_admin_id) DO UPDATE SET
                        manager_admin_id = excluded.manager_admin_id,
                        updated_at = excluded.updated_at
                ''', (restricted['id'], manager['id'], now, now))
        else:
            cursor = db.cursor()
            if db_type == 'mysql':
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_scope_managers (
                        manager_admin_id INT PRIMARY KEY,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (manager_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_scopes (
                        restricted_admin_id INT PRIMARY KEY,
                        manager_admin_id INT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (restricted_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        FOREIGN KEY (manager_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        INDEX idx_admin_mailbox_scope_manager (manager_admin_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_permissions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        admin_id INT NOT NULL,
                        mailbox_id INT NOT NULL,
                        granted_by_admin_id INT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
                        FOREIGN KEY (granted_by_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        UNIQUE KEY uniq_admin_mailbox_permission (admin_id, mailbox_id),
                        INDEX idx_admin_mailbox_permissions_mailbox (mailbox_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_group_permissions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        admin_id INT NOT NULL,
                        group_id INT NOT NULL,
                        granted_by_admin_id INT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        FOREIGN KEY (group_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                        FOREIGN KEY (granted_by_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        UNIQUE KEY uniq_admin_mailbox_group_permission (admin_id, group_id),
                        INDEX idx_admin_mailbox_group_permissions_group (group_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ''')
            else:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_scope_managers (
                        manager_admin_id INTEGER PRIMARY KEY,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (manager_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_scopes (
                        restricted_admin_id INTEGER PRIMARY KEY,
                        manager_admin_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (restricted_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        FOREIGN KEY (manager_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_scope_manager ON admin_mailbox_scopes(manager_admin_id)')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_permissions (
                        id SERIAL PRIMARY KEY,
                        admin_id INTEGER NOT NULL,
                        mailbox_id INTEGER NOT NULL,
                        granted_by_admin_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
                        FOREIGN KEY (granted_by_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        UNIQUE(admin_id, mailbox_id)
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_permissions_admin ON admin_mailbox_permissions(admin_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_permissions_mailbox ON admin_mailbox_permissions(mailbox_id)')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_mailbox_group_permissions (
                        id SERIAL PRIMARY KEY,
                        admin_id INTEGER NOT NULL,
                        group_id INTEGER NOT NULL,
                        granted_by_admin_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        FOREIGN KEY (group_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                        FOREIGN KEY (granted_by_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
                        UNIQUE(admin_id, group_id)
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_group_permissions_admin ON admin_mailbox_group_permissions(admin_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_mailbox_group_permissions_group ON admin_mailbox_group_permissions(group_id)')

            cursor.execute('SELECT id FROM admin_users WHERE LOWER(username) = LOWER(%s)', ('tjt740',))
            manager = cursor.fetchone()
            cursor.execute('SELECT id FROM admin_users WHERE LOWER(username) = LOWER(%s)', ('lhm',))
            restricted = cursor.fetchone()
            should_seed_default_scope = False
            if manager:
                manager_id = manager['id'] if isinstance(manager, dict) else manager[0]
                now = get_beijing_time()
                cursor.execute('''
                    SELECT 1 FROM admin_mailbox_scope_managers WHERE manager_admin_id = %s
                ''', (manager_id,))
                should_seed_default_scope = not bool(cursor.fetchone())
                if db_type == 'mysql':
                    if should_seed_default_scope:
                        cursor.execute('''
                            INSERT INTO admin_mailbox_scope_managers (manager_admin_id, created_at)
                            VALUES (%s, %s)
                        ''', (manager_id, now))
                else:
                    if should_seed_default_scope:
                        cursor.execute('''
                            INSERT INTO admin_mailbox_scope_managers (manager_admin_id, created_at)
                            VALUES (%s, %s)
                        ''', (manager_id, now))
            if manager and restricted and should_seed_default_scope:
                manager_id = manager['id'] if isinstance(manager, dict) else manager[0]
                restricted_id = restricted['id'] if isinstance(restricted, dict) else restricted[0]
                now = get_beijing_time()
                if db_type == 'mysql':
                    cursor.execute('''
                        INSERT INTO admin_mailbox_scopes
                            (restricted_admin_id, manager_admin_id, created_at, updated_at)
                        VALUES (%s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            manager_admin_id = VALUES(manager_admin_id),
                            updated_at = VALUES(updated_at)
                    ''', (restricted_id, manager_id, now, now))
                else:
                    cursor.execute('''
                        INSERT INTO admin_mailbox_scopes
                            (restricted_admin_id, manager_admin_id, created_at, updated_at)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (restricted_admin_id) DO UPDATE SET
                            manager_admin_id = EXCLUDED.manager_admin_id,
                            updated_at = EXCLUDED.updated_at
                    ''', (restricted_id, manager_id, now, now))
            cursor.close()

        db.commit()
        logger.info("Admin mailbox scope tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create admin mailbox scope tables: {e}")
        raise

def create_default_admin(db, db_type):
    """创建默认管理员用户"""
    try:
        if db_type == 'sqlite':
            # 检查是否存在任何管理员用户
            admin = db.execute('SELECT * FROM admin_users LIMIT 1').fetchone()
            if not admin:
                db.execute('INSERT INTO admin_users (username, password) VALUES (?, ?)', 
                          ('admin', 'admin'))  # 简单密码，生产环境应使用hash
        else:
            cursor = db.cursor()
            # 检查是否存在任何管理员用户
            cursor.execute('SELECT * FROM admin_users LIMIT 1')
            admin = cursor.fetchone()
            if not admin:
                cursor.execute('INSERT INTO admin_users (username, password) VALUES (%s, %s)', 
                              ('admin', 'admin'))
            cursor.close()
    except Exception as e:
        logger.error(f"Failed to create default admin: {e}")
        raise

def migrate_proxy_tables(db, db_type):
    """迁移代理表，添加unified_id字段"""
    try:
        # 检查http_proxies表是否有unified_id列
        if db_type == 'sqlite':
            result = db.execute("PRAGMA table_info(http_proxies)").fetchall()
            columns = [col[1] for col in result]
            
            if 'unified_id' not in columns:
                db.execute('ALTER TABLE http_proxies ADD COLUMN unified_id INTEGER DEFAULT 0')
                logger.info("Added unified_id column to http_proxies table")
                
        else:
            cursor = db.cursor()
            try:
                if db_type == 'mysql':
                    cursor.execute("SHOW COLUMNS FROM http_proxies LIKE 'unified_id'")
                    if not cursor.fetchone():
                        cursor.execute('ALTER TABLE http_proxies ADD COLUMN unified_id INT DEFAULT 0')
                        logger.info("Added unified_id column to http_proxies table")
                elif db_type == 'postgresql':
                    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='http_proxies' AND column_name='unified_id'")
                    if not cursor.fetchone():
                        cursor.execute('ALTER TABLE http_proxies ADD COLUMN unified_id INTEGER DEFAULT 0')
                        logger.info("Added unified_id column to http_proxies table")
            except Exception as e:
                logger.error(f"Error checking/adding unified_id to http_proxies: {e}")
        
        # 检查socks5_proxies表是否有unified_id列
        if db_type == 'sqlite':
            result = db.execute("PRAGMA table_info(socks5_proxies)").fetchall()
            columns = [col[1] for col in result]
            
            if 'unified_id' not in columns:
                db.execute('ALTER TABLE socks5_proxies ADD COLUMN unified_id INTEGER DEFAULT 0')
                logger.info("Added unified_id column to socks5_proxies table")
                
        else:
            cursor = db.cursor()
            try:
                if db_type == 'mysql':
                    cursor.execute("SHOW COLUMNS FROM socks5_proxies LIKE 'unified_id'")
                    if not cursor.fetchone():
                        cursor.execute('ALTER TABLE socks5_proxies ADD COLUMN unified_id INT DEFAULT 0')
                        logger.info("Added unified_id column to socks5_proxies table")
                elif db_type == 'postgresql':
                    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='socks5_proxies' AND column_name='unified_id'")
                    if not cursor.fetchone():
                        cursor.execute('ALTER TABLE socks5_proxies ADD COLUMN unified_id INTEGER DEFAULT 0')
                        logger.info("Added unified_id column to socks5_proxies table")
            except Exception as e:
                logger.error(f"Error checking/adding unified_id to socks5_proxies: {e}")
        
        # 为现有代理分配统一ID
        assign_unified_ids_to_existing_proxies(db, db_type)
        
        if db_type != 'sqlite':
            db.commit()
        else:
            db.commit()
            
    except Exception as e:
        logger.error(f"Error during proxy table migration: {e}")

def migrate_cards_table(db, db_type):
    """迁移cards表，添加新的邮件管理字段"""
    try:
        # 检查cards表是否有新字段
        new_columns = [
            ('bound_email_id', 'INTEGER DEFAULT NULL'),
            ('email_days_filter', 'INTEGER DEFAULT 1'),
            ('sender_filter', 'TEXT DEFAULT \'\''),
            ('keyword_filter', 'TEXT DEFAULT \'\'')
        ]
        
        for column_name, column_def in new_columns:
            if db_type == 'sqlite':
                # 检查列是否存在
                result = db.execute("PRAGMA table_info(cards)").fetchall()
                existing_columns = [col[1] for col in result]
                
                if column_name not in existing_columns:
                    if db_type == 'sqlite':
                        if column_name == 'bound_email_id':
                            db.execute('ALTER TABLE cards ADD COLUMN bound_email_id INTEGER DEFAULT NULL')
                        elif column_name == 'email_days_filter':
                            db.execute('ALTER TABLE cards ADD COLUMN email_days_filter INTEGER DEFAULT 1')
                        elif column_name == 'sender_filter':
                            db.execute('ALTER TABLE cards ADD COLUMN sender_filter TEXT DEFAULT \'\'')
                        elif column_name == 'keyword_filter':
                            db.execute('ALTER TABLE cards ADD COLUMN keyword_filter TEXT DEFAULT \'\'')
                    logger.info(f"Added {column_name} column to cards table")
                    
            else:
                cursor = db.cursor()
                try:
                    if db_type == 'mysql':
                        cursor.execute(f"SHOW COLUMNS FROM cards LIKE '{column_name}'")
                        if not cursor.fetchone():
                            mysql_def = column_def.replace('INTEGER', 'INT').replace('TEXT', 'TEXT')
                            cursor.execute(f'ALTER TABLE cards ADD COLUMN {column_name} {mysql_def}')
                            logger.info(f"Added {column_name} column to cards table")
                    elif db_type == 'postgresql':
                        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='cards' AND column_name='{column_name}'")
                        if not cursor.fetchone():
                            pg_def = column_def.replace('INTEGER', 'INTEGER').replace('TEXT', 'TEXT')
                            cursor.execute(f'ALTER TABLE cards ADD COLUMN {column_name} {pg_def}')
                            logger.info(f"Added {column_name} column to cards table")
                except Exception as e:
                    logger.error(f"Error checking/adding {column_name} to cards: {e}")
        
        if db_type != 'sqlite':
            db.commit()
        else:
            db.commit()
            
        logger.info("Cards table migration completed successfully")
        
    except Exception as e:
        logger.error(f"Error during cards table migration: {e}")

def create_card_email_bindings_table(db, db_type):
    """创建卡密-邮箱多对多绑定表，并把旧 bound_email_id 数据迁移进去"""
    try:
        if db_type == 'sqlite':
            db.execute('''
                CREATE TABLE IF NOT EXISTS card_email_bindings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    card_id INTEGER NOT NULL,
                    mailbox_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(card_id, mailbox_id),
                    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
                    FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE
                )
            ''')
            db.execute('CREATE INDEX IF NOT EXISTS idx_card_email_bindings_card ON card_email_bindings(card_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_card_email_bindings_mailbox ON card_email_bindings(mailbox_id)')
            db.execute('''
                INSERT OR IGNORE INTO card_email_bindings (card_id, mailbox_id, created_at)
                SELECT id, bound_email_id, CURRENT_TIMESTAMP
                FROM cards
                WHERE bound_email_id IS NOT NULL
            ''')
        elif db_type == 'mysql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS card_email_bindings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    card_id INT NOT NULL,
                    mailbox_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uniq_card_mailbox (card_id, mailbox_id),
                    INDEX idx_card_email_bindings_card (card_id),
                    INDEX idx_card_email_bindings_mailbox (mailbox_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            cursor.execute('''
                INSERT IGNORE INTO card_email_bindings (card_id, mailbox_id, created_at)
                SELECT id, bound_email_id, CURRENT_TIMESTAMP
                FROM cards
                WHERE bound_email_id IS NOT NULL
            ''')
        elif db_type == 'postgresql':
            cursor = db.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS card_email_bindings (
                    id SERIAL PRIMARY KEY,
                    card_id INTEGER NOT NULL,
                    mailbox_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(card_id, mailbox_id)
                )
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_card_email_bindings_card ON card_email_bindings(card_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_card_email_bindings_mailbox ON card_email_bindings(mailbox_id)')
            cursor.execute('''
                INSERT INTO card_email_bindings (card_id, mailbox_id, created_at)
                SELECT id, bound_email_id, CURRENT_TIMESTAMP
                FROM cards
                WHERE bound_email_id IS NOT NULL
                ON CONFLICT (card_id, mailbox_id) DO NOTHING
            ''')
        db.commit()
        logger.info("Card email bindings table migration completed")
    except Exception as e:
        logger.error(f"Error creating card_email_bindings table: {e}")

def migrate_mail_accounts_table(db, db_type):
    """迁移mail_accounts表，添加发件服务器、备注和认证相关字段"""
    try:
        new_columns = [
            ('send_server', "TEXT DEFAULT ''", "VARCHAR(255) DEFAULT ''"),
            ('send_port', 'INTEGER DEFAULT 465', 'INT DEFAULT 465'),
            ('send_protocol', "TEXT DEFAULT 'smtp'", "VARCHAR(50) DEFAULT 'smtp'"),
            ('send_ssl', 'INTEGER DEFAULT 1', 'TINYINT DEFAULT 1'),
            ('remarks', "TEXT DEFAULT ''", "TEXT DEFAULT ''"),
            ('auth_type', "TEXT DEFAULT 'password'", "VARCHAR(50) DEFAULT 'password'"),
            ('oauth_client_id', "TEXT DEFAULT ''", "TEXT DEFAULT ''"),
            ('oauth_refresh_token', "TEXT DEFAULT ''", "TEXT DEFAULT ''"),
            ('created_by_admin', "TEXT DEFAULT ''", "VARCHAR(255) DEFAULT ''")
        ]
        
        for column_name, sqlite_def, other_def in new_columns:
            if db_type == 'sqlite':
                result = db.execute("PRAGMA table_info(mail_accounts)").fetchall()
                columns = [col[1] for col in result]
                if column_name not in columns:
                    db.execute(f'ALTER TABLE mail_accounts ADD COLUMN {column_name} {sqlite_def}')
                    logger.info(f"Added {column_name} column to mail_accounts table")
            else:
                cursor = db.cursor()
                try:
                    if db_type == 'mysql':
                        cursor.execute(f"SHOW COLUMNS FROM mail_accounts LIKE '{column_name}'")
                        if not cursor.fetchone():
                            cursor.execute(f'ALTER TABLE mail_accounts ADD COLUMN {column_name} {other_def}')
                            logger.info(f"Added {column_name} column to mail_accounts table")
                    elif db_type == 'postgresql':
                        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='mail_accounts' AND column_name='{column_name}'")
                        if not cursor.fetchone():
                            pg_def = other_def.replace('TINYINT', 'INTEGER')
                            cursor.execute(f'ALTER TABLE mail_accounts ADD COLUMN {column_name} {pg_def}')
                            logger.info(f"Added {column_name} column to mail_accounts table")
                except Exception as e:
                    logger.error(f"Error checking/adding {column_name} to mail_accounts: {e}")
        
        db.commit()
    except Exception as e:
        logger.error(f"Error during mail_accounts table migration: {e}")

def migrate_remove_email_unique_constraint(db, db_type):
    """迁移mail_accounts表，移除email字段的UNIQUE约束以支持邮箱多分组"""
    try:
        if db_type == 'sqlite':
            # Check if the UNIQUE constraint exists
            result = db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='mail_accounts'").fetchone()
            if result and 'UNIQUE' in result[0] and 'email' in result[0]:
                logger.info("Removing UNIQUE constraint on email field from mail_accounts table")
                
                # SQLite doesn't support dropping constraints directly, need to recreate table
                # Get column information dynamically
                column_info = db.execute("PRAGMA table_info(mail_accounts)").fetchall()
                columns = [col[1] for col in column_info]  # col[1] is the column name
                columns_str = ', '.join(columns)
                placeholders = ', '.join(['?' for _ in columns])
                
                # Get all data first
                accounts = db.execute('SELECT * FROM mail_accounts').fetchall()
                
                # Get the original schema and remove UNIQUE constraint from email
                original_schema = result[0]
                # Simple approach: replace "email TEXT NOT NULL UNIQUE" with "email TEXT NOT NULL"
                new_schema = original_schema.replace('email TEXT NOT NULL UNIQUE', 'email TEXT NOT NULL')
                new_schema = new_schema.replace('mail_accounts', 'mail_accounts_backup')
                
                # Drop and recreate the table without UNIQUE constraint
                db.execute('DROP TABLE IF EXISTS mail_accounts_backup')
                db.execute(new_schema)
                
                # Copy data to backup table dynamically
                if accounts:
                    for account in accounts:
                        insert_sql = f'INSERT INTO mail_accounts_backup ({columns_str}) VALUES ({placeholders})'
                        db.execute(insert_sql, tuple(account))
                
                # Drop old table and rename backup
                db.execute('DROP TABLE mail_accounts')
                db.execute('ALTER TABLE mail_accounts_backup RENAME TO mail_accounts')
                
                # Recreate indexes
                db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_email ON mail_accounts(email)')
                db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_created_at ON mail_accounts(created_at)')
                db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_status ON mail_accounts(status)')
                db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_email_created ON mail_accounts(email, created_at)')
                
                logger.info("UNIQUE constraint removed from email field successfully")
        
        elif db_type == 'mysql':
            cursor = db.cursor()
            # Check if UNIQUE constraint exists
            cursor.execute("SHOW CREATE TABLE mail_accounts")
            table_def = cursor.fetchone()[1]
            if 'UNIQUE' in table_def and '`email`' in table_def:
                logger.info("Removing UNIQUE constraint on email field from mail_accounts table")
                # Find the constraint name
                cursor.execute("""
                    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mail_accounts' 
                    AND CONSTRAINT_TYPE = 'UNIQUE' AND CONSTRAINT_NAME LIKE '%email%'
                """)
                constraint = cursor.fetchone()
                if constraint:
                    cursor.execute(f'ALTER TABLE mail_accounts DROP INDEX {constraint[0]}')
                    logger.info(f"Dropped UNIQUE constraint {constraint[0]} from email field")
        
        elif db_type == 'postgresql':
            cursor = db.cursor()
            # Check if UNIQUE constraint exists
            cursor.execute("""
                SELECT conname FROM pg_constraint 
                WHERE conrelid = 'mail_accounts'::regclass AND contype = 'u'
                AND conname LIKE '%email%'
            """)
            constraint = cursor.fetchone()
            if constraint:
                logger.info(f"Removing UNIQUE constraint {constraint[0]} on email field from mail_accounts table")
                cursor.execute(f'ALTER TABLE mail_accounts DROP CONSTRAINT {constraint[0]}')
                logger.info("UNIQUE constraint removed from email field successfully")
        
        db.commit()
        logger.info("Email UNIQUE constraint migration completed")
    except Exception as e:
        logger.error(f"Error during email UNIQUE constraint migration: {e}")

def ensure_mail_account_indexes(db, db_type):
    """为mail_accounts表创建性能相关索引（主要针对SQLite大数据量场景）"""
    if db_type != 'sqlite':
        # 其他数据库（MySQL/PostgreSQL）通常通过迁移或显式DDL管理索引，保持不变
        return
    try:
        db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_created_at ON mail_accounts(created_at)')
        db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_email_created ON mail_accounts(email, created_at)')
        db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_created_by_admin ON mail_accounts(created_by_admin)')
    except Exception as e:
        logger.warning(f"Failed to ensure mail_accounts indexes: {e}")

def ensure_performance_indexes(db, db_type):
    """创建额外的性能优化索引以支持大数据量快速查询"""
    try:
        if db_type == 'sqlite':
            # 基础复合索引
            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_search ON mail_accounts(email, server, remarks)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_created_by_admin ON mail_accounts(created_by_admin)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_cards_search ON cards(card_key, remarks, status)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_cards_bound_email ON cards(bound_email_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_http_proxies_search ON http_proxies(name, host, remarks)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_socks5_proxies_search ON socks5_proxies(name, host, remarks)')
            
            # 高级性能优化索引（针对超大数据量场景）
            db.execute('CREATE INDEX IF NOT EXISTS idx_card_logs_card_created ON card_logs(card_id, created_at DESC)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_id_email ON mail_accounts(id, email)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mail_accounts_server_status ON mail_accounts(server, status)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_cards_status_id ON cards(status, id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_cards_key_status ON cards(card_key, status)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_http_proxies_status_id ON http_proxies(status, id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_socks5_proxies_status_id ON socks5_proxies(status, id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_http_proxies_name_host ON http_proxies(name, host)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_socks5_proxies_name_host ON socks5_proxies(name, host)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_group_mappings_group_mailbox ON mailbox_group_mappings(group_id, mailbox_id)')
            
            logger.info("Performance indexes created successfully")
        elif db_type == 'mysql':
            cursor = db.cursor()
            # 基础索引
            indexes = [
                ('idx_mail_accounts_search', 'mail_accounts', ['email', 'server', 'remarks']),
                ('idx_mail_accounts_created_by_admin', 'mail_accounts', ['created_by_admin']),
                ('idx_cards_search', 'cards', ['card_key', 'remarks', 'status']),
                ('idx_cards_bound_email', 'cards', ['bound_email_id']),
                ('idx_http_proxies_search', 'http_proxies', ['name', 'host', 'remarks']),
                ('idx_socks5_proxies_search', 'socks5_proxies', ['name', 'host', 'remarks']),
                # 高级性能优化索引
                ('idx_card_logs_card_created', 'card_logs', ['card_id', 'created_at']),
                ('idx_mail_accounts_id_email', 'mail_accounts', ['id', 'email']),
                ('idx_mail_accounts_server_status', 'mail_accounts', ['server', 'status']),
                ('idx_cards_status_id', 'cards', ['status', 'id']),
                ('idx_cards_key_status', 'cards', ['card_key', 'status']),
                ('idx_http_proxies_status_id', 'http_proxies', ['status', 'id']),
                ('idx_socks5_proxies_status_id', 'socks5_proxies', ['status', 'id']),
                ('idx_http_proxies_name_host', 'http_proxies', ['name', 'host']),
                ('idx_socks5_proxies_name_host', 'socks5_proxies', ['name', 'host']),
                ('idx_mailbox_group_mappings_group_mailbox', 'mailbox_group_mappings', ['group_id', 'mailbox_id'])
            ]
            for idx_name, table_name, columns in indexes:
                try:
                    # 检查索引是否存在
                    cursor.execute(f"SHOW INDEX FROM {table_name} WHERE Key_name = '{idx_name}'")
                    if not cursor.fetchone():
                        cols_str = ', '.join(columns)
                        cursor.execute(f'CREATE INDEX {idx_name} ON {table_name}({cols_str})')
                        logger.info(f"Created index {idx_name} on {table_name}")
                except Exception as e:
                    logger.warning(f"Failed to create index {idx_name}: {e}")
        elif db_type == 'postgresql':
            cursor = db.cursor()
            # PostgreSQL索引创建
            indexes = [
                ('idx_mail_accounts_search', 'mail_accounts', ['email', 'server', 'remarks']),
                ('idx_mail_accounts_created_by_admin', 'mail_accounts', ['created_by_admin']),
                ('idx_cards_search', 'cards', ['card_key', 'remarks', 'status']),
                ('idx_cards_bound_email', 'cards', ['bound_email_id']),
                ('idx_http_proxies_search', 'http_proxies', ['name', 'host', 'remarks']),
                ('idx_socks5_proxies_search', 'socks5_proxies', ['name', 'host', 'remarks']),
                # 高级性能优化索引
                ('idx_card_logs_card_created', 'card_logs', ['card_id', 'created_at']),
                ('idx_mail_accounts_id_email', 'mail_accounts', ['id', 'email']),
                ('idx_mail_accounts_server_status', 'mail_accounts', ['server', 'status']),
                ('idx_cards_status_id', 'cards', ['status', 'id']),
                ('idx_cards_key_status', 'cards', ['card_key', 'status']),
                ('idx_http_proxies_status_id', 'http_proxies', ['status', 'id']),
                ('idx_socks5_proxies_status_id', 'socks5_proxies', ['status', 'id']),
                ('idx_http_proxies_name_host', 'http_proxies', ['name', 'host']),
                ('idx_socks5_proxies_name_host', 'socks5_proxies', ['name', 'host']),
                ('idx_mailbox_group_mappings_group_mailbox', 'mailbox_group_mappings', ['group_id', 'mailbox_id'])
            ]
            for idx_name, table_name, columns in indexes:
                try:
                    # 检查索引是否存在
                    cursor.execute(f"SELECT indexname FROM pg_indexes WHERE tablename = '{table_name}' AND indexname = '{idx_name}'")
                    if not cursor.fetchone():
                        cols_str = ', '.join(columns)
                        cursor.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name}({cols_str})')
                        logger.info(f"Created index {idx_name} on {table_name}")
                except Exception as e:
                    logger.warning(f"Failed to create index {idx_name}: {e}")
        db.commit()
    except Exception as e:
        logger.error(f"Error creating performance indexes: {e}")


def migrate_server_addresses_table(db, db_type):
    """迁移server_addresses表，添加发件服务器相关字段"""
    try:
        new_columns = [
            ('send_server_address', "TEXT DEFAULT ''", "VARCHAR(255) DEFAULT ''"),
            ('default_port_smtp', 'INTEGER DEFAULT 465', 'INT DEFAULT 465'),
            ('send_ssl_enabled', 'INTEGER DEFAULT 1', 'TINYINT DEFAULT 1'),
            ('send_protocol', "TEXT DEFAULT 'smtp'", "VARCHAR(50) DEFAULT 'smtp'")
        ]
        
        for column_name, sqlite_def, other_def in new_columns:
            if db_type == 'sqlite':
                result = db.execute("PRAGMA table_info(server_addresses)").fetchall()
                columns = [col[1] for col in result]
                if column_name not in columns:
                    db.execute(f'ALTER TABLE server_addresses ADD COLUMN {column_name} {sqlite_def}')
                    logger.info(f"Added {column_name} column to server_addresses table")
            else:
                cursor = db.cursor()
                try:
                    if db_type == 'mysql':
                        cursor.execute(f"SHOW COLUMNS FROM server_addresses LIKE '{column_name}'")
                        if not cursor.fetchone():
                            cursor.execute(f'ALTER TABLE server_addresses ADD COLUMN {column_name} {other_def}')
                            logger.info(f"Added {column_name} column to server_addresses table")
                    elif db_type == 'postgresql':
                        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='server_addresses' AND column_name='{column_name}'")
                        if not cursor.fetchone():
                            pg_def = other_def.replace('TINYINT', 'INTEGER')
                            cursor.execute(f'ALTER TABLE server_addresses ADD COLUMN {column_name} {pg_def}')
                            logger.info(f"Added {column_name} column to server_addresses table")
                except Exception as e:
                    logger.error(f"Error checking/adding {column_name} to server_addresses: {e}")
        
        db.commit()
    except Exception as e:
        logger.error(f"Error during server_addresses table migration: {e}")

def migrate_card_logs_table(db, db_type):
    """迁移card_logs表，添加邮件主题字段和绑定邮箱字段"""
    try:
        # Add mail_subject column
        column_name = 'mail_subject'
        if db_type == 'sqlite':
            result = db.execute("PRAGMA table_info(card_logs)").fetchall()
            columns = [col[1] for col in result]
            if column_name not in columns:
                db.execute("ALTER TABLE card_logs ADD COLUMN mail_subject TEXT DEFAULT ''")
                logger.info("Added mail_subject column to card_logs table")
        else:
            cursor = db.cursor()
            try:
                if db_type == 'mysql':
                    cursor.execute(f"SHOW COLUMNS FROM card_logs LIKE '{column_name}'")
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE card_logs ADD COLUMN mail_subject TEXT DEFAULT ''")
                        logger.info("Added mail_subject column to card_logs table")
                elif db_type == 'postgresql':
                    cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='card_logs' AND column_name='{column_name}'")
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE card_logs ADD COLUMN mail_subject TEXT DEFAULT ''")
                        logger.info("Added mail_subject column to card_logs table")
            except Exception as e:
                logger.error(f"Error checking/adding mail_subject to card_logs: {e}")
        
        # Add bound_email column
        column_name = 'bound_email'
        if db_type == 'sqlite':
            result = db.execute("PRAGMA table_info(card_logs)").fetchall()
            columns = [col[1] for col in result]
            if column_name not in columns:
                db.execute("ALTER TABLE card_logs ADD COLUMN bound_email TEXT DEFAULT ''")
                logger.info("Added bound_email column to card_logs table")
        else:
            cursor = db.cursor()
            try:
                if db_type == 'mysql':
                    cursor.execute(f"SHOW COLUMNS FROM card_logs LIKE '{column_name}'")
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE card_logs ADD COLUMN bound_email VARCHAR(255) DEFAULT ''")
                        logger.info("Added bound_email column to card_logs table")
                elif db_type == 'postgresql':
                    cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='card_logs' AND column_name='{column_name}'")
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE card_logs ADD COLUMN bound_email VARCHAR(255) DEFAULT ''")
                        logger.info("Added bound_email column to card_logs table")
            except Exception as e:
                logger.error(f"Error checking/adding bound_email to card_logs: {e}")
        
        db.commit()
    except Exception as e:
        logger.error(f"Error during card_logs table migration: {e}")

def migrate_mailbox_groups_table(db, db_type):
    """迁移 mailbox_groups 表，补充分组计数与创建管理员字段。"""
    try:
        column_name = 'mailbox_count'
        if db_type == 'sqlite':
            result = db.execute("PRAGMA table_info(mailbox_groups)").fetchall()
            columns = [col[1] for col in result]
            if column_name not in columns:
                db.execute("ALTER TABLE mailbox_groups ADD COLUMN mailbox_count INTEGER DEFAULT 0")
                logger.info("Added mailbox_count column to mailbox_groups table")
                
                # Populate mailbox_count for existing groups
                groups = db.execute("SELECT id FROM mailbox_groups").fetchall()
                for group in groups:
                    count = db.execute("""
                        SELECT COUNT(*) as cnt 
                        FROM mailbox_group_mappings 
                        WHERE group_id = ?
                    """, (group['id'],)).fetchone()['cnt']
                    db.execute("UPDATE mailbox_groups SET mailbox_count = ? WHERE id = ?", (count, group['id']))
                logger.info("Populated mailbox_count for existing groups")
            if 'created_by_admin' not in columns:
                db.execute("ALTER TABLE mailbox_groups ADD COLUMN created_by_admin TEXT DEFAULT ''")
                logger.info("Added created_by_admin column to mailbox_groups table")
        else:
            cursor = db.cursor()
            try:
                if db_type == 'mysql':
                    cursor.execute("SHOW COLUMNS FROM mailbox_groups LIKE %s", (column_name,))
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE mailbox_groups ADD COLUMN mailbox_count INT DEFAULT 0")
                        logger.info("Added mailbox_count column to mailbox_groups table")
                        
                        # Populate mailbox_count for existing groups
                        cursor.execute("SELECT id FROM mailbox_groups")
                        groups = cursor.fetchall()
                        for group_row in groups:
                            group_id = group_row[0]
                            cursor.execute("""
                                SELECT COUNT(*) as cnt 
                                FROM mailbox_group_mappings 
                                WHERE group_id = %s
                            """, (group_id,))
                            count = cursor.fetchone()[0]
                            cursor.execute("UPDATE mailbox_groups SET mailbox_count = %s WHERE id = %s", (count, group_id))
                        logger.info("Populated mailbox_count for existing groups")
                    cursor.execute("SHOW COLUMNS FROM mailbox_groups LIKE %s", ('created_by_admin',))
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE mailbox_groups ADD COLUMN created_by_admin VARCHAR(255) DEFAULT ''")
                        logger.info("Added created_by_admin column to mailbox_groups table")
                elif db_type == 'postgresql':
                    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='mailbox_groups' AND column_name=%s", (column_name,))
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE mailbox_groups ADD COLUMN mailbox_count INTEGER DEFAULT 0")
                        logger.info("Added mailbox_count column to mailbox_groups table")
                        
                        # Populate mailbox_count for existing groups
                        cursor.execute("SELECT id FROM mailbox_groups")
                        groups = cursor.fetchall()
                        for group_row in groups:
                            group_id = group_row[0]
                            cursor.execute("""
                                SELECT COUNT(*) as cnt 
                                FROM mailbox_group_mappings 
                                WHERE group_id = %s
                            """, (group_id,))
                            count = cursor.fetchone()[0]
                            cursor.execute("UPDATE mailbox_groups SET mailbox_count = %s WHERE id = %s", (count, group_id))
                        logger.info("Populated mailbox_count for existing groups")
                    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='mailbox_groups' AND column_name=%s", ('created_by_admin',))
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE mailbox_groups ADD COLUMN created_by_admin VARCHAR(255) DEFAULT ''")
                        logger.info("Added created_by_admin column to mailbox_groups table")
            except Exception as e:
                logger.error(f"Error checking/adding mailbox_count to mailbox_groups: {e}")
        db.commit()
    except Exception as e:
        logger.error(f"Error during mailbox_groups table migration: {e}")

def create_mailbox_groups_tables(db, db_type):
    """创建邮箱分组管理表"""
    try:
        if db_type == 'sqlite':
            # Create mailbox_groups table
            db.execute('''
                CREATE TABLE IF NOT EXISTS mailbox_groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    parent_id INTEGER DEFAULT NULL,
                    sort_order INTEGER DEFAULT 0,
                    is_expanded INTEGER DEFAULT 1,
                    mailbox_count INTEGER DEFAULT 0,
                    created_by_admin TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE
                )
            ''')
            
            # Create mailbox_group_mappings table
            db.execute('''
                CREATE TABLE IF NOT EXISTS mailbox_group_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mailbox_id INTEGER NOT NULL,
                    group_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (group_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                    UNIQUE(mailbox_id, group_id)
                )
            ''')
            
            # Create indexes
            db.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_groups_parent ON mailbox_groups(parent_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_group_mappings_mailbox ON mailbox_group_mappings(mailbox_id)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_group_mappings_group ON mailbox_group_mappings(group_id)')
            
        elif db_type == 'mysql':
            cursor = db.cursor()
            
            # Create mailbox_groups table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS mailbox_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    parent_id INT DEFAULT NULL,
                    sort_order INT DEFAULT 0,
                    is_expanded TINYINT DEFAULT 1,
                    mailbox_count INT DEFAULT 0,
                    created_by_admin VARCHAR(255) DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                    INDEX idx_parent (parent_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            
            # Create mailbox_group_mappings table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS mailbox_group_mappings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    mailbox_id INT NOT NULL,
                    group_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (group_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_mapping (mailbox_id, group_id),
                    INDEX idx_mailbox (mailbox_id),
                    INDEX idx_group (group_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ''')
            
        elif db_type == 'postgresql':
            cursor = db.cursor()
            
            # Create mailbox_groups table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS mailbox_groups (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    parent_id INTEGER DEFAULT NULL,
                    sort_order INTEGER DEFAULT 0,
                    is_expanded INTEGER DEFAULT 1,
                    mailbox_count INTEGER DEFAULT 0,
                    created_by_admin VARCHAR(255) DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE
                )
            ''')
            
            # Create mailbox_group_mappings table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS mailbox_group_mappings (
                    id SERIAL PRIMARY KEY,
                    mailbox_id INTEGER NOT NULL,
                    group_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (mailbox_id) REFERENCES mail_accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (group_id) REFERENCES mailbox_groups(id) ON DELETE CASCADE,
                    UNIQUE(mailbox_id, group_id)
                )
            ''')
            
            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_groups_parent ON mailbox_groups(parent_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_group_mappings_mailbox ON mailbox_group_mappings(mailbox_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_mailbox_group_mappings_group ON mailbox_group_mappings(group_id)')
        
        logger.info("Mailbox groups tables created successfully")
        db.commit()
        
    except Exception as e:
        logger.error(f"Failed to create mailbox groups tables: {e}")
        raise

def assign_unified_ids_to_existing_proxies(db, db_type):
    """为现有代理分配统一ID（按创建时间顺序，确保ID连续）"""
    try:
        # 获取所有需要分配unified_id的代理，按创建时间排序
        all_proxies = []
        
        if db_type == 'sqlite':
            # 获取HTTP代理
            http_proxies = db.execute('SELECT id, created_at FROM http_proxies WHERE unified_id = 0 ORDER BY created_at ASC, id ASC').fetchall()
            for proxy in http_proxies:
                all_proxies.append(('http', proxy['id'], proxy['created_at']))
            
            # 获取SOCKS5代理
            socks5_proxies = db.execute('SELECT id, created_at FROM socks5_proxies WHERE unified_id = 0 ORDER BY created_at ASC, id ASC').fetchall()
            for proxy in socks5_proxies:
                all_proxies.append(('socks5', proxy['id'], proxy['created_at']))
        else:
            cursor = db.cursor()
            # 获取HTTP代理
            cursor.execute('SELECT id, created_at FROM http_proxies WHERE unified_id = 0 ORDER BY created_at ASC, id ASC')
            http_proxies = cursor.fetchall()
            for proxy in http_proxies:
                all_proxies.append(('http', proxy[0], proxy[1]))
                
            # 获取SOCKS5代理
            cursor.execute('SELECT id, created_at FROM socks5_proxies WHERE unified_id = 0 ORDER BY created_at ASC, id ASC')
            socks5_proxies = cursor.fetchall()
            for proxy in socks5_proxies:
                all_proxies.append(('socks5', proxy[0], proxy[1]))
        
        # 按创建时间排序所有代理，确保ID是连续的
        all_proxies.sort(key=lambda x: (x[2], x[1]))  # 按创建时间，然后按ID排序
        
        # 为每个代理分配统一ID
        for proxy_type, proxy_id, created_at in all_proxies:
            unified_id = get_next_unified_proxy_id(db, proxy_type, proxy_id)
            table_name = f'{proxy_type}_proxies'
            update_proxy_unified_id(db, table_name, proxy_id, unified_id)
        
        logger.info(f"Assigned unified IDs to {len(all_proxies)} existing proxies")
        
    except Exception as e:
        logger.error(f"Error assigning unified IDs to existing proxies: {e}")

@app.teardown_appcontext
def close_db(exception):
    """关闭数据库连接 - 优化版本"""
    db = getattr(g, '_database', None)
    if db is not None:
        db_type = app.config['DATABASE_TYPE']
        try:
            if db_type == 'sqlite':
                db.close()
            elif db_type == 'mysql':
                if hasattr(app, '_mysql_pool'):
                    # 返回连接到连接池
                    db.close()
                else:
                    db.close()
            elif db_type == 'postgresql':
                if hasattr(app, '_postgres_pool'):
                    # 返回连接到连接池
                    app._postgres_pool.putconn(db)
                else:
                    db.close()
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")
        finally:
            g._database = None

def get_account_count():
    """获取邮箱账号总数"""
    try:
        db = get_db()
        result = db.execute('SELECT COUNT(*) as count FROM mail_accounts').fetchone()
        return result['count'] if result else 0
    except:
        return 0

def get_card_count():
    """获取卡密总数"""
    try:
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        if db_type == 'sqlite':
            result = db.execute('SELECT COUNT(*) as count FROM cards').fetchone()
            return result['count'] if result else 0
        else:
            cursor = db.cursor()
            cursor.execute('SELECT COUNT(*) as count FROM cards')
            result = cursor.fetchone()
            return result[0] if result else 0
    except Exception as e:
        logger.error(f"Error getting card count: {e}")
        return 0

def get_available_proxy_count():
    """获取代理池中可用代理数量（HTTP + SOCKS5）"""
    try:
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        if db_type == 'sqlite':
            # 统计启用状态的HTTP代理
            http_result = db.execute('SELECT COUNT(*) as count FROM http_proxies WHERE status = 1').fetchone()
            http_count = http_result['count'] if http_result else 0
            
            # 统计启用状态的SOCKS5代理
            socks5_result = db.execute('SELECT COUNT(*) as count FROM socks5_proxies WHERE status = 1').fetchone()
            socks5_count = socks5_result['count'] if socks5_result else 0
            
            return http_count + socks5_count
        else:
            cursor = db.cursor()
            # 统计启用状态的HTTP代理
            cursor.execute('SELECT COUNT(*) as count FROM http_proxies WHERE status = 1')
            http_result = cursor.fetchone()
            http_count = http_result[0] if http_result else 0
            
            # 统计启用状态的SOCKS5代理
            cursor.execute('SELECT COUNT(*) as count FROM socks5_proxies WHERE status = 1')
            socks5_result = cursor.fetchone()
            socks5_count = socks5_result[0] if socks5_result else 0
            
            return http_count + socks5_count
    except Exception as e:
        logger.error(f"Error getting available proxy count: {e}")
        return 0

def get_next_unified_proxy_id(db, proxy_type, proxy_table_id):
    """获取下一个统一代理ID - 查找最小可用ID或创建新ID"""
    try:
        db_type = app.config['DATABASE_TYPE']
        
        # 查找最小的可用ID（被删除后留下的空隙）
        if db_type == 'sqlite':
            # 获取所有现有的ID
            result = db.execute('SELECT id FROM unified_proxy_ids ORDER BY id').fetchall()
            existing_ids = [row['id'] for row in result]
            
            # 查找第一个空缺的ID
            next_id = 1
            for existing_id in existing_ids:
                if existing_id > next_id:
                    break
                next_id = existing_id + 1
            
            # 插入到统一ID管理表，使用找到的ID
            db.execute('''
                INSERT INTO unified_proxy_ids (id, proxy_type, proxy_table_id)
                VALUES (?, ?, ?)
            ''', (next_id, proxy_type, proxy_table_id))
            unified_id = next_id
        else:
            cursor = db.cursor()
            # 获取所有现有的ID
            cursor.execute('SELECT id FROM unified_proxy_ids ORDER BY id')
            result = cursor.fetchall()
            existing_ids = [row[0] for row in result]
            
            # 查找第一个空缺的ID
            next_id = 1
            for existing_id in existing_ids:
                if existing_id > next_id:
                    break
                next_id = existing_id + 1
            
            # 插入到统一ID管理表，使用找到的ID
            cursor.execute('''
                INSERT INTO unified_proxy_ids (id, proxy_type, proxy_table_id)
                VALUES (%s, %s, %s)
            ''', (next_id, proxy_type, proxy_table_id))
            unified_id = next_id
        
        return unified_id
    except Exception as e:
        logger.error(f"Error getting unified proxy ID: {e}")
        raise

def reorder_unified_proxy_ids(db, db_type):
    """重新排序统一代理ID，确保删除后ID连续"""
    try:
        # 首先为没有unified_id的代理分配ID
        assign_unified_ids_to_existing_proxies(db, db_type)
        
        # 获取所有有效的统一ID记录，按创建时间和ID排序
        if db_type == 'sqlite':
            unified_records = db.execute('''
                SELECT upi.id, upi.proxy_type, upi.proxy_table_id, upi.created_at
                FROM unified_proxy_ids upi
                WHERE EXISTS (
                    SELECT 1 FROM http_proxies hp WHERE hp.id = upi.proxy_table_id AND upi.proxy_type = 'http'
                    UNION
                    SELECT 1 FROM socks5_proxies sp WHERE sp.id = upi.proxy_table_id AND upi.proxy_type = 'socks5'
                )
                ORDER BY upi.created_at, upi.id
            ''').fetchall()
        else:
            cursor = db.cursor()
            cursor.execute('''
                SELECT upi.id, upi.proxy_type, upi.proxy_table_id, upi.created_at
                FROM unified_proxy_ids upi
                WHERE EXISTS (
                    SELECT 1 FROM http_proxies hp WHERE hp.id = upi.proxy_table_id AND upi.proxy_type = 'http'
                    UNION
                    SELECT 1 FROM socks5_proxies sp WHERE sp.id = upi.proxy_table_id AND upi.proxy_type = 'socks5'
                )
                ORDER BY upi.created_at, upi.id
            ''')
            unified_records = cursor.fetchall()
        
        # 如果没有记录，直接返回
        if not unified_records:
            logger.info("No proxy records to reorder")
            return
        
        # 创建一个临时表来重新分配ID
        temp_table = 'unified_proxy_ids_temp'
        
        if db_type == 'sqlite':
            # 创建临时表
            db.execute(f'''
                CREATE TABLE {temp_table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    proxy_type TEXT NOT NULL,
                    proxy_table_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 按顺序重新插入数据（自动分配新的连续ID）
            for record in unified_records:
                proxy_type = record[1]
                proxy_table_id = record[2]
                created_at = record[3]
                
                db.execute(f'''
                    INSERT INTO {temp_table} (proxy_type, proxy_table_id, created_at)
                    VALUES (?, ?, ?)
                ''', (proxy_type, proxy_table_id, created_at))
            
            # 删除原表并重命名
            db.execute('DROP TABLE unified_proxy_ids')
            db.execute(f'ALTER TABLE {temp_table} RENAME TO unified_proxy_ids')
            
            # 重建索引
            db.execute('CREATE INDEX IF NOT EXISTS idx_unified_proxy_ids_type ON unified_proxy_ids(proxy_type)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_unified_proxy_ids_table_id ON unified_proxy_ids(proxy_table_id)')
            
            # 更新代理表中的unified_id
            http_records = db.execute('''
                SELECT upi.id, upi.proxy_table_id 
                FROM unified_proxy_ids upi 
                WHERE upi.proxy_type = 'http'
            ''').fetchall()
            
            for unified_id, proxy_table_id in http_records:
                db.execute('UPDATE http_proxies SET unified_id = ? WHERE id = ?', (unified_id, proxy_table_id))
            
            socks5_records = db.execute('''
                SELECT upi.id, upi.proxy_table_id 
                FROM unified_proxy_ids upi 
                WHERE upi.proxy_type = 'socks5'
            ''').fetchall()
            
            for unified_id, proxy_table_id in socks5_records:
                db.execute('UPDATE socks5_proxies SET unified_id = ? WHERE id = ?', (unified_id, proxy_table_id))
                
        else:
            # MySQL/PostgreSQL处理（类似逻辑）
            cursor = db.cursor()
            
            # 创建临时表
            if db_type == 'mysql':
                cursor.execute(f'''
                    CREATE TABLE {temp_table} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        proxy_type VARCHAR(50) NOT NULL,
                        proxy_table_id INT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ''')
            else:  # PostgreSQL
                cursor.execute(f'''
                    CREATE TABLE {temp_table} (
                        id SERIAL PRIMARY KEY,
                        proxy_type VARCHAR(50) NOT NULL,
                        proxy_table_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
            
            # 重新插入数据
            for record in unified_records:
                proxy_type = record[1]
                proxy_table_id = record[2]
                created_at = record[3]
                
                cursor.execute(f'''
                    INSERT INTO {temp_table} (proxy_type, proxy_table_id, created_at)
                    VALUES (%s, %s, %s)
                ''', (proxy_type, proxy_table_id, created_at))
            
            # 删除原表并重命名
            cursor.execute('DROP TABLE unified_proxy_ids')
            cursor.execute(f'ALTER TABLE {temp_table} RENAME TO unified_proxy_ids')
            
            # 重建索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_unified_proxy_ids_type ON unified_proxy_ids(proxy_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_unified_proxy_ids_table_id ON unified_proxy_ids(proxy_table_id)')
            
            # 更新代理表
            cursor.execute('''
                UPDATE http_proxies hp 
                SET unified_id = (
                    SELECT upi.id FROM unified_proxy_ids upi 
                    WHERE upi.proxy_type = 'http' AND upi.proxy_table_id = hp.id
                )
                WHERE EXISTS (
                    SELECT 1 FROM unified_proxy_ids upi 
                    WHERE upi.proxy_type = 'http' AND upi.proxy_table_id = hp.id
                )
            ''')
            
            cursor.execute('''
                UPDATE socks5_proxies sp 
                SET unified_id = (
                    SELECT upi.id FROM unified_proxy_ids upi 
                    WHERE upi.proxy_type = 'socks5' AND upi.proxy_table_id = sp.id
                )
                WHERE EXISTS (
                    SELECT 1 FROM unified_proxy_ids upi 
                    WHERE upi.proxy_type = 'socks5' AND upi.proxy_table_id = sp.id
                )
            ''')
        
        if db_type != 'sqlite':
            db.commit()
        else:
            db.commit()
            
        logger.info("Proxy unified IDs reordered successfully")
        
    except Exception as e:
        logger.error(f"Error reordering proxy unified IDs: {e}")
        if db_type != 'sqlite':
            try:
                db.rollback()
            except:
                pass

def cleanup_orphaned_proxy_ids(db, db_type):
    """清理孤立的统一代理ID记录（代理已删除但unified_proxy_ids中还有记录）但不重新排序ID"""
    try:
        # 删除孤立的统一ID记录（对应的代理不存在）
        if db_type == 'sqlite':
            db.execute('''
                DELETE FROM unified_proxy_ids
                WHERE NOT EXISTS (
                    SELECT 1 FROM http_proxies hp WHERE hp.id = unified_proxy_ids.proxy_table_id AND unified_proxy_ids.proxy_type = 'http'
                    UNION
                    SELECT 1 FROM socks5_proxies sp WHERE sp.id = unified_proxy_ids.proxy_table_id AND unified_proxy_ids.proxy_type = 'socks5'
                )
            ''')
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('''
                DELETE FROM unified_proxy_ids
                WHERE NOT EXISTS (
                    SELECT 1 FROM http_proxies hp WHERE hp.id = unified_proxy_ids.proxy_table_id AND unified_proxy_ids.proxy_type = 'http'
                    UNION
                    SELECT 1 FROM socks5_proxies sp WHERE sp.id = unified_proxy_ids.proxy_table_id AND unified_proxy_ids.proxy_type = 'socks5'
                )
            ''')
            db.commit()
        
        logger.info("Orphaned proxy unified IDs cleaned up successfully")
        
    except Exception as e:
        logger.error(f"Error cleaning up orphaned proxy unified IDs: {e}")
        if db_type != 'sqlite':
            try:
                db.rollback()
            except:
                pass

def update_mailbox_group_count(db, db_type, group_id, delta=None):
    """更新邮箱分组的mailbox_count字段
    
    Args:
        db: 数据库连接
        db_type: 数据库类型
        group_id: 分组ID
        delta: 增量值（可选）。如果提供，则增加或减少计数；如果为None，则重新计算总数
    """
    try:
        if delta is not None:
            # 增量更新
            if db_type == 'sqlite':
                db.execute("""
                    UPDATE mailbox_groups 
                    SET mailbox_count = MAX(0, mailbox_count + ?), 
                        updated_at = ?
                    WHERE id = ?
                """, (delta, get_beijing_time(), group_id))
            else:
                cursor = db.cursor()
                cursor.execute("""
                    UPDATE mailbox_groups 
                    SET mailbox_count = GREATEST(0, mailbox_count + %s), 
                        updated_at = %s
                    WHERE id = %s
                """, (delta, get_beijing_time(), group_id))
        else:
            # 重新计算总数 - 只计算存在的邮箱，不包括已删除的
            if db_type == 'sqlite':
                count_result = db.execute("""
                    SELECT COUNT(*) as cnt 
                    FROM mailbox_group_mappings m
                    INNER JOIN mail_accounts a ON m.mailbox_id = a.id
                    WHERE m.group_id = ?
                """, (group_id,)).fetchone()
                count = count_result['cnt'] if count_result else 0
                db.execute("""
                    UPDATE mailbox_groups 
                    SET mailbox_count = ?, 
                        updated_at = ?
                    WHERE id = ?
                """, (count, get_beijing_time(), group_id))
            else:
                cursor = db.cursor()
                cursor.execute("""
                    SELECT COUNT(*) as cnt 
                    FROM mailbox_group_mappings m
                    INNER JOIN mail_accounts a ON m.mailbox_id = a.id
                    WHERE m.group_id = %s
                """, (group_id,))
                count = cursor.fetchone()[0]
                cursor.execute("""
                    UPDATE mailbox_groups 
                    SET mailbox_count = %s, 
                        updated_at = %s
                    WHERE id = %s
                """, (count, get_beijing_time(), group_id))
        
        logger.debug(f"Updated mailbox count for group {group_id}")
    except Exception as e:
        logger.error(f"Error updating mailbox group count: {e}")

def reorder_mailbox_ids(db, db_type):
    """重新排序邮箱ID，确保删除后ID连续"""
    try:
        # 获取所有邮箱记录，按ID排序确保稳定的顺序
        if db_type == 'sqlite':
            mailboxes = db.execute('SELECT * FROM mail_accounts ORDER BY id ASC').fetchall()
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM mail_accounts ORDER BY id ASC')
            fetched_mailboxes = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            mailboxes = [dict(zip(columns, mailbox)) for mailbox in fetched_mailboxes]
        
        if not mailboxes:
            return
        
        # 创建临时表来重新插入数据
        temp_table_name = f'mail_accounts_temp_{int(time.time())}'
        
        if db_type == 'sqlite':
            # 创建临时表
            db.execute(f'''
                CREATE TABLE {temp_table_name} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL,
                    server TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    protocol TEXT NOT NULL DEFAULT 'imap',
                    ssl INTEGER NOT NULL DEFAULT 1,
                    send_server TEXT DEFAULT '',
                    send_port INTEGER DEFAULT 465,
                    send_protocol TEXT NOT NULL DEFAULT 'smtp',
                    send_ssl INTEGER NOT NULL DEFAULT 1,
                    remarks TEXT DEFAULT '',
                    auth_type TEXT DEFAULT 'password',
                    oauth_client_id TEXT DEFAULT '',
                    oauth_refresh_token TEXT DEFAULT '',
                    status INTEGER DEFAULT 1,
                    last_test DATETIME DEFAULT NULL,
                    test_result TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 重新插入数据（ID将自动重新排序）
            for mailbox in mailboxes:
                mailbox_dict = dict(mailbox)
                db.execute(f'''
                    INSERT INTO {temp_table_name} 
                    (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, status, last_test, test_result, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    mailbox_dict['email'], mailbox_dict['username'], mailbox_dict['password'],
                    mailbox_dict['server'], mailbox_dict['port'], mailbox_dict['protocol'],
                    mailbox_dict.get('ssl', 1), mailbox_dict.get('send_server', ''), mailbox_dict.get('send_port', 465),
                    mailbox_dict.get('send_protocol', 'smtp'), mailbox_dict.get('send_ssl', 1),
                    mailbox_dict['remarks'], mailbox_dict.get('auth_type', 'password'),
                    mailbox_dict.get('oauth_client_id', ''), mailbox_dict.get('oauth_refresh_token', ''),
                    mailbox_dict['status'],
                    mailbox_dict['last_test'], mailbox_dict['test_result'],
                    mailbox_dict['created_at'], mailbox_dict['updated_at']
                ))
            
            # 删除原表并重命名临时表
            db.execute('DROP TABLE mail_accounts')
            db.execute(f'ALTER TABLE {temp_table_name} RENAME TO mail_accounts')
            
        else:
            # MySQL/PostgreSQL处理方式
            cursor = db.cursor()
            
            # 创建临时表
            if db_type == 'mysql':
                cursor.execute(f'''
                    CREATE TABLE {temp_table_name} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(255) NOT NULL UNIQUE,
                        username TEXT NOT NULL,
                        password TEXT NOT NULL,
                        server TEXT NOT NULL,
                        port INT NOT NULL,
                        protocol VARCHAR(50) NOT NULL DEFAULT 'imap',
                        ssl TINYINT NOT NULL DEFAULT 1,
                        send_server TEXT DEFAULT '',
                        send_port INT DEFAULT 465,
                        send_protocol VARCHAR(50) NOT NULL DEFAULT 'smtp',
                        send_ssl TINYINT NOT NULL DEFAULT 1,
                        remarks TEXT DEFAULT '',
                        auth_type VARCHAR(50) DEFAULT 'password',
                        oauth_client_id TEXT DEFAULT '',
                        oauth_refresh_token TEXT DEFAULT '',
                        status TINYINT DEFAULT 1,
                        last_test DATETIME DEFAULT NULL,
                        test_result TEXT DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ''')
            else:  # PostgreSQL
                cursor.execute(f'''
                    CREATE TABLE {temp_table_name} (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) NOT NULL UNIQUE,
                        username TEXT NOT NULL,
                        password TEXT NOT NULL,
                        server TEXT NOT NULL,
                        port INTEGER NOT NULL,
                        protocol VARCHAR(50) NOT NULL DEFAULT 'imap',
                        ssl INTEGER NOT NULL DEFAULT 1,
                        send_server TEXT DEFAULT '',
                        send_port INTEGER DEFAULT 465,
                        send_protocol VARCHAR(50) NOT NULL DEFAULT 'smtp',
                        send_ssl INTEGER NOT NULL DEFAULT 1,
                        remarks TEXT DEFAULT '',
                        auth_type VARCHAR(50) DEFAULT 'password',
                        oauth_client_id TEXT DEFAULT '',
                        oauth_refresh_token TEXT DEFAULT '',
                        status INTEGER DEFAULT 1,
                        last_test TIMESTAMP DEFAULT NULL,
                        test_result TEXT DEFAULT '',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
            
            # 重新插入数据
            for mailbox_dict in mailboxes:
                cursor.execute(f'''
                    INSERT INTO {temp_table_name} 
                    (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, status, last_test, test_result, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (
                    mailbox_dict.get('email'), mailbox_dict.get('username'), mailbox_dict.get('password'),
                    mailbox_dict.get('server'), mailbox_dict.get('port'), mailbox_dict.get('protocol'),
                    mailbox_dict.get('ssl', 1), mailbox_dict.get('send_server', ''), mailbox_dict.get('send_port', 465),
                    mailbox_dict.get('send_protocol', 'smtp'), mailbox_dict.get('send_ssl', 1),
                    mailbox_dict.get('remarks'), mailbox_dict.get('auth_type', 'password'),
                    mailbox_dict.get('oauth_client_id', ''), mailbox_dict.get('oauth_refresh_token', ''),
                    mailbox_dict.get('status'),
                    mailbox_dict.get('last_test'), mailbox_dict.get('test_result'),
                    mailbox_dict.get('created_at'), mailbox_dict.get('updated_at')
                ))
            
            # 删除原表并重命名临时表
            cursor.execute('DROP TABLE mail_accounts')
            cursor.execute(f'ALTER TABLE {temp_table_name} RENAME TO mail_accounts')
            
        if db_type != 'sqlite':
            db.commit()
        else:
            db.commit()
            
        logger.info("Mailbox IDs reordered successfully")
        
    except Exception as e:
        logger.error(f"Error reordering mailbox IDs: {e}")
        if db_type != 'sqlite':
            try:
                db.rollback()
            except:
                pass

def update_proxy_unified_id(db, table_name, proxy_id, unified_id):
    """更新代理的统一ID"""
    try:
        db_type = app.config['DATABASE_TYPE']
        
        if db_type == 'sqlite':
            db.execute(f'''
                UPDATE {table_name} SET unified_id = ? WHERE id = ?
            ''', (unified_id, proxy_id))
        else:
            cursor = db.cursor()
            cursor.execute(f'''
                UPDATE {table_name} SET unified_id = %s WHERE id = %s
            ''', (unified_id, proxy_id))
            
    except Exception as e:
        logger.error(f"Error updating proxy unified ID: {e}")
        raise

# ===============================
# 前端页面路由
# ===============================

def render_react_app(page_title=None, **props):
    """Render the front-end app while keeping Flask APIs unchanged."""
    system_title = get_system_config('system_title', '邮件查看系统')
    resolved_title = page_title or system_title
    app_props = {
        'systemTitle': system_title,
        'pageTitle': resolved_title,
        'adminUsername': session.get('admin_username', ''),
        'adminLoginTitle': get_system_config('admin_login_title', '管理员登录'),
        'path': request.path
    }
    app_props.update(props)
    return render_template(
        'react_app.html',
        page_title=resolved_title,
        app_props=app_props
    )

@app.route('/')
def index():
    """前端首页 - 邮件查看"""
    frontend_title = get_system_config('frontend_page_title', '邮件查看系统')
    return render_react_app(page_title=frontend_title)

@app.route('/legacy/')
def legacy_index():
    """Legacy public mail viewer embedded by the React shell."""
    frontend_title = get_system_config('frontend_page_title', '邮件查看系统')
    return render_template(
        'frontend/index.html',
        page_title=frontend_title,
        embedded=request.args.get('embedded') == '1'
    )


SUPPORTED_PUBLIC_LANGUAGES = ('zh', 'en', 'vi')
CHINESE_LANGUAGE_COUNTRIES = {'CN', 'HK', 'MO', 'TW'}
COUNTRY_HEADER_NAMES = (
    'CF-IPCountry',
    'CloudFront-Viewer-Country',
    'X-Vercel-IP-Country',
    'X-Country-Code',
    'X-AppEngine-Country',
)


def _normalize_country_code(value):
    """Return a usable ISO-style country code or an empty string."""
    country = str(value or '').strip().upper()
    if len(country) == 2 and country.isalpha() and country not in {'XX'}:
        return country
    return ''


def _get_request_country_header():
    for header_name in COUNTRY_HEADER_NAMES:
        country = _normalize_country_code(request.headers.get(header_name))
        if country:
            return country
    return ''


def _get_client_ip():
    """Resolve the visitor IP used only for locale recommendation."""
    candidates = [
        request.headers.get('CF-Connecting-IP', ''),
        request.headers.get('X-Real-IP', ''),
        (request.headers.get('X-Forwarded-For', '').split(',', 1)[0]),
        request.remote_addr or '',
    ]
    for candidate in candidates:
        value = str(candidate or '').strip()
        if not value:
            continue
        try:
            return str(ipaddress.ip_address(value))
        except ValueError:
            continue
    return ''


def _lookup_country_for_ip(client_ip):
    """Look up a public IP country with a short timeout and a 24-hour cache."""
    try:
        address = ipaddress.ip_address(client_ip)
    except ValueError:
        return ''
    if not address.is_global:
        return ''

    now = time.time()
    with IP_COUNTRY_CACHE_LOCK:
        cached = IP_COUNTRY_CACHE.get(client_ip)
        if cached and cached['expires_at'] > now:
            return cached['country']

    country = ''
    try:
        response = requests.get(
            f'https://ipapi.co/{client_ip}/country/',
            headers={'User-Agent': 'mail-viewer-language-detection/1.0'},
            timeout=2.5,
        )
        if response.ok:
            country = _normalize_country_code(response.text)
    except requests.RequestException as error:
        logger.info('IP country lookup unavailable for %s: %s', client_ip, error)

    with IP_COUNTRY_CACHE_LOCK:
        IP_COUNTRY_CACHE[client_ip] = {
            'country': country,
            'expires_at': now + (IP_COUNTRY_CACHE_TTL if country else 60 * 60),
        }
    return country


def _language_for_country(country):
    if country == 'VN':
        return 'vi'
    if country in CHINESE_LANGUAGE_COUNTRIES:
        return 'zh'
    return 'en'


def _language_from_accept_header():
    best = request.accept_languages.best_match(
        ['zh-CN', 'zh-TW', 'zh', 'vi-VN', 'vi', 'en'],
        default='en',
    )
    normalized = str(best or 'en').lower()
    if normalized.startswith('zh'):
        return 'zh'
    if normalized.startswith('vi'):
        return 'vi'
    return 'en'


@app.route('/api/language', methods=['GET'])
def api_public_language():
    """Recommend the public UI language from the visitor's IP country."""
    country = _get_request_country_header()
    source = 'country_header' if country else ''
    if not country:
        client_ip = _get_client_ip()
        country = _lookup_country_for_ip(client_ip) if client_ip else ''
        source = 'ip_lookup' if country else ''

    language = _language_for_country(country) if country else _language_from_accept_header()
    return jsonify({
        'success': True,
        'language': language if language in SUPPORTED_PUBLIC_LANGUAGES else 'en',
        'country': country or None,
        'source': source or 'accept_language',
    })

# ===============================
# 管理员认证相关路由
# ===============================

@app.route('/admin')
@app.route('/admin/')
def admin_index():
    """管理员后台入口"""
    if session.get('admin_logged_in'):
        return redirect(url_for('admin_home'))
    return redirect(url_for('admin_login'))

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """管理员登录"""
    if session.get('admin_logged_in'):
        return redirect(url_for('admin_home'))
    
    error = ''
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        
        if username and password:
            try:
                db = get_db()
                admin = db.execute('SELECT * FROM admin_users WHERE username = ?', (username,)).fetchone()
                
                # 密码验证（支持兼容性检查）
                if admin:
                    # 检查是否为新的加密密码格式
                    if admin['password'].startswith('pbkdf2:') or admin['password'].startswith('scrypt:'):
                        # 使用werkzeug验证加密密码
                        if check_password_hash(admin['password'], password):
                            session['admin_logged_in'] = True
                            session['admin_id'] = admin['id']
                            session['admin_username'] = admin['username']
                            return redirect(url_for('admin_home'))
                        else:
                            error = '用户名或密码错误'
                    else:
                        # 兼容原有明文密码
                        if admin['password'] == password:
                            session['admin_logged_in'] = True
                            session['admin_id'] = admin['id']
                            session['admin_username'] = admin['username']
                            return redirect(url_for('admin_home'))
                        else:
                            error = '用户名或密码错误'
                else:
                    error = '用户名或密码错误'
            except Exception as e:
                error = f'数据库连接失败：{str(e)}'
        else:
            error = '请输入用户名和密码'
    
    return render_react_app(
        page_title=get_system_config('admin_login_title', '管理员登录'),
        loginError=error
    )

@app.route('/admin/logout')
def admin_logout():
    """管理员退出登录"""
    session.clear()
    return redirect(url_for('admin_login'))

def admin_required(f):
    """管理员权限装饰器"""
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def _get_admin_mailbox_scope(db, admin_id):
    """返回受限管理员的范围配置；未受限时返回 None。"""
    admin_id = safe_int(admin_id, 0)
    if admin_id <= 0:
        return None
    db_type = app.config['DATABASE_TYPE']
    try:
        if db_type == 'sqlite':
            row = db.execute('''
                SELECT s.restricted_admin_id, s.manager_admin_id,
                       restricted.username AS restricted_username,
                       manager.username AS manager_username
                FROM admin_mailbox_scopes s
                JOIN admin_users restricted ON restricted.id = s.restricted_admin_id
                JOIN admin_users manager ON manager.id = s.manager_admin_id
                WHERE s.restricted_admin_id = ?
            ''', (admin_id,)).fetchone()
            return dict(row) if row else None

        cursor = db.cursor()
        cursor.execute('''
            SELECT s.restricted_admin_id, s.manager_admin_id,
                   restricted.username AS restricted_username,
                   manager.username AS manager_username
            FROM admin_mailbox_scopes s
            JOIN admin_users restricted ON restricted.id = s.restricted_admin_id
            JOIN admin_users manager ON manager.id = s.manager_admin_id
            WHERE s.restricted_admin_id = %s
        ''', (admin_id,))
        row = cursor.fetchone()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        cursor.close()
        return _row_to_dict(row, columns) if row else None
    except Exception as e:
        # 测试库或尚未迁移的旧库没有权限表时，保持原有不受限行为。
        logger.debug(f"Admin mailbox scope lookup skipped: {e}")
        return None

def _get_current_admin_mailbox_scope(db=None):
    if not session.get('admin_logged_in'):
        return None
    return _get_admin_mailbox_scope(db or get_db(), session.get('admin_id'))

def _mailbox_scope_condition(db, alias=''):
    """生成当前管理员可见邮箱的 SQL 条件和参数。"""
    scope = _get_current_admin_mailbox_scope(db)
    if not scope:
        return '', []
    prefix = f'{alias}.' if alias else ''
    placeholder = '?' if app.config['DATABASE_TYPE'] == 'sqlite' else '%s'
    condition = f'''(
        LOWER(TRIM(COALESCE({prefix}created_by_admin, ''))) = LOWER({placeholder})
        OR EXISTS (
            SELECT 1 FROM admin_mailbox_permissions amp
            WHERE amp.admin_id = {placeholder}
              AND amp.mailbox_id = {prefix}id
        )
        OR EXISTS (
            SELECT 1
            FROM mailbox_group_mappings scope_mapping
            JOIN admin_mailbox_group_permissions scope_group_permission
              ON scope_group_permission.group_id = scope_mapping.group_id
            WHERE scope_group_permission.admin_id = {placeholder}
              AND scope_mapping.mailbox_id = {prefix}id
        )
    )'''
    return condition, [
        session.get('admin_username', ''),
        scope['restricted_admin_id'],
        scope['restricted_admin_id'],
    ]

def _mailbox_log_scope_condition(db, log_alias='l', email_column='email'):
    """生成按日志邮箱地址过滤的 SQL 条件。"""
    scope = _get_current_admin_mailbox_scope(db)
    if not scope:
        return '', []
    placeholder = '?' if app.config['DATABASE_TYPE'] == 'sqlite' else '%s'
    condition = f'''EXISTS (
        SELECT 1
        FROM mail_accounts scope_mailbox
        WHERE LOWER(TRIM(COALESCE(scope_mailbox.email, ''))) =
              LOWER(TRIM(COALESCE({log_alias}.{email_column}, '')))
          AND (
              LOWER(TRIM(COALESCE(scope_mailbox.created_by_admin, ''))) = LOWER({placeholder})
              OR EXISTS (
                  SELECT 1 FROM admin_mailbox_permissions scope_permission
                  WHERE scope_permission.admin_id = {placeholder}
                    AND scope_permission.mailbox_id = scope_mailbox.id
              )
              OR EXISTS (
                  SELECT 1
                  FROM mailbox_group_mappings scope_mapping
                  JOIN admin_mailbox_group_permissions scope_group_permission
                    ON scope_group_permission.group_id = scope_mapping.group_id
                  WHERE scope_group_permission.admin_id = {placeholder}
                    AND scope_mapping.mailbox_id = scope_mailbox.id
              )
          )
    )'''
    return condition, [
        session.get('admin_username', ''),
        scope['restricted_admin_id'],
        scope['restricted_admin_id'],
    ]

def _can_access_mailbox(db, mailbox_id):
    mailbox_id = safe_int(mailbox_id, 0)
    if mailbox_id <= 0:
        return False
    condition, params = _mailbox_scope_condition(db, 'ma')
    if not condition:
        return True
    db_type = app.config['DATABASE_TYPE']
    if db_type == 'sqlite':
        row = db.execute(
            f'SELECT ma.id FROM mail_accounts ma WHERE ma.id = ? AND {condition} LIMIT 1',
            [mailbox_id] + params
        ).fetchone()
    else:
        cursor = db.cursor()
        cursor.execute(
            f'SELECT ma.id FROM mail_accounts ma WHERE ma.id = %s AND {condition} LIMIT 1',
            [mailbox_id] + params
        )
        row = cursor.fetchone()
        cursor.close()
    return bool(row)

def _all_mailboxes_accessible(db, mailbox_ids):
    normalized_ids = []
    for mailbox_id in mailbox_ids or []:
        parsed = safe_int(mailbox_id, 0)
        if parsed > 0 and parsed not in normalized_ids:
            normalized_ids.append(parsed)
    return bool(normalized_ids) and all(_can_access_mailbox(db, mailbox_id) for mailbox_id in normalized_ids)

def _mailbox_not_found_response():
    # 对受限管理员不区分“不存在”和“无权访问”，避免通过 ID 探测数据。
    return jsonify({'success': False, 'message': '邮箱不存在或无权访问'}), 404

def _can_manage_group(db, group_id):
    group_id = safe_int(group_id, 0)
    if group_id <= 0:
        return False
    scope = _get_current_admin_mailbox_scope(db)
    if not scope:
        return True
    db_type = app.config['DATABASE_TYPE']
    username = session.get('admin_username', '')
    if db_type == 'sqlite':
        row = db.execute('''
            SELECT id FROM mailbox_groups
            WHERE id = ? AND LOWER(TRIM(COALESCE(created_by_admin, ''))) = LOWER(?)
        ''', (group_id, username)).fetchone()
    else:
        cursor = db.cursor()
        cursor.execute('''
            SELECT id FROM mailbox_groups
            WHERE id = %s AND LOWER(TRIM(COALESCE(created_by_admin, ''))) = LOWER(%s)
        ''', (group_id, username))
        row = cursor.fetchone()
        cursor.close()
    return bool(row)

def _filter_groups_for_current_admin(db, groups, mappings):
    """按当前受限管理员的邮箱范围过滤分组、关联和计数。"""
    scope = _get_current_admin_mailbox_scope(db)
    group_dicts = [dict(group) for group in groups]
    mapping_dicts = [dict(mapping) for mapping in mappings]
    if not scope:
        return group_dicts, mapping_dicts

    db_type = app.config['DATABASE_TYPE']
    condition, params = _mailbox_scope_condition(db, 'ma')
    if db_type == 'sqlite':
        mailbox_rows = db.execute(
            f'SELECT ma.id FROM mail_accounts ma WHERE {condition}', params
        ).fetchall()
        visible_mailbox_ids = {int(row['id']) for row in mailbox_rows}
    else:
        cursor = db.cursor()
        cursor.execute(f'SELECT ma.id FROM mail_accounts ma WHERE {condition}', params)
        visible_mailbox_ids = {
            int(row['id'] if isinstance(row, dict) else row[0])
            for row in cursor.fetchall()
        }
        cursor.close()

    visible_mappings = [
        mapping for mapping in mapping_dicts
        if safe_int(mapping.get('mailbox_id'), 0) in visible_mailbox_ids
    ]
    visible_group_ids = {
        safe_int(mapping.get('group_id'), 0)
        for mapping in visible_mappings
        if safe_int(mapping.get('group_id'), 0) > 0
    }
    try:
        if db_type == 'sqlite':
            granted_group_rows = db.execute('''
                SELECT group_id FROM admin_mailbox_group_permissions WHERE admin_id = ?
            ''', (scope['restricted_admin_id'],)).fetchall()
            visible_group_ids.update(int(row['group_id']) for row in granted_group_rows)
        else:
            cursor = db.cursor()
            cursor.execute('''
                SELECT group_id FROM admin_mailbox_group_permissions WHERE admin_id = %s
            ''', (scope['restricted_admin_id'],))
            visible_group_ids.update(
                int(row['group_id'] if isinstance(row, dict) else row[0])
                for row in cursor.fetchall()
            )
            cursor.close()
    except Exception as e:
        logger.debug(f"Admin mailbox group permission lookup skipped: {e}")
    username = str(session.get('admin_username', '')).strip().lower()
    for group in group_dicts:
        if str(group.get('created_by_admin') or '').strip().lower() == username:
            visible_group_ids.add(safe_int(group.get('id'), 0))

    # 保留可见分组的父级路径，避免树形结构断裂；父级只暴露名称，不暴露其邮箱。
    groups_by_id = {safe_int(group.get('id'), 0): group for group in group_dicts}
    pending = list(visible_group_ids)
    while pending:
        group = groups_by_id.get(pending.pop())
        parent_id = safe_int(group.get('parent_id'), 0) if group else 0
        if parent_id > 0 and parent_id not in visible_group_ids:
            visible_group_ids.add(parent_id)
            pending.append(parent_id)

    scoped_counts = {}
    for mapping in visible_mappings:
        group_id = safe_int(mapping.get('group_id'), 0)
        mailbox_id = safe_int(mapping.get('mailbox_id'), 0)
        scoped_counts.setdefault(group_id, set()).add(mailbox_id)

    visible_groups = []
    for group in group_dicts:
        group_id = safe_int(group.get('id'), 0)
        if group_id not in visible_group_ids:
            continue
        scoped_group = dict(group)
        scoped_group['mailbox_count'] = len(scoped_counts.get(group_id, set()))
        visible_groups.append(scoped_group)
    return visible_groups, visible_mappings

def _current_admin_managed_scope_targets(db):
    """仅允许 tjt740 返回可配置的其他管理员。"""
    current_admin_id = safe_int(session.get('admin_id'), 0)
    current_username = str(session.get('admin_username') or '').strip().lower()
    if current_admin_id <= 0 or current_username != 'tjt740':
        return []
    db_type = app.config['DATABASE_TYPE']
    try:
        if db_type == 'sqlite':
            manager = db.execute('''
                SELECT m.manager_admin_id
                FROM admin_mailbox_scope_managers m
                JOIN admin_users u ON u.id = m.manager_admin_id
                WHERE m.manager_admin_id = ? AND LOWER(TRIM(u.username)) = 'tjt740'
            ''', (current_admin_id,)).fetchone()
            if not manager:
                return []
            rows = db.execute('''
                SELECT u.id, u.username,
                       CASE WHEN s.restricted_admin_id IS NULL THEN 0 ELSE 1 END AS restricted_enabled
                FROM admin_users u
                LEFT JOIN admin_mailbox_scopes s
                  ON s.restricted_admin_id = u.id AND s.manager_admin_id = ?
                WHERE u.id <> ?
                ORDER BY u.username COLLATE NOCASE
            ''', (current_admin_id, current_admin_id)).fetchall()
            return [dict(row) for row in rows]
        cursor = db.cursor()
        cursor.execute('''
            SELECT m.manager_admin_id
            FROM admin_mailbox_scope_managers m
            JOIN admin_users u ON u.id = m.manager_admin_id
            WHERE m.manager_admin_id = %s AND LOWER(TRIM(u.username)) = 'tjt740'
        ''', (current_admin_id,))
        if not cursor.fetchone():
            cursor.close()
            return []
        cursor.execute('''
            SELECT u.id, u.username,
                   CASE WHEN s.restricted_admin_id IS NULL THEN 0 ELSE 1 END AS restricted_enabled
            FROM admin_users u
            LEFT JOIN admin_mailbox_scopes s
              ON s.restricted_admin_id = u.id AND s.manager_admin_id = %s
            WHERE u.id <> %s
            ORDER BY u.username
        ''', (current_admin_id, current_admin_id))
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        cursor.close()
        return [_row_to_dict(row, columns) for row in rows]
    except Exception as e:
        logger.debug(f"Managed mailbox scope lookup skipped: {e}")
        return []

def _is_admin_mailbox_scope_manager(db, admin_id):
    """判断管理员是否为持久化的邮箱范围控制人。"""
    admin_id = safe_int(admin_id, 0)
    if admin_id <= 0:
        return False
    try:
        if app.config['DATABASE_TYPE'] == 'sqlite':
            row = db.execute('''
                SELECT 1 FROM admin_mailbox_scope_managers
                WHERE manager_admin_id = ? LIMIT 1
            ''', (admin_id,)).fetchone()
        else:
            cursor = db.cursor()
            cursor.execute('''
                SELECT 1 FROM admin_mailbox_scope_managers
                WHERE manager_admin_id = %s LIMIT 1
            ''', (admin_id,))
            row = cursor.fetchone()
            cursor.close()
        return bool(row)
    except Exception as e:
        logger.debug(f"Mailbox scope manager lookup skipped: {e}")
        return False

def get_system_config(key, default_value=''):
    """获取系统配置值"""
    cursor = None
    try:
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        if db_type == 'sqlite':
            result = db.execute('SELECT config_value FROM system_config WHERE config_key = ?', (key,)).fetchone()
            return result['config_value'] if result else default_value
        else:
            cursor = db.cursor()
            cursor.execute('SELECT config_value FROM system_config WHERE config_key = %s', (key,))
            result = cursor.fetchone()
            return result[0] if result else default_value
    except Exception as e:
        logger.error(f"Failed to get system config for key {key}: {e}")
        return default_value
    finally:
        if cursor is not None:
            cursor.close()

def verify_admin_master_key(candidate):
    """校验管理员万能秘钥，配置缺失或旧哈希损坏时安全地返回 False。"""
    candidate = (candidate or '').strip()
    if not candidate:
        return False

    stored_hash = get_system_config('admin_master_key', '').strip()
    if not stored_hash:
        return False

    try:
        return check_password_hash(stored_hash, candidate)
    except (TypeError, ValueError) as e:
        logger.error(f"Invalid admin master key hash: {e}")
        return False

def set_system_config(db, db_type, key, value, config_type='string', description=''):
    """写入/更新一条系统配置（三种数据库通用 upsert）"""
    now = get_beijing_time()
    if db_type == 'sqlite':
        db.execute('''
            INSERT OR REPLACE INTO system_config (config_key, config_value, config_type, description, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
        ''', (key, str(value), config_type, description, now, now))
        db.commit()
    else:
        cursor = db.cursor()
        if db_type == 'mysql':
            cursor.execute('''
                INSERT INTO system_config (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 0, %s, %s)
                ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), updated_at=VALUES(updated_at)
            ''', (key, str(value), config_type, description, now, now))
        else:  # postgresql
            cursor.execute('''
                INSERT INTO system_config (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 0, %s, %s)
                ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = EXCLUDED.updated_at
            ''', (key, str(value), config_type, description, now, now))
        db.commit()

def _set_mail_poller_state(**kwargs):
    """线程安全更新邮件轮询状态"""
    with MAIL_POLLER_STATE_LOCK:
        MAIL_POLLER_STATE.update(kwargs)

def get_mail_poller_state():
    """获取邮件轮询状态快照"""
    with MAIL_POLLER_STATE_LOCK:
        return dict(MAIL_POLLER_STATE)

def _get_mail_poll_interval():
    """读取自动轮询间隔，最低30秒"""
    interval = safe_int(get_system_config('mail_check_interval', MAIL_POLL_DEFAULT_INTERVAL), MAIL_POLL_DEFAULT_INTERVAL)
    return max(interval, MAIL_POLL_MIN_INTERVAL)

def _is_mail_auto_poll_enabled():
    """自动轮询软开关：环境变量硬关 AND 数据库标志。需在 app_context 内调用"""
    if os.environ.get('MAIL_AUTO_POLL', '1') == '0':
        return False
    return get_system_config('mail_auto_poll_enabled', '1') == '1'

def _row_to_dict(row, columns=None):
    if row is None:
        return None
    if isinstance(row, sqlite3.Row):
        return dict(row)
    if isinstance(row, dict):
        return dict(row)
    if columns:
        return dict(zip(columns, row))
    try:
        return dict(row)
    except Exception:
        return {}

def _query_active_mail_accounts(db, db_type):
    """查询启用的邮箱账号，用于自动轮询"""
    if db_type == 'sqlite':
        rows = db.execute('''
            SELECT id, email, server, port, protocol, ssl
            FROM mail_accounts
            WHERE status = 1
            ORDER BY id ASC
        ''').fetchall()
        return [dict(row) for row in rows]

    cursor = db.cursor()
    try:
        cursor.execute('''
            SELECT id, email, server, port, protocol, ssl
            FROM mail_accounts
            WHERE status = 1
            ORDER BY id ASC
        ''')
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        return [_row_to_dict(row, columns) for row in rows]
    finally:
        cursor.close()

def _run_mail_fetcher(email_address, limit=None):
    """调用现有邮件获取器，返回JSON结果"""
    fetch_limit = min(max(safe_int(limit, MAIL_POLL_FETCH_LIMIT), 1), 50)
    script_args = [
        sys.executable,
        os.path.join(os.path.dirname(__file__), 'python', 'mail_fetcher.py'),
        email_address,
        '--admin-access',
        '--limit', str(fetch_limit),
        '--days-filter', str(MAIL_POLL_DAYS_FILTER),
        '--folder', 'INBOX'
    ]

    try:
        result = subprocess.run(
            script_args,
            capture_output=True,
            text=True,
            timeout=MAIL_POLL_TIMEOUT
        )
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'message': f'邮件获取超时（超过{MAIL_POLL_TIMEOUT}秒）'
        }

    if result.returncode != 0:
        return {
            'success': False,
            'message': result.stderr.strip() or '邮件获取器执行失败'
        }

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {
            'success': False,
            'message': '邮件服务响应格式错误'
        }

def _mail_poll_should_skip(email):
    """若邮箱处于退避期则消耗一个跳过周期并返回 True"""
    with MAIL_POLL_BACKOFF_LOCK:
        entry = MAIL_POLL_BACKOFF.get(email)
        if not entry or entry.get('skip_remaining', 0) <= 0:
            return False
        entry['skip_remaining'] -= 1
        return True

def _mail_poll_record_failure(email, error_message, failure_threshold, max_skip):
    """记录一次失败；连续失败达到阈值后按指数退避（2,4,8…封顶）"""
    with MAIL_POLL_BACKOFF_LOCK:
        entry = MAIL_POLL_BACKOFF.setdefault(email, {
            'failures': 0, 'skip_remaining': 0, 'last_error': '', 'last_failed_at': ''
        })
        entry['failures'] += 1
        entry['last_error'] = (error_message or '')[:200]
        entry['last_failed_at'] = get_beijing_time()
        if entry['failures'] >= failure_threshold:
            entry['skip_remaining'] = min(2 ** (entry['failures'] - failure_threshold + 1), max_skip)

def _mail_poll_record_success(email):
    """成功后清除该邮箱的退避状态"""
    with MAIL_POLL_BACKOFF_LOCK:
        MAIL_POLL_BACKOFF.pop(email, None)

def _mail_poll_backoff_snapshot():
    """导出退避状态列表（按连续失败数降序）"""
    with MAIL_POLL_BACKOFF_LOCK:
        items = [
            {'email': email, **entry}
            for email, entry in MAIL_POLL_BACKOFF.items()
        ]
    items.sort(key=lambda item: item.get('failures', 0), reverse=True)
    return items

def _mail_poll_reset_backoff(email=None):
    """重置单个或全部邮箱的退避状态"""
    with MAIL_POLL_BACKOFF_LOCK:
        if email:
            MAIL_POLL_BACKOFF.pop(email, None)
        else:
            MAIL_POLL_BACKOFF.clear()

def _extract_mail_items(response_data):
    """兼容单封和多封邮件响应"""
    if not isinstance(response_data, dict):
        return []
    mails = response_data.get('mails')
    if isinstance(mails, list):
        return [mail for mail in mails if isinstance(mail, dict)]
    mail = response_data.get('mail')
    if isinstance(mail, dict):
        return [mail]
    return []

def _normalize_mail_received_at(mail):
    received_at = (mail.get('date') or '').strip()
    if not received_at or received_at == '未知':
        return None
    return received_at

def _normalize_mail_body(mail):
    """Normalize fetched mail body before storing it in admin logs."""
    body = mail.get('body') or ''
    if body is None:
        body = ''
    body = str(body)
    if len(body) > MAIL_LOG_BODY_MAX_LENGTH:
        body = body[:MAIL_LOG_BODY_MAX_LENGTH] + '\n\n[正文过长，已截断]'

    body_type = (mail.get('body_type') or 'text').strip().lower()
    if body_type not in ('text', 'html', 'image'):
        body_type = 'text'
    return body, body_type

def _find_mail_log_id(db, db_type, email_address, mail):
    """查找邮件日志是否已存在，优先使用Message-ID去重"""
    message_id = (mail.get('message_id') or '').strip()[:255]
    subject = (mail.get('subject') or '').strip()
    mail_from = (mail.get('from') or mail.get('from_email') or '').strip()
    received_at = _normalize_mail_received_at(mail) or ''

    if message_id:
        where_clause = 'email = ? AND message_id = ?'
        params = [email_address, message_id]
    else:
        where_clause = "email = ? AND mail_subject = ? AND mail_from = ? AND COALESCE(received_at, '') = ?"
        params = [email_address, subject, mail_from, received_at]

    if db_type == 'sqlite':
        row = db.execute(f'SELECT id FROM mail_logs WHERE {where_clause} LIMIT 1', params).fetchone()
        return row['id'] if row else None

    cursor = db.cursor()
    try:
        cursor.execute(f'SELECT id FROM mail_logs WHERE {where_clause.replace("?", "%s")} LIMIT 1', params)
        row = cursor.fetchone()
        if not row:
            return None
        return row[0] if not isinstance(row, dict) else row['id']
    finally:
        cursor.close()

def _mail_log_exists(db, db_type, email_address, mail):
    """判断邮件日志是否已存在。"""
    return _find_mail_log_id(db, db_type, email_address, mail) is not None

def _insert_mail_log(db, db_type, email_address, mail, source, user_ip='', user_agent='', admin_username=''):
    """写入一条收件日志，存在则跳过"""
    existing_id = _find_mail_log_id(db, db_type, email_address, mail)
    if existing_id:
        mail_body, mail_body_type = _normalize_mail_body(mail)
        if mail_body:
            update_sql = '''
                UPDATE mail_logs
                SET admin_username = ?, mail_body_type = ?,
                    mail_body = CASE WHEN COALESCE(mail_body, '') = '' THEN ? ELSE mail_body END
                WHERE id = ?
            '''
            update_params = [admin_username or '', mail_body_type, mail_body, existing_id]
            if db_type == 'sqlite':
                db.execute(update_sql, update_params)
            else:
                cursor = db.cursor()
                try:
                    cursor.execute(update_sql.replace('?', '%s'), update_params)
                finally:
                    cursor.close()
        return False

    now = get_beijing_time()
    message_id = (mail.get('message_id') or '').strip()[:255]
    subject = (mail.get('subject') or '(无主题)').strip()
    mail_from = (mail.get('from') or mail.get('from_email') or '').strip()
    mail_to = (mail.get('to') or email_address).strip()
    received_at = _normalize_mail_received_at(mail)
    folder = (mail.get('folder') or 'inbox').strip().lower()
    mail_body, mail_body_type = _normalize_mail_body(mail)

    params = [
        email_address, subject, mail_from, mail_to, received_at,
        'received', '', user_ip, user_agent, now, message_id, folder, source,
        admin_username or '', mail_body_type, mail_body
    ]

    sql = '''
        INSERT INTO mail_logs
        (email, mail_subject, mail_from, mail_to, received_at, status, error_message,
         ip_address, user_agent, created_at, message_id, folder, source,
         admin_username, mail_body_type, mail_body)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''

    if db_type == 'sqlite':
        db.execute(sql, params)
    else:
        cursor = db.cursor()
        try:
            cursor.execute(sql.replace('?', '%s'), params)
        finally:
            cursor.close()
    return True

def _insert_mail_error_log(db, db_type, email_address, error_message, source, user_ip='', user_agent='', admin_username=''):
    """写入一条取件失败日志"""
    now = get_beijing_time()
    normalized_error = (error_message or '未知错误')[:1000]

    find_sql = '''
        SELECT id FROM mail_logs
        WHERE email = ? AND status = 'failed' AND source = ? AND error_message = ?
        ORDER BY id DESC
        LIMIT 1
    '''
    update_sql = '''
        UPDATE mail_logs
        SET mail_to = ?, ip_address = ?, user_agent = ?, admin_username = ?, created_at = ?
        WHERE id = ?
    '''

    if db_type == 'sqlite':
        existing = db.execute(find_sql, (email_address, source, normalized_error)).fetchone()
        if existing:
            db.execute(update_sql, (email_address, user_ip, user_agent, admin_username or '', now, existing['id']))
            return
    else:
        cursor = db.cursor()
        try:
            cursor.execute(find_sql.replace('?', '%s'), (email_address, source, normalized_error))
            existing = cursor.fetchone()
            if existing:
                existing_id = existing[0] if not isinstance(existing, dict) else existing['id']
                cursor.execute(update_sql.replace('?', '%s'), (email_address, user_ip, user_agent, admin_username or '', now, existing_id))
                return
        finally:
            cursor.close()

    params = [
        email_address, '', '', email_address, None, 'failed',
        normalized_error, user_ip, user_agent, now, '', 'inbox', source,
        admin_username or '', 'text', ''
    ]
    sql = '''
        INSERT INTO mail_logs
        (email, mail_subject, mail_from, mail_to, received_at, status, error_message,
         ip_address, user_agent, created_at, message_id, folder, source,
         admin_username, mail_body_type, mail_body)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''

    if db_type == 'sqlite':
        db.execute(sql, params)
    else:
        cursor = db.cursor()
        try:
            cursor.execute(sql.replace('?', '%s'), params)
        finally:
            cursor.close()

def log_mail_fetch_result(db, db_type, email_address, response_data, source, user_ip='', user_agent='', admin_username=''):
    """把邮件获取结果落到mail_logs，返回新增数量"""
    if not response_data.get('success'):
        _insert_mail_error_log(db, db_type, email_address, response_data.get('message', '邮件获取失败'), source, user_ip, user_agent, admin_username)
        return 0

    inserted_count = 0
    for mail in _extract_mail_items(response_data):
        if _insert_mail_log(db, db_type, email_address, mail, source, user_ip, user_agent, admin_username):
            inserted_count += 1
    return inserted_count

def run_mail_poll_once(source='auto_poll', lock_acquired=False, admin_username=''):
    """执行一次邮箱自动轮询"""
    acquired = lock_acquired or MAIL_POLLER_RUN_LOCK.acquire(blocking=False)
    if not acquired:
        return {
            'success': False,
            'message': '邮件轮询正在运行中',
            'running': True
        }

    actor_username = admin_username or ('系统自动' if source == 'auto_poll' else '')
    started_at = get_beijing_time()
    _set_mail_poller_state(
        running=True,
        last_started_at=started_at,
        last_message='正在轮询邮箱...'
    )

    checked_count = 0
    new_count = 0
    failed_count = 0
    skipped_count = 0

    try:
        poll_interval = MAIL_POLL_DEFAULT_INTERVAL
        with app.app_context():
            db = get_db()
            db_type = app.config['DATABASE_TYPE']
            poll_interval = _get_mail_poll_interval()

            # 定期清理收件日志（0=关闭时为空操作）
            retention_deleted = apply_mail_log_retention(db, db_type)
            if retention_deleted:
                logger.info("Mail log retention removed %s rows", retention_deleted)

            failure_threshold = max(safe_int(get_system_config('mail_poll_failure_threshold', '3'), 3), 1)
            backoff_max_skip = max(safe_int(get_system_config('mail_poll_backoff_max_skip', '16'), 16), 1)

            accounts = [
                account for account in _query_active_mail_accounts(db, db_type)
                if account.get('email', '').strip()
            ]
            # 自动轮询跳过处于失败退避期的邮箱；手动「立即查询」有意绕过退避（等于重试）
            if source == 'auto_poll':
                fetchable = []
                for account in accounts:
                    if _mail_poll_should_skip(account.get('email', '').strip()):
                        skipped_count += 1
                    else:
                        fetchable.append(account)
                accounts = fetchable
            checked_count = len(accounts)
            worker_count = min(MAIL_POLL_WORKERS, max(checked_count, 1))

            def fetch_account(account):
                email_address = account.get('email', '').strip()
                return email_address, _run_mail_fetcher(email_address, MAIL_POLL_FETCH_LIMIT)

            with ThreadPoolExecutor(max_workers=worker_count) as executor:
                futures = [executor.submit(fetch_account, account) for account in accounts]
                completed_count = 0
                for future in as_completed(futures):
                    completed_count += 1
                    try:
                        email_address, response_data = future.result()
                    except Exception as fetch_error:
                        email_address = ''
                        response_data = {
                            'success': False,
                            'message': f'邮件获取任务异常: {str(fetch_error)}'
                        }

                    _set_mail_poller_state(
                        last_message=f'正在轮询邮箱... {completed_count}/{checked_count}'
                    )

                    if not email_address:
                        failed_count += 1
                        continue

                    try:
                        if response_data.get('success'):
                            _mail_poll_record_success(email_address)
                            new_count += log_mail_fetch_result(db, db_type, email_address, response_data, source, admin_username=actor_username)
                        else:
                            failed_count += 1
                            _mail_poll_record_failure(
                                email_address,
                                response_data.get('message', '邮件获取失败'),
                                failure_threshold,
                                backoff_max_skip
                            )
                            _insert_mail_error_log(
                                db,
                                db_type,
                                email_address,
                                response_data.get('message', '邮件获取失败'),
                                source,
                                admin_username=actor_username
                            )
                        db.commit()
                    except Exception as log_error:
                        failed_count += 1
                        try:
                            db.rollback()
                        except Exception:
                            pass
                        logger.error("写入收件日志失败: %s", log_error)

        message = f'轮询完成：检查 {checked_count} 个邮箱，新增 {new_count} 封，失败 {failed_count} 个'
        if skipped_count:
            message += f'，跳过 {skipped_count} 个（失败退避）'
        _set_mail_poller_state(
            running=False,
            last_finished_at=get_beijing_time(),
            last_message=message,
            last_checked_count=checked_count,
            last_new_count=new_count,
            last_failed_count=failed_count,
            interval=poll_interval,
            backoff=_mail_poll_backoff_snapshot()
        )
        logger.info(message)
        return {
            'success': True,
            'message': message,
            'checked_count': checked_count,
            'new_count': new_count,
            'failed_count': failed_count
        }
    except Exception as e:
        failed_message = f'邮件轮询失败: {str(e)}'
        logger.error(failed_message)
        _set_mail_poller_state(
            running=False,
            last_finished_at=get_beijing_time(),
            last_message=failed_message,
            last_checked_count=checked_count,
            last_new_count=new_count,
            last_failed_count=max(failed_count, 1),
            backoff=_mail_poll_backoff_snapshot()
        )
        return {
            'success': False,
            'message': failed_message,
            'checked_count': checked_count,
            'new_count': new_count,
            'failed_count': max(failed_count, 1)
        }
    finally:
        MAIL_POLLER_RUN_LOCK.release()

def _mail_poll_loop():
    """后台邮件轮询循环"""
    while True:
        try:
            with app.app_context():
                interval = _get_mail_poll_interval()
                enabled = _is_mail_auto_poll_enabled()

            if not enabled:
                # 软开关关闭：短睡眠轮询标志，开启后 ≤30 秒生效，无需重启
                _set_mail_poller_state(
                    interval=interval,
                    auto_poll_enabled=False,
                    last_message='自动轮询已暂停（可在收件日志页开启）',
                    next_run_at=''
                )
                time.sleep(min(interval, 30))
                continue

            _set_mail_poller_state(interval=interval, auto_poll_enabled=True)
            run_mail_poll_once(source='auto_poll')
            next_run = datetime.now(timezone(timedelta(hours=8))) + timedelta(seconds=interval)
            _set_mail_poller_state(next_run_at=next_run.strftime('%Y-%m-%d %H:%M:%S'))
            time.sleep(interval)
        except Exception as e:
            logger.error("邮件轮询线程异常: %s", e)
            _set_mail_poller_state(
                running=False,
                last_finished_at=get_beijing_time(),
                last_message=f'邮件轮询线程异常: {str(e)}'
            )
            time.sleep(MAIL_POLL_DEFAULT_INTERVAL)

def start_mail_poller():
    """启动邮件自动轮询线程"""
    global MAIL_POLLER_STARTED, MAIL_POLLER_THREAD

    if os.environ.get('MAIL_AUTO_POLL', '1') == '0':
        _set_mail_poller_state(
            started=False,
            running=False,
            last_message='邮件自动轮询已通过环境变量关闭'
        )
        return False

    if MAIL_POLLER_STARTED:
        return True

    MAIL_POLLER_STARTED = True
    MAIL_POLLER_THREAD = threading.Thread(target=_mail_poll_loop, name='mail-auto-poller', daemon=True)
    MAIL_POLLER_THREAD.start()
    _set_mail_poller_state(
        started=True,
        last_message='邮件自动轮询已启动',
        interval=MAIL_POLL_DEFAULT_INTERVAL
    )
    logger.info("Mail auto poller started")
    return True

def trigger_mail_poll_once(source='manual_poll', admin_username=''):
    """异步触发一次邮件轮询"""
    if not MAIL_POLLER_RUN_LOCK.acquire(blocking=False):
        return False, '邮件轮询正在运行中'

    thread = threading.Thread(
        target=run_mail_poll_once,
        kwargs={'source': source, 'lock_acquired': True, 'admin_username': admin_username},
        name='mail-manual-poll',
        daemon=True
    )
    thread.start()
    return True, '已开始后台轮询，请稍后刷新日志'

@app.context_processor
def inject_system_title():
    """注入系统标题到所有模板"""
    return {
        'system_title': get_system_config('system_title', '邮件查看系统')
    }

# ===============================
# 管理员后台页面路由
# ===============================

@app.route('/admin/home')
@admin_required
def admin_home():
    """管理员首页"""
    return render_react_app(page_title=f'首页 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/admin/mailbox')
@admin_required
def admin_mailbox():
    """邮箱管理页面"""
    return render_react_app(page_title=f'邮箱管理 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/admin/daili')
@admin_required
def admin_daili():
    """代理池管理页面"""
    return render_react_app(page_title=f'代理池 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/admin/kami')
@admin_required
def admin_kami():
    """卡密管理页面"""
    return render_react_app(page_title=f'卡密管理 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/admin/kamirizhi')
@admin_required
def admin_kamirizhi():
    """卡密日志页面"""
    return render_react_app(page_title=f'卡密日志 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/admin/shoujian')
@admin_required
def admin_shoujian():
    """收件日志页面"""
    return render_react_app(page_title=f'收件日志 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/admin/system')
@admin_required
def admin_system():
    """系统设置页面"""
    return render_react_app(page_title=f'系统设置 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/legacy/admin/home')
@admin_required
def legacy_admin_home():
    """Legacy admin dashboard embedded by the React shell."""
    account_count = get_account_count()
    card_count = get_card_count()
    available_proxy_count = get_available_proxy_count()
    return render_template('admin/home.html',
                         admin_username=session.get('admin_username'),
                         account_count=account_count,
                         card_count=card_count,
                         available_proxy_count=available_proxy_count,
                         embedded=request.args.get('embedded') == '1')

@app.route('/legacy/admin/mailbox')
@admin_required
def legacy_admin_mailbox():
    """Legacy mailbox management page embedded by the React shell."""
    return render_template('admin/mailbox.html',
                         admin_username=session.get('admin_username'),
                         embedded=request.args.get('embedded') == '1')

@app.route('/legacy/admin/daili')
@admin_required
def legacy_admin_daili():
    """Legacy proxy pool page embedded by the React shell."""
    return render_template('admin/daili.html',
                         admin_username=session.get('admin_username'),
                         embedded=request.args.get('embedded') == '1')

@app.route('/legacy/admin/kami')
@admin_required
def legacy_admin_kami():
    """Legacy card management page embedded by the React shell."""
    return render_template('admin/kami.html',
                         admin_username=session.get('admin_username'),
                         embedded=request.args.get('embedded') == '1')

@app.route('/legacy/admin/kamirizhi')
@admin_required
def legacy_admin_kamirizhi():
    """Legacy card logs page embedded by the React shell."""
    return render_template('admin/kamirizhi.html',
                         admin_username=session.get('admin_username'),
                         embedded=request.args.get('embedded') == '1')

@app.route('/legacy/admin/shoujian')
@admin_required
def legacy_admin_shoujian():
    """Legacy mail logs page embedded by the React shell."""
    return render_template('admin/shoujian.html',
                         admin_username=session.get('admin_username'),
                         embedded=request.args.get('embedded') == '1')

@app.route('/legacy/admin/system')
@admin_required
def legacy_admin_system():
    """Legacy system settings page embedded by the React shell."""
    return render_template('admin/system.html',
                         admin_username=session.get('admin_username'),
                         show_mailbox_access=(str(session.get('admin_username') or '').strip().lower() == 'tjt740'),
                         embedded=request.args.get('embedded') == '1')

@app.route('/admin/help')
@admin_required
def admin_help():
    """帮助中心页面（React 壳，iframe 加载 legacy 版）"""
    return render_react_app(page_title=f'帮助中心 - {get_system_config("system_title", "邮件查看系统")}')

@app.route('/legacy/admin/help')
@admin_required
def legacy_admin_help():
    """Legacy help center page embedded by the React shell."""
    return render_template('admin/help.html',
                         admin_username=session.get('admin_username'),
                         embedded=request.args.get('embedded') == '1')

# ===============================
# API 接口路由
# ===============================

@app.route('/api/check_login', methods=['GET'])
def api_check_login():
    """检查管理员登录状态 API"""
    try:
        logged_in = session.get('admin_logged_in', False)
        admin_username = session.get('admin_username', '')
        
        return jsonify({
            'success': True,
            'logged_in': logged_in,
            'admin_username': admin_username
        })
    except Exception as e:
        logger.error(f"Check login error: {e}")
        return jsonify({
            'success': False,
            'logged_in': False,
            'message': f'检查登录状态失败: {str(e)}'
        })

CARD_STATUS_MESSAGES = {
    'valid': '卡密有效',
    'not_found': '卡密不存在或已失效',
    'disabled': '卡密已被禁用',
    'expired': '卡密已过期',
    'exhausted': '卡密使用次数已用完'
}

def load_and_validate_card(db, db_type, card_key):
    """查询卡密并校验状态，返回 (card_info_or_None, status)

    status: 'valid' | 'not_found' | 'disabled' | 'expired' | 'exhausted'
    """
    if db_type == 'sqlite':
        card_result = db.execute('''
            SELECT c.*, e.email as bound_email, e.server, e.username, e.password,
                   e.port, e.protocol, e.ssl
            FROM cards c
            LEFT JOIN mail_accounts e ON c.bound_email_id = e.id
            WHERE c.card_key = ?
        ''', (card_key,)).fetchone()
        card_info = dict(card_result) if card_result else None
    else:
        cursor = db.cursor()
        cursor.execute('''
            SELECT c.*, e.email as bound_email, e.server, e.username, e.password,
                   e.port, e.protocol, e.ssl
            FROM cards c
            LEFT JOIN mail_accounts e ON c.bound_email_id = e.id
            WHERE c.card_key = %s
        ''', (card_key,))
        card_result = cursor.fetchone()
        if card_result:
            columns = [desc[0] for desc in cursor.description]
            card_info = dict(zip(columns, card_result))
        else:
            card_info = None

    if not card_info:
        return None, 'not_found'

    # 检查卡密是否启用（1=可用 0=禁用 2=已用完）
    if card_info['status'] != 1:
        return card_info, 'disabled'

    # 检查是否已过期
    now = get_beijing_time()
    if card_info['expired_at'] and card_info['expired_at'] <= now:
        return card_info, 'expired'

    # 检查使用次数是否已用完
    if card_info['used_count'] >= card_info['usage_limit']:
        return card_info, 'exhausted'

    return card_info, 'valid'

@app.route('/api/card_info', methods=['POST'])
def api_card_info():
    """卡密信息查询 API：返回卡密状态与绑定邮箱，不消耗使用次数。

    枚举风险与 GET /api/mail/<card_key>（HTML 页）一致，可接受。
    """
    try:
        data = request.get_json(silent=True) or {}
        card_key = (data.get('card_key', '') or '').strip()
        if not card_key:
            return jsonify({
                'success': False,
                'status': 'not_found',
                'credential_type': None,
                'message': '请输入卡密',
                'card_info': None,
                'bound_emails': []
            })

        # 首页共用一个凭证输入框。先识别万能秘钥，避免把有效的万能秘钥
        # 错误提示成“卡密不存在”，也让后续请求只携带正确的凭证字段。
        if verify_admin_master_key(card_key):
            return jsonify({
                'success': True,
                'status': 'master_key',
                'credential_type': 'master_key',
                'message': '万能秘钥有效，请填写要查询的邮箱地址',
                'card_info': None,
                'bound_emails': []
            })

        db = get_db()
        db_type = app.config['DATABASE_TYPE']

        card_info, status = load_and_validate_card(db, db_type, card_key)
        if not card_info:
            return jsonify({
                'success': False,
                'status': 'not_found',
                'credential_type': None,
                'message': CARD_STATUS_MESSAGES['not_found'],
                'card_info': None,
                'bound_emails': []
            })

        bound_mailboxes = fetch_card_bound_mailboxes(
            db, db_type, card_info.get('id'), card_info.get('bound_email_id')
        )
        # 只暴露 id 与 email，绑定行中的服务器/账号/密码绝不外泄
        bound_emails = [
            {'id': m.get('id'), 'email': m.get('email')}
            for m in bound_mailboxes if m.get('email')
        ]

        try:
            user_ip = request.environ.get('HTTP_X_FORWARDED_FOR') or request.environ.get('REMOTE_ADDR') or 'unknown'
            user_agent = request.headers.get('User-Agent', 'unknown')
            now = get_beijing_time()
            if db_type == 'sqlite':
                db.execute('''
                    INSERT INTO card_logs (card_id, card_key, bound_email, user_ip, user_agent, action, result, mail_subject, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (card_info['id'], card_key, card_info.get('bound_email') or '', user_ip, user_agent,
                      'check', '查询卡密信息', '', now))
                db.commit()
            else:
                cursor = db.cursor()
                cursor.execute('''
                    INSERT INTO card_logs (card_id, card_key, bound_email, user_ip, user_agent, action, result, mail_subject, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (card_info['id'], card_key, card_info.get('bound_email') or '', user_ip, user_agent,
                      'check', '查询卡密信息', '', now))
                db.commit()
        except Exception as log_error:
            logger.warning(f"Card info check log error: {log_error}")

        return jsonify({
            'success': status == 'valid',
            'status': status,
            'credential_type': 'card_key',
            'message': CARD_STATUS_MESSAGES.get(status, ''),
            'card_info': {
                'card_type': card_info.get('card_type'),
                'total_uses': card_info.get('usage_limit'),
                'used_count': card_info.get('used_count'),
                'remaining_uses': max((card_info.get('usage_limit') or 0) - (card_info.get('used_count') or 0), 0),
                'expired_at': str(card_info.get('expired_at')) if card_info.get('expired_at') else None
            },
            'bound_emails': bound_emails
        })
    except Exception as e:
        logger.error(f"Card info error: {e}")
        return jsonify({
            'success': False,
            'status': 'error',
            'credential_type': None,
            'message': f'卡密查询失败: {str(e)}',
            'card_info': None,
            'bound_emails': []
        })

@app.route('/api/get_mail', methods=['POST'])
def api_get_mail():
    """获取邮件 API。

    Public callers may fetch any mailbox already configured in the admin
    database by entering its address. Card-key requests remain compatible with
    older generated links, but the public home page no longer requires or
    exposes credentials.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据无效'
            })
            
        email = data.get('email', '').strip()
        card_key = (data.get('card_key', '') or request.headers.get('X-Card-Key', '') or '').strip()
        admin_access = bool(data.get('admin_access', False))
        # 兼容只有一个“卡密/万能秘钥”输入框的旧客户端：显式 master_key
        # 优先，否则也允许把万能秘钥放在 card_key 或 X-Card-Key 中。
        master_key_input = (data.get('master_key') or card_key or '').strip()
        master_key_valid = verify_admin_master_key(master_key_input)
        
        # 验证请求参数
        if not email:
            return jsonify({
                'success': False,
                'message': '请提供邮箱地址'
            })
        
        # No credential means the new public mailbox-address lookup flow. An
        # explicitly supplied legacy card still uses the card-bound path, while
        # administrator sessions and old master-key clients remain compatible.
        is_admin_session = session.get('admin_logged_in', False) and admin_access and not card_key
        is_public_lookup = not card_key
        is_direct_access = is_public_lookup or is_admin_session or master_key_valid
        
        # Get optional email_index parameter for fetching different emails
        email_index = safe_int(data.get('email_index', 0), 0)
        
        # Get optional email_limit parameter for fetching multiple emails
        email_limit = safe_int(data.get('email_limit', 1), 1)
        email_limit = min(max(email_limit, 1), 200)
        
        # Optional folder selection
        folder = (data.get('folder') or 'INBOX').strip() or 'INBOX'
        
        # Preview mode: fetch mail without incrementing card usage (for duplicate detection)
        preview_only = data.get('preview_only', False)
        
        # 获取数据库连接
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        if is_direct_access:
            # 公开邮箱查询 / 管理员访问：直接调用邮件获取器。邮件获取器
            # 只会读取后台 mail_accounts 中已配置的邮箱，不接受任意账号密码。
            try:
                # 调用Python邮件获取器脚本
                script_args = [
                    sys.executable, 
                    os.path.join(os.path.dirname(__file__), 'python', 'mail_fetcher.py'),
                    email,
                    '--admin-access'  # 标记为管理员访问
                ]
                
                # Add email index parameter if provided
                if email_index > 0:
                    script_args.extend(['--index', str(email_index)])
                
                # Add email limit parameter if provided
                if email_limit > 1:
                    script_args.extend(['--limit', str(email_limit)])
                
                # Add folder selection when provided
                if folder:
                    script_args.extend(['--folder', folder])
                
                result = subprocess.run(script_args, capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    # 解析JSON输出
                    response_data = json.loads(result.stdout)
                    
                    if response_data.get('success'):
                        # 记录公开查询或管理员访问日志
                        user_ip = request.environ.get('HTTP_X_FORWARDED_FOR') or request.environ.get('REMOTE_ADDR') or 'unknown'
                        if master_key_valid:
                            actor_username = 'master_key'
                        elif is_admin_session:
                            actor_username = session.get('admin_username', 'unknown')
                        else:
                            actor_username = 'public'
                        user_agent = request.headers.get('User-Agent', 'unknown')
                        log_source = 'admin_manual' if (master_key_valid or is_admin_session) else 'public_lookup'
                        log_mail_fetch_result(db, db_type, email, response_data, log_source, user_ip, user_agent, actor_username)
                        mail_items = _extract_mail_items(response_data)
                        first_subject = mail_items[0].get('subject', '无主题') if mail_items else '无主题'
                        
                        if db_type == 'sqlite':
                            db.execute('''
                                INSERT INTO admin_mail_logs (admin_username, email, user_ip, action, result, created_at)
                                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ''', (actor_username, email, user_ip, 'public_get_mail' if actor_username == 'public' else 'admin_get_mail',
                                  f'获取邮件: {first_subject}'))
                            db.commit()
                        else:
                            cursor = db.cursor()
                            cursor.execute('''
                                INSERT INTO admin_mail_logs (admin_username, email, user_ip, action, result, created_at)
                                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                            ''', (actor_username, email, user_ip, 'public_get_mail' if actor_username == 'public' else 'admin_get_mail',
                                  f'获取邮件: {first_subject}'))
                            db.commit()
                    
                    return jsonify(response_data)
                else:
                    return jsonify({
                        'success': False,
                        'message': f'邮件获取失败: {result.stderr or "未知错误"}'
                    })
                    
            except subprocess.TimeoutExpired:
                return jsonify({
                    'success': False,
                    'message': '邮件获取超时，请稍后重试'
                })
            except json.JSONDecodeError:
                return jsonify({
                    'success': False,
                    'message': '邮件服务响应格式错误'
                })
            except Exception as e:
                logger.error(f"Direct mail access error: {e}")
                return jsonify({
                    'success': False,
                    'message': f'邮件获取错误: {str(e)}'
                })
        else:
            # 原有的卡密验证逻辑保持不变
            try:
                # 查询卡密并校验状态（与 /api/card_info 共享助手，消息保持一致）
                card_info, card_status = load_and_validate_card(db, db_type, card_key)
                if card_status != 'valid':
                    return jsonify({
                        'success': False,
                        'message': CARD_STATUS_MESSAGES[card_status]
                    })

                now = get_beijing_time()

                # 如果卡密绑定了邮箱，检查邮箱是否匹配（支持多邮箱绑定）
                bound_mailboxes = fetch_card_bound_mailboxes(
                    db,
                    db_type,
                    card_info.get('id'),
                    card_info.get('bound_email_id')
                )
                bound_emails = [m.get('email') for m in bound_mailboxes if m.get('email')]
                if bound_emails:
                    bound_email_lookup = {addr.lower(): addr for addr in bound_emails}
                    matched_bound_email = bound_email_lookup.get(email.lower())
                    if not matched_bound_email:
                        allowed_preview = '、'.join(bound_emails[:5])
                        if len(bound_emails) > 5:
                            allowed_preview += f' 等 {len(bound_emails)} 个邮箱'
                        return jsonify({
                            'success': False,
                            'message': f'此卡密只能用于绑定邮箱: {allowed_preview}'
                        })
                    # 使用绑定邮箱信息直接获取邮件
                    use_bound_email = True
                    card_info['bound_email'] = matched_bound_email
                else:
                    # 如果没有绑定邮箱，需要在数据库中查找邮箱配置
                    use_bound_email = False
                
                # 调用Python邮件获取器脚本，传递卡密过滤参数
                fetch_email = card_info.get('bound_email') or email
                script_args = [
                    sys.executable, 
                    os.path.join(os.path.dirname(__file__), 'python', 'mail_fetcher.py'),
                    fetch_email
                ]
                
                # 添加卡密过滤参数
                if card_info.get('email_days_filter'):
                    script_args.extend(['--days-filter', str(card_info['email_days_filter'])])
                
                if card_info.get('sender_filter'):
                    script_args.extend(['--sender-filter', card_info['sender_filter']])
                
                if card_info.get('keyword_filter'):
                    script_args.extend(['--keyword-filter', card_info['keyword_filter']])
                
                # 添加卡密标识用于后续处理
                script_args.extend(['--card-key', card_key])
                
                # 邮件序号与数量控制
                if email_index > 0:
                    script_args.extend(['--index', str(email_index)])
                if email_limit > 1:
                    script_args.extend(['--limit', str(email_limit)])
                
                # 文件夹选择
                if folder:
                    script_args.extend(['--folder', folder])
                
                result = subprocess.run(script_args, capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    # 解析JSON输出
                    response_data = json.loads(result.stdout)
                    if response_data.get('success'):
                        fetch_user_ip = request.environ.get('HTTP_X_FORWARDED_FOR') or request.environ.get('REMOTE_ADDR') or 'unknown'
                        fetch_user_agent = request.headers.get('User-Agent', 'unknown')
                        logged_mail_count = log_mail_fetch_result(
                            db,
                            db_type,
                            email,
                            response_data,
                            'card_preview' if preview_only else 'card_api',
                            fetch_user_ip,
                            fetch_user_agent
                        )
                        if preview_only and logged_mail_count:
                            db.commit()
                    
                    # 如果邮件获取成功，处理卡密信息
                    if response_data.get('success') and response_data.get('mail'):
                        if preview_only:
                            # 预览模式：不扣除次数，但返回当前的卡密信息
                            response_data['card_info'] = {
                                'remaining_uses': card_info['usage_limit'] - card_info['used_count'],
                                'total_uses': card_info['usage_limit'],
                                'used_count': card_info['used_count']
                            }
                            response_data['preview_mode'] = True
                        else:
                            # 正常模式：增加使用次数
                            new_used_count = card_info['used_count'] + 1
                            
                            # 记录使用日志
                            user_ip = request.environ.get('HTTP_X_FORWARDED_FOR') or request.environ.get('REMOTE_ADDR') or 'unknown'
                            user_agent = request.headers.get('User-Agent', 'unknown')
                            mail_subject = response_data.get("mail", {}).get("subject", "")
                            # Use bound email from card if available, otherwise use current email
                            bound_email = card_info.get('bound_email', email) or email
                            
                            if db_type == 'sqlite':
                                # 更新卡密使用次数
                                db.execute('''
                                    UPDATE cards SET used_count = ?, updated_at = CURRENT_TIMESTAMP 
                                    WHERE id = ?
                                ''', (new_used_count, card_info['id']))
                                
                                # 插入使用日志（总是插入，包括最后一次使用）
                                db.execute('''
                                    INSERT INTO card_logs (card_id, card_key, bound_email, user_ip, user_agent, action, result, mail_subject, created_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (card_info['id'], card_key, bound_email, user_ip, user_agent, 'use', 
                                      f'成功获取邮件: {mail_subject}', mail_subject, now))
                                
                                db.commit()
                            else:
                                cursor = db.cursor()
                                # 更新卡密使用次数
                                cursor.execute('''
                                    UPDATE cards SET used_count = %s, updated_at = CURRENT_TIMESTAMP 
                                    WHERE id = %s
                                ''', (new_used_count, card_info['id']))
                                
                                # 插入使用日志（总是插入，包括最后一次使用）
                                cursor.execute('''
                                    INSERT INTO card_logs (card_id, card_key, bound_email, user_ip, user_agent, action, result, mail_subject, created_at)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ''', (card_info['id'], card_key, bound_email, user_ip, user_agent, 'use', 
                                      f'成功获取邮件: {mail_subject}', mail_subject, now))
                                
                                db.commit()
                            
                            # 更新响应数据，包含剩余使用次数
                            response_data['card_info'] = {
                                'remaining_uses': card_info['usage_limit'] - new_used_count,
                                'total_uses': card_info['usage_limit'],
                                'used_count': new_used_count
                            }
                    
                    return jsonify(response_data)
                else:
                    return jsonify({
                        'success': False,
                        'message': f'邮件获取失败: {result.stderr or "未知错误"}'
                    })
                    
            except subprocess.TimeoutExpired:
                return jsonify({
                    'success': False,
                    'message': '邮件获取超时，请稍后重试'
                })
            except json.JSONDecodeError:
                return jsonify({
                    'success': False,
                    'message': '邮件服务响应格式错误'
                })
            except Exception as e:
                logger.error(f"Database or processing error in get_mail: {e}")
                return jsonify({
                    'success': False,
                    'message': f'邮件服务错误: {str(e)}'
                })
                
    except Exception as e:
        logger.error(f"General error in get_mail: {e}")
        return jsonify({
            'success': False,
            'message': f'服务器错误: {str(e)}'
        })

def move_card_to_recycle_bin(db, db_type, card_id, recycle_type='deleted', reason=''):
    """将卡密移动到回收站"""
    try:
        # 获取卡密信息
        if db_type == 'sqlite':
            card = db.execute('SELECT * FROM cards WHERE id = ?', (card_id,)).fetchone()
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM cards WHERE id = %s', (card_id,))
            card = cursor.fetchone()
        
        if not card:
            return False, '卡密不存在'
        
        # 转换为字典
        if db_type == 'sqlite':
            card_data = dict(card)
        else:
            columns = [desc[0] for desc in cursor.description]
            card_data = dict(zip(columns, card))
        
        # 插入到回收站
        now = get_beijing_time()  # 使用北京时间
        if db_type == 'sqlite':
            db.execute('''
                INSERT INTO card_recycle_bin (original_card_id, card_key, usage_limit, used_count, 
                                            expired_at, bound_email_id, email_days_filter, sender_filter, 
                                            remarks, status, recycle_type, reason, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (card_data['id'], card_data['card_key'], card_data['usage_limit'], 
                  card_data['used_count'], card_data['expired_at'], card_data['bound_email_id'],
                  card_data['email_days_filter'], card_data['sender_filter'], card_data['remarks'],
                  card_data['status'], recycle_type, reason, card_data['created_at'], 
                  card_data['updated_at'], now))
            
            # 从主表删除
            db.execute('DELETE FROM cards WHERE id = ?', (card_id,))
        else:
            cursor = db.cursor()
            cursor.execute('''
                INSERT INTO card_recycle_bin (original_card_id, card_key, usage_limit, used_count, 
                                            expired_at, bound_email_id, email_days_filter, sender_filter, 
                                            remarks, status, recycle_type, reason, created_at, updated_at, deleted_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (card_data['id'], card_data['card_key'], card_data['usage_limit'], 
                  card_data['used_count'], card_data['expired_at'], card_data['bound_email_id'],
                  card_data['email_days_filter'], card_data['sender_filter'], card_data['remarks'],
                  card_data['status'], recycle_type, reason, card_data['created_at'], 
                  card_data['updated_at'], now))
            
            # 从主表删除
            cursor.execute('DELETE FROM cards WHERE id = %s', (card_id,))
        
        return True, '成功移动到回收站'
        
    except Exception as e:
        logger.error(f"Move card to recycle bin error: {e}")
        return False, f'移动到回收站失败: {str(e)}'

def process_expired_cards():
    """处理过期的卡密，将其移动到回收站"""
    try:
        with app.app_context():
            db = get_db()
            db_type = app.config['DATABASE_TYPE']
            now = get_beijing_time()  # 使用北京时间
            
            # 查找所有过期的卡密
            if db_type == 'sqlite':
                expired_cards = db.execute('''
                    SELECT id, card_key FROM cards 
                    WHERE expired_at IS NOT NULL AND expired_at <= ?
                ''', (now,)).fetchall()
            else:
                cursor = db.cursor()
                cursor.execute('''
                    SELECT id, card_key FROM cards 
                    WHERE expired_at IS NOT NULL AND expired_at <= %s
                ''', (now,))
                expired_cards = cursor.fetchall()
            
            if expired_cards:
                moved_count = 0
                for card in expired_cards:
                    card_id = card['id'] if db_type == 'sqlite' else card[0]
                    card_key = card['card_key'] if db_type == 'sqlite' else card[1]
                    
                    success, message = move_card_to_recycle_bin(db, db_type, card_id, 'expired', '到期时间已过')
                    if success:
                        moved_count += 1
                        logger.info(f"Expired card {card_key} moved to recycle bin")
                    else:
                        logger.error(f"Failed to move expired card {card_key}: {message}")
                
                if moved_count > 0:
                    db.commit()
                    logger.info(f"Moved {moved_count} expired cards to recycle bin")
            
    except Exception as e:
        logger.error(f"Process expired cards error: {e}")

@app.route('/admin/api/mailbox', methods=['GET', 'POST', 'DELETE'])
@admin_required
def api_admin_mailbox():
    """邮箱管理 API（增强版）"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    if request.method == 'GET':
        # 检查是否请求单个邮箱
        mailbox_id = request.args.get('id', '').strip()
        if mailbox_id:
            # 获取单个邮箱详情
            try:
                mailbox_id_int = int(mailbox_id)
                if mailbox_id_int <= 0:
                    return jsonify({
                        'success': False,
                        'message': '无效的邮箱ID'
                    }), 400

                if not _can_access_mailbox(db, mailbox_id_int):
                    return _mailbox_not_found_response()
                    
                if db_type == 'sqlite':
                    account = db.execute('SELECT * FROM mail_accounts WHERE id = ?', (mailbox_id_int,)).fetchone()
                else:
                    cursor = db.cursor()
                    cursor.execute('SELECT * FROM mail_accounts WHERE id = %s', (mailbox_id_int,))
                    result = cursor.fetchone()
                    if result:
                        columns = [desc[0] for desc in cursor.description]
                        account = dict(zip(columns, result))
                    else:
                        account = None
                
                if account:
                    return jsonify({
                        'success': True,
                        'data': dict(account) if db_type == 'sqlite' else account
                    })
                else:
                    return jsonify({
                        'success': False,
                        'message': '邮箱不存在'
                    }), 404
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '无效的邮箱ID'
                }), 400
            except Exception as e:
                logger.error(f'获取邮箱详情失败: {e}')
                return jsonify({
                    'success': False,
                    'message': '获取邮箱信息失败'
                }), 500
        
        # 获取邮箱列表（支持分页和搜索）
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 30))
        search = request.args.get('search', '').strip()
        fast_mode = request.args.get('fast', '') == '1'
        select_columns = FAST_MAILBOX_COLUMNS if fast_mode else "*"
        
        offset = (page - 1) * per_page
        
        # 构建查询条件，并在数据库层应用当前管理员的邮箱可见范围。
        conditions = []
        params = []
        if search:
            conditions.append("(ma.email LIKE ? OR ma.server LIKE ? OR ma.remarks LIKE ? OR ma.created_by_admin LIKE ?)")
            search_param = f"%{search}%"
            params = [search_param, search_param, search_param, search_param]
        scope_condition, scope_params = _mailbox_scope_condition(db, 'ma')
        if scope_condition:
            conditions.append(scope_condition)
            params.extend(scope_params)
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        
        # 获取总数
        if db_type == 'sqlite':
            total = None
            if not fast_mode:
                count_sql = f"SELECT COUNT(*) as count FROM mail_accounts ma {where_clause}"
                count_result = db.execute(count_sql, params).fetchone()
                total = count_result['count']
            
            # 获取分页数据 - 按ID排序确保ID稳定显示
            sql = f"""
                SELECT {select_columns} FROM mail_accounts ma {where_clause}
                ORDER BY ma.id ASC
                LIMIT ? OFFSET ?
            """
            accounts = db.execute(sql, params + [per_page, offset]).fetchall()
        else:
            cursor = db.cursor()
            placeholder = '%s'
            
            where_mysql = where_clause.replace('?', placeholder) if where_clause else ""
            
            total = None
            if not fast_mode:
                count_sql = f"SELECT COUNT(*) as count FROM mail_accounts ma {where_mysql}"
                cursor.execute(count_sql, params)
                total = cursor.fetchone()['count'] if db_type == 'postgresql' else cursor.fetchone()[0]
            
            sql = f"""
                SELECT {select_columns} FROM mail_accounts ma {where_mysql}
                ORDER BY ma.id ASC
                LIMIT {per_page} OFFSET {offset}
            """
            cursor.execute(sql, params)
            accounts = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'data': [dict(account) for account in accounts],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': ((total + per_page - 1) // per_page) if isinstance(total, int) else None
            }
        })
    
    elif request.method == 'POST':
        # 添加或编辑邮箱
        data = request.get_json() or {}
        action = data.get('action')

        single_mailbox_actions = {'edit', 'test', 'send_mail', 'update_remarks'}
        if action in single_mailbox_actions and not _can_access_mailbox(db, data.get('id')):
            return _mailbox_not_found_response()
        if action == 'batch_delete' and not _all_mailboxes_accessible(db, data.get('ids', [])):
            return _mailbox_not_found_response()
        if action == 'edit' and _get_current_admin_mailbox_scope(db) and 'created_by_admin' in data:
            return jsonify({'success': False, 'message': '无权修改邮箱归属管理员'}), 403
        
        if action == 'add':
            return _add_mailbox(db, data)
        elif action == 'parse_import':
            return _parse_mailbox_import_preview(data)
        elif action == 'batch_add':
            return _batch_add_mailbox(db, data)
        elif action == 'edit':
            return _edit_mailbox(db, data)
        elif action == 'test':
            return _test_mailbox(db, data)
        elif action == 'test_new':
            return _test_new_mailbox(data)
        elif action == 'batch_delete':
            return _batch_delete_mailbox(db, data)
        elif action == 'send_mail':
            return _send_mail(db, data)
        elif action == 'update_remarks':
            return _update_mailbox_remarks(db, data)
    
    elif request.method == 'DELETE':
        # 删除邮箱
        data = request.get_json()
        account_id = data.get('id')
        
        if not account_id:
            return jsonify({
                'success': False,
                'message': '缺少邮箱ID'
            })

        if not _can_access_mailbox(db, account_id):
            return _mailbox_not_found_response()
        
        try:
            if app.config['DATABASE_TYPE'] == 'sqlite':
                db.execute('DELETE FROM mail_accounts WHERE id = ?', (account_id,))
                db.commit()
            else:
                cursor = db.cursor()
                cursor.execute('DELETE FROM mail_accounts WHERE id = %s', (account_id,))
                db.commit()
            
            return jsonify({
                'success': True,
                'message': '邮箱删除成功'
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'删除失败: {str(e)}'
            })

@app.route('/admin/api/mailbox/search', methods=['GET'])
@admin_required
def api_mailbox_search():
    """邮箱搜索 API - 用于自动完成/选择器（性能优化版）"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    search = request.args.get('q', '').strip()
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    if not search:
        return jsonify({
            'success': True,
            'data': [],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': 0,
                'has_more': False
            }
        })
    
    offset = (page - 1) * per_page
    
    # 构建查询条件 - 使用索引优化的搜索，并应用可见范围。
    conditions = ["(ma.email LIKE ? OR ma.server LIKE ? OR ma.remarks LIKE ?)"]
    search_param = f"%{search}%"
    params = [search_param, search_param, search_param]
    scope_condition, scope_params = _mailbox_scope_condition(db, 'ma')
    if scope_condition:
        conditions.append(scope_condition)
        params.extend(scope_params)
    where_clause = f"WHERE {' AND '.join(conditions)}"
    
    try:
        if db_type == 'sqlite':
            # 获取总数（限制计数以提高性能）
            count_sql = f"SELECT COUNT(*) as count FROM mail_accounts ma {where_clause}"
            count_result = db.execute(count_sql, params).fetchone()
            total = count_result['count']
            
            # 获取分页数据 - 只返回必要字段以提高性能
            sql = f"""
                SELECT id, email, server, remarks
                FROM mail_accounts ma {where_clause}
                ORDER BY ma.id ASC
                LIMIT ? OFFSET ?
            """
            accounts = db.execute(sql, params + [per_page, offset]).fetchall()
        else:
            cursor = db.cursor()
            placeholder = '%s'
            where_mysql = where_clause.replace('?', placeholder)
            
            count_sql = f"SELECT COUNT(*) as count FROM mail_accounts ma {where_mysql}"
            cursor.execute(count_sql, params)
            total = cursor.fetchone()['count'] if db_type == 'postgresql' else cursor.fetchone()[0]
            
            sql = f"""
                SELECT id, email, server, remarks
                FROM mail_accounts ma {where_mysql}
                ORDER BY ma.id ASC
                LIMIT {per_page} OFFSET {offset}
            """
            cursor.execute(sql, params)
            accounts = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'data': [dict(account) for account in accounts],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'has_more': (page * per_page) < total
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'搜索失败: {str(e)}'
        })


def _add_mailbox(db, data):
    """添加单个邮箱"""
    import_content = str(data.get('import_content') or '').strip()
    email = data.get('email', '').strip()
    username = email  # 使用邮箱作为用户名
    password = data.get('password', '').strip()
    server = data.get('server', '').strip()
    port = safe_int(data.get('port', 0))
    protocol = data.get('protocol', 'imap')
    ssl = 1 if data.get('ssl') else 0
    send_server = data.get('send_server', '').strip() or server
    send_protocol = data.get('send_protocol', 'smtp')
    send_ssl_flag = data.get('send_ssl')
    send_ssl = 1 if (send_ssl_flag if send_ssl_flag is not None else data.get('ssl')) else 0
    send_port = normalize_smtp_port(data.get('send_port'), send_protocol, send_ssl == 1)
    remarks = data.get('remarks', '').strip()
    auth_type = 'password'
    oauth_client_id = ''
    oauth_refresh_token = ''
    group_id = data.get('group_id')  # Get group_id from request
    created_by_admin = session.get('admin_username', 'admin')

    if import_content:
        import_lines = [line.strip() for line in import_content.splitlines() if line.strip()]
        if len(import_lines) != 1:
            return jsonify({
                'success': False,
                'message': '单个添加一次只能识别一条邮箱内容'
            })

        parsed_account, parse_error = parse_mailbox_import_line(import_lines[0])
        if not parsed_account:
            return jsonify({
                'success': False,
                'message': f'邮箱内容识别失败：{parse_error}'
            })

        email = parsed_account['email']
        username = parsed_account.get('username') or email
        password = parsed_account['password']
        auth_type = parsed_account.get('auth_type') or 'password'
        oauth_client_id = parsed_account.get('oauth_client_id') or ''
        oauth_refresh_token = parsed_account.get('oauth_refresh_token') or ''
        remarks = merge_mailbox_remarks(remarks, parsed_account.get('remarks', ''))

        if auth_type == 'graph':
            server = 'imap-mail.outlook.com'
            port = 993
            protocol = 'imap'
            ssl = 1
            send_server = 'smtp-mail.outlook.com'
            send_port = 587
            send_protocol = 'smtp_starttls'
            send_ssl = 0
    
    if not all([email, password, server, port]):
        return jsonify({
            'success': False,
            'message': '请填写所有必需字段'
        })

    normalized_group_id = safe_int(group_id, 0)
    if normalized_group_id > 0 and not _can_manage_group(db, normalized_group_id):
        return jsonify({'success': False, 'message': '分组不存在或无权使用'}), 403
    
    try:
        db_type = app.config['DATABASE_TYPE']
        
        # 检查该邮箱在哪些分组中已存在
        existing_groups = []
        scope_condition, scope_params = _mailbox_scope_condition(db, 'ma')
        visibility_sql = f' AND {scope_condition}' if scope_condition else ''
        if db_type == 'sqlite':
            existing_accounts = db.execute(f'''
                SELECT ma.id, mg.name as group_name, mgm.group_id
                FROM mail_accounts ma
                LEFT JOIN mailbox_group_mappings mgm ON ma.id = mgm.mailbox_id
                LEFT JOIN mailbox_groups mg ON mgm.group_id = mg.id
                WHERE ma.email = ?
                {visibility_sql}
            ''', [email] + scope_params).fetchall()
        else:
            cursor = db.cursor()
            cursor.execute(f'''
                SELECT ma.id, mg.name as group_name, mgm.group_id
                FROM mail_accounts ma
                LEFT JOIN mailbox_group_mappings mgm ON ma.id = mgm.mailbox_id
                LEFT JOIN mailbox_groups mg ON mgm.group_id = mg.id
                WHERE ma.email = %s
                {visibility_sql}
            ''', [email] + scope_params)
            existing_accounts = cursor.fetchall()
        
        # 检查是否在当前分组中已存在
        if group_id and group_id not in ['-1', 'null', 'undefined', '']:
            try:
                group_id_int = int(group_id)
                for account in existing_accounts:
                    account_dict = dict(account) if db_type == 'sqlite' else {
                        'id': account[0],
                        'group_name': account[1],
                        'group_id': account[2]
                    }
                    if account_dict.get('group_id') == group_id_int:
                        return jsonify({
                            'success': False,
                            'message': f'邮箱已存在于当前分组中'
                        })
                    if account_dict.get('group_name'):
                        existing_groups.append(account_dict['group_name'])
            except (ValueError, TypeError):
                pass
        else:
            # 如果未指定分组，收集所有存在的分组信息，并检查是否已在未分组中存在
            has_no_group = False
            for account in existing_accounts:
                account_dict = dict(account) if db_type == 'sqlite' else {
                    'id': account[0],
                    'group_name': account[1],
                    'group_id': account[2]
                }
                if account_dict.get('group_name'):
                    existing_groups.append(account_dict['group_name'])
                else:
                    # 邮箱存在但没有分组
                    has_no_group = True
            
            # 如果在未分组中已存在，阻止添加
            if has_no_group:
                return jsonify({
                    'success': False,
                    'message': '邮箱已存在于未分组中'
                })
        
        # 去重分组列表
        existing_groups = list(dict.fromkeys(existing_groups))  # 保持顺序的去重
        
        # 插入新邮箱
        now = get_beijing_time()
        if db_type == 'sqlite':
            db.execute('''
                INSERT INTO mail_accounts (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, now, now))
            mailbox_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('''
                INSERT INTO mail_accounts (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, now, now))
            mailbox_id = cursor.lastrowid
            db.commit()
        
        # If group_id is provided and valid, create the mapping
        if group_id and group_id not in ['-1', 'null', 'undefined', '']:
            try:
                group_id_int = int(group_id)
                if group_id_int > 0:  # Only create mapping for valid group IDs (not for "所有分组" or "未分组")
                    if db_type == 'sqlite':
                        db.execute('''
                            INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                            VALUES (?, ?, ?)
                        ''', (mailbox_id, group_id_int, now))
                        db.commit()
                    else:
                        cursor = db.cursor()
                        cursor.execute('''
                            INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                            VALUES (%s, %s, %s)
                        ''', (mailbox_id, group_id_int, now))
                        db.commit()
                    
                    # 更新分组的邮箱计数
                    update_mailbox_group_count(db, db_type, group_id_int, delta=1)
                    db.commit()
            except (ValueError, TypeError):
                # Invalid group_id, skip mapping
                pass
        
        # 构建成功消息
        success_message = '邮箱添加成功'
        if existing_groups:
            groups_str = '、'.join(existing_groups)
            success_message = f'邮箱添加成功（邮箱已存在于{groups_str}中）'
        
        return jsonify({
            'success': True,
            'message': success_message
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'添加失败: {str(e)}'
        })


EMAIL_IMPORT_RE = re.compile(r'[\w.!#$%&\'*+/=?^_`{|}~-]+@[\w.-]+\.[A-Za-z]{2,}', re.IGNORECASE)
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

IMPORT_FIELD_ALIASES = {
    'email': {'email', 'mail', 'email_address', 'mail_address', 'account_email', '邮箱', '邮箱地址', '账号', '帐号', '账户', 'account'},
    'username': {'username', 'user', 'login', 'login_name', '登录名', '用户名'},
    'password': {'password', 'passwd', 'pass', 'pwd', 'mail_password', '密码', '邮箱密码', '授权码'},
    'client_id': {'client_id', 'clientid', 'client', 'cid', 'app_id', 'appid', 'application_id', '应用id', '客户端id'},
    'refresh_token': {'refresh_token', 'refreshtoken', 'refresh', 'oauth_token', 'token', '刷新令牌', '刷新token'},
    'recovery_email': {'recovery_email', 'recovery', 'backup_email', 'secondary_email', '辅助邮箱', '恢复邮箱', '备用邮箱'},
    'auth_type': {'auth_type', 'authtype', 'auth', 'login_type', 'receive_type', 'receive', 'api', 'mode', '类型', '收件方式'},
    'remarks': {'remarks', 'remark', 'note', 'notes', '备注'}
}

GRAPH_IMPORT_MARKERS = {
    'graph',
    'graphapi',
    'msgraph',
    'microsoftgraph',
    'microsoftgraphapi',
}


def _clean_import_value(value):
    """清理批量导入字段，兼容 BOM 和包裹引号。"""
    if value is None:
        return ''
    cleaned = str(value).strip().lstrip('\ufeff')
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in ('"', "'"):
        cleaned = cleaned[1:-1].strip()
    return cleaned


def _canonical_import_key(key):
    normalized = re.sub(r'[\s\-]+', '_', _clean_import_value(key).lower())
    while '__' in normalized:
        normalized = normalized.replace('__', '_')
    for canonical, aliases in IMPORT_FIELD_ALIASES.items():
        if normalized in aliases:
            return canonical
    return ''


def _looks_like_refresh_token(value):
    value = _clean_import_value(value)
    if len(value) >= 80:
        return True
    return value.startswith(('M.C', '0.A', '1//')) and len(value) >= 30


def _is_graph_api_marker(value):
    value = _clean_import_value(value)
    if not value:
        return False

    normalized = re.sub(r'[\s_\-:/\\|,;()（）]+', '', value.lower())
    if normalized in GRAPH_IMPORT_MARKERS:
        return True
    return 'graph' in normalized and ('api' in normalized or '收件' in value)


def _split_hyphen_import_line(line):
    """按连续四个连字符切分，并保留字段末尾多出来的连字符。"""
    matches = list(re.finditer(r'-{4,}', line))
    if not matches:
        return line.split('---') if '---' in line else [line]

    parts = []
    start = 0
    for match in matches:
        separator_start = match.end() - 4
        parts.append(line[start:separator_start])
        start = match.end()
    parts.append(line[start:])
    return parts


def _split_import_line(line):
    """按常见批量格式切分一行，优先使用更明确的分隔符。"""
    if re.search(r'-{3,}', line):
        return [_clean_import_value(part) for part in _split_hyphen_import_line(line)]
    if '\t' in line:
        return [_clean_import_value(part) for part in line.split('\t')]

    for delimiter in ('｜', '|', '，', ',', '；', ';'):
        if delimiter in line:
            try:
                return [_clean_import_value(part) for part in next(csv.reader([line], delimiter=delimiter))]
            except Exception:
                return [_clean_import_value(part) for part in line.split(delimiter)]

    email_match = EMAIL_IMPORT_RE.search(line)
    if email_match:
        email = email_match.group(0)
        tail = line[email_match.end():].strip()
        if tail.startswith((':', '：')):
            return [email] + [_clean_import_value(part) for part in re.split(r'[:：]', tail[1:])]

    return [_clean_import_value(part) for part in re.split(r'\s+', line) if part.strip()]


def _is_pipe_graph_oauth_pack(line, tokens, email_index):
    """识别 email|password|refresh_token|client_id|recovery_email 这类 Outlook 数据包。"""
    if '|' not in line or email_index < 0 or len(tokens) < 4:
        return False

    has_refresh_token = False
    has_client_id = False
    has_secondary_email = False

    for index, token in enumerate(tokens):
        if not token or index == email_index:
            continue
        if _looks_like_refresh_token(token):
            has_refresh_token = True
        elif UUID_RE.fullmatch(token):
            has_client_id = True
        elif EMAIL_IMPORT_RE.fullmatch(token):
            has_secondary_email = True

    return has_refresh_token and has_client_id and has_secondary_email


def _parse_key_value_import_line(line):
    """解析 JSON 或 key=value/key:value 形式的导入行。"""
    stripped = line.strip()
    parsed = {}

    if stripped.startswith('{') and stripped.endswith('}'):
        try:
            payload = json.loads(stripped)
            if isinstance(payload, dict):
                for key, value in payload.items():
                    canonical = _canonical_import_key(key)
                    if canonical:
                        parsed[canonical] = _clean_import_value(value)
        except Exception:
            parsed = {}

    if parsed:
        return parsed

    # 将字段之间的显式分隔符归一为空格，再用“下一个 key=”作为值边界。
    # 单个连字符不会被替换，因此 UUID、密码和刷新令牌保持完整。
    normalized_line = line
    if re.search(r'-{3,}', normalized_line):
        normalized_line = ' '.join(_split_hyphen_import_line(normalized_line))
    normalized_line = re.sub(r'[|｜,，;；]+', ' ', normalized_line)
    key_pattern = r'[\w\u4e00-\u9fff\-]+(?:\s+[\w\u4e00-\u9fff\-]+)?'
    pattern = re.compile(
        rf'(?P<key>{key_pattern})\s*[:=：]\s*'
        rf'(?P<value>"[^"]*"|\'[^\']*\'|.*?)'
        rf'(?=\s+(?:{key_pattern})\s*[:=：]|$)',
        re.IGNORECASE,
    )
    for match in pattern.finditer(normalized_line.strip()):
        key = match.group('key')
        value = match.group('value')
        canonical = _canonical_import_key(key)
        if canonical:
            parsed[canonical] = _clean_import_value(value)
        elif _is_graph_api_marker(key) and str(value).strip().lower() not in ('0', 'false', 'no', '否'):
            parsed['auth_type'] = 'graph'

    return parsed


def parse_mailbox_import_line(line):
    """尽可能识别单行邮箱导入内容。"""
    raw_line = _clean_import_value(line)
    if not raw_line:
        return None, '空行'

    parsed = _parse_key_value_import_line(raw_line)
    tokens = _split_import_line(raw_line)

    # 分隔格式必须优先从独立字段中取邮箱。直接在整行搜索时，邮箱域名正则
    # 会把 `----password----client_id...` 这一类仅含字母、数字和连字符的
    # 尾部误当作域名的一部分。
    email = ''
    parsed_email = _clean_import_value(parsed.get('email', ''))
    if parsed_email:
        email_match = EMAIL_IMPORT_RE.search(parsed_email)
        email = _clean_import_value(email_match.group(0)) if email_match else ''

    if not email:
        for token in tokens:
            if EMAIL_IMPORT_RE.fullmatch(token):
                email = _clean_import_value(token)
                break

    if not email:
        email_match = EMAIL_IMPORT_RE.search(raw_line)
        email = _clean_import_value(email_match.group(0)) if email_match else ''

    if not email:
        return None, '未识别到邮箱地址'

    email_index = -1
    for index, token in enumerate(tokens):
        if EMAIL_IMPORT_RE.fullmatch(token):
            email_index = index
            break
        if email in token:
            email_index = index
            break

    username = parsed['username'] if parsed.get('username') and '@' not in parsed.get('username', '') else email
    password = parsed.get('password', '')
    client_id = parsed.get('client_id', '')
    refresh_token = parsed.get('refresh_token', '')
    remarks = parsed.get('remarks', '')
    recovery_email = parsed.get('recovery_email', '')
    graph_api_requested = _is_graph_api_marker(parsed.get('auth_type', '')) or _is_pipe_graph_oauth_pack(raw_line, tokens, email_index) or any(
        _is_graph_api_marker(token) for token in tokens
    )
    used_indexes = set()
    if email_index >= 0:
        used_indexes.add(email_index)

    use_token_fallback = not bool(password)
    ordered_tokens = [] if parsed and not use_token_fallback else [
        (index, token) for index, token in enumerate(tokens) if token and index not in used_indexes
    ]

    if not password:
        if email_index >= 0:
            for index, token in ordered_tokens:
                if index > email_index:
                    password = token
                    used_indexes.add(index)
                    break
        if not password and ordered_tokens:
            index, token = ordered_tokens[0]
            password = token
            used_indexes.add(index)

    for index, token in ordered_tokens:
        if index in used_indexes:
            continue
        if _is_graph_api_marker(token):
            graph_api_requested = True
            used_indexes.add(index)
            continue
        if not client_id and UUID_RE.fullmatch(token):
            client_id = token
            used_indexes.add(index)
            continue
        if not refresh_token and _looks_like_refresh_token(token):
            refresh_token = token
            used_indexes.add(index)
            continue

    extra_parts = []
    for index, token in ordered_tokens:
        if index in used_indexes:
            continue
        if _is_graph_api_marker(token):
            graph_api_requested = True
            used_indexes.add(index)
            continue
        if not client_id and UUID_RE.fullmatch(token):
            client_id = token
        elif not refresh_token and _looks_like_refresh_token(token):
            refresh_token = token
        else:
            extra_parts.append(token)

    if not password:
        return None, '未识别到密码或授权码'

    if graph_api_requested and not (client_id and refresh_token):
        return None, 'Graph API收件需要client_id和refresh_token'

    if extra_parts:
        extra_text = ' | '.join(extra_parts)
        remarks = f'{remarks} | {extra_text}' if remarks else extra_text

    if recovery_email and recovery_email != email:
        recovery_note = f'辅助邮箱：{recovery_email}'
        remarks = f'{remarks} | {recovery_note}' if remarks else recovery_note

    auth_type = 'graph' if graph_api_requested and client_id and refresh_token else ('oauth' if client_id and refresh_token else 'password')
    if auth_type == 'graph' and not remarks:
        remarks = 'Graph API收件'
    elif auth_type == 'oauth' and not remarks:
        remarks = 'OAuth登录'

    return {
        'email': email,
        'username': username,
        'password': password,
        'auth_type': auth_type,
        'oauth_client_id': client_id,
        'oauth_refresh_token': refresh_token,
        'remarks': remarks
    }, ''


def _serialize_mailbox_import_entry(value):
    """把结构化记录转成现有单行解析器可消费的文本。"""
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return _clean_import_value(value)


def _mailbox_import_header_keys(line):
    tokens = _split_import_line(line)
    keys = [_canonical_import_key(token) for token in tokens]
    recognized = [key for key in keys if key]
    if 'email' not in recognized or len(recognized) < 2:
        return []
    return keys


def expand_mailbox_import_entries(content):
    """展开 JSON、带表头 CSV/TSV 和分行键值块，返回可逐条解析的记录。"""
    raw_content = str(content or '').strip().lstrip('\ufeff')
    if not raw_content:
        return []

    # JSON 对象、JSON 数组以及字符串数组。
    if raw_content.startswith(('{', '[')):
        try:
            payload = json.loads(raw_content)
            if isinstance(payload, dict):
                return [_serialize_mailbox_import_entry(payload)]
            if isinstance(payload, list):
                entries = [_serialize_mailbox_import_entry(item) for item in payload]
                return [entry for entry in entries if entry]
        except (TypeError, ValueError, json.JSONDecodeError):
            pass

    source_lines = raw_content.splitlines()
    nonempty_lines = [line.strip() for line in source_lines if line.strip()]
    if not nonempty_lines:
        return []

    # email,password,client_id,refresh_token + 后续数据行（也兼容 Tab/----/竖线）。
    header_keys = _mailbox_import_header_keys(nonempty_lines[0])
    if header_keys and len(nonempty_lines) > 1:
        entries = []
        for row in nonempty_lines[1:]:
            values = _split_import_line(row)
            record = {
                key: values[index]
                for index, key in enumerate(header_keys)
                if key and index < len(values) and values[index]
            }
            if record:
                entries.append(_serialize_mailbox_import_entry(record))
        if entries:
            return entries

    # 一个账号占多行：email: ... / password: ... / client_id: ...。
    if len(nonempty_lines) > 1:
        blocks = []
        current = {}
        multiline_key_values = True
        for raw_line in source_lines:
            line = raw_line.strip()
            if not line:
                if current:
                    blocks.append(current)
                    current = {}
                continue
            fields = _parse_key_value_import_line(line)
            if len(fields) != 1:
                multiline_key_values = False
                break
            key, value = next(iter(fields.items()))
            if key == 'email' and 'email' in current:
                blocks.append(current)
                current = {}
            current[key] = value

        if multiline_key_values:
            if current:
                blocks.append(current)
            if blocks and all(block.get('email') for block in blocks):
                return [_serialize_mailbox_import_entry(block) for block in blocks]

    return nonempty_lines


def merge_mailbox_remarks(default_remarks, parsed_remarks):
    default_remarks = _clean_import_value(default_remarks)
    parsed_remarks = _clean_import_value(parsed_remarks)
    if default_remarks and parsed_remarks:
        return f'{default_remarks} | {parsed_remarks}'
    return default_remarks or parsed_remarks


def _parse_mailbox_import_preview(data):
    """识别单个邮箱导入内容，供添加表单即时预览。"""
    import_content = str(data.get('import_content') or '').strip()
    import_entries = expand_mailbox_import_entries(import_content)
    if not import_entries:
        return jsonify({
            'success': False,
            'message': '请输入需要识别的邮箱内容'
        })
    if len(import_entries) != 1:
        return jsonify({
            'success': False,
            'message': '单个添加一次只能识别一条邮箱内容'
        })

    parsed_account, parse_error = parse_mailbox_import_line(import_entries[0])
    if not parsed_account:
        return jsonify({
            'success': False,
            'message': parse_error or '无法识别邮箱内容'
        })

    return jsonify({
        'success': True,
        'message': '邮箱内容识别成功',
        'data': {
            'email': parsed_account['email'],
            'password': parsed_account['password'],
            'auth_type': parsed_account.get('auth_type') or 'password',
            'remarks': parsed_account.get('remarks') or ''
        }
    })


def _batch_add_mailbox(db, data):
    """批量添加邮箱"""
    batch_content = data.get('batch_content', '').strip()
    server = data.get('server', '').strip()
    port = safe_int(data.get('port', 0))
    protocol = data.get('protocol', 'imap')
    ssl = 1 if data.get('ssl') else 0
    send_server = data.get('send_server', '').strip() or server
    send_protocol = data.get('send_protocol', 'smtp')
    send_ssl_flag = data.get('send_ssl')
    send_ssl = 1 if (send_ssl_flag if send_ssl_flag is not None else data.get('ssl')) else 0
    send_port = normalize_smtp_port(data.get('send_port'), send_protocol, send_ssl == 1)
    remarks = data.get('remarks', '').strip()
    group_id = data.get('group_id')  # Get group_id from request

    if group_id is not None and _get_current_admin_mailbox_scope(db):
        requested_group_id = safe_int(group_id, 0)
        if requested_group_id > 0 and not _can_manage_group(db, requested_group_id):
            return jsonify({'success': False, 'message': '分组不存在或无权修改'}), 403

        db_type = app.config['DATABASE_TYPE']
        if db_type == 'sqlite':
            existing_group_rows = db.execute(
                'SELECT group_id FROM mailbox_group_mappings WHERE mailbox_id = ?',
                (account_id,)
            ).fetchall()
            existing_group_ids = {safe_int(row['group_id'], 0) for row in existing_group_rows}
        else:
            cursor = db.cursor()
            cursor.execute(
                'SELECT group_id FROM mailbox_group_mappings WHERE mailbox_id = %s',
                (account_id,)
            )
            existing_group_ids = {
                safe_int(row['group_id'] if isinstance(row, dict) else row[0], 0)
                for row in cursor.fetchall()
            }
            cursor.close()

        protected_existing = [gid for gid in existing_group_ids if gid > 0 and not _can_manage_group(db, gid)]
        if protected_existing:
            if requested_group_id in existing_group_ids:
                # 保持其他管理员的原分组不变，只编辑邮箱本身。
                group_id = None
            else:
                return jsonify({'success': False, 'message': '无权移动其他管理员分组中的邮箱'}), 403
    
    if not batch_content or not server or not port:
        return jsonify({
            'success': False,
            'message': '请填写批量内容和服务器信息'
        })

    normalized_group_id = safe_int(group_id, 0)
    if normalized_group_id > 0 and not _can_manage_group(db, normalized_group_id):
        return jsonify({'success': False, 'message': '分组不存在或无权使用'}), 403
    
    # 统一展开 JSON/JSON 数组、CSV/TSV 表头、分行键值块和逐行分隔格式。
    entries = expand_mailbox_import_entries(batch_content)
    success_count = 0
    error_count = 0
    errors = []
    notifications = []  # 用于存储非错误的通知信息
    created_mailboxes = []
    db_type = app.config['DATABASE_TYPE']
    created_by_admin = session.get('admin_username', 'admin')
    
    for line_number, line in enumerate(entries, 1):
        try:
            parsed_account, parse_error = parse_mailbox_import_line(line)
            if not parsed_account:
                error_count += 1
                errors.append(f'第 {line_number} 条：{parse_error}')
                continue

            email = parsed_account['email']
            username = parsed_account.get('username') or email
            password = parsed_account['password']
            auth_type = parsed_account.get('auth_type') or 'password'
            oauth_client_id = parsed_account.get('oauth_client_id') or ''
            oauth_refresh_token = parsed_account.get('oauth_refresh_token') or ''
            row_remarks = merge_mailbox_remarks(remarks, parsed_account.get('remarks', ''))
            row_server = server
            row_port = port
            row_protocol = protocol
            row_ssl = ssl
            row_send_server = send_server
            row_send_port = send_port
            row_send_protocol = send_protocol
            row_send_ssl = send_ssl
            if auth_type == 'graph':
                row_server = 'imap-mail.outlook.com'
                row_port = 993
                row_protocol = 'imap'
                row_ssl = 1
                row_send_server = 'smtp-mail.outlook.com'
                row_send_port = 587
                row_send_protocol = 'smtp_starttls'
                row_send_ssl = 0
            
            # 检查该邮箱在哪些分组中已存在（当前分组）
            existing_in_group = False
            existing_groups = []
            scope_condition, scope_params = _mailbox_scope_condition(db, 'ma')
            visibility_sql = f' AND {scope_condition}' if scope_condition else ''
            if db_type == 'sqlite':
                existing_accounts = db.execute(f'''
                    SELECT ma.id, mg.name as group_name, mgm.group_id
                    FROM mail_accounts ma
                    LEFT JOIN mailbox_group_mappings mgm ON ma.id = mgm.mailbox_id
                    LEFT JOIN mailbox_groups mg ON mgm.group_id = mg.id
                    WHERE ma.email = ?
                    {visibility_sql}
                ''', [email] + scope_params).fetchall()
            else:
                cursor = db.cursor()
                cursor.execute(f'''
                    SELECT ma.id, mg.name as group_name, mgm.group_id
                    FROM mail_accounts ma
                    LEFT JOIN mailbox_group_mappings mgm ON ma.id = mgm.mailbox_id
                    LEFT JOIN mailbox_groups mg ON mgm.group_id = mg.id
                    WHERE ma.email = %s
                    {visibility_sql}
                ''', [email] + scope_params)
                existing_accounts = cursor.fetchall()
            
            # 检查是否在当前分组中已存在
            if group_id and group_id not in ['-1', 'null', 'undefined', '']:
                try:
                    group_id_int = int(group_id)
                    for account in existing_accounts:
                        account_dict = dict(account) if db_type == 'sqlite' else {
                            'id': account[0],
                            'group_name': account[1],
                            'group_id': account[2]
                        }
                        if account_dict.get('group_id') == group_id_int:
                            existing_in_group = True
                            break
                        if account_dict.get('group_name'):
                            existing_groups.append(account_dict['group_name'])
                except (ValueError, TypeError):
                    pass
            else:
                # 如果未指定分组，收集所有存在的分组信息，并检查是否已在未分组中存在
                for account in existing_accounts:
                    account_dict = dict(account) if db_type == 'sqlite' else {
                        'id': account[0],
                        'group_name': account[1],
                        'group_id': account[2]
                    }
                    if account_dict.get('group_name'):
                        existing_groups.append(account_dict['group_name'])
                    elif not account_dict.get('group_id'):
                        # 邮箱已在未分组中存在
                        existing_in_group = True
            
            # 去重分组列表
            existing_groups = list(dict.fromkeys(existing_groups))  # 保持顺序的去重
            
            # 如果在当前分组中已存在，跳过
            if existing_in_group:
                error_count += 1
                errors.append(f'邮箱已存在于当前分组：{email}')
                continue
            
            # 插入邮箱
            now = get_beijing_time()
            if db_type == 'sqlite':
                db.execute('''
                    INSERT INTO mail_accounts (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (email, username, password, row_server, row_port, row_protocol, row_ssl, row_send_server, row_send_port, row_send_protocol, row_send_ssl, row_remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, now, now))
                mailbox_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
            else:
                cursor = db.cursor()
                cursor.execute('''
                    INSERT INTO mail_accounts (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (email, username, password, row_server, row_port, row_protocol, row_ssl, row_send_server, row_send_port, row_send_protocol, row_send_ssl, row_remarks, auth_type, oauth_client_id, oauth_refresh_token, created_by_admin, now, now))
                mailbox_id = cursor.lastrowid
            
            # If group_id is provided and valid, create the mapping
            if group_id and group_id not in ['-1', 'null', 'undefined', '']:
                try:
                    group_id_int = int(group_id)
                    if group_id_int > 0:  # Only create mapping for valid group IDs (not for "所有分组" or "未分组")
                        if db_type == 'sqlite':
                            db.execute('''
                                INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                                VALUES (?, ?, ?)
                            ''', (mailbox_id, group_id_int, now))
                        else:
                            cursor = db.cursor()
                            cursor.execute('''
                                INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                                VALUES (%s, %s, %s)
                            ''', (mailbox_id, group_id_int, now))
                except (ValueError, TypeError):
                    # Invalid group_id, skip mapping
                    pass
            
            success_count += 1
            created_mailboxes.append({
                'id': mailbox_id,
                'email': email,
                'auth_type': auth_type
            })
            # 如果有已存在的分组信息，添加到通知列表
            if existing_groups:
                groups_str = '、'.join(existing_groups)
                notifications.append(f'邮箱已存在于{groups_str}中：{email}')
            
        except Exception as e:
            error_count += 1
            errors.append(f'第 {line_number} 条处理失败：{str(e)}')
    
    try:
        db.commit()
        
        # 批量添加完成后，更新分组的邮箱计数
        if group_id and group_id not in ['-1', 'null', 'undefined', ''] and success_count > 0:
            try:
                group_id_int = int(group_id)
                if group_id_int > 0:
                    update_mailbox_group_count(db, db_type, group_id_int, delta=None)
                    db.commit()
            except (ValueError, TypeError):
                pass
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'数据库提交失败: {str(e)}'
        })
    
    message = f'批量添加完成：成功 {success_count} 个，失败 {error_count} 个'
    if errors:
        message += f'\n错误详情：\n' + '\n'.join(errors[:10])  # 只显示前10个错误
    if notifications:
        message += f'\n提示信息：\n' + '\n'.join(notifications[:10])  # 显示前10个通知
    
    return jsonify({
        'success': True,
        'message': message,
        'details': {
            'success_count': success_count,
            'error_count': error_count,
            'errors': errors,
            'notifications': notifications,
            'created_mailboxes': created_mailboxes
        }
    })

def _edit_mailbox(db, data):
    """编辑邮箱"""
    account_id = data.get('id')
    if not account_id:
        return jsonify({
            'success': False,
            'message': '缺少邮箱ID'
        })
    
    # 更新邮箱信息
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    server = data.get('server', '').strip()
    port = safe_int(data.get('port', 0))
    protocol = data.get('protocol', 'imap')
    ssl = 1 if data.get('ssl') else 0
    send_server = data.get('send_server', '').strip() or server
    send_protocol = data.get('send_protocol', 'smtp')
    send_ssl_flag = data.get('send_ssl')
    send_ssl = 1 if (send_ssl_flag if send_ssl_flag is not None else data.get('ssl')) else 0
    send_port = normalize_smtp_port(data.get('send_port'), send_protocol, send_ssl == 1)
    should_update_operator = 'created_by_admin' in data
    created_by_admin = str(data.get('created_by_admin') or '').strip()
    remarks = data.get('remarks', '').strip()
    group_id = data.get('group_id')  # Get group_id from request
    
    try:
        db_type = app.config['DATABASE_TYPE']
        now = get_beijing_time()
        if db_type == 'sqlite':
            operator_sql = ', created_by_admin=?' if should_update_operator else ''
            params = [email, email, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks]
            if should_update_operator:
                params.append(created_by_admin)
            params.extend([now, account_id])
            db.execute(f'''
                UPDATE mail_accounts 
                SET email=?, username=?, password=?, server=?, port=?, protocol=?, ssl=?, send_server=?, send_port=?, send_protocol=?, send_ssl=?, remarks=?{operator_sql}, updated_at=?
                WHERE id=?
            ''', params)
            db.commit()
        else:
            cursor = db.cursor()
            operator_sql = ', created_by_admin=%s' if should_update_operator else ''
            params = [email, email, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks]
            if should_update_operator:
                params.append(created_by_admin)
            params.extend([now, account_id])
            cursor.execute(f'''
                UPDATE mail_accounts 
                SET email=%s, username=%s, password=%s, server=%s, port=%s, protocol=%s, ssl=%s, send_server=%s, send_port=%s, send_protocol=%s, send_ssl=%s, remarks=%s{operator_sql}, updated_at=%s
                WHERE id=%s
            ''', params)
            db.commit()
        
        # Update group mapping if group_id is provided
        if group_id is not None:
            # First, delete existing group mappings for this mailbox
            if db_type == 'sqlite':
                db.execute('DELETE FROM mailbox_group_mappings WHERE mailbox_id = ?', (account_id,))
                db.commit()
            else:
                cursor = db.cursor()
                cursor.execute('DELETE FROM mailbox_group_mappings WHERE mailbox_id = %s', (account_id,))
                db.commit()
            
            # Then, create new mapping if group_id is valid
            if group_id not in ['-1', 'null', 'undefined', '']:
                try:
                    group_id_int = int(group_id)
                    if group_id_int > 0:  # Only create mapping for valid group IDs (not for "所有分组" or "未分组")
                        if db_type == 'sqlite':
                            db.execute('''
                                INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                                VALUES (?, ?, ?)
                            ''', (account_id, group_id_int, now))
                            db.commit()
                        else:
                            cursor = db.cursor()
                            cursor.execute('''
                                INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                                VALUES (%s, %s, %s)
                            ''', (account_id, group_id_int, now))
                            db.commit()
                except (ValueError, TypeError):
                    # Invalid group_id, skip mapping
                    pass
        
        return jsonify({
            'success': True,
            'message': '邮箱更新成功'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'更新失败: {str(e)}'
        })

def _update_mailbox_remarks(db, data):
    """更新邮箱备注"""
    account_id = data.get('id')
    if not account_id:
        return jsonify({
            'success': False,
            'message': '缺少邮箱ID'
        })
    
    remarks = data.get('remarks', '').strip()
    
    try:
        db_type = app.config['DATABASE_TYPE']
        now = get_beijing_time()
        
        if db_type == 'sqlite':
            db.execute('''
                UPDATE mail_accounts 
                SET remarks=?, updated_at=?
                WHERE id=?
            ''', (remarks, now, account_id))
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('''
                UPDATE mail_accounts 
                SET remarks=%s, updated_at=%s
                WHERE id=%s
            ''', (remarks, now, account_id))
            db.commit()
        
        return jsonify({
            'success': True,
            'message': '备注更新成功'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'更新失败: {str(e)}'
        })

def _test_mailbox(db, data):
    """测试邮箱连接"""
    account_id = data.get('id')
    
    try:
        # 获取邮箱信息
        if app.config['DATABASE_TYPE'] == 'sqlite':
            account = db.execute('SELECT * FROM mail_accounts WHERE id = ?', (account_id,)).fetchone()
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM mail_accounts WHERE id = %s', (account_id,))
            account = cursor.fetchone()
        
        if not account:
            return jsonify({
                'success': False,
                'message': '邮箱不存在'
            })
        
        # 调用Python邮件获取器进行测试
        try:
            if app.config['DATABASE_TYPE'] == 'sqlite':
                account_dict = dict(account)
            else:
                columns = [desc[0] for desc in cursor.description]
                account_dict = dict(zip(columns, account))
            
            result = subprocess.run([
                sys.executable, 
                os.path.join(os.path.dirname(__file__), 'python', 'mail_fetcher.py'),
                account_dict['email'],
                '--test-connection'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # 解析JSON输出
                test_result = json.loads(result.stdout)
                test_success = test_result.get('success', False)
                test_message = test_result.get('message', '测试完成')
                
                # 更新测试结果
                now = get_beijing_time()
                if app.config['DATABASE_TYPE'] == 'sqlite':
                    db.execute('''
                        UPDATE mail_accounts 
                        SET last_test=?, test_result=?
                        WHERE id=?
                    ''', (now, test_message, account_id))
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        UPDATE mail_accounts 
                        SET last_test=%s, test_result=%s
                        WHERE id=%s
                    ''', (now, test_message, account_id))
                    db.commit()
                
                return jsonify({
                    'success': test_success,
                    'message': test_message,
                    'last_test': now,
                    'test_result': test_message,
                    'proxy_info': test_result.get('proxy', {}),
                    'diagnostics': test_result.get('diagnostics', {})
                })
            else:
                error_message = result.stderr or "邮箱测试失败"
                
                # 更新测试结果
                now = get_beijing_time()
                if app.config['DATABASE_TYPE'] == 'sqlite':
                    db.execute('''
                        UPDATE mail_accounts 
                        SET last_test=?, test_result=?
                        WHERE id=?
                    ''', (now, error_message, account_id))
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        UPDATE mail_accounts 
                        SET last_test=%s, test_result=%s
                        WHERE id=%s
                    ''', (now, error_message, account_id))
                    db.commit()
                
                return jsonify({
                    'success': False,
                    'message': error_message,
                    'last_test': now,
                    'test_result': error_message
                })
                
        except subprocess.TimeoutExpired:
            return jsonify({
                'success': False,
                'message': '邮箱连接测试超时，请检查网络连接或服务器配置'
            })
        except json.JSONDecodeError:
            return jsonify({
                'success': False,
                'message': '邮箱测试服务响应格式错误'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'邮箱测试服务错误: {str(e)}'
            })
        
    except Exception as e:
        return jsonify({
            'success': False,
                'message': f'测试失败: {str(e)}'
            })

def _send_mail(db, data):
    """使用邮箱发件"""
    account_id = data.get('id')
    to_email = data.get('to', '').strip()
    subject = data.get('subject', '').strip()
    content = data.get('content', '').strip()
    nickname = data.get('nickname', '').strip()
    db_type = app.config['DATABASE_TYPE']
    
    if not account_id or not to_email:
        return jsonify({
            'success': False,
            'message': '请提供邮箱ID和收件人地址'
        })
    
    try:
        # 获取邮箱信息
        if db_type == 'sqlite':
            account = db.execute('SELECT * FROM mail_accounts WHERE id = ?', (account_id,)).fetchone()
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM mail_accounts WHERE id = %s', (account_id,))
            account = cursor.fetchone()
        
        if not account:
            return jsonify({
                'success': False,
                'message': '邮箱不存在'
            })
        
        if db_type == 'sqlite':
            account_dict = dict(account)
        else:
            columns = [desc[0] for desc in cursor.description]
            account_dict = dict(zip(columns, account))
        
        send_server = (account_dict.get('send_server') or account_dict.get('server') or '').strip()
        send_protocol = (account_dict.get('send_protocol') or 'smtp').lower()
        send_ssl_raw = account_dict.get('send_ssl')
        if send_ssl_raw is None:
            send_ssl = True
        else:
            try:
                send_ssl = int(send_ssl_raw) == 1
            except (TypeError, ValueError):
                send_ssl = bool(send_ssl_raw)
        send_port = normalize_smtp_port(account_dict.get('send_port'), send_protocol, send_ssl)
        
        if not send_server or not send_port:
            return jsonify({
                'success': False,
                'message': '请先完善发件服务器信息'
            })
        
        errors = []
        attempt_plan = []
        seen_attempts = set()

        def build_proxy_payload(proxy_cfg):
            if not proxy_cfg:
                return None
            return {
                'enabled': True,
                'info': {
                    'name': proxy_cfg.get('name', ''),
                    'type': proxy_cfg.get('proxy_type', ''),
                    'host': proxy_cfg.get('host', ''),
                    'port': proxy_cfg.get('port', '')
                }
            }
        
        def should_use_ssl(proto, ssl_flag):
            return proto in ('smtp_ssl', 'smtps') or (proto == 'smtp' and ssl_flag)
        
        def add_attempt(proto, port_value, ssl_flag):
            port_val = normalize_smtp_port(port_value, proto, ssl_flag)
            key = (proto, port_val, bool(ssl_flag))
            if key not in seen_attempts:
                seen_attempts.add(key)
                attempt_plan.append(key)
        
        add_attempt(send_protocol, send_port, send_ssl)
        if send_protocol != 'smtp_starttls':
            add_attempt('smtp_starttls', get_default_smtp_port('smtp_starttls', False), False)
        if send_protocol not in ('smtp_ssl', 'smtps'):
            add_attempt('smtp_ssl', get_default_smtp_port('smtp_ssl', True), True)
        
        def build_direct_connector():
            def connector(address, timeout=None):
                return socket.create_connection(address, timeout=timeout or 30)
            return connector
        
        def send_once(conn_label, connector, proto, port_value, ssl_flag):
            smtp_client = None
            try:
                class ProxySMTP(smtplib.SMTP):
                    def _get_socket(self_inner, host, port, timeout):
                        return connector((host, port), timeout)
                class ProxySMTP_SSL(smtplib.SMTP_SSL):
                    def _get_socket(self_inner, host, port, timeout):
                        raw_sock = connector((host, port), timeout)
                        context = self_inner.context
                        if context is None:
                            context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
                            context.check_hostname = True
                            context.verify_mode = ssl.CERT_REQUIRED
                            context.load_default_certs()
                        if hasattr(context, "minimum_version"):
                            context.minimum_version = ssl.TLSVersion.TLSv1_2
                        return context.wrap_socket(raw_sock, server_hostname=self_inner._host)
                
                use_ssl = should_use_ssl(proto, ssl_flag)
                if proto == 'smtp_starttls':
                    smtp_client = ProxySMTP(send_server, port_value, timeout=SMTP_CONNECT_TIMEOUT)
                    smtp_client.ehlo()
                    smtp_client.starttls()
                    smtp_client.ehlo()
                elif use_ssl:
                    smtp_client = ProxySMTP_SSL(send_server, port_value, timeout=SMTP_CONNECT_TIMEOUT)
                    smtp_client.ehlo()
                else:
                    smtp_client = ProxySMTP(send_server, port_value, timeout=SMTP_CONNECT_TIMEOUT)
                    smtp_client.ehlo()
                
                username = account_dict.get('username') or account_dict.get('email')
                password = account_dict.get('password')
                if smtp_client.has_extn('AUTH'):
                    smtp_client.login(username, password)
                elif password:
                    raise Exception("SMTP服务器未提供AUTH扩展，已拒绝使用凭据发送邮件")
                else:
                    logger.info("SMTP服务器未声明AUTH扩展且未配置密码，跳过登录直接发送")
                
                msg = EmailMessage()
                msg['Subject'] = subject or '（无主题）'
                from_email = account_dict.get('email')
                msg['From'] = formataddr((nickname, from_email)) if nickname else from_email
                msg['To'] = to_email
                msg.set_content(content or '')
                
                smtp_client.send_message(msg)
                smtp_client.quit()
                return True, f'邮件发送成功 ({conn_label}, {proto}@{port_value})'
            except Exception as e:
                if smtp_client:
                    try:
                        smtp_client.quit()
                    except:
                        pass
                return False, translate_network_error(e, send_server, port_value)
        
        def attempt_with_connector(label, connector, connection_type, proxy_data=None):
            for proto, port_val, ssl_flag in attempt_plan:
                ok, result = send_once(label, connector, proto, port_val, ssl_flag)
                if ok:
                    payload = {
                        'success': True,
                        'message': result,
                        'connection': connection_type
                    }
                    proxy_payload = build_proxy_payload(proxy_data)
                    if proxy_payload:
                        payload['proxy'] = proxy_payload
                    return jsonify(payload)
                errors.append(f'{label} {proto}@{port_val}: {result}')
            return None
        
        direct_connector = build_direct_connector()
        direct_label = '直连'
        proxy_cfg = _get_active_proxy(db, db_type)
        if proxy_cfg:
            with smtp_proxy_context(proxy_cfg) as (proxy_enabled, proxy_connector):
                if proxy_enabled:
                    resp = attempt_with_connector('代理', proxy_connector, 'proxy', proxy_cfg)
                    if resp:
                        return resp
                    direct_label = '直连(代理失败后)'
        
        resp = attempt_with_connector(direct_label, direct_connector, 'direct')
        if resp:
            return resp
        
        return jsonify({
            'success': False,
            'message': f"发件失败: {'; '.join(errors) if errors else '未知原因'}",
            'connection': 'direct'
        })
        
    except Exception as e:
        # Handle outer exceptions with helper function
        error_msg = translate_network_error(e)
        
        return jsonify({
            'success': False,
            'message': f'发件失败: {error_msg}'
        })

def _test_new_mailbox(data):
    """测试新邮箱连接（无需保存到数据库）"""
    import_content = str(data.get('import_content') or '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    server = data.get('server', '').strip()
    port = safe_int(data.get('port', 0))
    protocol = data.get('protocol', 'imap')
    ssl = data.get('ssl', True)
    send_server = data.get('send_server', '').strip() or server
    send_protocol = data.get('send_protocol', 'smtp')
    send_ssl_flag = data.get('send_ssl')
    send_ssl = 1 if (send_ssl_flag if send_ssl_flag is not None else data.get('ssl', True)) else 0
    send_port = normalize_smtp_port(data.get('send_port'), send_protocol, send_ssl == 1)
    auth_type = 'password'
    oauth_client_id = ''
    oauth_refresh_token = ''

    if import_content:
        import_lines = [line.strip() for line in import_content.splitlines() if line.strip()]
        if len(import_lines) != 1:
            return jsonify({
                'success': False,
                'message': '单个添加一次只能识别一条邮箱内容'
            })
        parsed_account, parse_error = parse_mailbox_import_line(import_lines[0])
        if not parsed_account:
            return jsonify({
                'success': False,
                'message': f'邮箱内容识别失败：{parse_error}'
            })
        email = parsed_account['email']
        password = parsed_account['password']
        auth_type = parsed_account.get('auth_type') or 'password'
        oauth_client_id = parsed_account.get('oauth_client_id') or ''
        oauth_refresh_token = parsed_account.get('oauth_refresh_token') or ''
        if auth_type == 'graph':
            server = 'imap-mail.outlook.com'
            port = 993
            protocol = 'imap'
            ssl = True
            send_server = 'smtp-mail.outlook.com'
            send_port = 587
            send_protocol = 'smtp_starttls'
            send_ssl = 0
    
    if not all([email, password, server, port]):
        return jsonify({
            'success': False,
            'message': '请填写完整的邮箱信息'
        })
    
    try:
        # 临时保存邮箱信息到数据库进行测试
        with app.app_context():
            db = get_db()
            temp_email = f"temp_test_{email}_{int(time.time())}"
            
            # 插入临时邮箱记录
            now = get_beijing_time()
            if app.config['DATABASE_TYPE'] == 'sqlite':
                db.execute('''
                    INSERT INTO mail_accounts (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (temp_email, email, password, server, port, protocol, 1 if ssl else 0, send_server, send_port, send_protocol, send_ssl, '临时测试邮箱', auth_type, oauth_client_id, oauth_refresh_token, now, now))
                db.commit()
            else:
                cursor = db.cursor()
                cursor.execute('''
                    INSERT INTO mail_accounts (email, username, password, server, port, protocol, ssl, send_server, send_port, send_protocol, send_ssl, remarks, auth_type, oauth_client_id, oauth_refresh_token, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (temp_email, email, password, server, port, protocol, 1 if ssl else 0, send_server, send_port, send_protocol, send_ssl, '临时测试邮箱', auth_type, oauth_client_id, oauth_refresh_token, now, now))
                db.commit()
            
            try:
                # 调用Python邮件获取器进行测试
                result = subprocess.run([
                    sys.executable, 
                    os.path.join(os.path.dirname(__file__), 'python', 'mail_fetcher.py'),
                    temp_email,
                    '--test-connection'
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    # 解析JSON输出
                    test_result = json.loads(result.stdout)
                    test_success = test_result.get('success', False)
                    test_message = test_result.get('message', '测试完成')
                    
                    return jsonify({
                        'success': test_success,
                        'message': test_message,
                        'proxy_info': test_result.get('proxy', {}),
                        'diagnostics': test_result.get('diagnostics', {})
                    })
                else:
                    error_message = result.stderr or "邮箱测试失败"
                    return jsonify({
                        'success': False,
                        'message': error_message
                    })
                    
            except subprocess.TimeoutExpired:
                return jsonify({
                    'success': False,
                    'message': '邮箱连接测试超时'
                })
            except json.JSONDecodeError:
                return jsonify({
                    'success': False,
                    'message': '邮箱测试服务响应格式错误'
                })
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'邮箱测试服务错误: {str(e)}'
                })
                
            finally:
                # 删除临时邮箱记录
                try:
                    if app.config['DATABASE_TYPE'] == 'sqlite':
                        db.execute('DELETE FROM mail_accounts WHERE email = ?', (temp_email,))
                        db.commit()
                    else:
                        cursor = db.cursor()
                        cursor.execute('DELETE FROM mail_accounts WHERE email = %s', (temp_email,))
                        db.commit()
                except:
                    pass  # 忽略删除错误
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'测试失败: {str(e)}'
        })

def _batch_delete_mailbox(db, data):
    """批量删除邮箱"""
    account_ids = data.get('ids', [])
    
    if not account_ids:
        return jsonify({
            'success': False,
            'message': '请选择要删除的邮箱'
        })
    
    try:
        db_type = app.config['DATABASE_TYPE']
        
        # 在删除前，获取这些邮箱所属的分组，以便更新计数
        affected_groups = set()
        if db_type == 'sqlite':
            placeholders = ','.join(['?' for _ in account_ids])
            mappings = db.execute(f'SELECT DISTINCT group_id FROM mailbox_group_mappings WHERE mailbox_id IN ({placeholders})', account_ids).fetchall()
            affected_groups = set(m['group_id'] for m in mappings)
            
            # 删除邮箱（CASCADE会自动删除关联的mappings）
            db.execute(f'DELETE FROM mail_accounts WHERE id IN ({placeholders})', account_ids)
            db.commit()
        else:
            cursor = db.cursor()
            placeholders = ','.join(['%s' for _ in account_ids])
            cursor.execute(f'SELECT DISTINCT group_id FROM mailbox_group_mappings WHERE mailbox_id IN ({placeholders})', account_ids)
            affected_groups = set(row[0] for row in cursor.fetchall())
            
            # 删除邮箱（CASCADE会自动删除关联的mappings）
            cursor.execute(f'DELETE FROM mail_accounts WHERE id IN ({placeholders})', account_ids)
            db.commit()
        
        # 更新受影响分组的计数（重新计算，因为可能有多个邮箱从同一分组删除）
        for group_id in affected_groups:
            update_mailbox_group_count(db, db_type, group_id, delta=None)
        
        db.commit()
        
        return jsonify({
            'success': True,
            'message': f'成功删除 {len(account_ids)} 个邮箱'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'批量删除失败: {str(e)}'
        })

@app.route('/admin/api/mailbox-groups', methods=['GET', 'POST', 'DELETE'])
@admin_required
def api_mailbox_groups():
    """邮箱分组管理 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']

    def find_group_duplicate_by_name(name, exclude_id=None):
        normalized_name = (name or '').strip()
        if not normalized_name:
            return None

        protected_names = {'所有分组', '未分组'}
        if normalized_name.lower() in {item.lower() for item in protected_names}:
            return {'id': None, 'name': normalized_name}

        if db_type == 'sqlite':
            if exclude_id:
                row = db.execute('''
                    SELECT id, name FROM mailbox_groups
                    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?
                    LIMIT 1
                ''', (normalized_name, exclude_id)).fetchone()
            else:
                row = db.execute('''
                    SELECT id, name FROM mailbox_groups
                    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
                    LIMIT 1
                ''', (normalized_name,)).fetchone()
            return dict(row) if row else None

        cursor = db.cursor()
        if exclude_id:
            cursor.execute('''
                SELECT id, name FROM mailbox_groups
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s)) AND id != %s
                LIMIT 1
            ''', (normalized_name, exclude_id))
        else:
            cursor.execute('''
                SELECT id, name FROM mailbox_groups
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
                LIMIT 1
            ''', (normalized_name,))
        row = cursor.fetchone()
        if not row:
            return None
        if isinstance(row, dict):
            return row
        return {'id': row[0], 'name': row[1]}
    
    if request.method == 'GET':
        # 获取所有分组及其关联的邮箱
        compact = request.args.get('compact', '') == '1'
        only_mappings = request.args.get('only_mappings', '') == '1'
        try:
            if only_mappings:
                if db_type == 'sqlite':
                    mappings = db.execute('SELECT mailbox_id, group_id FROM mailbox_group_mappings').fetchall()
                else:
                    cursor = db.cursor()
                    cursor.execute('SELECT mailbox_id, group_id FROM mailbox_group_mappings')
                    mappings_data = cursor.fetchall()
                    mappings = [{'mailbox_id': row[0], 'group_id': row[1]} for row in mappings_data]
                _, mappings = _filter_groups_for_current_admin(db, [], mappings)
                return jsonify({
                    'success': True,
                    'groups': [],
                    'mappings': [dict(m) for m in mappings]
                })

            if db_type == 'sqlite':
                group_sql = 'SELECT id, name, parent_id, sort_order, mailbox_count, created_by_admin FROM mailbox_groups ORDER BY parent_id, sort_order, id' if compact else 'SELECT id, name, parent_id, sort_order, is_expanded, mailbox_count, created_by_admin, created_at, updated_at FROM mailbox_groups ORDER BY parent_id, sort_order, id'
                groups = db.execute(group_sql).fetchall()
                must_scope = bool(_get_current_admin_mailbox_scope(db))
                mappings = [] if compact and not must_scope else db.execute('SELECT mailbox_id, group_id FROM mailbox_group_mappings').fetchall()
            else:
                cursor = db.cursor()
                group_sql = 'SELECT id, name, parent_id, sort_order, mailbox_count, created_by_admin FROM mailbox_groups ORDER BY parent_id, sort_order, id' if compact else 'SELECT id, name, parent_id, sort_order, is_expanded, mailbox_count, created_by_admin, created_at, updated_at FROM mailbox_groups ORDER BY parent_id, sort_order, id'
                cursor.execute(group_sql)
                groups_data = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description]
                groups = [dict(zip(columns, row)) for row in groups_data]
                
                if compact and not _get_current_admin_mailbox_scope(db):
                    mappings = []
                else:
                    cursor.execute('SELECT mailbox_id, group_id FROM mailbox_group_mappings')
                    mappings_data = cursor.fetchall()
                    mappings = [{'mailbox_id': row[0], 'group_id': row[1]} for row in mappings_data]
            
            scoped_groups, scoped_mappings = _filter_groups_for_current_admin(db, groups, mappings)
            return jsonify({
                'success': True,
                'groups': scoped_groups,
                'mappings': [] if compact else scoped_mappings
            })
        except Exception as e:
            logger.error(f"Get groups error: {e}")
            return jsonify({
                'success': False,
                'message': f'获取分组失败: {str(e)}'
            })
    
    elif request.method == 'POST':
        data = request.get_json()
        action = data.get('action')
        
        if action == 'add':
            # 添加新分组
            name = data.get('name', '').strip()
            parent_id = data.get('parent_id')
            sort_order = data.get('sort_order', 0)
            
            if not name:
                return jsonify({
                    'success': False,
                    'message': '分组名称不能为空'
                })

            duplicate = find_group_duplicate_by_name(name)
            if duplicate and duplicate.get('id') and _get_current_admin_mailbox_scope(db) and not _can_manage_group(db, duplicate.get('id')):
                duplicate = None
            if duplicate:
                return jsonify({
                    'success': False,
                    'message': f'分组“{duplicate["name"]}”已存在，不能重复添加'
                })
            
            try:
                now = get_beijing_time()
                if parent_id and not _can_manage_group(db, parent_id):
                    return jsonify({'success': False, 'message': '父分组不存在或无权使用'}), 403
                created_by_admin = session.get('admin_username', 'admin')
                if db_type == 'sqlite':
                    cursor = db.execute('''
                        INSERT INTO mailbox_groups (name, parent_id, sort_order, created_by_admin, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (name, parent_id, sort_order, created_by_admin, now, now))
                    group_id = cursor.lastrowid
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        INSERT INTO mailbox_groups (name, parent_id, sort_order, created_by_admin, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (name, parent_id, sort_order, created_by_admin, now, now))
                    group_id = cursor.lastrowid
                    db.commit()
                
                return jsonify({
                    'success': True,
                    'message': '分组添加成功',
                    'group_id': group_id
                })
            except Exception as e:
                logger.error(f"Add group error: {e}")
                return jsonify({
                    'success': False,
                    'message': f'添加分组失败: {str(e)}'
                })
        
        elif action == 'update':
            # 更新分组
            group_id = data.get('id')
            name = data.get('name', '').strip()
            
            if not group_id or not name:
                return jsonify({
                    'success': False,
                    'message': '分组ID和名称不能为空'
                })

            duplicate = find_group_duplicate_by_name(name, group_id)
            if duplicate and duplicate.get('id') and _get_current_admin_mailbox_scope(db) and not _can_manage_group(db, duplicate.get('id')):
                duplicate = None
            if duplicate:
                return jsonify({
                    'success': False,
                    'message': f'分组“{duplicate["name"]}”已存在，不能重复添加'
                })
            
            try:
                if not _can_manage_group(db, group_id):
                    return jsonify({'success': False, 'message': '分组不存在或无权修改'}), 403
                now = get_beijing_time()
                if db_type == 'sqlite':
                    db.execute('''
                        UPDATE mailbox_groups SET name = ?, updated_at = ? WHERE id = ?
                    ''', (name, now, group_id))
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        UPDATE mailbox_groups SET name = %s, updated_at = %s WHERE id = %s
                    ''', (name, now, group_id))
                    db.commit()
                
                return jsonify({
                    'success': True,
                    'message': '分组更新成功'
                })
            except Exception as e:
                logger.error(f"Update group error: {e}")
                return jsonify({
                    'success': False,
                    'message': f'更新分组失败: {str(e)}'
                })
        
        elif action == 'assign':
            # 分配邮箱到分组
            mailbox_id = data.get('mailbox_id')
            group_id = data.get('group_id')
            
            if not mailbox_id:
                return jsonify({
                    'success': False,
                    'message': '邮箱ID不能为空'
                })

            if not _can_access_mailbox(db, mailbox_id):
                return _mailbox_not_found_response()
            if group_id and not _can_manage_group(db, group_id):
                return jsonify({'success': False, 'message': '分组不存在或无权修改'}), 403
            
            try:
                # 获取邮箱原来所属的分组
                old_group_id = None
                if db_type == 'sqlite':
                    old_mapping = db.execute('SELECT group_id FROM mailbox_group_mappings WHERE mailbox_id = ?', (mailbox_id,)).fetchone()
                    if old_mapping:
                        old_group_id = old_mapping['group_id']

                    if old_group_id and _get_current_admin_mailbox_scope(db) and not _can_manage_group(db, old_group_id):
                        return jsonify({'success': False, 'message': '无权移动其他管理员分组中的邮箱'}), 403
                    
                    # 先删除该邮箱的现有分组
                    db.execute('DELETE FROM mailbox_group_mappings WHERE mailbox_id = ?', (mailbox_id,))
                    
                    # 如果指定了分组ID，则添加新的关联
                    if group_id:
                        now = get_beijing_time()
                        db.execute('''
                            INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                            VALUES (?, ?, ?)
                        ''', (mailbox_id, group_id, now))
                    
                    # 更新旧分组的计数（如果存在）
                    if old_group_id:
                        update_mailbox_group_count(db, db_type, old_group_id, delta=-1)
                    
                    # 更新新分组的计数（如果指定了新分组）
                    if group_id:
                        update_mailbox_group_count(db, db_type, group_id, delta=1)
                    
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('SELECT group_id FROM mailbox_group_mappings WHERE mailbox_id = %s', (mailbox_id,))
                    old_mapping = cursor.fetchone()
                    if old_mapping:
                        old_group_id = old_mapping[0]

                    if old_group_id and _get_current_admin_mailbox_scope(db) and not _can_manage_group(db, old_group_id):
                        cursor.close()
                        return jsonify({'success': False, 'message': '无权移动其他管理员分组中的邮箱'}), 403
                    
                    cursor.execute('DELETE FROM mailbox_group_mappings WHERE mailbox_id = %s', (mailbox_id,))
                    
                    if group_id:
                        now = get_beijing_time()
                        cursor.execute('''
                            INSERT INTO mailbox_group_mappings (mailbox_id, group_id, created_at)
                            VALUES (%s, %s, %s)
                        ''', (mailbox_id, group_id, now))
                    
                    # 更新旧分组的计数（如果存在）
                    if old_group_id:
                        update_mailbox_group_count(db, db_type, old_group_id, delta=-1)
                    
                    # 更新新分组的计数（如果指定了新分组）
                    if group_id:
                        update_mailbox_group_count(db, db_type, group_id, delta=1)
                    
                    db.commit()
                
                return jsonify({
                    'success': True,
                    'message': '分组分配成功'
                })
            except Exception as e:
                logger.error(f"Assign group error: {e}")
                return jsonify({
                    'success': False,
                    'message': f'分配分组失败: {str(e)}'
                })
        
        else:
            return jsonify({
                'success': False,
                'message': '未知的操作类型'
            })
    
    elif request.method == 'DELETE':
        # 删除分组
        data = request.get_json()
        group_id = data.get('id')
        
        if not group_id:
            return jsonify({
                'success': False,
                'message': '分组ID不能为空'
            })

        if not _can_manage_group(db, group_id):
            return jsonify({'success': False, 'message': '分组不存在或无权删除'}), 403
        
        try:
            # 删除分组（CASCADE会自动删除子分组和关联）
            if db_type == 'sqlite':
                db.execute('DELETE FROM mailbox_groups WHERE id = ?', (group_id,))
                db.commit()
            else:
                cursor = db.cursor()
                cursor.execute('DELETE FROM mailbox_groups WHERE id = %s', (group_id,))
                db.commit()
            
            return jsonify({
                'success': True,
                'message': '分组删除成功'
            })
        except Exception as e:
            logger.error(f"Delete group error: {e}")
            return jsonify({
                'success': False,
                'message': f'删除分组失败: {str(e)}'
            })

@app.route('/admin/api/servers', methods=['GET', 'POST', 'DELETE'])
@admin_required
def api_admin_servers():
    """服务器地址管理 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    if request.method == 'GET':
        # 获取服务器列表
        if db_type == 'sqlite':
            servers = db.execute('SELECT * FROM server_addresses ORDER BY id ASC').fetchall()
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM server_addresses ORDER BY id ASC')
            servers = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'data': [dict(server) for server in servers]
        })
    
    elif request.method == 'POST':
        data = request.get_json()
        action = data.get('action')
        
        if action == 'add':
            server_name = data.get('server_name', '').strip()
            server_address = data.get('server_address', '').strip()
            send_server_address = data.get('send_server_address', '').strip() or server_address
            default_port_imap = safe_int(data.get('default_port_imap', 993), 993)
            default_port_pop3 = safe_int(data.get('default_port_pop3', 995), 995)
            ssl_enabled = 1 if data.get('ssl_enabled') else 0
            default_port_smtp = safe_int(data.get('default_port_smtp', 465), 465)
            send_ssl_enabled = 1 if data.get('send_ssl_enabled') else 0
            send_protocol = data.get('send_protocol', 'smtp')
            remarks = data.get('remarks', '').strip()
            
            if not all([server_name, server_address, send_server_address]):
                return jsonify({
                    'success': False,
                    'message': '请填写服务器名称和收/发件地址'
                })
            
            try:
                now = get_beijing_time()
                if db_type == 'sqlite':
                    db.execute('''
                        INSERT INTO server_addresses (server_name, server_address, send_server_address, default_port_imap, default_port_pop3, default_port_smtp, ssl_enabled, send_ssl_enabled, send_protocol, remarks, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (server_name, server_address, send_server_address, default_port_imap, default_port_pop3, default_port_smtp, ssl_enabled, send_ssl_enabled, send_protocol, remarks, now, now))
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        INSERT INTO server_addresses (server_name, server_address, send_server_address, default_port_imap, default_port_pop3, default_port_smtp, ssl_enabled, send_ssl_enabled, send_protocol, remarks, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (server_name, server_address, send_server_address, default_port_imap, default_port_pop3, default_port_smtp, ssl_enabled, send_ssl_enabled, send_protocol, remarks, now, now))
                    db.commit()
                
                return jsonify({
                    'success': True,
                    'message': '服务器添加成功'
                })
                
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'添加失败: {str(e)}'
                })
        
        elif action == 'edit':
            server_id = data.get('id')
            if not server_id:
                return jsonify({
                    'success': False,
                    'message': '缺少服务器ID'
                })
            
            server_name = data.get('server_name', '').strip()
            server_address = data.get('server_address', '').strip()
            send_server_address = data.get('send_server_address', '').strip() or server_address
            default_port_imap = safe_int(data.get('default_port_imap', 993), 993)
            default_port_pop3 = safe_int(data.get('default_port_pop3', 995), 995)
            ssl_enabled = 1 if data.get('ssl_enabled') else 0
            default_port_smtp = safe_int(data.get('default_port_smtp', 465), 465)
            send_ssl_enabled = 1 if data.get('send_ssl_enabled') else 0
            send_protocol = data.get('send_protocol', 'smtp')
            remarks = data.get('remarks', '').strip()
            
            try:
                now = get_beijing_time()
                if db_type == 'sqlite':
                    db.execute('''
                        UPDATE server_addresses 
                        SET server_name=?, server_address=?, send_server_address=?, default_port_imap=?, default_port_pop3=?, default_port_smtp=?, ssl_enabled=?, send_ssl_enabled=?, send_protocol=?, remarks=?, updated_at=?
                        WHERE id=?
                    ''', (server_name, server_address, send_server_address, default_port_imap, default_port_pop3, default_port_smtp, ssl_enabled, send_ssl_enabled, send_protocol, remarks, now, server_id))
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        UPDATE server_addresses 
                        SET server_name=%s, server_address=%s, send_server_address=%s, default_port_imap=%s, default_port_pop3=%s, default_port_smtp=%s, ssl_enabled=%s, send_ssl_enabled=%s, send_protocol=%s, remarks=%s, updated_at=%s
                        WHERE id=%s
                    ''', (server_name, server_address, send_server_address, default_port_imap, default_port_pop3, default_port_smtp, ssl_enabled, send_ssl_enabled, send_protocol, remarks, now, server_id))
                    db.commit()
                
                return jsonify({
                    'success': True,
                    'message': '服务器更新成功'
                })
                
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'更新失败: {str(e)}'
                })
    
    elif request.method == 'DELETE':
        data = request.get_json()
        server_ids = data.get('ids', [])
        
        if not server_ids:
            return jsonify({
                'success': False,
                'message': '请选择要删除的服务器'
            })
        
        try:
            if db_type == 'sqlite':
                placeholders = ','.join(['?' for _ in server_ids])
                db.execute(f'DELETE FROM server_addresses WHERE id IN ({placeholders})', server_ids)
                db.commit()
            else:
                cursor = db.cursor()
                placeholders = ','.join(['%s' for _ in server_ids])
                cursor.execute(f'DELETE FROM server_addresses WHERE id IN ({placeholders})', server_ids)
                db.commit()
            
            return jsonify({
                'success': True,
                'message': f'成功删除 {len(server_ids)} 个服务器'
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'删除失败: {str(e)}'
            })

@app.route('/admin/api/proxies/<proxy_type>', methods=['GET', 'POST', 'DELETE'])
@admin_required
def api_admin_proxies(proxy_type):
    """代理管理 API"""
    if proxy_type not in ['http', 'socks5']:
        return jsonify({
            'success': False,
            'message': '无效的代理类型'
        })
    
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    table_name = f'{proxy_type}_proxies'
    
    if request.method == 'GET':
        # 获取代理列表（支持分页和搜索）
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 30))
        search = request.args.get('search', '').strip()
        fast_mode = request.args.get('fast', '0') == '1'  # 快速模式，跳过总数统计
        
        offset = (page - 1) * per_page
        
        # 构建查询条件
        where_clause = ""
        params = []
        if search:
            where_clause = "WHERE name LIKE ? OR host LIKE ? OR remarks LIKE ?"
            search_param = f"%{search}%"
            params = [search_param, search_param, search_param]
        
        # 获取总数和数据
        if db_type == 'sqlite':
            total = None
            if not fast_mode:
                count_sql = f"SELECT COUNT(*) as count FROM {table_name} {where_clause}"
                count_result = db.execute(count_sql, params).fetchone()
                total = count_result['count']
            
            sql = f"""
                SELECT * FROM {table_name} {where_clause}
                ORDER BY id DESC 
                LIMIT ? OFFSET ?
            """
            proxies = db.execute(sql, params + [per_page, offset]).fetchall()
        else:
            cursor = db.cursor()
            placeholder = '%s'
            where_mysql = where_clause.replace('?', placeholder) if where_clause else ""
            
            total = None
            if not fast_mode:
                count_sql = f"SELECT COUNT(*) as count FROM {table_name} {where_mysql}"
                cursor.execute(count_sql, params)
                total = cursor.fetchone()['count'] if db_type == 'postgresql' else cursor.fetchone()[0]
            
            sql = f"""
                SELECT * FROM {table_name} {where_mysql}
                ORDER BY id DESC 
                LIMIT {per_page} OFFSET {offset}
            """
            cursor.execute(sql, params)
            proxies = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'data': [dict(proxy) for proxy in proxies],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
    
    elif request.method == 'POST':
        data = request.get_json()
        action = data.get('action')
        
        if action == 'add':
            return _add_proxy(db, table_name, data, proxy_type)
        elif action == 'edit':
            return _edit_proxy(db, table_name, data)
        elif action == 'test':
            return _test_proxy(db, table_name, data, proxy_type)
        elif action == 'test_new':
            return _test_new_proxy(data, proxy_type)
        elif action == 'batch_delete':
            return _batch_delete_proxy(db, table_name, data)
        else:
            return jsonify({
                'success': False,
                'message': '无效的操作类型'
            })
    
    elif request.method == 'DELETE':
        data = request.get_json()
        proxy_id = data.get('id')
        
        if not proxy_id:
            return jsonify({
                'success': False,
                'message': '缺少代理ID'
            })
        
        try:
            if db_type == 'sqlite':
                db.execute(f'DELETE FROM {table_name} WHERE id = ?', (proxy_id,))
                db.commit()
            else:
                cursor = db.cursor()
                cursor.execute(f'DELETE FROM {table_name} WHERE id = %s', (proxy_id,))
                db.commit()
            
            # 清理孤立的统一代理ID记录并重新排序ID，确保ID连续
            cleanup_orphaned_proxy_ids(db, db_type)
            reorder_unified_proxy_ids(db, db_type)
            
            return jsonify({
                'success': True,
                'message': '代理删除成功'
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'删除失败: {str(e)}'
            })

def _add_proxy(db, table_name, data, proxy_type):
    """添加代理"""
    name = data.get('name', '').strip()
    host = data.get('host', '').strip()
    port_value = data.get('port')
    
    # Handle port conversion more safely
    try:
        port = int(port_value) if port_value is not None else 0
    except (ValueError, TypeError):
        port = 0
    
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    remarks = data.get('remarks', '').strip()
    
    if not all([host, port]):
        return jsonify({
            'success': False,
            'message': '请填写代理地址和端口'
        })
    
    # 如果没有提供名称，保持为空字符串
    if not name:
        name = ""
    
    try:
        now = get_beijing_time()
        
        # 先插入代理记录（不包含unified_id）
        if app.config['DATABASE_TYPE'] == 'sqlite':
            cursor = db.execute(f'''
                INSERT INTO {table_name} (name, host, port, username, password, remarks, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (name, host, port, username, password, remarks, now, now))
            proxy_id = cursor.lastrowid
        else:
            cursor = db.cursor()
            cursor.execute(f'''
                INSERT INTO {table_name} (name, host, port, username, password, remarks, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (name, host, port, username, password, remarks, now, now))
            proxy_id = cursor.lastrowid
            
        # 获取统一ID
        unified_id = get_next_unified_proxy_id(db, proxy_type, proxy_id)
        
        # 更新代理记录的unified_id（如果列存在）
        try:
            update_proxy_unified_id(db, table_name, proxy_id, unified_id)
        except:
            # 如果unified_id列不存在，继续执行
            pass
        
        db.commit()
        
        return jsonify({
            'success': True,
            'message': f'{proxy_type.upper()}代理添加成功'
        })
        
    except Exception as e:
        logger.error(f"Error adding proxy: {e}")
        return jsonify({
            'success': False,
            'message': f'添加失败: {str(e)}'
        })

def _edit_proxy(db, table_name, data):
    """编辑代理"""
    proxy_id = data.get('id')
    if not proxy_id:
        return jsonify({
            'success': False,
            'message': '缺少代理ID'
        })
    
    name = data.get('name', '').strip()
    host = data.get('host', '').strip()
    port_value = data.get('port')
    
    # Handle port conversion more safely
    try:
        port = int(port_value) if port_value is not None else 0
    except (ValueError, TypeError):
        port = 0
    
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    remarks = data.get('remarks', '').strip()
    
    try:
        now = get_beijing_time()
        if app.config['DATABASE_TYPE'] == 'sqlite':
            db.execute(f'''
                UPDATE {table_name}
                SET name=?, host=?, port=?, username=?, password=?, remarks=?, updated_at=?
                WHERE id=?
            ''', (name, host, port, username, password, remarks, now, proxy_id))
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute(f'''
                UPDATE {table_name}
                SET name=%s, host=%s, port=%s, username=%s, password=%s, remarks=%s, updated_at=%s
                WHERE id=%s
            ''', (name, host, port, username, password, remarks, now, proxy_id))
            db.commit()
        
        return jsonify({
            'success': True,
            'message': '代理更新成功'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'更新失败: {str(e)}'
        })

def _test_proxy(db, table_name, data, proxy_type):
    """测试代理"""
    proxy_id = data.get('id')
    
    try:
        # 获取代理信息
        if app.config['DATABASE_TYPE'] == 'sqlite':
            proxy = db.execute(f'SELECT * FROM {table_name} WHERE id = ?', (proxy_id,)).fetchone()
        else:
            cursor = db.cursor()
            cursor.execute(f'SELECT * FROM {table_name} WHERE id = %s', (proxy_id,))
            proxy = cursor.fetchone()
        
        if not proxy:
            return jsonify({
                'success': False,
                'message': '代理不存在'
            })
        
        # 测试代理连接
        test_results = _perform_proxy_test(proxy, proxy_type)
        
        # 更新测试结果
        now = get_beijing_time()
        response_time = test_results.get('avg_response_time', 0)
        
        if app.config['DATABASE_TYPE'] == 'sqlite':
            db.execute(f'''
                UPDATE {table_name}
                SET last_check=?, response_time=?, status=?
                WHERE id=?
            ''', (now, response_time, 1 if test_results['success'] else 0, proxy_id))
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute(f'''
                UPDATE {table_name}
                SET last_check=%s, response_time=%s, status=%s
                WHERE id=%s
            ''', (now, response_time, 1 if test_results['success'] else 0, proxy_id))
            db.commit()
        
        return jsonify({
            'success': test_results['success'],
            'message': test_results['message'],
            'details': test_results
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'测试失败: {str(e)}'
        })

def _test_new_proxy(data, proxy_type):
    """测试新代理（无需保存到数据库）"""
    host = data.get('host', '').strip()
    port_value = data.get('port')
    
    # Handle port conversion more safely
    try:
        port = int(port_value) if port_value is not None else 0
    except (ValueError, TypeError):
        port = 0
    
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip() or f"临时代理"
    
    if not all([host, port]):
        return jsonify({
            'success': False,
            'message': '请填写代理地址和端口'
        })
    
    try:
        # Create temporary proxy dict for testing
        proxy_dict = {
            'host': host,
            'port': port,
            'username': username or None,
            'password': password or None,
            'name': name
        }
        
        # Test proxy connection
        test_results = _perform_proxy_test(proxy_dict, proxy_type)
        
        return jsonify({
            'success': test_results['success'],
            'message': test_results['message'],
            'details': test_results
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'测试失败: {str(e)}'
        })

def _perform_proxy_test(proxy, proxy_type):
    """执行代理测试 - 优化版本"""
    try:
        host = proxy['host']
        port = proxy['port']
        username = proxy['username'] or None
        password = proxy['password'] or None
        
        # 优化测试目标 - 使用baidu.com和163.com进行测试
        # 增加超时时间到30秒以适应高延迟代理
        test_urls = [
            ('http://baidu.com', 30),          # 百度网站，超时30秒
            ('http://163.com', 30)             # 网易163网站，超时30秒
        ]
        results = []
        
        for url, timeout in test_urls:
            start_time = time.time()
            try:
                if proxy_type == 'http':
                    proxies = {
                        'http': f'http://{username}:{password}@{host}:{port}' if username else f'http://{host}:{port}',
                        'https': f'http://{username}:{password}@{host}:{port}' if username else f'http://{host}:{port}'
                    }
                else:  # socks5
                    proxies = {
                        'http': f'socks5://{username}:{password}@{host}:{port}' if username else f'socks5://{host}:{port}',
                        'https': f'socks5://{username}:{password}@{host}:{port}' if username else f'socks5://{host}:{port}'
                    }
                
                # 优化请求设置
                response = requests.get(
                    url, 
                    proxies=proxies, 
                    timeout=timeout,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache'
                    },
                    allow_redirects=True,
                    verify=False  # 跳过SSL验证以提高速度
                )
                response_time = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    results.append({
                        'url': url,
                        'success': True,
                        'response_time': response_time,
                        'status_code': response.status_code
                    })
                    # 注释掉早期中断，确保测试所有URL以显示完整的测试结果
                    # if url == test_urls[0][0]:
                    #     break
                elif response.status_code == 403 and ('163.com' in url or 'baidu.com' in url):
                    # 这些网站的403错误视为网站限制，不算失败
                    results.append({
                        'url': url,
                        'success': True,  # 标记为成功，因为代理工作正常
                        'response_time': response_time,
                        'error': '网站限制(403) - 代理工作正常',
                        'status_code': response.status_code
                    })
                else:
                    results.append({
                        'url': url,
                        'success': False,
                        'response_time': response_time,
                        'error': f'HTTP {response.status_code}',
                        'status_code': response.status_code
                    })
                    
            except requests.exceptions.ConnectTimeout:
                elapsed = int((time.time() - start_time) * 1000)
                results.append({
                    'url': url,
                    'success': False,
                    'response_time': elapsed,
                    'error': f'连接超时(>{timeout}s)'
                })
            except requests.exceptions.ProxyError as e:
                results.append({
                    'url': url,
                    'success': False,
                    'response_time': int((time.time() - start_time) * 1000),
                    'error': f'代理错误: {str(e)}'
                })
            except requests.exceptions.RequestException as e:
                error_msg = str(e)
                # 对于特定网站的限制，给出更友好的提示
                if ('163.com' in url or 'baidu.com' in url) and ('403' in error_msg or 'Forbidden' in error_msg):
                    results.append({
                        'url': url,
                        'success': True,
                        'response_time': int((time.time() - start_time) * 1000),
                        'error': '网站限制 - 代理工作正常'
                    })
                else:
                    results.append({
                        'url': url,
                        'success': False,
                        'response_time': int((time.time() - start_time) * 1000),
                        'error': error_msg
                    })
            except Exception as e:
                results.append({
                    'url': url,
                    'success': False,
                    'response_time': int((time.time() - start_time) * 1000),
                    'error': str(e)
                })
        
        # 计算结果 - 优先考虑成功的测试
        successful_tests = [r for r in results if r['success']]
        
        if successful_tests:
            # 使用第一个成功测试的响应时间
            avg_response_time = successful_tests[0]['response_time']
            
            # 根据延迟给出更详细的信息
            if avg_response_time > 10000:  # 超过10秒
                message = f"测试成功(高延迟)，延迟: {avg_response_time}ms"
            elif avg_response_time > 5000:  # 超过5秒
                message = f"测试成功(较慢)，延迟: {avg_response_time}ms"
            else:
                message = f"测试成功，延迟: {avg_response_time}ms"
            
            # 添加成功比例信息
            if len(results) > 1:
                message += f"，成功: {len(successful_tests)}/{len(results)}"
                
            return {
                'success': True,
                'message': message,
                'avg_response_time': avg_response_time,
                'results': results
            }
        else:
            # 所有测试都失败 - 简化错误消息，避免显示复杂的堆栈信息
            return {
                'success': False,
                'message': "测试失败",
                'avg_response_time': 0,
                'results': results
            }
            
    except Exception as e:
        return {
            'success': False,
            'message': '测试失败',
            'avg_response_time': 0,
            'results': []
        }

def _batch_delete_proxy(db, table_name, data):
    """批量删除代理"""
    proxy_ids = data.get('ids', [])
    
    if not proxy_ids:
        return jsonify({
            'success': False,
            'message': '请选择要删除的代理'
        })
    
    try:
        if app.config['DATABASE_TYPE'] == 'sqlite':
            placeholders = ','.join(['?' for _ in proxy_ids])
            db.execute(f'DELETE FROM {table_name} WHERE id IN ({placeholders})', proxy_ids)
            db.commit()
        else:
            cursor = db.cursor()
            placeholders = ','.join(['%s' for _ in proxy_ids])
            cursor.execute(f'DELETE FROM {table_name} WHERE id IN ({placeholders})', proxy_ids)
            db.commit()
        
        # 清理孤立的统一代理ID记录并重新排序ID，确保ID连续
        cleanup_orphaned_proxy_ids(db, app.config['DATABASE_TYPE'])
        reorder_unified_proxy_ids(db, app.config['DATABASE_TYPE'])
        
        return jsonify({
            'success': True,
            'message': f'成功删除 {len(proxy_ids)} 个代理'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'批量删除失败: {str(e)}'
        })

@app.route('/admin/api/proxy-config', methods=['GET', 'POST'])
@admin_required
def api_admin_proxy_config():
    """代理配置管理 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    if request.method == 'GET':
        # 获取代理配置
        try:
            if db_type == 'sqlite':
                config_rows = db.execute('SELECT * FROM proxy_config').fetchall()
            else:
                cursor = db.cursor()
                cursor.execute('SELECT * FROM proxy_config')
                config_rows = cursor.fetchall()
            
            # 转换为字典
            config = {}
            for row in config_rows:
                if db_type == 'sqlite':
                    config[row['config_key']] = row['config_value']
                else:
                    config[row[1]] = row[2]  # config_key, config_value
            
            # 获取当前激活的代理信息
            active_proxy = None
            if config.get('proxy_enabled') == '1':
                proxy_type = config.get('active_proxy_type', '')
                proxy_id = int(config.get('active_proxy_id', '0'))
                
                if proxy_type and proxy_id > 0:
                    table_name = 'socks5_proxies' if proxy_type == 'socks5' else 'http_proxies'
                    
                    if db_type == 'sqlite':
                        proxy = db.execute(f'SELECT * FROM {table_name} WHERE id = ?', (proxy_id,)).fetchone()
                    else:
                        cursor = db.cursor()
                        cursor.execute(f'SELECT * FROM {table_name} WHERE id = %s', (proxy_id,))
                        proxy = cursor.fetchone()
                    
                    if proxy:
                        if db_type == 'sqlite':
                            active_proxy = dict(proxy)
                        else:
                            columns = [desc[0] for desc in cursor.description]
                            active_proxy = dict(zip(columns, proxy))
                        active_proxy['proxy_type'] = proxy_type
            
            return jsonify({
                'success': True,
                'config': config,
                'active_proxy': active_proxy
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'获取代理配置失败: {str(e)}'
            })
    
    elif request.method == 'POST':
        # 更新代理配置
        data = request.get_json()
        action = data.get('action')
        
        try:
            if action == 'enable_proxy':
                # 开启代理功能 - 测试所有代理，自动选择延迟最低的代理启用
                
                # 获取所有可用的代理
                all_proxies = []
                
                # 获取HTTP代理
                if db_type == 'sqlite':
                    http_proxies = db.execute('SELECT * FROM http_proxies WHERE status = 1').fetchall()
                else:
                    cursor = db.cursor()
                    cursor.execute('SELECT * FROM http_proxies WHERE status = 1')
                    http_proxies = cursor.fetchall()
                
                if http_proxies:
                    for proxy in http_proxies:
                        if db_type == 'sqlite':
                            proxy_dict = dict(proxy)
                        else:
                            columns = [desc[0] for desc in cursor.description]
                            proxy_dict = dict(zip(columns, proxy))
                        proxy_dict['proxy_type'] = 'http'
                        all_proxies.append(proxy_dict)
                
                # 获取SOCKS5代理
                if db_type == 'sqlite':
                    socks5_proxies = db.execute('SELECT * FROM socks5_proxies WHERE status = 1').fetchall()
                else:
                    cursor = db.cursor()
                    cursor.execute('SELECT * FROM socks5_proxies WHERE status = 1')
                    socks5_proxies = cursor.fetchall()
                
                if socks5_proxies:
                    for proxy in socks5_proxies:
                        if db_type == 'sqlite':
                            proxy_dict = dict(proxy)
                        else:
                            columns = [desc[0] for desc in cursor.description]
                            proxy_dict = dict(zip(columns, proxy))
                        proxy_dict['proxy_type'] = 'socks5'
                        all_proxies.append(proxy_dict)
                
                if not all_proxies:
                    return jsonify({
                        'success': False,
                        'message': '没有找到可用的代理配置'
                    })
                
                # 测试所有代理，选择延迟最低的
                best_proxy = None
                best_response_time = float('inf')
                test_results = []
                
                for proxy in all_proxies:
                    try:
                        # 测试代理连接
                        test_result = _perform_proxy_test(proxy, proxy['proxy_type'])
                        test_results.append({
                            'proxy': proxy,
                            'result': test_result
                        })
                        
                        # 如果测试成功且延迟更低，更新最佳代理
                        if test_result['success'] and test_result['avg_response_time'] < best_response_time:
                            best_proxy = proxy
                            best_response_time = test_result['avg_response_time']
                            
                            # 更新数据库中的响应时间
                            table_name = f"{proxy['proxy_type']}_proxies"
                            now = get_beijing_time()
                            
                            if db_type == 'sqlite':
                                db.execute(f'''
                                    UPDATE {table_name}
                                    SET last_check=?, response_time=?
                                    WHERE id=?
                                ''', (now, test_result['avg_response_time'], proxy['id']))
                            else:
                                cursor = db.cursor()
                                cursor.execute(f'''
                                    UPDATE {table_name}
                                    SET last_check=%s, response_time=%s
                                    WHERE id=%s
                                ''', (now, test_result['avg_response_time'], proxy['id']))
                        
                    except Exception as e:
                        test_results.append({
                            'proxy': proxy,
                            'result': {
                                'success': False,
                                'message': f'测试失败: {str(e)}',
                                'avg_response_time': 0
                            }
                        })
                
                if not best_proxy:
                    # 如果没有测试成功的代理，选择ID最小的作为备用
                    all_proxies.sort(key=lambda x: x['id'])
                    best_proxy = all_proxies[0]
                    proxy_type = best_proxy['proxy_type']
                    proxy_id = best_proxy['id']
                    
                    # 更新代理配置
                    config_updates = [
                        ('proxy_enabled', '1'),
                        ('active_proxy_type', proxy_type),
                        ('active_proxy_id', str(proxy_id))
                    ]
                    
                    for key, value in config_updates:
                        if db_type == 'sqlite':
                            db.execute('''
                                INSERT OR REPLACE INTO proxy_config (config_key, config_value, updated_at)
                                VALUES (?, ?, CURRENT_TIMESTAMP)
                            ''', (key, value))
                        else:
                            cursor = db.cursor()
                            cursor.execute('''
                                INSERT INTO proxy_config (config_key, config_value, updated_at)
                                VALUES (%s, %s, CURRENT_TIMESTAMP)
                                ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP
                            ''' if db_type == 'mysql' else '''
                                INSERT INTO proxy_config (config_key, config_value, updated_at)
                                VALUES (%s, %s, CURRENT_TIMESTAMP)
                                ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP
                            ''', (key, value))
                    
                    if db_type != 'sqlite':
                        db.commit()
                    else:
                        db.commit()
                    
                    proxy_name = best_proxy.get('name', '')
                    return jsonify({
                        'success': True,
                        'message': f'🟢 代理状态：已启用\n当前代理: {proxy_type.upper()}--{proxy_name}--地址: {best_proxy["host"]}:{best_proxy["port"]}，所有代理测试均失败，已选择ID最小的代理'
                    })
                
                # 找到最佳代理，更新配置
                proxy_type = best_proxy['proxy_type']
                proxy_id = best_proxy['id']
                
                config_updates = [
                    ('proxy_enabled', '1'),
                    ('active_proxy_type', proxy_type),
                    ('active_proxy_id', str(proxy_id))
                ]
                
                for key, value in config_updates:
                    if db_type == 'sqlite':
                        db.execute('''
                            INSERT OR REPLACE INTO proxy_config (config_key, config_value, updated_at)
                            VALUES (?, ?, CURRENT_TIMESTAMP)
                        ''', (key, value))
                    else:
                        cursor = db.cursor()
                        cursor.execute('''
                            INSERT INTO proxy_config (config_key, config_value, updated_at)
                            VALUES (%s, %s, CURRENT_TIMESTAMP)
                            ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP
                        ''' if db_type == 'mysql' else '''
                            INSERT INTO proxy_config (config_key, config_value, updated_at)
                            VALUES (%s, %s, CURRENT_TIMESTAMP)
                            ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP
                        ''', (key, value))
                
                if db_type != 'sqlite':
                    db.commit()
                else:
                    db.commit()
                
                proxy_name = best_proxy.get('name', '')
                return jsonify({
                    'success': True,
                    'message': f'🟢 代理状态：已启用\n当前代理: {proxy_type.upper()}--{proxy_name}--地址: {best_proxy["host"]}:{best_proxy["port"]}，平均延迟: {best_response_time}ms'
                })
                
            elif action == 'disable_proxy':
                # 关闭代理功能
                if db_type == 'sqlite':
                    db.execute('''
                        INSERT OR REPLACE INTO proxy_config (config_key, config_value, updated_at)
                        VALUES ('proxy_enabled', '0', CURRENT_TIMESTAMP)
                    ''')
                    db.commit()
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        INSERT INTO proxy_config (config_key, config_value, updated_at)
                        VALUES (%s, %s, CURRENT_TIMESTAMP)
                        ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP
                    ''' if db_type == 'mysql' else '''
                        INSERT INTO proxy_config (config_key, config_value, updated_at)
                        VALUES (%s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP
                    ''', ('proxy_enabled', '0'))
                    db.commit()
                
                return jsonify({
                    'success': True,
                    'message': '代理已关闭'
                })
                
            elif action == 'switch_proxy':
                # 切换代理
                proxy_type = data.get('proxy_type')
                proxy_id = int(data.get('proxy_id', 0))
                
                if not proxy_type or not proxy_id:
                    return jsonify({
                        'success': False,
                        'message': '请提供代理类型和ID'
                    })
                
                # 验证代理是否存在
                table_name = 'socks5_proxies' if proxy_type == 'socks5' else 'http_proxies'
                
                if db_type == 'sqlite':
                    proxy = db.execute(f'SELECT * FROM {table_name} WHERE id = ? AND status = 1', (proxy_id,)).fetchone()
                else:
                    cursor = db.cursor()
                    cursor.execute(f'SELECT * FROM {table_name} WHERE id = %s AND status = 1', (proxy_id,))
                    proxy = cursor.fetchone()
                
                if not proxy:
                    return jsonify({
                        'success': False,
                        'message': '代理不存在或已禁用'
                    })
                
                # 更新配置
                config_updates = [
                    ('proxy_enabled', '1'),
                    ('active_proxy_type', proxy_type),
                    ('active_proxy_id', str(proxy_id))
                ]
                
                for key, value in config_updates:
                    if db_type == 'sqlite':
                        db.execute('''
                            INSERT OR REPLACE INTO proxy_config (config_key, config_value, updated_at)
                            VALUES (?, ?, CURRENT_TIMESTAMP)
                        ''', (key, value))
                    else:
                        cursor = db.cursor()
                        cursor.execute('''
                            INSERT INTO proxy_config (config_key, config_value, updated_at)
                            VALUES (%s, %s, CURRENT_TIMESTAMP)
                            ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP
                        ''' if db_type == 'mysql' else '''
                            INSERT INTO proxy_config (config_key, config_value, updated_at)
                            VALUES (%s, %s, CURRENT_TIMESTAMP)
                            ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP
                        ''', (key, value))
                
                if db_type != 'sqlite':
                    db.commit()
                else:
                    db.commit()
                
                # 获取代理信息
                if db_type == 'sqlite':
                    proxy_dict = dict(proxy)
                else:
                    cursor.execute(f'DESCRIBE {table_name}' if db_type == 'mysql' else 
                                 f'SELECT column_name FROM information_schema.columns WHERE table_name = \'{table_name}\'')
                    columns = [row[0] for row in cursor.fetchall()]
                    proxy_dict = dict(zip(columns, proxy))
                
                proxy_name = proxy_dict.get('name', '')
                return jsonify({
                    'success': True,
                    'message': f'🟢 代理状态：已启用\n当前代理: {proxy_type.upper()}--{proxy_name}--地址: {proxy_dict["host"]}:{proxy_dict["port"]}'
                })
            
            else:
                return jsonify({
                    'success': False,
                    'message': '无效的操作'
                })
                
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'操作失败: {str(e)}'
            })

def normalize_mailbox_id_list(value):
    """把前端传入的单个/多个邮箱ID统一清洗成去重后的整数列表"""
    if value is None or value == '':
        return []
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                value = parsed
            else:
                value = [parsed]
        except Exception:
            value = re.split(r'[\s,，;；]+', stripped)
    elif not isinstance(value, (list, tuple, set)):
        value = [value]

    result = []
    seen = set()
    for item in value:
        try:
            mailbox_id = int(item)
        except (TypeError, ValueError):
            continue
        if mailbox_id > 0 and mailbox_id not in seen:
            seen.add(mailbox_id)
            result.append(mailbox_id)
    return result

def fetch_card_bound_mailboxes(db, db_type, card_id, legacy_bound_email_id=None):
    """读取某张卡密绑定的邮箱列表，兼容旧 cards.bound_email_id 字段"""
    if not card_id:
        return []

    rows = []
    try:
        scope_condition, scope_params = _mailbox_scope_condition(db, 'm')
        scope_sql = f' AND {scope_condition}' if scope_condition else ''
        if db_type == 'sqlite':
            rows = db.execute(f'''
                SELECT m.id, m.email, m.server
                FROM card_email_bindings ceb
                JOIN mail_accounts m ON m.id = ceb.mailbox_id
                WHERE ceb.card_id = ?
                {scope_sql}
                ORDER BY ceb.id ASC
            ''', [card_id] + scope_params).fetchall()
            mailboxes = [dict(row) for row in rows]
        else:
            cursor = db.cursor()
            cursor.execute(f'''
                SELECT m.id, m.email, m.server
                FROM card_email_bindings ceb
                JOIN mail_accounts m ON m.id = ceb.mailbox_id
                WHERE ceb.card_id = %s
                {scope_sql}
                ORDER BY ceb.id ASC
            ''', [card_id] + scope_params)
            result_rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            mailboxes = [_row_to_dict(row, columns) for row in result_rows]
    except Exception as e:
        logger.warning(f"Failed to fetch card email bindings for card {card_id}: {e}")
        mailboxes = []

    if legacy_bound_email_id and _can_access_mailbox(db, legacy_bound_email_id) and not any(str(m.get('id')) == str(legacy_bound_email_id) for m in mailboxes):
        try:
            if db_type == 'sqlite':
                legacy = db.execute('SELECT id, email, server FROM mail_accounts WHERE id = ?', (legacy_bound_email_id,)).fetchone()
                if legacy:
                    mailboxes.insert(0, dict(legacy))
            else:
                cursor = db.cursor()
                cursor.execute('SELECT id, email, server FROM mail_accounts WHERE id = %s', (legacy_bound_email_id,))
                legacy = cursor.fetchone()
                if legacy:
                    columns = [desc[0] for desc in cursor.description]
                    mailboxes.insert(0, _row_to_dict(legacy, columns))
        except Exception as e:
            logger.warning(f"Failed to fetch legacy bound mailbox {legacy_bound_email_id}: {e}")

    deduped = []
    seen = set()
    for mailbox in mailboxes:
        mailbox_id = mailbox.get('id')
        if mailbox_id in seen:
            continue
        seen.add(mailbox_id)
        deduped.append(mailbox)
    return deduped

def attach_card_bound_mailboxes(db, db_type, cards):
    """给卡密列表附加 bound_email_ids / bound_emails 字段"""
    for card in cards:
        mailboxes = fetch_card_bound_mailboxes(db, db_type, card.get('id'), card.get('bound_email_id'))
        if not mailboxes and card.get('bound_email') and card.get('bound_email_id') and _can_access_mailbox(db, card.get('bound_email_id')):
            mailboxes = [{
                'id': card.get('bound_email_id'),
                'email': card.get('bound_email'),
                'server': card.get('server') or ''
            }]
        card['bound_email_ids'] = [m.get('id') for m in mailboxes if m.get('id') is not None]
        card['bound_emails'] = [m.get('email') for m in mailboxes if m.get('email')]
        card['bound_mailboxes'] = mailboxes
        card['bound_email'] = card['bound_emails'][0] if card['bound_emails'] else None
    return cards

def replace_card_email_bindings(db, db_type, card_id, mailbox_ids):
    """用新的邮箱ID列表替换某张卡密的所有绑定，并同步旧 bound_email_id 字段"""
    primary_mailbox_id = mailbox_ids[0] if mailbox_ids else None
    if db_type == 'sqlite':
        db.execute('DELETE FROM card_email_bindings WHERE card_id = ?', (card_id,))
        for mailbox_id in mailbox_ids:
            db.execute('''
                INSERT OR IGNORE INTO card_email_bindings (card_id, mailbox_id, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (card_id, mailbox_id))
        db.execute('UPDATE cards SET bound_email_id = ? WHERE id = ?', (primary_mailbox_id, card_id))
    else:
        cursor = db.cursor()
        cursor.execute('DELETE FROM card_email_bindings WHERE card_id = %s', (card_id,))
        for mailbox_id in mailbox_ids:
            if db_type == 'mysql':
                cursor.execute('''
                    INSERT IGNORE INTO card_email_bindings (card_id, mailbox_id, created_at)
                    VALUES (%s, %s, CURRENT_TIMESTAMP)
                ''', (card_id, mailbox_id))
            else:
                cursor.execute('''
                    INSERT INTO card_email_bindings (card_id, mailbox_id, created_at)
                    VALUES (%s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (card_id, mailbox_id) DO NOTHING
                ''', (card_id, mailbox_id))
        cursor.execute('UPDATE cards SET bound_email_id = %s WHERE id = %s', (primary_mailbox_id, card_id))

@app.route('/admin/api/cards', methods=['GET', 'POST', 'DELETE'])
@admin_required
def api_admin_cards():
    """卡密管理 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    if request.method == 'GET':
        # 获取卡密列表（支持分页和搜索）
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 30))
        search = request.args.get('search', '').strip()
        
        offset = (page - 1) * per_page
        
        # 构建查询条件
        where_clause = ""
        params = []
        if search:
            where_clause = "WHERE card_key LIKE ? OR remarks LIKE ?"
            search_param = f"%{search}%"
            params = [search_param, search_param]
        
        # 获取总数
        if db_type == 'sqlite':
            count_sql = f"SELECT COUNT(*) as count FROM cards {where_clause}"
            count_result = db.execute(count_sql, params).fetchone()
            total = count_result['count']
            
            # 获取分页数据 - 优化：使用 LEFT JOIN 代替子查询以提高性能
            sql = f"""
                SELECT c.*, 
                    e.email as bound_email,
                    cl.created_at as last_used_at
                FROM cards c
                LEFT JOIN mail_accounts e ON c.bound_email_id = e.id
                LEFT JOIN (
                    SELECT card_id, MAX(created_at) as created_at
                    FROM card_logs
                    GROUP BY card_id
                ) cl ON c.id = cl.card_id
                {where_clause.replace('card_key', 'c.card_key').replace('remarks', 'c.remarks') if where_clause else ''}
                ORDER BY c.id ASC 
                LIMIT ? OFFSET ?
            """
            cards = db.execute(sql, params + [per_page, offset]).fetchall()
            card_dicts = [dict(card) for card in cards]
        else:
            cursor = db.cursor()
            placeholder = '%s'
            where_mysql = where_clause.replace('?', placeholder) if where_clause else ""
            
            count_sql = f"SELECT COUNT(*) as count FROM cards {where_mysql}"
            cursor.execute(count_sql, params)
            total = cursor.fetchone()[0]
            
            # 获取分页数据 - 优化：使用 LEFT JOIN 代替子查询以提高性能
            sql = f"""
                SELECT c.*, 
                    e.email as bound_email,
                    cl.created_at as last_used_at
                FROM cards c
                LEFT JOIN mail_accounts e ON c.bound_email_id = e.id
                LEFT JOIN (
                    SELECT card_id, MAX(created_at) as created_at
                    FROM card_logs
                    GROUP BY card_id
                ) cl ON c.id = cl.card_id
                {where_mysql}
                ORDER BY c.id ASC 
                LIMIT {per_page} OFFSET {offset}
            """
            cursor.execute(sql, params)
            cards = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            card_dicts = [
                dict(card) if isinstance(card, dict) else dict(zip(columns, card))
                for card in cards
            ]

        attach_card_bound_mailboxes(db, db_type, card_dicts)
        
        return jsonify({
            'success': True,
            'data': card_dicts,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
    
    elif request.method == 'POST':
        # 添加或处理卡密
        data = request.get_json()
        action = data.get('action')
        
        if action == 'generate':
            return _generate_card(db, data)
        elif action == 'batch_generate':
            return _batch_generate_cards(db, data)
        elif action == 'bind_email':
            return _bind_email_to_card(db, data)
        elif action == 'edit':
            return _edit_card(db, data)
        else:
            return jsonify({
                'success': False,
                'message': '无效的操作类型'
            })
    
    elif request.method == 'DELETE':
        # 删除卡密
        data = request.get_json()
        
        if 'action' in data and data['action'] == 'batch_delete':
            return _batch_delete_cards(db, data)
        else:
            card_id = data.get('id')
            if not card_id:
                return jsonify({
                    'success': False,
                    'message': '缺少卡密ID'
                })
            
            try:
                success, message = move_card_to_recycle_bin(db, db_type, card_id, 'deleted', '手动删除')
                if success:
                    db.commit()
                    return jsonify({
                        'success': True,
                        'message': '卡密已移动到回收站'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'message': message
                    })
                
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'删除失败: {str(e)}'
                })

@app.route('/admin/api/cards/stats')
@admin_required
def api_admin_card_stats():
    """卡密统计 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    try:
        now = get_beijing_time()
        
        if db_type == 'sqlite':
            # 总数
            total_result = db.execute('SELECT COUNT(*) as count FROM cards').fetchone()
            total = total_result['count']
            
            # 可用数量（状态正常、未过期、未用完）
            active_result = db.execute('''
                SELECT COUNT(*) as count FROM cards 
                WHERE status = 1 
                AND (expired_at IS NULL OR expired_at > ?) 
                AND used_count < usage_limit
            ''', (now,)).fetchone()
            active = active_result['count']
            
            # 已使用完
            used_result = db.execute('''
                SELECT COUNT(*) as count FROM cards 
                WHERE used_count >= usage_limit
            ''').fetchone()
            used = used_result['count']
            
            # 已过期
            expired_result = db.execute('''
                SELECT COUNT(*) as count FROM cards 
                WHERE expired_at IS NOT NULL AND expired_at <= ?
            ''', (now,)).fetchone()
            expired = expired_result['count']
            
        else:
            cursor = db.cursor()
            
            # 总数
            cursor.execute('SELECT COUNT(*) as count FROM cards')
            total = cursor.fetchone()[0]
            
            # 可用数量
            cursor.execute('''
                SELECT COUNT(*) as count FROM cards 
                WHERE status = 1 
                AND (expired_at IS NULL OR expired_at > %s) 
                AND used_count < usage_limit
            ''', (now,))
            active = cursor.fetchone()[0]
            
            # 已使用完
            cursor.execute('''
                SELECT COUNT(*) as count FROM cards 
                WHERE used_count >= usage_limit
            ''')
            used = cursor.fetchone()[0]
            
            # 已过期
            cursor.execute('''
                SELECT COUNT(*) as count FROM cards 
                WHERE expired_at IS NOT NULL AND expired_at <= %s
            ''', (now,))
            expired = cursor.fetchone()[0]
        
        return jsonify({
            'success': True,
            'stats': {
                'total': total,
                'active': active,
                'used': used,
                'expired': expired
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'获取统计数据失败: {str(e)}'
        })

def _generate_card_key():
    """生成12位随机小写字母和数字的卡密"""
    import random
    import string
    
    # 小写字母和数字
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choice(chars) for _ in range(12))

def _generate_card(db, data):
    """生成单个卡密"""
    usage_limit = data.get('usage_limit', 1)
    expired_at = data.get('expired_at')
    remarks = data.get('remarks', '')
    email_days_filter = data.get('email_days_filter', 1)
    keyword_filter = data.get('keyword_filter', '')
    
    try:
        # 生成唯一卡密
        max_attempts = 10
        for _ in range(max_attempts):
            card_key = _generate_card_key()
            
            # 检查是否已存在
            if app.config['DATABASE_TYPE'] == 'sqlite':
                existing = db.execute('SELECT id FROM cards WHERE card_key = ?', (card_key,)).fetchone()
            else:
                cursor = db.cursor()
                cursor.execute('SELECT id FROM cards WHERE card_key = %s', (card_key,))
                existing = cursor.fetchone()
            
            if not existing:
                break
        else:
            return jsonify({
                'success': False,
                'message': '生成卡密失败，请重试'
            })
        
        # 插入卡密
        now = get_beijing_time()  # 使用北京时间
        if app.config['DATABASE_TYPE'] == 'sqlite':
            db.execute('''
                INSERT INTO cards (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, now, now))
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('''
                INSERT INTO cards (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, now, now))
            db.commit()
        
        return jsonify({
            'success': True,
            'message': f'卡密生成成功：{card_key}',
            'card_key': card_key
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'生成卡密失败: {str(e)}'
        })

def _batch_generate_cards(db, data):
    """批量生成卡密"""
    count = data.get('count', 1)
    usage_limit = data.get('usage_limit', 1)
    expired_at = data.get('expired_at')
    remarks = data.get('remarks', '')
    email_days_filter = data.get('email_days_filter', 1)
    keyword_filter = data.get('keyword_filter', '')
    
    if count > 100:
        return jsonify({
            'success': False,
            'message': '一次最多生成100个卡密'
        })
    
    try:
        generated_cards = []
        now = get_beijing_time()  # 使用北京时间
        
        for i in range(count):
            # 生成唯一卡密
            max_attempts = 10
            for _ in range(max_attempts):
                card_key = _generate_card_key()
                
                # 检查是否已存在（包括已生成的）
                if card_key not in generated_cards:
                    if app.config['DATABASE_TYPE'] == 'sqlite':
                        existing = db.execute('SELECT id FROM cards WHERE card_key = ?', (card_key,)).fetchone()
                    else:
                        cursor = db.cursor()
                        cursor.execute('SELECT id FROM cards WHERE card_key = %s', (card_key,))
                        existing = cursor.fetchone()
                    
                    if not existing:
                        generated_cards.append(card_key)
                        break
            else:
                return jsonify({
                    'success': False,
                    'message': f'生成第{i+1}个卡密失败，请重试'
                })
        
        # 批量插入
        if app.config['DATABASE_TYPE'] == 'sqlite':
            for card_key in generated_cards:
                db.execute('''
                    INSERT INTO cards (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, now, now))
            db.commit()
        else:
            cursor = db.cursor()
            for card_key in generated_cards:
                cursor.execute('''
                    INSERT INTO cards (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ''', (card_key, usage_limit, expired_at, remarks, email_days_filter, keyword_filter, now, now))
            db.commit()
        
        return jsonify({
            'success': True,
            'message': f'批量生成成功，共生成 {len(generated_cards)} 个卡密',
            'generated_count': len(generated_cards),
            'card_keys': generated_cards
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'批量生成失败: {str(e)}'
        })

def _batch_delete_cards(db, data):
    """批量删除卡密"""
    card_ids = data.get('ids', [])
    
    if not card_ids:
        return jsonify({
            'success': False,
            'message': '请选择要删除的卡密'
        })
    
    try:
        db_type = app.config['DATABASE_TYPE']  # 获取数据库类型
        success_count = 0
        error_count = 0
        
        for card_id in card_ids:
            success, message = move_card_to_recycle_bin(db, db_type, card_id, 'deleted', '批量删除')
            if success:
                success_count += 1
            else:
                error_count += 1
                logger.error(f"Failed to move card {card_id} to recycle bin: {message}")
        
        if success_count > 0:
            db.commit()
        
        if error_count == 0:
            return jsonify({
                'success': True,
                'message': f'成功将 {success_count} 个卡密移动到回收站'
            })
        else:
            return jsonify({
                'success': True,
                'message': f'成功将 {success_count} 个卡密移动到回收站，{error_count} 个失败'
            })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'批量删除失败: {str(e)}'
        })

def _edit_card(db, data):
    """编辑卡密"""
    card_id = data.get('card_id')
    usage_limit = data.get('usage_limit', 1)
    expired_at = data.get('expired_at')
    remarks = data.get('remarks', '')
    bound_email_id = data.get('bound_email_id')
    bound_email_ids = normalize_mailbox_id_list(data.get('bound_email_ids'))
    if not bound_email_ids and bound_email_id:
        bound_email_ids = normalize_mailbox_id_list(bound_email_id)
    email_days_filter = data.get('email_days_filter', 7)
    sender_filter = data.get('sender_filter', '')
    keyword_filter = data.get('keyword_filter', '')
    
    if not card_id:
        return jsonify({
            'success': False,
            'message': '缺少卡密ID'
        })
    
    try:
        now = get_beijing_time()  # 使用北京时间

        if bound_email_ids and not _all_mailboxes_accessible(db, bound_email_ids):
            return _mailbox_not_found_response()
        
        # 验证绑定邮箱是否有效（如果提供）
        if bound_email_ids:
            if app.config['DATABASE_TYPE'] == 'sqlite':
                placeholders = ','.join(['?'] * len(bound_email_ids))
                email_rows = db.execute(
                    f'SELECT id FROM mail_accounts WHERE id IN ({placeholders})',
                    bound_email_ids
                ).fetchall()
                existing_email_ids = {int(row['id']) for row in email_rows}
            else:
                cursor = db.cursor()
                placeholders = ','.join(['%s'] * len(bound_email_ids))
                cursor.execute(
                    f'SELECT id FROM mail_accounts WHERE id IN ({placeholders})',
                    bound_email_ids
                )
                existing_email_ids = {
                    int(row['id'] if isinstance(row, dict) else row[0])
                    for row in cursor.fetchall()
                }
            
            missing_email_ids = [mid for mid in bound_email_ids if mid not in existing_email_ids]
            if missing_email_ids:
                return jsonify({
                    'success': False,
                    'message': f'指定的邮箱不存在: {", ".join(map(str, missing_email_ids))}'
                })
        
        if app.config['DATABASE_TYPE'] == 'sqlite':
            # 检查卡密是否存在
            card = db.execute('SELECT * FROM cards WHERE id = ?', (card_id,)).fetchone()
            if not card:
                return jsonify({
                    'success': False,
                    'message': '卡密不存在'
                })
            
            # 更新卡密
            db.execute('''
                UPDATE cards 
                SET usage_limit = ?, expired_at = ?, remarks = ?, 
                    bound_email_id = ?, email_days_filter = ?, sender_filter = ?, keyword_filter = ?, updated_at = ?
                WHERE id = ?
            ''', (usage_limit, expired_at, remarks, bound_email_ids[0] if bound_email_ids else None, email_days_filter, sender_filter, keyword_filter, now, card_id))
            replace_card_email_bindings(db, app.config['DATABASE_TYPE'], card_id, bound_email_ids)
            db.commit()
        else:
            cursor = db.cursor()
            # 检查卡密是否存在
            cursor.execute('SELECT * FROM cards WHERE id = %s', (card_id,))
            card = cursor.fetchone()
            if not card:
                return jsonify({
                    'success': False,
                    'message': '卡密不存在'
                })
            
            # 更新卡密
            cursor.execute('''
                UPDATE cards 
                SET usage_limit = %s, expired_at = %s, remarks = %s, 
                    bound_email_id = %s, email_days_filter = %s, sender_filter = %s, keyword_filter = %s, updated_at = %s
                WHERE id = %s
            ''', (usage_limit, expired_at, remarks, bound_email_ids[0] if bound_email_ids else None, email_days_filter, sender_filter, keyword_filter, now, card_id))
            replace_card_email_bindings(db, app.config['DATABASE_TYPE'], card_id, bound_email_ids)
            db.commit()
        
        return jsonify({
            'success': True,
            'message': '卡密编辑成功'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'编辑卡密失败: {str(e)}'
        })

def _bind_email_to_card(db, data):
    """绑定邮箱到卡密"""
    card_id = data.get('card_id')
    email_ids = normalize_mailbox_id_list(data.get('email_ids'))
    if not email_ids:
        email_ids = normalize_mailbox_id_list(data.get('email_id'))
    
    if not card_id or not email_ids:
        return jsonify({
            'success': False,
            'message': '请提供卡密ID和邮箱ID'
        })
    
    try:
        # 验证卡密和邮箱是否存在
        if not _all_mailboxes_accessible(db, email_ids):
            return _mailbox_not_found_response()
        if app.config['DATABASE_TYPE'] == 'sqlite':
            card = db.execute('SELECT * FROM cards WHERE id = ?', (card_id,)).fetchone()
            placeholders = ','.join(['?'] * len(email_ids))
            email_rows = db.execute(f'SELECT id, email FROM mail_accounts WHERE id IN ({placeholders})', email_ids).fetchall()
            email_map = {int(row['id']): row['email'] for row in email_rows}
        else:
            cursor = db.cursor()
            cursor.execute('SELECT * FROM cards WHERE id = %s', (card_id,))
            card = cursor.fetchone()
            placeholders = ','.join(['%s'] * len(email_ids))
            cursor.execute(f'SELECT id, email FROM mail_accounts WHERE id IN ({placeholders})', email_ids)
            email_map = {}
            for row in cursor.fetchall():
                if isinstance(row, dict):
                    email_map[int(row['id'])] = row['email']
                else:
                    email_map[int(row[0])] = row[1]
        
        if not card:
            return jsonify({
                'success': False,
                'message': '卡密不存在'
            })
        
        missing_email_ids = [email_id for email_id in email_ids if email_id not in email_map]
        if missing_email_ids:
            return jsonify({
                'success': False,
                'message': f'邮箱不存在: {", ".join(map(str, missing_email_ids))}'
            })
        
        replace_card_email_bindings(db, app.config['DATABASE_TYPE'], card_id, email_ids)
        db.commit()
        
        return jsonify({
            'success': True,
            'message': f'邮箱绑定成功，共绑定 {len(email_ids)} 个邮箱'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'绑定失败: {str(e)}'
        })

@app.route('/admin/api/cards/<int:card_id>/available-emails', methods=['GET'])
@admin_required
def api_admin_card_available_emails(card_id):
    """获取指定卡密可绑定的邮箱列表 - 支持分页和搜索"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    try:
        # 获取分页和搜索参数，添加验证
        try:
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 50))
        except (ValueError, TypeError):
            page = 1
            per_page = 50
        
        # 验证参数范围
        page = max(1, min(page, 10000))  # 限制最大页码
        per_page = max(1, min(per_page, 5000))  # 限制每页数量在1-5000之间
        
        search = request.args.get('search', '').strip()
        
        offset = (page - 1) * per_page
        
        current_bound_mailboxes = fetch_card_bound_mailboxes(db, db_type, card_id)
        current_bound_ids = {int(m['id']) for m in current_bound_mailboxes if m.get('id') is not None}

        # 构建查询条件
        conditions = []
        params = []
        
        if search:
            conditions.append("(m.email LIKE ? OR m.server LIKE ? OR m.remarks LIKE ?)")
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])
        scope_condition, scope_params = _mailbox_scope_condition(db, 'm')
        if scope_condition:
            conditions.append(scope_condition)
            params.extend(scope_params)
        where_clause = f"AND {' AND '.join(conditions)}" if conditions else ""
        
        if db_type == 'sqlite':
            # 获取总数
            count_sql = f"""
                SELECT COUNT(*) as count 
                FROM mail_accounts m
                WHERE m.status = 1 
                {where_clause}
            """
            count_result = db.execute(count_sql, params).fetchone()
            total = count_result['count']
            
            # 获取分页数据
            sql = f"""
                SELECT m.id, m.email, m.server, m.port, m.protocol, m.ssl, 
                       m.send_server, m.send_port, m.remarks, m.status
                FROM mail_accounts m
                WHERE m.status = 1 
                {where_clause}
                ORDER BY m.id ASC 
                LIMIT ? OFFSET ?
            """
            available_emails = db.execute(sql, params + [per_page, offset]).fetchall()
            available_emails = [dict(email) for email in available_emails]
        else:
            cursor = db.cursor()
            placeholder = '%s'
            where_mysql = where_clause.replace('?', placeholder) if where_clause else ""
            
            # 获取总数
            count_sql = f"""
                SELECT COUNT(*) as count 
                FROM mail_accounts m
                WHERE m.status = 1 
                {where_mysql}
            """
            cursor.execute(count_sql, params)
            total = cursor.fetchone()[0]
            
            # 获取分页数据
            sql = f"""
                SELECT m.id, m.email, m.server, m.port, m.protocol, m.ssl, 
                       m.send_server, m.send_port, m.remarks, m.status
                FROM mail_accounts m
                WHERE m.status = 1 
                {where_mysql}
                ORDER BY m.id ASC 
                LIMIT {per_page} OFFSET {offset}
            """
            cursor.execute(sql, params)
            results = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            available_emails = [_row_to_dict(row, columns) for row in results]

        for email in available_emails:
            try:
                email['selected'] = int(email.get('id')) in current_bound_ids
            except (TypeError, ValueError):
                email['selected'] = False
        
        return jsonify({
            'success': True,
            'data': available_emails,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logger.error(f'获取可绑定邮箱列表失败: {e}')
        return jsonify({
            'success': False,
            'message': f'获取可绑定邮箱列表失败: {str(e)}'
        })

@app.route('/api/mail/<card_key>', methods=['GET'])
def api_card_mail_page(card_key):
    """为卡密生成简洁的API页面（不包含admin路径）"""
    return api_admin_generate_card_api_page(card_key)

@app.route('/admin/api/cards/generate-api/<card_key>', methods=['GET'])
def api_admin_generate_card_api_page(card_key):
    """为卡密生成API页面"""
    try:
        # 获取数据库连接
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        # 查询卡密信息，包括绑定的邮箱
        if db_type == 'sqlite':
            card_query = """
                SELECT c.*, e.email, e.server 
                FROM cards c 
                LEFT JOIN mail_accounts e ON c.bound_email_id = e.id 
                WHERE c.card_key = ?
            """
            card_result = db.execute(card_query, (card_key,)).fetchone()
            if card_result:
                card_result = dict(card_result)  # Convert Row to dict
        else:
            cursor = db.cursor()
            card_query = """
                SELECT c.*, e.email, e.server 
                FROM cards c 
                LEFT JOIN mail_accounts e ON c.bound_email_id = e.id 
                WHERE c.card_key = %s
            """
            cursor.execute(card_query, (card_key,))
            card_result = cursor.fetchone()
            if card_result and hasattr(card_result, '_asdict'):
                card_result = card_result._asdict()
            elif card_result:
                # Handle tuple result
                columns = [desc[0] for desc in cursor.description]
                card_result = dict(zip(columns, card_result))
        
        if not card_result:
            # 获取API页面标题
            api_title = get_system_config('api_page_title', 'API取件页面')
            # 返回包含"此卡密不存在"消息的HTML页面而不是JSON
            error_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{api_title} - 卡密不存在</title>
    <link rel="icon" type="image/x-icon" href="/static/img/favicons/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/static/img/favicons/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/static/img/favicons/favicon-32x32.png">
    <link rel="icon" type="image/svg+xml" href="/static/img/favicons/favicon.svg">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        
        .error-container {{
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }}
        
        .error-icon {{
            font-size: 64px;
            margin-bottom: 20px;
            color: #ef4444;
        }}
        
        .error-title {{
            font-size: 24px;
            color: #1e293b;
            margin-bottom: 15px;
            font-weight: 600;
        }}
        
        .error-message {{
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">❌</div>
        <div class="error-title">此卡密不存在</div>
        <div class="error-message">请检查卡密是否正确，或联系管理员获取有效卡密</div>
    </div>
</body>
</html>"""
            return error_content, 404, {'Content-Type': 'text/html; charset=utf-8'}
        
        # 检查卡密是否已绑定邮箱且邮箱仍然存在（支持多邮箱绑定）
        bound_mailboxes = fetch_card_bound_mailboxes(
            db,
            db_type,
            card_result.get('id'),
            card_result.get('bound_email_id')
        )
        bound_emails = [m.get('email') for m in bound_mailboxes if m.get('email')]
        has_bound_email = len(bound_emails) > 0
        bound_email = bound_emails[0] if has_bound_email else None
        bound_emails_json = json.dumps(
            [{'id': m.get('id'), 'email': m.get('email')} for m in bound_mailboxes if m.get('email')],
            ensure_ascii=False
        ).replace('</', '<\\/')
        
        # 根据绑定状态生成不同的API页面内容
        if has_bound_email:
            if len(bound_emails) == 1:
                safe_bound_email = html.escape(bound_email, quote=True)
                input_section = f"""
                <div class="bound-email-section">
                    <div class="email-display-row">
                        <div class="email-info">
                            <span class="email-label">绑定邮箱：</span>
                            <span class="email-address" id="boundEmailAddress">{safe_bound_email}</span>
                        </div>
                        <button class="copy-btn" onclick="copyEmail()" title="复制邮箱地址">
                            复制
                        </button>
                        <button class="get-mail-btn" onclick="getMail()">获取邮件</button>
                    </div>
                </div>"""
            else:
                options_html = ''.join(
                    f'<option value="{html.escape(email, quote=True)}">{html.escape(email)}</option>'
                    for email in bound_emails
                )
                input_section = f"""
                <div class="bound-email-section">
                    <div class="email-display-row">
                        <div class="email-info email-info-select">
                            <span class="email-label">绑定邮箱：</span>
                            <select id="boundEmailSelect" class="bound-email-select">
                                {options_html}
                            </select>
                        </div>
                        <button class="copy-btn" onclick="copyEmail()" title="复制当前邮箱地址">
                            复制
                        </button>
                        <button class="get-mail-btn" onclick="getMail()">获取邮件</button>
                    </div>
                    <p class="info-text" style="margin-top: 10px;">此卡密已绑定 {len(bound_emails)} 个邮箱，请选择要查询的邮箱。</p>
                </div>"""
        else:
            # 未绑定邮箱：页面仅有输入框和"获取邮件"按钮
            input_section = f"""
            <div class="input-group">
                <input type="email" id="emailInput" placeholder="请输入邮箱地址" required>
                <button class="get-mail-btn" onclick="getMail()">获取邮件</button>
            </div>"""
        
        # 获取API页面标题
        api_title = get_system_config('api_page_title', 'API取件页面')
        
        api_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{api_title}</title>
    <link rel="icon" type="image/x-icon" href="/static/img/favicons/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/static/img/favicons/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/static/img/favicons/favicon-32x32.png">
    <link rel="icon" type="image/svg+xml" href="/static/img/favicons/favicon.svg">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1100px;
            width: 100%;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            font-size: 32px;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }}
        
        .header p {{
            font-size: 16px;
            opacity: 0.9;
        }}
        
        .main-card {{
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        
        .input-group {{
            display: flex;
            margin-bottom: 20px;
            gap: 15px;
        }}

        /* 响应式适配 - 平板与手机 */
        @media (max-width: 1024px) {{
            body {{
                padding: 16px;
            }}
            .main-card {{
                padding: 26px;
            }}
            .input-group {{
                flex-direction: column;
                align-items: stretch;
            }}
            .copy-btn, .get-mail-btn {{
                width: 100%;
            }}
            .email-display-row {{
                gap: 10px;
            }}
        }}

        @media (max-width: 640px) {{
            body {{
                padding: 12px;
            }}
            h1 {{
                font-size: 24px;
            }}
            .main-card {{
                padding: 18px;
            }}
            .input-group {{
                gap: 10px;
            }}
            .email-display-row {{
                align-items: stretch;
            }}
        }}
        
        .action-group {{
            text-align: center;
            margin-bottom: 20px;
        }}
        
        .bound-email-section {{
            margin-bottom: 20px;
        }}
        
        .email-display-row {{
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border-left: 4px solid #667eea;
            flex-wrap: wrap;
        }}
        
        .email-info {{
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            min-width: 200px;
        }}
        
        .copy-btn {{
            background: #10b981;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            white-space: nowrap;
        }}
        
        .copy-btn:hover {{
            background: #059669;
            transform: translateY(-1px);
        }}
        
        .copy-btn:active {{
            transform: translateY(0);
        }}
        
        .bound-email-info {{
            margin-bottom: 25px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }}
        
        .unbound-email-info {{
            margin-bottom: 20px;
            padding: 15px;
            background: #fef3c7;
            border-radius: 12px;
            border-left: 4px solid #f59e0b;
        }}
        
        .email-info {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }}
        
        .email-label {{
            font-weight: 600;
            color: #374151;
        }}
        
        .email-address {{
            background: #667eea;
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }}

        .email-info-select {{
            align-items: center;
            gap: 12px;
        }}

        .bound-email-select {{
            min-width: 280px;
            flex: 1;
            padding: 11px 14px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: white;
            color: #111827;
            font-size: 15px;
        }}
        
        .info-text {{
            color: #6b7280;
            font-size: 14px;
            margin: 0;
        }}
        
        .input-group input {{
            flex: 1;
            padding: 15px 20px;
            border: 2px solid #e1e5e9;
            border-radius: 12px;
            font-size: 16px;
            transition: all 0.3s ease;
        }}
        
        .input-group input:focus {{
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }}
        
        .get-mail-btn {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 120px;
        }}
        
        .get-mail-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }}
        
        .get-mail-btn:disabled {{
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }}
        
        .loading {{
            display: none;
            text-align: center;
            padding: 20px;
            color: #667eea;
            font-size: 16px;
        }}
        
        .loading .spinner {{
            width: 40px;
            height: 40px;
            border: 4px solid #f3f4f6;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }}
        
        @keyframes spin {{
            0% {{ transform: rotate(0deg); }}
            100% {{ transform: rotate(360deg); }}
        }}
        
        .message {{
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: 500;
        }}
        
        .message.success {{
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #a7f3d0;
        }}
        
        .message.error {{
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
        }}
        
        .message.info {{
            background: #dbeafe;
            color: #1e40af;
            border: 1px solid #93c5fd;
        }}
        
        .warning-message {{
            background: #fee2e2;
            color: #dc2626;
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 15px 20px;
            margin-bottom: 20px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }}
        
        .warning-message::before {{
            content: '⚠️';
            font-size: 20px;
        }}
        
        .mail-display {{
            display: none;
            background: white;
            border-radius: 15px;
            padding: 28px;
            margin-top: 25px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 18px 36px rgba(0,0,0,0.08);
            width: 100%;
        }}
        
        .mail-header {{
            margin-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
        }}
        
        .mail-subject {{
            font-size: 20px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 15px;
        }}
        
        .mail-meta {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }}
        
        .mail-meta-item {{
            background: white;
            padding: 12px 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }}
        
        .mail-meta-label {{
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            display: block;
            margin-bottom: 5px;
        }}
        
        .mail-body {{
            background: #f8fafc;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            max-height: 520px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
        }}
        
        .mail-body.text-content {{
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
        }}
        
        .mail-body.html-content {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }}
        
        .mail-body.html-content a {{
            color: #667eea;
            text-decoration: none;
        }}
        
        .mail-body.html-content a:hover {{
            color: #764ba2;
            text-decoration: underline;
        }}
        
        /* Images section styles */
        .mail-images {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            margin-top: 15px;
        }}
        
        .image-container {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 10px;
        }}
        
        .image-item {{
            background: #f8fafc;
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.2s ease;
        }}
        
        .image-item:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        
        .image-item img {{
            width: 100%;
            height: 150px;
            object-fit: cover;
            cursor: pointer;
        }}
        
        .image-info {{
            padding: 10px;
        }}
        
        .attachment-name {{
            font-weight: 600;
            color: #374151;
            margin-bottom: 4px;
            word-break: break-all;
        }}
        
        .attachment-meta {{
            font-size: 12px;
            color: #6b7280;
        }}
        
        /* Attachments section styles */
        .mail-attachments {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            margin-top: 15px;
        }}
        
        .attachment-list {{
            margin-top: 10px;
        }}
        
        .attachment-item {{
            display: flex;
            align-items: center;
            padding: 12px;
            background: #f8fafc;
            border-radius: 8px;
            margin-bottom: 8px;
            transition: background 0.2s ease;
        }}
        
        .attachment-item:hover {{
            background: #e5e7eb;
        }}
        
        .attachment-icon {{
            width: 40px;
            height: 40px;
            background: #667eea;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            margin-right: 12px;
        }}
        
        .attachment-details {{
            flex: 1;
        }}
        
        .attachment-size {{
            color: #6b7280;
            font-size: 12px;
        }}
        
        /* Image Modal styles */
        .image-modal {{
            display: none;
            position: fixed;
            z-index: 4000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }}
        
        .image-modal-content {{
            margin: auto;
            display: block;
            width: 80%;
            max-width: 700px;
            max-height: 80%;
            animation: zoom 0.3s;
        }}
        
        @keyframes zoom {{
            from {{transform: scale(0)}}
            to {{transform: scale(1)}}
        }}
        
        .image-modal-close {{
            position: absolute;
            top: 15px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            transition: 0.3s;
            cursor: pointer;
        }}
        
        .image-modal-close:hover,
        .image-modal-close:focus {{
            color: #bbb;
            text-decoration: none;
        }}
        
        .api-info {{
            background: #f1f5f9;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
            font-size: 14px;
            color: #475569;
        }}
        
        .card-key {{
            background: #667eea;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-weight: 600;
        }}
        
        /* Toast Notifications */
        .toast-container {{
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 3000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        }}
        
        .toast {{
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transform: translateX(450px);
            opacity: 0;
            transition: all 0.3s ease;
            position: relative;
            background: #6b7280;
            margin-bottom: 10px;
        }}
        
        .toast.show {{
            transform: translateX(0);
            opacity: 1;
        }}
        
        .toast.success {{
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }}
        
        .toast.error {{
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }}
        
        .toast.info {{
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }}
        
        .toast.warning {{
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }}
        
        /* Responsive Design */
        @media (max-width: 1024px) {{
            body {{
                padding: 16px;
            }}

            .container {{
                padding: 0 6px;
            }}

            .main-card {{
                padding: 28px;
            }}

            .input-group {{
                flex-direction: column;
                gap: 12px;
                align-items: stretch;
            }}

            .input-group input {{
                width: 100%;
            }}

            .email-display-row {{
                flex-direction: column;
                gap: 12px;
                align-items: stretch;
            }}
            
            .email-info {{
                justify-content: center;
                text-align: center;
                min-width: auto;
            }}
            
            .copy-btn, .get-mail-btn {{
                width: 100%;
                justify-content: center;
            }}
        }}
    </style>
</head>
<body>
    <!-- Toast notification container -->
    <div id="toast-container" class="toast-container"></div>
    
    <div class="container">
        <div class="header">
            <h1>📧 API邮件查看</h1>
            <p>{api_title}</p>
        </div>
        
        <div class="main-card">
            {input_section}
            
            <div class="warning-message">
                邮件有延迟，不要连续重复获取邮件，间隔1-2分钟再点击获取邮件
            </div>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <div>正在通过API获取邮件，请稍候...</div>
            </div>
        </div>
        
        <div class="mail-display" id="mailDisplay">
            <div class="mail-header">
                <div class="mail-subject" id="mailSubject"></div>
                <div class="mail-meta">
                    <div class="mail-meta-item">
                        <span class="mail-meta-label">发件人:</span>
                        <span id="mailFrom"></span>
                    </div>
                    <div class="mail-meta-item">
                        <span class="mail-meta-label">收件人:</span>
                        <span id="mailTo"></span>
                    </div>
                    <div class="mail-meta-item">
                        <span class="mail-meta-label">时间:</span>
                        <span id="mailDate"></span>
                    </div>
                </div>
            </div>
            
            <div class="mail-body" id="mailBody"></div>
            
            <!-- Images section -->
            <div class="mail-images" id="mailImages" style="display: none;">
                <h4 style="color: #667eea; margin-bottom: 10px;">📷 图片内容</h4>
                <div class="image-container" id="imageContainer"></div>
            </div>
            
            <!-- Attachments section -->
            <div class="mail-attachments" id="mailAttachments" style="display: none;">
                <h4 style="color: #667eea; margin-bottom: 10px;">📎 附件</h4>
                <div class="attachment-list" id="attachmentList"></div>
            </div>
        </div>
    </div>
    
    <!-- Image Modal -->
    <div id="imageModal" class="image-modal">
        <span class="image-modal-close" onclick="closeImageModal()">&times;</span>
        <img class="image-modal-content" id="modalImage">
    </div>
    
    <script>
        // 检查是否已绑定邮箱
        const boundEmails = {bound_emails_json};
        const hasBoundEmail = boundEmails.length > 0;
        const boundEmail = boundEmails.length === 1 ? boundEmails[0].email : "";

        function getSelectedBoundEmail() {{
            if (!hasBoundEmail) return "";
            const select = document.getElementById('boundEmailSelect');
            if (select) {{
                return select.value.trim();
            }}
            return boundEmail;
        }}
        
        // 复制邮箱地址功能
        function copyEmail() {{
            const email = getSelectedBoundEmail();
            if (!email) {{
                showToast('请选择邮箱地址', 'error');
                return;
            }}
            
            // 创建临时文本区域
            const textArea = document.createElement('textarea');
            textArea.value = email;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {{
                document.execCommand('copy');
                showToast('邮箱地址已复制到剪贴板', 'success');
            }} catch (err) {{
                // 降级到现代API
                if (navigator.clipboard && navigator.clipboard.writeText) {{
                    navigator.clipboard.writeText(email).then(() => {{
                        showToast('邮箱地址已复制到剪贴板', 'success');
                    }}).catch(() => {{
                        showToast('复制失败，请手动复制', 'error');
                    }});
                }} else {{
                    showToast('复制失败，请手动复制', 'error');
                }}
            }}
            
            document.body.removeChild(textArea);
        }}
        
        // 回车键触发获取邮件（仅在有输入框时）
        const emailInput = document.getElementById('emailInput');
        if (emailInput) {{
            emailInput.addEventListener('keypress', function(e) {{
                if (e.key === 'Enter') {{
                    getMail();
                }}
            }});
        }}
        
        // 生成邮件标识符（用于检测重复）
        function generateMailIdentifier(mail) {{
            // 使用主题、发件人、日期和正文的前100个字符生成唯一标识
            const BODY_PREVIEW_LENGTH = 100;
            const bodyPreview = (mail.body || '').substring(0, BODY_PREVIEW_LENGTH);
            const identifierString = `${{mail.subject}}|${{mail.from}}|${{mail.date}}|${{bodyPreview}}`;
            
            // 简单的哈希函数
            let hash = 0;
            for (let i = 0; i < identifierString.length; i++) {{
                const char = identifierString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash | 0; // Convert to 32bit integer
            }}
            return hash.toString();
        }}
        
        // 获取本地存储的上次邮件标识
        function getLastMailIdentifier(email) {{
            const storageKey = `last_mail_${{email}}_${{'{card_key}'}}`;
            return localStorage.getItem(storageKey);
        }}
        
        // 保存邮件标识到本地存储
        function saveMailIdentifier(email, identifier) {{
            const storageKey = `last_mail_${{email}}_${{'{card_key}'}}`;
            localStorage.setItem(storageKey, identifier);
        }}
        
        async function getMail() {{
            const loading = document.getElementById('loading');
            const mailDisplay = document.getElementById('mailDisplay');
            const getMailBtn = document.querySelector('.get-mail-btn');
            
            let email;
            
            if (hasBoundEmail) {{
                // 已绑定邮箱，使用当前选中的绑定邮箱
                email = getSelectedBoundEmail();
                if (!email) {{
                    showToast('请选择邮箱地址', 'error');
                    return;
                }}
            }} else {{
                // 未绑定邮箱，从输入框获取
                const emailInput = document.getElementById('emailInput');
                email = emailInput.value.trim();
                
                if (!email) {{
                    showToast('请输入邮箱地址', 'error');
                    return;
                }}
                
                if (!isValidEmail(email)) {{
                    showToast('请输入有效的邮箱地址', 'error');
                    return;
                }}
            }}
            
            // 显示加载状态
            loading.style.display = 'block';
            getMailBtn.disabled = true;
            getMailBtn.textContent = '获取中...';
            mailDisplay.style.display = 'none';
            
            try {{
                // 第一步：预览模式获取邮件，不扣除次数
                const previewResponse = await fetch('/api/get_mail', {{
                    method: 'POST',
                    headers: {{
                        'Content-Type': 'application/json',
                        'X-Card-Key': '{card_key}'
                    }},
                    body: JSON.stringify({{ 
                        email: email,
                        card_key: '{card_key}',
                        preview_only: true
                    }})
                }});
                
                const previewData = await previewResponse.json();
                
                if (!previewData.success) {{
                    // 预览失败，显示错误
                    let errorMessage = previewData.message || '获取邮件失败';
                    const hasConnectionInfo = /\\(直连\\)|\\(代理\\)|\\(通过.*\\)|\\(代理连接.*\\)/.test(errorMessage);
                    
                    if (!hasConnectionInfo) {{
                        if (previewData.proxy && previewData.proxy.enabled) {{
                            if (previewData.proxy.info && previewData.proxy.info.name) {{
                                errorMessage += ` (代理连接: ${{previewData.proxy.info.name}})`;
                            }} else {{
                                errorMessage += ' (代理连接)';
                            }}
                        }} else {{
                            errorMessage += ' (直连)';
                        }}
                    }}
                    showToast(errorMessage, 'error');
                    return;
                }}
                
                if (!previewData.mail) {{
                    // 没有邮件
                    let noMailMessage = '邮箱中暂无邮件';
                    if (previewData.proxy && previewData.proxy.enabled) {{
                        noMailMessage += ' (代理)';
                    }} else {{
                        noMailMessage += ' (直连)';
                    }}
                    showToast(noMailMessage, 'info');
                    return;
                }}
                
                // 第二步：生成邮件标识符并比较
                const newMailIdentifier = generateMailIdentifier(previewData.mail);
                const lastMailIdentifier = getLastMailIdentifier(email);
                
                if (lastMailIdentifier && newMailIdentifier === lastMailIdentifier) {{
                    // 邮件相同，不扣除次数
                    displayMailWithCardInfo(previewData);
                    let duplicateMessage = '获取的邮件与上次相同，未扣除卡密次数';
                    if (previewData.proxy && previewData.proxy.enabled) {{
                        duplicateMessage += ' (代理)';
                    }} else {{
                        duplicateMessage += ' (直连)';
                    }}
                    showToast(duplicateMessage, 'info', 5000);
                    return;
                }}
                
                // 第三步：邮件不同或首次获取，进行真实的获取并扣除次数
                const response = await fetch('/api/get_mail', {{
                    method: 'POST',
                    headers: {{
                        'Content-Type': 'application/json',
                        'X-Card-Key': '{card_key}'
                    }},
                    body: JSON.stringify({{ 
                        email: email,
                        card_key: '{card_key}',
                        preview_only: false
                    }})
                }});
                
                const data = await response.json();
                
                if (data.success) {{
                    if (data.mail) {{
                        // 保存新的邮件标识符
                        saveMailIdentifier(email, newMailIdentifier);
                        
                        displayMailWithCardInfo(data);
                        // 添加连接状态到成功消息
                        let successMessage = '邮件获取成功';
                        if (data.proxy && data.proxy.enabled) {{
                            successMessage += ' (代理)';
                        }} else {{
                            successMessage += ' (直连)';
                        }}
                        showToast(successMessage, 'success');
                    }} else {{
                        // 添加连接状态到无邮件消息  
                        let noMailMessage = '邮箱中暂无邮件';
                        if (data.proxy && data.proxy.enabled) {{
                            noMailMessage += ' (代理)';
                        }} else {{
                            noMailMessage += ' (直连)';
                        }}
                        showToast(noMailMessage, 'info');
                    }}
                }} else {{
                    // 添加连接状态到错误消息
                    let errorMessage = data.message || '获取邮件失败';
                    // 检查消息是否已经包含连接指示符，避免重复添加
                    const hasConnectionInfo = /\\(直连\\)|\\(代理\\)|\\(通过.*\\)|\\(代理连接.*\\)/.test(errorMessage);
                    
                    if (!hasConnectionInfo) {{
                        if (data.proxy && data.proxy.enabled) {{
                            if (data.proxy.info && data.proxy.info.name) {{
                                errorMessage += ` (代理连接: ${{data.proxy.info.name}})`;
                            }} else {{
                                errorMessage += ' (代理连接)';
                            }}
                        }} else {{
                            errorMessage += ' (直连)';
                        }}
                    }}
                    showToast(errorMessage, 'error');
                }}
                
            }} catch (error) {{
                console.error('API请求失败:', error);
                showToast('网络请求失败，请检查网络连接', 'error');
            }} finally {{
                // 隐藏加载状态
                loading.style.display = 'none';
                getMailBtn.disabled = false;
                getMailBtn.textContent = '获取邮件';
            }}
        }}
        
        function displayMail(mail) {{
            document.getElementById('mailSubject').textContent = mail.subject || '(无主题)';
            
            // 显示发件人信息（后端已格式化为"名称 <邮箱地址>"格式）
            document.getElementById('mailFrom').textContent = mail.from || '未知';
            
            document.getElementById('mailTo').textContent = mail.to || '未知';
            document.getElementById('mailDate').textContent = mail.date || '未知';
            
            // 显示邮件正文
            const mailBodyElement = document.getElementById('mailBody');
            if (mail.body_type === 'html') {{
                mailBodyElement.innerHTML = mail.body || '(邮件内容为空)';
                mailBodyElement.className = 'mail-body html-content';
            }} else {{
                mailBodyElement.textContent = mail.body || '(邮件内容为空)';
                mailBodyElement.className = 'mail-body text-content';
            }}
            
            // 显示图片
            displayImages(mail.images || []);
            
            // 显示附件
            displayAttachments(mail.attachments || []);
            
            document.getElementById('mailDisplay').style.display = 'block';
        }}
        
        function displayMailWithCardInfo(data) {{
            if (data.mail) {{
                displayMail(data.mail);
                
                // 显示卡密使用信息
                if (data.card_info) {{
                    const cardInfo = data.card_info;
                    const cardMessage = `邮件获取成功！剩余使用次数: ${{cardInfo.remaining_uses}}/${{cardInfo.total_uses}}`;
                    showToast(cardMessage, 'success', 5000);
                }}
            }}
        }}
        
        function showMessage(text, type) {{
            showToast(text, type);
        }}
        
        function isValidEmail(email) {{
            const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            return re.test(email);
        }}
        
        // Toast notification system
        function showToast(message, type = 'info', duration = 3000) {{
            const container = document.getElementById('toast-container');
            
            const toast = document.createElement('div');
            toast.className = `toast ${{type}}`;
            toast.textContent = message;
            
            container.appendChild(toast);
            
            setTimeout(() => {{
                toast.classList.add('show');
            }}, 10);
            
            setTimeout(() => {{
                toast.classList.remove('show');
                setTimeout(() => {{
                    if (container.contains(toast)) {{
                        container.removeChild(toast);
                    }}
                }}, 300);
            }}, duration);
        }}
        
        function displayImages(images) {{
            const imagesSection = document.getElementById('mailImages');
            const imageContainer = document.getElementById('imageContainer');
            
            if (images && images.length > 0) {{
                imageContainer.innerHTML = '';
                
                images.forEach((image, index) => {{
                    const imageItem = document.createElement('div');
                    imageItem.className = 'image-item';
                    
                    const img = document.createElement('img');
                    img.src = 'data:' + image.mime_type + ';base64,' + image.content;
                    img.alt = image.filename;
                    img.onclick = () => openImageModal(img.src);
                    
                    const imageInfo = document.createElement('div');
                    imageInfo.className = 'image-info';
                    imageInfo.innerHTML = `
                        <div class="attachment-name">${{escapeHtml(image.filename)}}</div>
                        <div class="attachment-meta">${{formatFileSize(image.size)}} • ${{image.mime_type}}</div>
                    `;
                    
                    imageItem.appendChild(img);
                    imageItem.appendChild(imageInfo);
                    imageContainer.appendChild(imageItem);
                }});
                
                imagesSection.style.display = 'block';
            }} else {{
                imagesSection.style.display = 'none';
            }}
        }}
        
        function displayAttachments(attachments) {{
            const attachmentsSection = document.getElementById('mailAttachments');
            const attachmentList = document.getElementById('attachmentList');
            
            if (attachments && attachments.length > 0) {{
                attachmentList.innerHTML = '';
                
                attachments.forEach((attachment, index) => {{
                    const attachmentItem = document.createElement('div');
                    attachmentItem.className = 'attachment-item';
                    
                    const fileExt = attachment.filename.split('.').pop()?.toUpperCase() || '?';
                    
                    attachmentItem.innerHTML = `
                        <div class="attachment-icon">${{fileExt.substring(0, 3)}}</div>
                        <div class="attachment-details">
                            <div class="attachment-name">${{escapeHtml(attachment.filename)}}</div>
                            <div class="attachment-size">${{formatFileSize(attachment.size)}} • ${{attachment.mime_type}}</div>
                        </div>
                    `;
                    
                    attachmentList.appendChild(attachmentItem);
                }});
                
                attachmentsSection.style.display = 'block';
            }} else {{
                attachmentsSection.style.display = 'none';
            }}
        }}
        
        // Image modal functions
        function openImageModal(src) {{
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            modal.style.display = 'block';
            modalImg.src = src;
        }}
        
        function closeImageModal() {{
            document.getElementById('imageModal').style.display = 'none';
        }}
        
        // Click outside modal to close
        document.getElementById('imageModal').onclick = function(event) {{
            if (event.target === this) {{
                closeImageModal();
            }}
        }}
        
        // Escape key to close modal
        document.addEventListener('keydown', function(event) {{
            if (event.key === 'Escape') {{
                closeImageModal();
            }}
        }});
        
        // Utility functions
        function escapeHtml(text) {{
            const map = {{
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }};
            return text.replace(/[&<>"']/g, function(m) {{ return map[m]; }});
        }}
        
        function formatFileSize(bytes) {{
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }}
    </script>
</body>
</html>"""
        
        return api_content, 200, {'Content-Type': 'text/html; charset=utf-8'}
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'生成API页面失败: {str(e)}'
        }), 500

@app.route('/admin/api/card-logs', methods=['GET', 'POST', 'DELETE'])
@admin_required
def api_admin_card_logs():
    """卡密日志 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    if request.method == 'GET':
        # 应用保留策略
        retention_days = apply_card_log_retention(db, db_type)
        
        page = max(1, safe_int(request.args.get('page', 1), 1))
        per_page = max(1, safe_int(request.args.get('per_page', 30), 30))
        search = request.args.get('search', '').strip()
        offset = (page - 1) * per_page
        
        conditions = []
        params = []
        if search:
            conditions.append("cl.card_key LIKE ?")
            params.append(f"%{search}%")
        card_log_scope, card_log_scope_params = _mailbox_log_scope_condition(db, 'cl', 'bound_email')
        if card_log_scope:
            conditions.append(card_log_scope)
            params.extend(card_log_scope_params)
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        
        if db_type != 'sqlite':
            placeholder = '%s'
            if where_clause:
                where_clause = where_clause.replace('?', placeholder)
        
        # 获取总数
        if db_type == 'sqlite':
            count_row = db.execute(f"SELECT COUNT(*) as count FROM card_logs cl {where_clause}", params).fetchone()
            total = count_row['count'] if count_row else 0
            logs = db.execute(f'''
                SELECT cl.id, cl.card_key, cl.bound_email, cl.mail_subject, cl.user_ip, cl.created_at
                FROM card_logs cl
                {where_clause}
                ORDER BY cl.created_at DESC
                LIMIT ? OFFSET ?
            ''', params + [per_page, offset]).fetchall()
            data_rows = [dict(row) for row in logs]
        else:
            cursor = db.cursor()
            cursor.execute(f"SELECT COUNT(*) as count FROM card_logs cl {where_clause}", params)
            total_row = cursor.fetchone()
            total = total_row[0] if total_row else 0
            
            cursor.execute(f'''
                SELECT cl.id, cl.card_key, cl.bound_email, cl.mail_subject, cl.user_ip, cl.created_at
                FROM card_logs cl
                {where_clause}
                ORDER BY cl.created_at DESC
                LIMIT {per_page} OFFSET {offset}
            ''', params)
            logs = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            data_rows = [dict(zip(columns, row)) for row in logs]
        
        return jsonify({
            'success': True,
            'data': data_rows,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            },
            'retention_days': retention_days
        })
    
    elif request.method == 'DELETE':
        data = request.get_json() or {}
        card_key = data.get('card_key', '').strip()
        
        try:
            if db_type == 'sqlite':
                if card_key:
                    db.execute('DELETE FROM card_logs WHERE card_key = ?', (card_key,))
                else:
                    db.execute('DELETE FROM card_logs')
                db.commit()
            else:
                cursor = db.cursor()
                if card_key:
                    cursor.execute('DELETE FROM card_logs WHERE card_key = %s', (card_key,))
                else:
                    cursor.execute('DELETE FROM card_logs')
                db.commit()
            
            return jsonify({
                'success': True,
                'message': '卡密日志已清空' if not card_key else f'卡密 {card_key} 的日志已清空'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'清空失败: {str(e)}'
            })
    
    elif request.method == 'POST':
        data = request.get_json() or {}
        action = data.get('action')
        
        if action == 'set_retention':
            days_value = data.get('days', 0)
            try:
                days_int = max(0, int(days_value))
            except Exception:
                days_int = 0
            now = get_beijing_time()
            
            try:
                if db_type == 'sqlite':
                    db.execute('''
                        INSERT OR REPLACE INTO system_config (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                        VALUES (?, ?, 'number', '卡密日志保留天数', 0, ?, ?)
                    ''', ('card_log_retention_days', str(days_int), now, now))
                    db.commit()
                else:
                    cursor = db.cursor()
                    if db_type == 'mysql':
                        cursor.execute('''
                            INSERT INTO system_config (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                            VALUES (%s, %s, 'number', '卡密日志保留天数', 0, %s, %s)
                            ON DUPLICATE KEY UPDATE config_value=VALUES(config_value), updated_at=VALUES(updated_at)
                        ''', ('card_log_retention_days', str(days_int), now, now))
                    else:  # postgresql
                        cursor.execute('''
                            INSERT INTO system_config (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                            VALUES (%s, %s, 'number', '卡密日志保留天数', 0, %s, %s)
                            ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = EXCLUDED.updated_at
                        ''', ('card_log_retention_days', str(days_int), now, now))
                    db.commit()
                
                # 应用新的保留策略
                apply_card_log_retention(db, db_type)
                
                return jsonify({
                    'success': True,
                    'message': f'已{"关闭" if days_int == 0 else "更新"}定期清理（{days_int}天）'
                })
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'保存失败: {str(e)}'
                })
        
        return jsonify({
            'success': False,
            'message': '无效的操作'
        })

def apply_card_log_retention(db, db_type):
    """根据配置定期清理卡密日志"""
    try:
        retention_value = get_system_config('card_log_retention_days', '0')
        retention_days = safe_int(retention_value, 0)
    except Exception:
        retention_days = 0
    
    if retention_days <= 0:
        return 0
    
    cutoff_time = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=retention_days)
    cutoff_str = cutoff_time.strftime('%Y-%m-%d %H:%M:%S')
    
    try:
        if db_type == 'sqlite':
            db.execute('DELETE FROM card_logs WHERE created_at < ?', (cutoff_str,))
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('DELETE FROM card_logs WHERE created_at < %s', (cutoff_str,))
            db.commit()
    except Exception as e:
        logger.error(f"Auto clear card logs failed: {e}")
    
    return retention_days

def apply_mail_log_retention(db, db_type):
    """根据 mail_log_retention_days 清理收件日志，返回删除行数。

    注意：历史上 init.sql 里播种过 log_retention_days=30 但从未被代码引用；
    这里刻意使用新键 mail_log_retention_days（默认 0=关闭），让清理成为
    管理员显式开启的行为，避免老安装升级后被静默删数据。
    SQLite 删除后文件不会自动收缩（需 VACUUM），仅影响磁盘占用回收速度。
    """
    try:
        retention_days = safe_int(get_system_config('mail_log_retention_days', '0'), 0)
    except Exception:
        retention_days = 0

    if retention_days <= 0:
        return 0

    cutoff_time = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=retention_days)
    cutoff_str = cutoff_time.strftime('%Y-%m-%d %H:%M:%S')

    deleted = 0
    try:
        if db_type == 'sqlite':
            cursor = db.execute('DELETE FROM mail_logs WHERE created_at < ?', (cutoff_str,))
            deleted = cursor.rowcount or 0
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('DELETE FROM mail_logs WHERE created_at < %s', (cutoff_str,))
            deleted = cursor.rowcount or 0
            db.commit()
    except Exception as e:
        logger.error(f"Auto clear mail logs failed: {e}")

    return deleted

@app.route('/admin/api/recycle-bin')
@admin_required
def api_admin_recycle_bin():
    """获取回收站数据 API"""
    try:
        recycle_type = request.args.get('type', 'deleted')  # deleted 或 expired
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        # 获取回收站数据
        if db_type == 'sqlite':
            if recycle_type == 'deleted':
                cards = db.execute('''
                    SELECT * FROM card_recycle_bin 
                    WHERE recycle_type = 'deleted' 
                    ORDER BY deleted_at DESC
                ''').fetchall()
            else:  # expired
                cards = db.execute('''
                    SELECT * FROM card_recycle_bin 
                    WHERE recycle_type = 'expired' 
                    ORDER BY deleted_at DESC
                ''').fetchall()
            
            # 获取计数
            counts = {
                'deleted': db.execute('SELECT COUNT(*) as count FROM card_recycle_bin WHERE recycle_type = "deleted"').fetchone()['count'],
                'expired': db.execute('SELECT COUNT(*) as count FROM card_recycle_bin WHERE recycle_type = "expired"').fetchone()['count']
            }
        else:
            cursor = db.cursor()
            if recycle_type == 'deleted':
                cursor.execute('''
                    SELECT * FROM card_recycle_bin 
                    WHERE recycle_type = 'deleted' 
                    ORDER BY deleted_at DESC
                ''')
            else:  # expired
                cursor.execute('''
                    SELECT * FROM card_recycle_bin 
                    WHERE recycle_type = 'expired' 
                    ORDER BY deleted_at DESC
                ''')
            cards = cursor.fetchall()
            
            # 获取计数
            cursor.execute('SELECT COUNT(*) as count FROM card_recycle_bin WHERE recycle_type = %s', ('deleted',))
            deleted_count = cursor.fetchone()[0]
            cursor.execute('SELECT COUNT(*) as count FROM card_recycle_bin WHERE recycle_type = %s', ('expired',))
            expired_count = cursor.fetchone()[0]
            counts = {'deleted': deleted_count, 'expired': expired_count}
        
        return jsonify({
            'success': True,
            'data': [dict(card) for card in cards] if db_type == 'sqlite' else [dict(zip([desc[0] for desc in cursor.description], card)) for card in cards],
            'counts': counts
        })
        
    except Exception as e:
        logger.error(f"Get recycle bin error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取回收站数据失败: {str(e)}'
        })

@app.route('/admin/api/recycle-bin/restore', methods=['POST'])
@admin_required
def api_admin_restore_card():
    """恢复卡密 API (支持单个和批量)"""
    try:
        data = request.get_json()
        card_id = data.get('card_id')
        card_ids = data.get('card_ids')
        recycle_type = data.get('type', 'deleted')
        
        # 确定要恢复的卡密ID列表
        if card_ids:
            # 批量恢复
            ids_to_restore = card_ids
        elif card_id:
            # 单个恢复
            ids_to_restore = [card_id]
        else:
            return jsonify({
                'success': False,
                'message': '缺少卡密ID'
            })
        
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        restored_count = 0
        now = get_beijing_time()  # 使用北京时间
        
        for card_id in ids_to_restore:
            try:
                # 获取回收站中的卡密信息
                if db_type == 'sqlite':
                    recycled_card = db.execute('SELECT * FROM card_recycle_bin WHERE id = ?', (card_id,)).fetchone()
                else:
                    cursor = db.cursor()
                    cursor.execute('SELECT * FROM card_recycle_bin WHERE id = %s', (card_id,))
                    recycled_card = cursor.fetchone()
                
                if not recycled_card:
                    continue
                
                # 转换为字典
                if db_type == 'sqlite':
                    card_data = dict(recycled_card)
                else:
                    columns = [desc[0] for desc in cursor.description]
                    card_data = dict(zip(columns, recycled_card))
                
                # 恢复到主卡密表
                if db_type == 'sqlite':
                    db.execute('''
                        INSERT INTO cards (card_key, usage_limit, used_count, expired_at, bound_email_id, 
                                         email_days_filter, sender_filter, remarks, status, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    ''', (card_data['card_key'], card_data['usage_limit'], card_data['used_count'],
                          card_data['expired_at'], card_data['bound_email_id'], card_data['email_days_filter'],
                          card_data['sender_filter'], card_data['remarks'], card_data['created_at'], now))
                    
                    # 从回收站删除
                    db.execute('DELETE FROM card_recycle_bin WHERE id = ?', (card_id,))
                else:
                    cursor = db.cursor()
                    cursor.execute('''
                        INSERT INTO cards (card_key, usage_limit, used_count, expired_at, bound_email_id, 
                                         email_days_filter, sender_filter, remarks, status, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s)
                    ''', (card_data['card_key'], card_data['usage_limit'], card_data['used_count'],
                          card_data['expired_at'], card_data['bound_email_id'], card_data['email_days_filter'],
                          card_data['sender_filter'], card_data['remarks'], card_data['created_at'], now))
                    
                    # 从回收站删除
                    cursor.execute('DELETE FROM card_recycle_bin WHERE id = %s', (card_id,))
                
                restored_count += 1
                
            except Exception as e:
                logger.error(f"Error restoring card {card_id}: {e}")
                continue
        
        # 提交所有更改
        if db_type == 'sqlite':
            db.commit()
        else:
            db.commit()
        
        if restored_count > 0:
            message = f'成功恢复 {restored_count} 个卡密' if restored_count > 1 else '卡密恢复成功'
            return jsonify({
                'success': True,
                'message': message,
                'restored_count': restored_count
            })
        else:
            return jsonify({
                'success': False,
                'message': '没有找到可恢复的卡密'
            })
        
    except Exception as e:
        logger.error(f"Restore card error: {e}")
        return jsonify({
            'success': False,
            'message': f'恢复卡密失败: {str(e)}'
        })

@app.route('/admin/api/recycle-bin/permanent-delete', methods=['DELETE'])
@admin_required
def api_admin_permanent_delete_card():
    """永久删除卡密 API (支持单个和批量)"""
    try:
        data = request.get_json()
        card_id = data.get('card_id')
        card_ids = data.get('card_ids')
        
        # 确定要删除的卡密ID列表
        if card_ids:
            # 批量删除
            ids_to_delete = card_ids
        elif card_id:
            # 单个删除
            ids_to_delete = [card_id]
        else:
            return jsonify({
                'success': False,
                'message': '缺少卡密ID'
            })
        
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        deleted_count = 0
        
        for card_id in ids_to_delete:
            try:
                if db_type == 'sqlite':
                    result = db.execute('DELETE FROM card_recycle_bin WHERE id = ?', (card_id,))
                    if result.rowcount > 0:
                        deleted_count += 1
                else:
                    cursor = db.cursor()
                    cursor.execute('DELETE FROM card_recycle_bin WHERE id = %s', (card_id,))
                    if cursor.rowcount > 0:
                        deleted_count += 1
            except Exception as e:
                logger.error(f"Error deleting card {card_id}: {e}")
                continue
        
        # 提交所有更改
        if db_type == 'sqlite':
            db.commit()
        else:
            db.commit()
        
        if deleted_count > 0:
            message = f'成功永久删除 {deleted_count} 个卡密' if deleted_count > 1 else '卡密永久删除成功'
            return jsonify({
                'success': True,
                'message': message,
                'deleted_count': deleted_count
            })
        else:
            return jsonify({
                'success': False,
                'message': '没有找到可删除的卡密'
            })
        
    except Exception as e:
        logger.error(f"Permanent delete card error: {e}")
        return jsonify({
            'success': False,
            'message': f'永久删除失败: {str(e)}'
        })

@app.route('/admin/api/recycle-bin/clear', methods=['DELETE'])
@admin_required
def api_admin_clear_recycle_bin():
    """清空回收站 API"""
    try:
        db = get_db()
        db_type = app.config['DATABASE_TYPE']
        
        if db_type == 'sqlite':
            db.execute('DELETE FROM card_recycle_bin')
            db.commit()
        else:
            cursor = db.cursor()
            cursor.execute('DELETE FROM card_recycle_bin')
            db.commit()
        
        return jsonify({
            'success': True,
            'message': '回收站清空成功'
        })
        
    except Exception as e:
        logger.error(f"Clear recycle bin error: {e}")
        return jsonify({
            'success': False,
            'message': f'清空回收站失败: {str(e)}'
        })

@app.route('/admin/api/process-expired-cards', methods=['POST'])
@admin_required
def api_admin_process_expired_cards():
    """手动处理过期卡密 API"""
    try:
        process_expired_cards()
        return jsonify({
            'success': True,
            'message': '过期卡密处理完成'
        })
        
    except Exception as e:
        logger.error(f"Process expired cards API error: {e}")
        return jsonify({
            'success': False,
            'message': f'处理过期卡密失败: {str(e)}'
        })

@app.route('/admin/api/mail-logs', methods=['GET', 'POST'])
@admin_required
def api_admin_mail_logs():
    """收件日志 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        action = data.get('action', 'poll_now')

        if action != 'poll_now':
            return jsonify({
                'success': False,
                'message': '未知操作'
            }), 400

        started, message = trigger_mail_poll_once(
            source='manual_poll',
            admin_username=session.get('admin_username', 'admin')
        )
        return jsonify({
            'success': started,
            'message': message,
            'poller': get_mail_poller_state()
        }), 202 if started else 409

    try:
        page = max(safe_int(request.args.get('page', 1), 1), 1)
        per_page = min(max(safe_int(request.args.get('per_page', 30), 30), 1), 200)
        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '').strip()
        email_filters = request.args.get('email_filters', '').strip()
        subject_filters = request.args.get('subject_filters', '').strip()
        sender_filters = request.args.get('sender_filters', '').strip()
        admin_filter = request.args.get('admin', '').strip()
        offset = (page - 1) * per_page

        def split_filter_terms(value, limit=80):
            terms = []
            for item in re.split(r'[\n,，;；]+', value or ''):
                item = item.strip()
                if item and item not in terms:
                    terms.append(item)
                if len(terms) >= limit:
                    break
            return terms

        def add_like_filters(column_sql, raw_value):
            terms = split_filter_terms(raw_value)
            if not terms:
                return
            where_parts.append('(' + ' OR '.join([f'{column_sql} LIKE ?' for _ in terms]) + ')')
            params.extend([f'%{term}%' for term in terms])

        where_parts = []
        params = []
        log_scope_condition, log_scope_params = _mailbox_log_scope_condition(db, 'l')
        if log_scope_condition:
            where_parts.append(log_scope_condition)
            params.extend(log_scope_params)
        if search:
            where_parts.append('''
                (l.email LIKE ? OR l.mail_subject LIKE ? OR l.mail_from LIKE ?
                 OR l.error_message LIKE ? OR l.mail_body LIKE ? OR l.admin_username LIKE ?
                 OR ma.mailbox_created_by_admin LIKE ?)
            ''')
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param, search_param, search_param, search_param, search_param])

        add_like_filters('l.email', email_filters)
        add_like_filters('l.mail_subject', subject_filters)
        add_like_filters('l.mail_from', sender_filters)

        if status_filter in ('received', 'processed', 'failed'):
            where_parts.append('l.status = ?')
            params.append(status_filter)

        if admin_filter:
            where_parts.append("COALESCE(NULLIF(TRIM(ma.mailbox_created_by_admin), ''), NULLIF(TRIM(l.admin_username), ''), '') = ?")
            params.append(admin_filter)

        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ''
        email_key_sql = "LOWER(COALESCE(NULLIF(TRIM(l.email), ''), '-'))"
        mailbox_meta_sql = '''
            (
                SELECT a.email AS mailbox_email,
                       LOWER(COALESCE(NULLIF(TRIM(a.email), ''), '-')) AS email_key,
                       a.created_at AS mailbox_created_at,
                       a.created_by_admin AS mailbox_created_by_admin
                FROM mail_accounts a
                INNER JOIN (
                    SELECT LOWER(COALESCE(NULLIF(TRIM(email), ''), '-')) AS email_key,
                           MAX(id) AS latest_mailbox_id
                    FROM mail_accounts
                    GROUP BY LOWER(COALESCE(NULLIF(TRIM(email), ''), '-'))
                ) latest_mailbox ON a.id = latest_mailbox.latest_mailbox_id
            ) ma
        '''
        from_logs_sql = f'''
            FROM mail_logs l
            LEFT JOIN {mailbox_meta_sql} ON ma.email_key = {email_key_sql}
        '''

        if db_type == 'sqlite':
            count_row = db.execute(f'''
                SELECT COUNT(*) as count
                FROM (
                    SELECT {email_key_sql} AS email_key
                    {from_logs_sql}
                    {where_clause}
                    GROUP BY {email_key_sql}
                ) AS email_groups
            ''', params).fetchone()
            total = count_row['count']
            email_rows = db.execute(f'''
                SELECT {email_key_sql} AS email_key,
                       MAX(COALESCE(ma.mailbox_created_at, l.created_at)) AS sort_created_at,
                       MAX(l.id) AS latest_id
                {from_logs_sql}
                {where_clause}
                GROUP BY {email_key_sql}
                ORDER BY sort_created_at DESC, latest_id DESC
                LIMIT ? OFFSET ?
            ''', params + [per_page, offset]).fetchall()
            email_keys = [row['email_key'] for row in email_rows]
            logs = []
            if email_keys:
                key_placeholders = ','.join(['?'] * len(email_keys))
                key_where_parts = where_parts + [f'{email_key_sql} IN ({key_placeholders})']
                key_where_clause = f"WHERE {' AND '.join(key_where_parts)}"
                rows = db.execute(f'''
                    WITH ranked_logs AS (
                        SELECT {email_key_sql} AS email_key,
                               l.id, l.email, l.mail_subject, l.mail_from, l.mail_to, l.received_at, l.status,
                               l.error_message, l.ip_address, l.user_agent, l.created_at, l.message_id, l.folder, l.source,
                               l.admin_username, l.mail_body_type,
                               SUBSTR(COALESCE(l.mail_body, ''), 1, {MAIL_LOG_LIST_BODY_PREVIEW_LENGTH}) AS mail_body_preview,
                               CASE
                                   WHEN LENGTH(COALESCE(l.mail_body, '')) > {MAIL_LOG_LIST_BODY_PREVIEW_LENGTH} THEN 1
                                   ELSE 0
                               END AS mail_body_truncated,
                               ma.mailbox_created_at, ma.mailbox_created_by_admin,
                               COUNT(*) OVER (PARTITION BY {email_key_sql}) AS email_log_total,
                               SUM(CASE WHEN l.status = 'received' THEN 1 ELSE 0 END) OVER (PARTITION BY {email_key_sql}) AS email_received_count,
                               SUM(CASE WHEN l.status = 'processed' THEN 1 ELSE 0 END) OVER (PARTITION BY {email_key_sql}) AS email_processed_count,
                               SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) OVER (PARTITION BY {email_key_sql}) AS email_failed_count,
                               ROW_NUMBER() OVER (PARTITION BY {email_key_sql} ORDER BY l.id DESC) AS row_num
                        {from_logs_sql}
                        {key_where_clause}
                    )
                    SELECT *
                    FROM ranked_logs
                    WHERE row_num <= ?
                    ORDER BY COALESCE(mailbox_created_at, created_at) DESC, id DESC
                ''', params + email_keys + [MAIL_LOG_LIST_PER_EMAIL_LIMIT]).fetchall()
                logs = [dict(row) for row in rows]
            scope_where_clause = f'WHERE {log_scope_condition}' if log_scope_condition else ''
            stat_rows = db.execute(
                f'SELECT l.status, COUNT(*) as count FROM mail_logs l {scope_where_clause} GROUP BY l.status',
                log_scope_params
            ).fetchall()
            stats = {row['status']: row['count'] for row in stat_rows}
            admin_rows = db.execute('''
                SELECT admin_name FROM (
                    SELECT DISTINCT TRIM(created_by_admin) AS admin_name
                    FROM mail_accounts
                    WHERE TRIM(COALESCE(created_by_admin, '')) != ''
                    UNION
                    SELECT DISTINCT TRIM(admin_username) AS admin_name
                    FROM mail_logs
                    WHERE TRIM(COALESCE(admin_username, '')) != ''
                ) admins
                ORDER BY admin_name COLLATE NOCASE
            ''').fetchall()
            admin_options = [row['admin_name'] for row in admin_rows]
        else:
            cursor = db.cursor()
            try:
                where_parts_mysql = [part.replace('?', '%s') for part in where_parts]
                where_mysql = f"WHERE {' AND '.join(where_parts_mysql)}" if where_parts_mysql else ''
                cursor.execute(f'''
                    SELECT COUNT(*) as count
                    FROM (
                        SELECT {email_key_sql} AS email_key
                        {from_logs_sql}
                        {where_mysql}
                        GROUP BY {email_key_sql}
                    ) AS email_groups
                ''', params)
                total = cursor.fetchone()[0]
                cursor.execute(f'''
                    SELECT {email_key_sql} AS email_key,
                           MAX(COALESCE(ma.mailbox_created_at, l.created_at)) AS sort_created_at,
                           MAX(l.id) AS latest_id
                    {from_logs_sql}
                    {where_mysql}
                    GROUP BY {email_key_sql}
                    ORDER BY sort_created_at DESC, latest_id DESC
                    LIMIT {per_page} OFFSET {offset}
                ''', params)
                email_keys = [row[0] for row in cursor.fetchall()]
                logs = []
                if email_keys:
                    key_placeholders = ','.join(['%s'] * len(email_keys))
                    key_where_parts = where_parts_mysql + [f'{email_key_sql} IN ({key_placeholders})']
                    key_where_clause = f"WHERE {' AND '.join(key_where_parts)}"
                    cursor.execute(f'''
                        WITH ranked_logs AS (
                            SELECT {email_key_sql} AS email_key,
                                   l.id, l.email, l.mail_subject, l.mail_from, l.mail_to, l.received_at, l.status,
                                   l.error_message, l.ip_address, l.user_agent, l.created_at, l.message_id, l.folder, l.source,
                                   l.admin_username, l.mail_body_type,
                                   SUBSTRING(COALESCE(l.mail_body, ''), 1, {MAIL_LOG_LIST_BODY_PREVIEW_LENGTH}) AS mail_body_preview,
                                   CASE
                                       WHEN CHAR_LENGTH(COALESCE(l.mail_body, '')) > {MAIL_LOG_LIST_BODY_PREVIEW_LENGTH} THEN 1
                                       ELSE 0
                                   END AS mail_body_truncated,
                                   ma.mailbox_created_at, ma.mailbox_created_by_admin,
                                   COUNT(*) OVER (PARTITION BY {email_key_sql}) AS email_log_total,
                                   SUM(CASE WHEN l.status = 'received' THEN 1 ELSE 0 END) OVER (PARTITION BY {email_key_sql}) AS email_received_count,
                                   SUM(CASE WHEN l.status = 'processed' THEN 1 ELSE 0 END) OVER (PARTITION BY {email_key_sql}) AS email_processed_count,
                                   SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) OVER (PARTITION BY {email_key_sql}) AS email_failed_count,
                                   ROW_NUMBER() OVER (PARTITION BY {email_key_sql} ORDER BY l.id DESC) AS row_num
                            {from_logs_sql}
                            {key_where_clause}
                        )
                        SELECT *
                        FROM ranked_logs
                        WHERE row_num <= %s
                        ORDER BY COALESCE(mailbox_created_at, created_at) DESC, id DESC
                    ''', params + email_keys + [MAIL_LOG_LIST_PER_EMAIL_LIMIT])
                    columns = [desc[0] for desc in cursor.description]
                    logs = [_row_to_dict(row, columns) for row in cursor.fetchall()]
                scope_where_mysql = f'WHERE {log_scope_condition}' if log_scope_condition else ''
                cursor.execute(
                    f'SELECT l.status, COUNT(*) as count FROM mail_logs l {scope_where_mysql} GROUP BY l.status',
                    log_scope_params
                )
                stats = {row[0]: row[1] for row in cursor.fetchall()}
                cursor.execute('''
                    SELECT admin_name FROM (
                        SELECT DISTINCT TRIM(created_by_admin) AS admin_name
                        FROM mail_accounts
                        WHERE TRIM(COALESCE(created_by_admin, '')) != ''
                        UNION
                        SELECT DISTINCT TRIM(admin_username) AS admin_name
                        FROM mail_logs
                        WHERE TRIM(COALESCE(admin_username, '')) != ''
                    ) admins
                    ORDER BY admin_name
                ''')
                admin_options = [row[0] for row in cursor.fetchall()]
            finally:
                cursor.close()

        return jsonify({
            'success': True,
            'data': logs,
            'stats': {
                'total': sum(stats.values()),
                'received': stats.get('received', 0),
                'failed': stats.get('failed', 0),
                'processed': stats.get('processed', 0)
            },
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            },
            'admin_options': admin_options,
            'poller': get_mail_poller_state()
        })
    except Exception as e:
        logger.error(f"Get mail logs error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取收件日志失败: {str(e)}'
        }), 500

@app.route('/admin/api/poller/config', methods=['GET', 'POST'])
@admin_required
def api_admin_poller_config():
    """自动轮询管控：开关 / 间隔 / 日志保留 / 失败退避重置"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']

    def build_payload(message=None, success=True):
        state = get_mail_poller_state()
        state['backoff'] = _mail_poll_backoff_snapshot()
        state['auto_poll_enabled'] = _is_mail_auto_poll_enabled()
        payload = {
            'success': success,
            'config': {
                'auto_poll_enabled': get_system_config('mail_auto_poll_enabled', '1') == '1',
                'interval': _get_mail_poll_interval(),
                'min_interval': MAIL_POLL_MIN_INTERVAL,
                'retention_days': safe_int(get_system_config('mail_log_retention_days', '0'), 0),
                'failure_threshold': max(safe_int(get_system_config('mail_poll_failure_threshold', '3'), 3), 1),
                'backoff_max_skip': max(safe_int(get_system_config('mail_poll_backoff_max_skip', '16'), 16), 1),
                'env_kill_switch': os.environ.get('MAIL_AUTO_POLL', '1') == '0'
            },
            'state': state
        }
        if message is not None:
            payload['message'] = message
        return jsonify(payload)

    if request.method == 'GET':
        return build_payload()

    try:
        data = request.get_json(silent=True) or {}
        action = data.get('action')

        if action == 'set_enabled':
            enabled = bool(data.get('enabled'))
            set_system_config(db, db_type, 'mail_auto_poll_enabled', '1' if enabled else '0',
                              config_type='boolean', description='邮件自动轮询开关')
            _set_mail_poller_state(auto_poll_enabled=enabled)
            message = '已开启自动轮询（下个周期生效）' if enabled else '已暂停自动轮询'
            return build_payload(message)

        if action == 'set_interval':
            interval = max(safe_int(data.get('interval'), MAIL_POLL_DEFAULT_INTERVAL), MAIL_POLL_MIN_INTERVAL)
            set_system_config(db, db_type, 'mail_check_interval', str(interval),
                              config_type='number', description='邮件轮询间隔（秒）')
            _set_mail_poller_state(interval=interval)
            return build_payload(f'轮询间隔已设为 {interval} 秒，将在当前周期结束后生效')

        if action == 'set_retention':
            try:
                days = max(0, int(data.get('days', 0)))
            except Exception:
                days = 0
            set_system_config(db, db_type, 'mail_log_retention_days', str(days),
                              config_type='number', description='收件日志保留天数（0=不清理）')
            deleted = apply_mail_log_retention(db, db_type)
            if days == 0:
                message = '已关闭收件日志定期清理'
            else:
                message = f'保留天数已设为 {days} 天，本次清理 {deleted} 条历史日志'
            return build_payload(message)

        if action == 'reset_backoff':
            email = (data.get('email') or '').strip() or None
            _mail_poll_reset_backoff(email)
            _set_mail_poller_state(backoff=_mail_poll_backoff_snapshot())
            return build_payload(f'已重置 {email} 的退避状态' if email else '已重置全部退避状态')

        return jsonify({'success': False, 'message': '无效的操作'})
    except Exception as e:
        logger.error(f"Poller config error: {e}")
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'})

@app.route('/admin/api/mail-logs/<int:log_id>', methods=['GET'])
@admin_required
def api_admin_mail_log_detail(log_id):
    """单条收件日志详情 API，按需返回完整正文。"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']

    mailbox_meta_sql = '''
        (
            SELECT a.email AS mailbox_email,
                   LOWER(COALESCE(NULLIF(TRIM(a.email), ''), '-')) AS email_key,
                   a.created_at AS mailbox_created_at,
                   a.created_by_admin AS mailbox_created_by_admin
            FROM mail_accounts a
            INNER JOIN (
                SELECT LOWER(COALESCE(NULLIF(TRIM(email), ''), '-')) AS email_key,
                       MAX(id) AS latest_mailbox_id
                FROM mail_accounts
                GROUP BY LOWER(COALESCE(NULLIF(TRIM(email), ''), '-'))
            ) latest_mailbox ON a.id = latest_mailbox.latest_mailbox_id
        ) ma
    '''
    email_key_sql = "LOWER(COALESCE(NULLIF(TRIM(l.email), ''), '-'))"
    log_scope_condition, log_scope_params = _mailbox_log_scope_condition(db, 'l')
    scope_sql = f' AND {log_scope_condition}' if log_scope_condition else ''

    try:
        if db_type == 'sqlite':
            row = db.execute(f'''
                SELECT l.id, l.email, l.mail_subject, l.mail_from, l.mail_to, l.received_at, l.status,
                       l.error_message, l.ip_address, l.user_agent, l.created_at, l.message_id, l.folder, l.source,
                       l.admin_username, l.mail_body_type, l.mail_body,
                       ma.mailbox_created_at, ma.mailbox_created_by_admin
                FROM mail_logs l
                LEFT JOIN {mailbox_meta_sql} ON ma.email_key = {email_key_sql}
                WHERE l.id = ?
                {scope_sql}
                LIMIT 1
            ''', [log_id] + log_scope_params).fetchone()
            log = dict(row) if row else None
        else:
            cursor = db.cursor()
            try:
                cursor.execute(f'''
                    SELECT l.id, l.email, l.mail_subject, l.mail_from, l.mail_to, l.received_at, l.status,
                           l.error_message, l.ip_address, l.user_agent, l.created_at, l.message_id, l.folder, l.source,
                           l.admin_username, l.mail_body_type, l.mail_body,
                           ma.mailbox_created_at, ma.mailbox_created_by_admin
                    FROM mail_logs l
                    LEFT JOIN {mailbox_meta_sql} ON ma.email_key = {email_key_sql}
                    WHERE l.id = %s
                    {scope_sql}
                    LIMIT 1
                ''', [log_id] + log_scope_params)
                row = cursor.fetchone()
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                log = _row_to_dict(row, columns) if row else None
            finally:
                cursor.close()

        if not log:
            return jsonify({
                'success': False,
                'message': '收件日志不存在'
            }), 404

        return jsonify({
            'success': True,
            'data': log
        })
    except Exception as e:
        logger.error(f"Get mail log detail error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取收件日志详情失败: {str(e)}'
        }), 500

@app.route('/admin/api/mailbox-access', methods=['GET', 'POST'])
@admin_required
def api_admin_mailbox_access():
    """由范围控制人配置任意管理员的限制开关、分组和单邮箱授权。"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    managed_targets = _current_admin_managed_scope_targets(db)
    if not managed_targets:
        return jsonify({'success': False, 'message': '无权配置管理员邮箱范围'}), 403

    data = (request.get_json(silent=True) or {}) if request.method == 'POST' else request.args
    target_admin_id = safe_int(data.get('target_admin_id'), 0)
    allowed_target_ids = {safe_int(target.get('id'), 0) for target in managed_targets}
    if target_admin_id <= 0:
        target_admin_id = safe_int(managed_targets[0].get('id'), 0)
    if target_admin_id not in allowed_target_ids:
        return jsonify({'success': False, 'message': '无权配置该管理员'}), 403

    target = next(target for target in managed_targets if safe_int(target.get('id'), 0) == target_admin_id)

    if request.method == 'POST':
        restricted_enabled_value = data.get('restricted_enabled', True)
        if isinstance(restricted_enabled_value, str):
            restricted_enabled = restricted_enabled_value.strip().lower() not in ('0', 'false', 'off', 'no', '')
        else:
            restricted_enabled = bool(restricted_enabled_value)
        requested_ids = normalize_mailbox_id_list(data.get('mailbox_ids'))
        requested_group_ids = normalize_mailbox_id_list(data.get('group_ids'))
        try:
            if db_type == 'sqlite':
                existing_ids = set()
                existing_group_ids = set()
                if requested_ids:
                    placeholders = ','.join(['?'] * len(requested_ids))
                    rows = db.execute(
                        f'SELECT id FROM mail_accounts WHERE id IN ({placeholders})',
                        requested_ids
                    ).fetchall()
                    existing_ids = {int(row['id']) for row in rows}
                if requested_group_ids:
                    placeholders = ','.join(['?'] * len(requested_group_ids))
                    rows = db.execute(
                        f'SELECT id FROM mailbox_groups WHERE id IN ({placeholders})',
                        requested_group_ids
                    ).fetchall()
                    existing_group_ids = {int(row['id']) for row in rows}
                db.execute('DELETE FROM admin_mailbox_permissions WHERE admin_id = ?', (target_admin_id,))
                db.execute('DELETE FROM admin_mailbox_group_permissions WHERE admin_id = ?', (target_admin_id,))
                if restricted_enabled:
                    now = get_beijing_time()
                    db.execute('''
                        INSERT INTO admin_mailbox_scopes
                            (restricted_admin_id, manager_admin_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(restricted_admin_id) DO UPDATE SET
                            manager_admin_id = excluded.manager_admin_id,
                            updated_at = excluded.updated_at
                    ''', (target_admin_id, session.get('admin_id'), now, now))
                    for mailbox_id in requested_ids:
                        if mailbox_id in existing_ids:
                            db.execute('''
                                INSERT OR IGNORE INTO admin_mailbox_permissions
                                    (admin_id, mailbox_id, granted_by_admin_id, created_at)
                                VALUES (?, ?, ?, ?)
                            ''', (target_admin_id, mailbox_id, session.get('admin_id'), now))
                    for group_id in requested_group_ids:
                        if group_id in existing_group_ids:
                            db.execute('''
                                INSERT OR IGNORE INTO admin_mailbox_group_permissions
                                    (admin_id, group_id, granted_by_admin_id, created_at)
                                VALUES (?, ?, ?, ?)
                            ''', (target_admin_id, group_id, session.get('admin_id'), now))
                else:
                    db.execute('DELETE FROM admin_mailbox_scopes WHERE restricted_admin_id = ?', (target_admin_id,))
            else:
                cursor = db.cursor()
                existing_ids = set()
                existing_group_ids = set()
                if requested_ids:
                    placeholders = ','.join(['%s'] * len(requested_ids))
                    cursor.execute(
                        f'SELECT id FROM mail_accounts WHERE id IN ({placeholders})',
                        requested_ids
                    )
                    existing_ids = {
                        int(row['id'] if isinstance(row, dict) else row[0])
                        for row in cursor.fetchall()
                    }
                if requested_group_ids:
                    placeholders = ','.join(['%s'] * len(requested_group_ids))
                    cursor.execute(
                        f'SELECT id FROM mailbox_groups WHERE id IN ({placeholders})',
                        requested_group_ids
                    )
                    existing_group_ids = {
                        int(row['id'] if isinstance(row, dict) else row[0])
                        for row in cursor.fetchall()
                    }
                cursor.execute('DELETE FROM admin_mailbox_permissions WHERE admin_id = %s', (target_admin_id,))
                cursor.execute('DELETE FROM admin_mailbox_group_permissions WHERE admin_id = %s', (target_admin_id,))
                if restricted_enabled:
                    now = get_beijing_time()
                    if db_type == 'mysql':
                        cursor.execute('''
                            INSERT INTO admin_mailbox_scopes
                                (restricted_admin_id, manager_admin_id, created_at, updated_at)
                            VALUES (%s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                manager_admin_id = VALUES(manager_admin_id),
                                updated_at = VALUES(updated_at)
                        ''', (target_admin_id, session.get('admin_id'), now, now))
                    else:
                        cursor.execute('''
                            INSERT INTO admin_mailbox_scopes
                                (restricted_admin_id, manager_admin_id, created_at, updated_at)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (restricted_admin_id) DO UPDATE SET
                                manager_admin_id = EXCLUDED.manager_admin_id,
                                updated_at = EXCLUDED.updated_at
                        ''', (target_admin_id, session.get('admin_id'), now, now))
                    for mailbox_id in requested_ids:
                        if mailbox_id not in existing_ids:
                            continue
                        if db_type == 'mysql':
                            cursor.execute('''
                                INSERT IGNORE INTO admin_mailbox_permissions
                                    (admin_id, mailbox_id, granted_by_admin_id, created_at)
                                VALUES (%s, %s, %s, %s)
                            ''', (target_admin_id, mailbox_id, session.get('admin_id'), now))
                        else:
                            cursor.execute('''
                                INSERT INTO admin_mailbox_permissions
                                    (admin_id, mailbox_id, granted_by_admin_id, created_at)
                                VALUES (%s, %s, %s, %s)
                                ON CONFLICT (admin_id, mailbox_id) DO NOTHING
                            ''', (target_admin_id, mailbox_id, session.get('admin_id'), now))
                    for group_id in requested_group_ids:
                        if group_id not in existing_group_ids:
                            continue
                        if db_type == 'mysql':
                            cursor.execute('''
                                INSERT IGNORE INTO admin_mailbox_group_permissions
                                    (admin_id, group_id, granted_by_admin_id, created_at)
                                VALUES (%s, %s, %s, %s)
                            ''', (target_admin_id, group_id, session.get('admin_id'), now))
                        else:
                            cursor.execute('''
                                INSERT INTO admin_mailbox_group_permissions
                                    (admin_id, group_id, granted_by_admin_id, created_at)
                                VALUES (%s, %s, %s, %s)
                                ON CONFLICT (admin_id, group_id) DO NOTHING
                            ''', (target_admin_id, group_id, session.get('admin_id'), now))
                else:
                    cursor.execute('DELETE FROM admin_mailbox_scopes WHERE restricted_admin_id = %s', (target_admin_id,))
                cursor.close()
            db.commit()
            return jsonify({
                'success': True,
                'message': (
                    f'已更新管理员 {target.get("username", "")} 的邮箱可见范围'
                    if restricted_enabled else
                    f'已取消管理员 {target.get("username", "")} 的邮箱范围限制'
                ),
                'data': {
                    'restricted_enabled': restricted_enabled,
                    'granted_count': len(existing_ids.intersection(requested_ids)) if restricted_enabled else 0,
                    'granted_group_count': len(existing_group_ids.intersection(requested_group_ids)) if restricted_enabled else 0,
                }
            })
        except Exception as e:
            db.rollback()
            logger.error(f"Update admin mailbox access error: {e}")
            return jsonify({'success': False, 'message': f'保存邮箱范围失败: {str(e)}'}), 500

    try:
        if db_type == 'sqlite':
            rows = db.execute('''
                SELECT ma.id, ma.email, ma.created_by_admin, ma.remarks, ma.status, ma.created_at,
                       CASE WHEN amp.mailbox_id IS NULL THEN 0 ELSE 1 END AS granted
                FROM mail_accounts ma
                LEFT JOIN admin_mailbox_permissions amp
                  ON amp.mailbox_id = ma.id AND amp.admin_id = ?
                ORDER BY ma.id ASC
            ''', (target_admin_id,)).fetchall()
            mailboxes = [dict(row) for row in rows]
            group_rows = db.execute('''
                SELECT mg.id, mg.name, mg.parent_id, mg.created_by_admin,
                       (SELECT COUNT(DISTINCT mgm.mailbox_id)
                        FROM mailbox_group_mappings mgm WHERE mgm.group_id = mg.id) AS mailbox_count,
                       CASE WHEN amgp.group_id IS NULL THEN 0 ELSE 1 END AS granted
                FROM mailbox_groups mg
                LEFT JOIN admin_mailbox_group_permissions amgp
                  ON amgp.group_id = mg.id AND amgp.admin_id = ?
                ORDER BY mg.sort_order ASC, mg.id ASC
            ''', (target_admin_id,)).fetchall()
            groups = [dict(row) for row in group_rows]
        else:
            cursor = db.cursor()
            cursor.execute('''
                SELECT ma.id, ma.email, ma.created_by_admin, ma.remarks, ma.status, ma.created_at,
                       CASE WHEN amp.mailbox_id IS NULL THEN 0 ELSE 1 END AS granted
                FROM mail_accounts ma
                LEFT JOIN admin_mailbox_permissions amp
                  ON amp.mailbox_id = ma.id AND amp.admin_id = %s
                ORDER BY ma.id ASC
            ''', (target_admin_id,))
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            mailboxes = [_row_to_dict(row, columns) for row in rows]
            cursor.execute('''
                SELECT mg.id, mg.name, mg.parent_id, mg.created_by_admin,
                       (SELECT COUNT(DISTINCT mgm.mailbox_id)
                        FROM mailbox_group_mappings mgm WHERE mgm.group_id = mg.id) AS mailbox_count,
                       CASE WHEN amgp.group_id IS NULL THEN 0 ELSE 1 END AS granted
                FROM mailbox_groups mg
                LEFT JOIN admin_mailbox_group_permissions amgp
                  ON amgp.group_id = mg.id AND amgp.admin_id = %s
                ORDER BY mg.sort_order ASC, mg.id ASC
            ''', (target_admin_id,))
            group_rows = cursor.fetchall()
            group_columns = [desc[0] for desc in cursor.description] if cursor.description else []
            groups = [_row_to_dict(row, group_columns) for row in group_rows]
            cursor.close()

        target_username = str(target.get('username') or '')
        for mailbox in mailboxes:
            mailbox['owned_by_target'] = (
                str(mailbox.get('created_by_admin') or '').strip().lower() == target_username.strip().lower()
            )
        return jsonify({
            'success': True,
            'data': {
                'targets': managed_targets,
                'target': target,
                'mailboxes': mailboxes,
                'groups': groups,
                'restricted_enabled': bool(safe_int(target.get('restricted_enabled'), 0)),
                'policy': 'own_plus_granted_mailboxes_and_groups'
            }
        })
    except Exception as e:
        logger.error(f"Get admin mailbox access error: {e}")
        return jsonify({'success': False, 'message': f'获取邮箱范围失败: {str(e)}'}), 500

@app.route('/admin/api/system-config', methods=['GET', 'POST'])
@admin_required
def api_admin_system_config():
    """系统设置 API"""
    db = get_db()
    db_type = app.config['DATABASE_TYPE']
    
    if request.method == 'GET':
        try:
            # 获取当前管理员信息
            current_admin_username = session.get('admin_username', 'admin')
            current_admin_id = session.get('admin_id')
            
            # 获取系统配置
            system_config = {}
            if db_type == 'sqlite':
                config_rows = db.execute('SELECT config_key, config_value FROM system_config').fetchall()
                for row in config_rows:
                    system_config[row['config_key']] = row['config_value']
                admin_rows = db.execute('SELECT id, username, created_at FROM admin_users ORDER BY id ASC').fetchall()
                admin_users = [dict(row) for row in admin_rows]
            else:
                cursor = db.cursor()
                cursor.execute('SELECT config_key, config_value FROM system_config')
                config_rows = cursor.fetchall()
                for row in config_rows:
                    system_config[row[0]] = row[1]
                cursor.execute('SELECT id, username, created_at FROM admin_users ORDER BY id ASC')
                admin_rows = cursor.fetchall()
                admin_columns = [desc[0] for desc in cursor.description]
                admin_users = [dict(zip(admin_columns, row)) for row in admin_rows]
            
            return jsonify({
                'success': True,
                'data': {
                    'system_name': system_config.get('system_name', '邮件查看系统'),
                    'system_title': system_config.get('system_title', '邮件查看系统'),
                    'version': system_config.get('system_version', '2.0.0'),
                    'database_type': app.config['DATABASE_TYPE'],
                    'admin_username': current_admin_username,
                    'api_page_title': system_config.get('api_page_title', 'API取件页面'),
                    'frontend_page_title': system_config.get('frontend_page_title', '邮件查看'),
                    'admin_login_title': system_config.get('admin_login_title', '管理员登录'),
                    'admin_master_key_set': bool(system_config.get('admin_master_key', '')),
                    'current_admin_id': current_admin_id,
                    'admin_users': admin_users,
                    'can_manage_mailbox_access': bool(_current_admin_managed_scope_targets(db))
                }
            })
        except Exception as e:
            logger.error(f"Get system config error: {e}")
            return jsonify({
                'success': False,
                'message': f'获取系统设置失败: {str(e)}'
            })
    
    else:  # POST
        try:
            data = request.get_json()
            action = data.get('action')
            
            if action == 'update_admin':
                return _update_admin_account(db, db_type, data)
            elif action == 'add_admin':
                return _add_admin_account(db, db_type, data)
            elif action == 'reset_admin_password':
                return _reset_admin_password(db, db_type, data)
            elif action == 'delete_admin':
                return _delete_admin_account(db, db_type, data)
            elif action == 'update_page_titles':
                return _update_page_titles(db, db_type, data)
            elif action == 'update_system_title':
                return _update_system_title(db, db_type, data)
            elif action == 'update_admin_master_key':
                return _update_admin_master_key(db, db_type, data)
            else:
                return jsonify({
                    'success': False,
                    'message': '未知的操作类型'
                })
                
        except Exception as e:
            logger.error(f"Update system config error: {e}")
            return jsonify({
                'success': False,
                'message': f'更新系统设置失败: {str(e)}'
            })

def _update_admin_account(db, db_type, data):
    """更新管理员账号"""
    new_username = data.get('admin_username', '').strip()
    new_password = data.get('admin_password', '').strip()
    
    if not new_username or not new_password:
        return jsonify({
            'success': False,
            'message': '用户名和密码不能为空'
        })
    
    if len(new_password) < 4:
        return jsonify({
            'success': False,
            'message': '密码长度至少4位'
        })
    
    try:
        current_admin_id = session.get('admin_id')
        
        # 验证当前用户ID
        if not current_admin_id:
            return jsonify({
                'success': False,
                'message': '会话已过期，请重新登录'
            })
        
        # 加密密码（生产环境使用）
        hashed_password = generate_password_hash(new_password)
        
        if db_type == 'sqlite':
            # 检查当前用户是否存在
            current_user = db.execute(
                'SELECT id, username FROM admin_users WHERE id = ?',
                (current_admin_id,)
            ).fetchone()
            
            if not current_user:
                return jsonify({
                    'success': False,
                    'message': '当前管理员用户不存在'
                })
            
            # 检查新用户名是否已存在（排除当前用户）
            if new_username != current_user['username']:
                existing_user = db.execute(
                    'SELECT id FROM admin_users WHERE username = ? AND id != ?', 
                    (new_username, current_admin_id)
                ).fetchone()
                
                if existing_user:
                    return jsonify({
                        'success': False,
                        'message': '用户名已存在'
                    })
            
            # 更新管理员账号
            db.execute(
                'UPDATE admin_users SET username = ?, password = ? WHERE id = ?',
                (new_username, hashed_password, current_admin_id)
            )
            db.commit()
        else:
            cursor = db.cursor()
            
            # 检查当前用户是否存在
            cursor.execute(
                'SELECT id, username FROM admin_users WHERE id = %s',
                (current_admin_id,)
            )
            current_user = cursor.fetchone()
            
            if not current_user:
                return jsonify({
                    'success': False,
                    'message': '当前管理员用户不存在'
                })
            
            # 检查新用户名是否已存在（排除当前用户）
            current_username = current_user[1] if current_user else None
            if new_username != current_username:
                cursor.execute(
                    'SELECT id FROM admin_users WHERE username = %s AND id != %s', 
                    (new_username, current_admin_id)
                )
                existing_user = cursor.fetchone()
                
                if existing_user:
                    return jsonify({
                        'success': False,
                        'message': '用户名已存在'
                    })
            
            # 更新管理员账号
            cursor.execute(
                'UPDATE admin_users SET username = %s, password = %s WHERE id = %s',
                (new_username, hashed_password, current_admin_id)
            )
            db.commit()
        
        # 更新会话中的用户名
        session['admin_username'] = new_username
        
        logger.info(f"Admin account updated: {current_user['username'] if 'current_user' in locals() else 'unknown'} -> {new_username}")
        
        return jsonify({
            'success': True,
            'message': '管理员账号更新成功'
        })
        
    except Exception as e:
        logger.error(f"Update admin account error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新管理员账号失败: {str(e)}'
        })

def _add_admin_account(db, db_type, data):
    """新增后台管理员账号"""
    if _get_current_admin_mailbox_scope(db):
        return jsonify({'success': False, 'message': '受限管理员无权新增其他管理员'}), 403

    username = data.get('admin_username', '').strip()
    password = data.get('admin_password', '').strip()

    if not username or not password:
        return jsonify({
            'success': False,
            'message': '用户名和密码不能为空'
        })

    if len(password) < 4:
        return jsonify({
            'success': False,
            'message': '密码长度至少4位'
        })

    try:
        hashed_password = generate_password_hash(password)
        now = get_beijing_time()

        if db_type == 'sqlite':
            existing_user = db.execute(
                'SELECT id FROM admin_users WHERE username = ?',
                (username,)
            ).fetchone()
            if existing_user:
                return jsonify({
                    'success': False,
                    'message': '用户名已存在'
                })

            db.execute(
                'INSERT INTO admin_users (username, password, created_at) VALUES (?, ?, ?)',
                (username, hashed_password, now)
            )
            db.commit()
            admin_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        else:
            cursor = db.cursor()
            cursor.execute(
                'SELECT id FROM admin_users WHERE username = %s',
                (username,)
            )
            if cursor.fetchone():
                return jsonify({
                    'success': False,
                    'message': '用户名已存在'
                })

            cursor.execute(
                'INSERT INTO admin_users (username, password, created_at) VALUES (%s, %s, %s)',
                (username, hashed_password, now)
            )
            db.commit()
            admin_id = getattr(cursor, 'lastrowid', None)

        return jsonify({
            'success': True,
            'message': '管理员添加成功',
            'data': {
                'id': admin_id,
                'username': username,
                'created_at': now
            }
        })
    except Exception as e:
        logger.error(f"Add admin account error: {e}")
        return jsonify({
            'success': False,
            'message': f'添加管理员失败: {str(e)}'
        })

def _reset_admin_password(db, db_type, data):
    """重置指定后台管理员密码"""
    admin_id = safe_int(data.get('admin_id'), 0)
    new_password = data.get('admin_password', '').strip()

    if admin_id <= 0:
        return jsonify({
            'success': False,
            'message': '缺少管理员ID'
        })

    if not new_password:
        return jsonify({
            'success': False,
            'message': '密码不能为空'
        })

    if len(new_password) < 4:
        return jsonify({
            'success': False,
            'message': '密码长度至少4位'
        })

    current_admin_id = safe_int(session.get('admin_id'), 0)
    if _get_current_admin_mailbox_scope(db) and admin_id != current_admin_id:
        return jsonify({'success': False, 'message': '受限管理员无权重置其他管理员密码'}), 403

    if _is_admin_mailbox_scope_manager(db, admin_id) and admin_id != current_admin_id:
        return jsonify({'success': False, 'message': '邮箱范围控制人的密码只能由本人修改'}), 403

    try:
        hashed_password = generate_password_hash(new_password)

        if db_type == 'sqlite':
            target_admin = db.execute(
                'SELECT id, username FROM admin_users WHERE id = ?',
                (admin_id,)
            ).fetchone()
            if not target_admin:
                return jsonify({
                    'success': False,
                    'message': '管理员不存在'
                })

            db.execute(
                'UPDATE admin_users SET password = ? WHERE id = ?',
                (hashed_password, admin_id)
            )
            db.commit()
            username = target_admin['username']
        else:
            cursor = db.cursor()
            cursor.execute(
                'SELECT id, username FROM admin_users WHERE id = %s',
                (admin_id,)
            )
            target_admin = cursor.fetchone()
            if not target_admin:
                return jsonify({
                    'success': False,
                    'message': '管理员不存在'
                })

            cursor.execute(
                'UPDATE admin_users SET password = %s WHERE id = %s',
                (hashed_password, admin_id)
            )
            db.commit()
            username = target_admin[1]

        return jsonify({
            'success': True,
            'message': f'管理员 {username} 的密码已重置'
        })
    except Exception as e:
        logger.error(f"Reset admin password error: {e}")
        return jsonify({
            'success': False,
            'message': f'重置密码失败: {str(e)}'
        })

def _delete_admin_account(db, db_type, data):
    """删除后台管理员账号"""
    admin_id = safe_int(data.get('admin_id'), 0)
    current_admin_id = safe_int(session.get('admin_id'), 0)

    if admin_id <= 0:
        return jsonify({
            'success': False,
            'message': '缺少管理员ID'
        })

    if admin_id == current_admin_id:
        return jsonify({
            'success': False,
            'message': '不能删除当前登录的管理员'
        })

    if _get_current_admin_mailbox_scope(db):
        return jsonify({'success': False, 'message': '受限管理员无权删除其他管理员'}), 403

    if _is_admin_mailbox_scope_manager(db, admin_id):
        return jsonify({'success': False, 'message': '邮箱范围控制人不能被其他管理员删除'}), 403

    try:
        if db_type == 'sqlite':
            admin_count = db.execute('SELECT COUNT(*) FROM admin_users').fetchone()[0]
            if admin_count <= 1:
                return jsonify({
                    'success': False,
                    'message': '至少需要保留一个管理员账号'
                })

            target_admin = db.execute(
                'SELECT id, username FROM admin_users WHERE id = ?',
                (admin_id,)
            ).fetchone()
            if not target_admin:
                return jsonify({
                    'success': False,
                    'message': '管理员不存在'
                })

            db.execute('DELETE FROM admin_users WHERE id = ?', (admin_id,))
            db.commit()
            deleted_username = target_admin['username']
        else:
            cursor = db.cursor()
            cursor.execute('SELECT COUNT(*) FROM admin_users')
            admin_count = cursor.fetchone()[0]
            if admin_count <= 1:
                return jsonify({
                    'success': False,
                    'message': '至少需要保留一个管理员账号'
                })

            cursor.execute(
                'SELECT id, username FROM admin_users WHERE id = %s',
                (admin_id,)
            )
            target_admin = cursor.fetchone()
            if not target_admin:
                return jsonify({
                    'success': False,
                    'message': '管理员不存在'
                })

            deleted_username = target_admin[1]
            cursor.execute('DELETE FROM admin_users WHERE id = %s', (admin_id,))
            db.commit()

        return jsonify({
            'success': True,
            'message': f'管理员 {deleted_username} 已删除'
        })
    except Exception as e:
        logger.error(f"Delete admin account error: {e}")
        return jsonify({
            'success': False,
            'message': f'删除管理员失败: {str(e)}'
        })

def _update_page_titles(db, db_type, data):
    """更新页面标题设置"""
    api_page_title = data.get('api_page_title', '').strip()
    frontend_page_title = data.get('frontend_page_title', '').strip()
    admin_login_title = data.get('admin_login_title', '').strip()
    
    if not api_page_title or not frontend_page_title or not admin_login_title:
        return jsonify({
            'success': False,
            'message': '所有页面标题不能为空'
        })
    
    try:
        now = get_beijing_time()
        
        # 更新或插入配置项
        config_items = [
            ('api_page_title', api_page_title, 'API取件页面标题'),
            ('frontend_page_title', frontend_page_title, '前端取件页面标题'),
            ('admin_login_title', admin_login_title, '管理员登录页面标题')
        ]
        
        for config_key, config_value, description in config_items:
            if db_type == 'sqlite':
                # 使用 INSERT OR REPLACE 语法
                db.execute('''
                    INSERT OR REPLACE INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES (?, ?, 'string', ?, 0, 
                        COALESCE((SELECT created_at FROM system_config WHERE config_key = ?), ?), 
                        ?)
                ''', (config_key, config_value, description, config_key, now, now))
            else:
                cursor = db.cursor()
                if db_type == 'mysql':
                    # MySQL 使用 ON DUPLICATE KEY UPDATE
                    cursor.execute('''
                        INSERT INTO system_config 
                        (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                        VALUES (%s, %s, 'string', %s, 0, %s, %s)
                        ON DUPLICATE KEY UPDATE 
                        config_value = VALUES(config_value), 
                        updated_at = VALUES(updated_at)
                    ''', (config_key, config_value, description, now, now))
                else:  # PostgreSQL
                    # PostgreSQL 使用 ON CONFLICT
                    cursor.execute('''
                        INSERT INTO system_config 
                        (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                        VALUES (%s, %s, 'string', %s, 0, %s, %s)
                        ON CONFLICT (config_key) DO UPDATE SET 
                        config_value = EXCLUDED.config_value, 
                        updated_at = EXCLUDED.updated_at
                    ''', (config_key, config_value, description, now, now))
        
        if db_type == 'sqlite':
            db.commit()
        else:
            db.commit()
        
        logger.info(f"Page titles updated: API={api_page_title}, Frontend={frontend_page_title}, Admin={admin_login_title}")
        
        return jsonify({
            'success': True,
            'message': '页面标题更新成功'
        })
        
    except Exception as e:
        logger.error(f"Update page titles error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新页面标题失败: {str(e)}'
        })

def _update_system_title(db, db_type, data):
    """更新系统标题设置"""
    system_title = data.get('system_title', '').strip()
    
    if not system_title:
        return jsonify({
            'success': False,
            'message': '系统标题不能为空'
        })
    
    try:
        now = get_beijing_time()
        
        # 更新或插入系统标题配置
        if db_type == 'sqlite':
            # 使用 INSERT OR REPLACE 语法
            db.execute('''
                INSERT OR REPLACE INTO system_config 
                (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                VALUES ('system_title', ?, 'string', '系统页面标题', 0, 
                    COALESCE((SELECT created_at FROM system_config WHERE config_key = 'system_title'), ?), 
                    ?)
            ''', (system_title, now, now))
        else:
            cursor = db.cursor()
            if db_type == 'mysql':
                # MySQL 使用 ON DUPLICATE KEY UPDATE
                cursor.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('system_title', %s, 'string', '系统页面标题', 0, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                    config_value = VALUES(config_value), 
                    updated_at = VALUES(updated_at)
                ''', (system_title, now, now))
            else:  # PostgreSQL
                # PostgreSQL 使用 ON CONFLICT
                cursor.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('system_title', %s, 'string', '系统页面标题', 0, %s, %s)
                    ON CONFLICT (config_key) DO UPDATE SET 
                    config_value = EXCLUDED.config_value, 
                    updated_at = EXCLUDED.updated_at
                ''', (system_title, now, now))
        
        if db_type == 'sqlite':
            db.commit()
        else:
            db.commit()
        
        logger.info(f"System title updated to: {system_title}")
        
        return jsonify({
            'success': True,
            'message': '系统标题更新成功'
        })
        
    except Exception as e:
        logger.error(f"Update system title error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新系统标题失败: {str(e)}'
        })

def _update_admin_master_key(db, db_type, data):
    """更新管理员万能秘钥（哈希存储）"""
    new_key = (data.get('admin_master_key') or '').strip()
    confirm_key_raw = data.get('confirm_master_key')
    confirm_key = (confirm_key_raw or '').strip()
    
    if not new_key:
        return jsonify({
            'success': False,
            'message': '请输入管理员万能秘钥'
        })
    
    # 如果提供了单独的确认值但不一致则拒绝；未提供则按单次输入处理
    if confirm_key_raw is not None and confirm_key and new_key != confirm_key:
        return jsonify({
            'success': False,
            'message': '两次输入的秘钥不一致'
        })
    
    if len(new_key) < 6:
        return jsonify({
            'success': False,
            'message': '万能秘钥长度至少6位'
        })
    
    try:
        now = get_beijing_time()
        hashed_key = generate_password_hash(new_key)
        
        if db_type == 'sqlite':
            db.execute('''
                INSERT OR REPLACE INTO system_config 
                (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                VALUES ('admin_master_key', ?, 'secret', '管理员万能秘钥', 0, 
                    COALESCE((SELECT created_at FROM system_config WHERE config_key = 'admin_master_key'), ?), 
                    ?)
            ''', (hashed_key, now, now))
        else:
            cursor = db.cursor()
            if db_type == 'mysql':
                cursor.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('admin_master_key', %s, 'secret', '管理员万能秘钥', 0, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                    config_value = VALUES(config_value),
                    updated_at = VALUES(updated_at)
                ''', (hashed_key, now, now))
            else:  # postgresql
                cursor.execute('''
                    INSERT INTO system_config 
                    (config_key, config_value, config_type, description, is_system, created_at, updated_at)
                    VALUES ('admin_master_key', %s, 'secret', '管理员万能秘钥', 0, %s, %s)
                    ON CONFLICT (config_key) DO UPDATE SET 
                    config_value = EXCLUDED.config_value,
                    updated_at = EXCLUDED.updated_at
                ''', (hashed_key, now, now))
        
        db.commit()

        # 提交后立即从实际配置读取并校验，避免仅凭 SQL 未抛错就向前端报告成功。
        if not verify_admin_master_key(new_key):
            logger.error("Admin master key read-back verification failed")
            return jsonify({
                'success': False,
                'message': '万能秘钥写入后校验失败，请检查数据库持久化配置'
            }), 500
        
        logger.info("Admin master key updated")
        
        return jsonify({
            'success': True,
            'message': '管理员万能秘钥已保存并验证',
            'data': {
                'admin_master_key_set': True,
                'verified': True
            }
        })
    except Exception as e:
        logger.error(f"Update admin master key error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新万能秘钥失败: {str(e)}'
        })

if __name__ == '__main__':
    # 初始化数据库
    with app.app_context():
        init_db()

    # 启动邮件自动轮询
    start_mail_poller()
    
    # 启动应用（端口8005）
    port = int(os.environ.get('PORT', 8005))
    app.run(debug=False, host='0.0.0.0', port=port)
