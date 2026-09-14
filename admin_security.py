"""Administrator ownership and explicit, inheritable feature grants.

Account IDs carry authority. Usernames never confer authority after migration.
Missing profiles, missing parents and cycles deny access rather than bypass checks.
"""
import json
from flask import current_app, g, session
from werkzeug.security import generate_password_hash

BUILTIN_SECOND_LEVEL_USERNAMES = frozenset(('lhm', 'pink'))
RESERVED_USERNAMES = BUILTIN_SECOND_LEVEL_USERNAMES | {'tjt740'}
HIERARCHY_PERMISSIONS = frozenset(('admins', 'mailbox_access'))

PERMISSIONS = {
    'home': '首页统计',
    'mailbox': '邮箱管理',
    'mailbox_all': '查看全部邮箱（跨账号）',
    'proxies': '代理池管理（全站）',
    'cards': '卡密管理（全站）',
    'card_logs': '卡密日志（全站）',
    'mail_logs': '收件日志',
    'settings': '系统设置（标题、服务器、轮询）',
    'admins': '管理直属下级及功能授权',
    'mailbox_access': '授权直属下级邮箱范围',
    'master_key': '设置和使用本人万能密钥',
}
PAGE_PERMISSIONS = {
    'home': 'home', 'mailbox': 'mailbox', 'daili': 'proxies', 'kami': 'cards',
    'kamirizhi': 'card_logs', 'shoujian': 'mail_logs',
}


def query(db, sql, params=(), *, write=False, db_type=None):
    db_type = db_type or current_app.config['DATABASE_TYPE']
    cursor = db.cursor()
    try:
        cursor.execute(sql if db_type == 'sqlite' else sql.replace('?', '%s'), params)
        if write:
            return cursor.rowcount
        columns = [col[0] for col in cursor.description] if cursor.description else []
        return [dict(row) if hasattr(row, 'keys') else dict(zip(columns, row)) for row in cursor.fetchall()]
    finally:
        cursor.close()


def migrate(db, db_type):
    """Persist levels once: tjt740 is level 1, existing lhm/pink are built-in level 2.

    Later restarts never derive privilege from usernames or reset saved grants.
    """
    query(db, '''CREATE TABLE IF NOT EXISTS admin_access (
        admin_id INTEGER PRIMARY KEY,
        parent_admin_id INTEGER,
        is_super_admin INTEGER NOT NULL DEFAULT 0,
        permissions TEXT NOT NULL,
        session_version INTEGER NOT NULL DEFAULT 0,
        master_key_hash TEXT NOT NULL,
        master_key_digest VARCHAR(64) UNIQUE,
        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_admin_id) REFERENCES admin_users(id)
    )''', write=True, db_type=db_type)
    cursor = db.cursor()
    try:
        cursor.execute('SELECT * FROM admin_access WHERE 1 = 0')
        columns = {column[0] for column in cursor.description}
    finally:
        cursor.close()
    upgrade_levels = 'admin_level' not in columns
    for column, default in (('admin_level', 0), ('is_builtin_admin', 0)):
        if column not in columns:
            query(db, f'ALTER TABLE admin_access ADD COLUMN {column} INTEGER NOT NULL DEFAULT {default}',
                  write=True, db_type=db_type)
    users = query(db, 'SELECT id, username FROM admin_users ORDER BY id', db_type=db_type)
    existing = query(db, 'SELECT * FROM admin_access', db_type=db_type)
    upgrade_levels = upgrade_levels or any(row['admin_level'] == 0 for row in existing)
    if not users or (existing and not upgrade_levels):
        return
    old_profiles = {row['admin_id']: row for row in existing}
    root = (next((u for u in users if old_profiles.get(u['id'], {}).get('is_super_admin')), None)
            if existing else next((u for u in users if u['username'].strip().lower() == 'tjt740'), users[0]))
    if not root:
        return
    restricted_ids = {row['restricted_admin_id'] for row in query(
        db, 'SELECT restricted_admin_id FROM admin_mailbox_scopes', db_type=db_type)}
    parents = {row['parent_admin_id'] for row in existing}
    for user in users:
        is_root = user['id'] == root['id']
        builtin = is_root or user['username'].strip().lower() in BUILTIN_SECOND_LEVEL_USERNAMES
        previous = old_profiles.get(user['id'])
        if existing and not previous:
            continue
        level = 1 if is_root else 2 if builtin else 3
        if previous and not builtin and previous['parent_admin_id'] == root['id']:
            try:
                previous_grants = json.loads(previous['permissions'])
            except (TypeError, ValueError):
                previous_grants = []
            if user['id'] in parents or (isinstance(previous_grants, list) and 'admins' in previous_grants):
                level = 2
        grants = set(PERMISSIONS) if builtin else {'mailbox'}
        if not is_root and user['id'] in restricted_ids:
            grants.discard('mailbox_all')
        parent_id = None if is_root else root['id']
        if previous:
            query(db, 'UPDATE admin_access SET admin_level = ?, is_builtin_admin = ? WHERE admin_id = ?',
                  (level, int(builtin), user['id']), write=True, db_type=db_type)
            if builtin:
                query(db, 'UPDATE admin_access SET parent_admin_id = ?, permissions = ? WHERE admin_id = ?',
                      (parent_id, json.dumps(sorted(grants)), user['id']), write=True, db_type=db_type)
        else:
            query(db, '''INSERT INTO admin_access
                (admin_id, parent_admin_id, is_super_admin, permissions, master_key_hash, admin_level, is_builtin_admin)
                VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (user['id'], parent_id, int(is_root), json.dumps(sorted(grants)), '', level, int(builtin)),
                write=True, db_type=db_type)


def profiles(db):
    if 'admin_profiles' not in g:
        rows = query(db, '''SELECT u.id, u.username, u.created_at, a.parent_admin_id,
            a.is_super_admin, a.permissions, a.session_version, a.admin_level, a.is_builtin_admin
            FROM admin_users u JOIN admin_access a ON a.admin_id = u.id''')
        g.admin_profiles = {int(row['id']): row for row in rows}
    return g.admin_profiles


def invalidate():
    g.pop('admin_profiles', None)
    g.pop('admin_effective_permissions', None)


def current(db):
    try:
        return profiles(db).get(int(session.get('admin_id', 0))) if session.get('admin_logged_in') else None
    except (ValueError, TypeError):
        return None


def effective(db, admin_id):
    all_profiles = profiles(db)
    remaining = set(PERMISSIONS)
    visited = set()
    while admin_id in all_profiles and admin_id not in visited:
        visited.add(admin_id)
        profile = all_profiles[admin_id]
        level = profile['admin_level']
        if profile['is_super_admin']:
            return remaining if level == 1 and profile['parent_admin_id'] is None else set()
        parent = all_profiles.get(profile['parent_admin_id'])
        if level not in (2, 3) or not parent or parent['admin_level'] not in range(1, level):
            return set()
        try:
            grants = json.loads(profile['permissions'])
            if not isinstance(grants, list):
                return set()
            remaining.intersection_update(grants)
            remaining.intersection_update(level_permissions(level))
        except (ValueError, TypeError):
            return set()
        admin_id = profile['parent_admin_id']
    return set()


def has(db, permission, admin_id=None):
    if admin_id is None:
        actor = current(db)
        admin_id = actor['id'] if actor else None
    return permission in effective(db, admin_id)


def is_root(db, admin_id=None):
    actor = profiles(db).get(admin_id) if admin_id is not None else current(db)
    return bool(actor and actor['is_super_admin'] and actor['admin_level'] == 1)


def level_permissions(level):
    return set(PERMISSIONS) - (HIERARCHY_PERMISSIONS if level == 3 else set())


def creation_levels(db):
    actor = current(db)
    if not actor or not has(db, 'admins'):
        return []
    return [2, 3] if is_root(db) else [3] if actor['admin_level'] == 2 else []


def can_manage(db, target_id, permission='admins'):
    actor = current(db)
    target = profiles(db).get(target_id)
    return bool(actor and target and actor['id'] != target_id and not target['is_super_admin']
                and actor['admin_level'] < target['admin_level']
                and (not target['is_builtin_admin'] or permission == 'mailbox_access')
                and has(db, permission)
                and (actor['is_super_admin'] or target['parent_admin_id'] == actor['id']))


def account_list(db):
    actor = current(db)
    if not actor:
        return []
    result = []
    parents = {item['parent_admin_id'] for item in profiles(db).values()}
    for item in profiles(db).values():
        if not (actor['is_super_admin'] or item['id'] == actor['id'] or (
                (has(db, 'admins') or has(db, 'mailbox_access')) and item['parent_admin_id'] == actor['id'])):
            continue
        row = {k: item[k] for k in ('id', 'username', 'created_at', 'parent_admin_id', 'is_super_admin',
                                  'admin_level', 'is_builtin_admin')}
        parent = profiles(db).get(item['parent_admin_id'])
        row['parent_username'] = parent['username'] if parent else ''
        row['permissions'] = sorted(effective(db, item['id']))
        row['can_manage'] = can_manage(db, item['id'])
        row['has_children'] = item['id'] in parents
        result.append(row)
    return sorted(result, key=lambda row: row['id'])


def account_parent_options(db):
    """Only the root may create an account under another administrator."""
    actor = current(db)
    if not actor or not creation_levels(db):
        return []
    return [
        {'id': item['id'], 'username': item['username'], 'admin_level': item['admin_level']}
        for item in sorted(profiles(db).values(), key=lambda row: row['id'])
        if item['admin_level'] in (1, 2) and (actor['is_super_admin'] or item['id'] == actor['id'])
    ]


def account_ancestors(db):
    """Minimal context for the current branch; never disclose sibling accounts or grants."""
    actor = current(db)
    if not actor:
        return []
    all_profiles = profiles(db)
    seen = {actor['id']}
    result = []
    parent_id = actor['parent_admin_id']
    while parent_id in all_profiles and parent_id not in seen:
        seen.add(parent_id)
        parent = all_profiles[parent_id]
        result.append({key: parent[key] for key in ('id', 'username', 'parent_admin_id', 'admin_level')})
        parent_id = parent['parent_admin_id']
    return result


def account_parent_id(db, value, level):
    actor = current(db)
    if isinstance(value, str):
        value = value.strip()
    if value is None or value == '':
        value = actor['id']
    if isinstance(value, str) and value.isascii() and value.isdecimal():
        value = int(value)
    if type(value) is not int or value <= 0:
        raise ValueError('归属上级格式错误，请重新选择')
    if not actor['is_super_admin'] and value != actor['id']:
        raise PermissionError('只能将新管理员归属到自己名下')
    if value not in profiles(db):
        raise ValueError('归属上级不存在，请刷新后重新选择')
    if profiles(db)[value]['admin_level'] not in range(1, level):
        raise ValueError('归属上级的级别必须高于新管理员')
    return value


def validated_grants(db, value, level=None):
    if not isinstance(value, list) or any(not isinstance(p, str) or p not in PERMISSIONS for p in value):
        raise ValueError('权限列表包含未知权限或格式错误')
    grants = set(value)
    if level == 3 and grants.intersection(HIERARCHY_PERMISSIONS):
        raise ValueError('三级管理员不能创建或管理下级')
    actor = current(db)
    if not actor or not grants.issubset(effective(db, actor['id'])):
        raise PermissionError('不能授予自己没有的权限')
    return json.dumps(sorted(grants))


def update_permissions(db, data):
    target_id = int(data.get('admin_id') or 0)
    if not can_manage(db, target_id):
        raise PermissionError('只能管理直属下级，不能修改本人、上级或其他管理员')
    grants = validated_grants(db, data.get('permissions'), profiles(db)[target_id]['admin_level'])
    parent_id = profiles(db)[target_id]['parent_admin_id']
    if not set(json.loads(grants)).issubset(effective(db, parent_id)):
        raise PermissionError('请先为目标管理员的上级授予所需权限')
    query(db, 'UPDATE admin_access SET permissions = ? WHERE admin_id = ?', (grants, target_id), write=True)
    # Removing master-key permission destroys the old key, so later reauthorization
    # cannot revive a credential that was deliberately revoked.
    if 'master_key' not in json.loads(grants):
        descendants = {target_id}
        while True:
            expanded = descendants | {p['id'] for p in profiles(db).values() if p['parent_admin_id'] in descendants}
            if expanded == descendants:
                break
            descendants = expanded
        for admin_id in descendants:
            query(db, "UPDATE admin_access SET master_key_hash = '', master_key_digest = NULL WHERE admin_id = ?", (admin_id,), write=True)
    db.commit()
    invalidate()


def add_account(db, data, now):
    levels = creation_levels(db)
    if not levels:
        raise PermissionError('无权新增管理员')
    level = data.get('admin_level', 3)
    if isinstance(level, str) and level in ('2', '3'):
        level = int(level)
    if type(level) is not int or level not in (2, 3):
        raise ValueError('管理员级别必须为二级或三级')
    if level not in levels:
        raise PermissionError('只有一级管理员可以创建二级管理员')
    username = str(data.get('admin_username') or '').strip()
    password = str(data.get('admin_password') or '')
    if not username or len(username) > 255 or len(password) < 6:
        raise ValueError('用户名不能为空且不超过255字，密码长度至少6位')
    if username.lower() in RESERVED_USERNAMES:
        raise PermissionError('内置管理员用户名已保留')
    if query(db, 'SELECT id FROM admin_users WHERE LOWER(username) = LOWER(?)', (username,)):
        raise ValueError('用户名已存在')
    parent_id = account_parent_id(db, data.get('parent_admin_id'), level)
    grants = validated_grants(db, data.get('permissions', []), level)
    if not set(json.loads(grants)).issubset(effective(db, parent_id)):
        raise PermissionError('请先为目标管理员的上级授予所需权限')
    query(db, 'INSERT INTO admin_users (username, password, created_at) VALUES (?, ?, ?)',
          (username, generate_password_hash(password), now), write=True)
    admin_id = query(db, 'SELECT id FROM admin_users WHERE username = ?', (username,))[0]['id']
    query(db, '''INSERT INTO admin_access
        (admin_id, parent_admin_id, permissions, master_key_hash, admin_level) VALUES (?, ?, ?, ?, ?)''',
        (admin_id, parent_id, grants, '', level), write=True)
    db.commit()
    invalidate()
    return {'id': admin_id, 'username': username, 'admin_level': level, 'parent_admin_id': parent_id}


def change_password(db, data, *, own=False):
    actor = current(db)
    target_id = actor['id'] if own else int(data.get('admin_id') or 0)
    if not own and not can_manage(db, target_id):
        raise PermissionError('只能重置直属下级的密码')
    target = profiles(db)[target_id]
    username = str(data.get('admin_username') or target['username']).strip() if own else target['username']
    # Names are ownership labels in legacy tables. Keeping names stable prevents
    # mailbox ownership loss, impersonation and reserved-name privilege escalation.
    if username != target['username']:
        raise ValueError('管理员用户名用于数据归属，不允许修改；可以修改密码')
    password = str(data.get('admin_password') or '')
    if len(password) < 6:
        raise ValueError('密码长度至少6位')
    query(db, 'UPDATE admin_users SET password = ? WHERE id = ?',
          (generate_password_hash(password), target_id), write=True)
    query(db, "UPDATE admin_access SET session_version = session_version + 1, master_key_hash = '', master_key_digest = NULL WHERE admin_id = ?",
          (target_id,), write=True)
    db.commit()
    invalidate()
    if own:
        session.clear()


def delete_account(db, data):
    target_id = int(data.get('admin_id') or 0)
    if not can_manage(db, target_id):
        raise PermissionError('只能删除直属下级，最高管理员和当前账号不可删除')
    if any(p['parent_admin_id'] == target_id for p in profiles(db).values()):
        raise ValueError('该管理员仍有下级，请先处理下级账号，避免误删或遗失归属')
    # Keep legacy data ownership safe if this username is registered again:
    # transfer its mailboxes/groups to the parent before deleting the account.
    target = profiles(db)[target_id]
    parent = profiles(db).get(target['parent_admin_id'])
    for table in ('mail_accounts', 'mailbox_groups'):
        query(db, f'UPDATE {table} SET created_by_admin = ? WHERE LOWER(created_by_admin) = LOWER(?)',
              (parent['username'], target['username']), write=True)
    for table in ('admin_mailbox_permissions', 'admin_mailbox_group_permissions'):
        query(db, f'DELETE FROM {table} WHERE admin_id = ? OR granted_by_admin_id = ?', (target_id, target_id), write=True)
    query(db, 'DELETE FROM admin_mailbox_scopes WHERE restricted_admin_id = ? OR manager_admin_id = ?',
          (target_id, target_id), write=True)
    query(db, 'DELETE FROM admin_mailbox_scope_managers WHERE manager_admin_id = ?', (target_id,), write=True)
    query(db, 'DELETE FROM admin_access WHERE admin_id = ?', (target_id,), write=True)
    query(db, 'DELETE FROM admin_users WHERE id = ?', (target_id,), write=True)
    db.commit()
    invalidate()
