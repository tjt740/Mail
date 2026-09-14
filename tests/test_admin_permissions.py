import json
import os
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app as app_module
from werkzeug.security import generate_password_hash


class AdminPermissionsTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmp.name, 'permissions.sqlite')
        self.previous = {key: app_module.app.config.get(key) for key in ('DATABASE', 'DATABASE_TYPE', 'TESTING')}
        app_module.app.config.update(DATABASE=self.path, DATABASE_TYPE='sqlite', TESTING=True)
        app_module.init_db()
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE admin_users SET username = ?, password = ? WHERE id = 1', ('tjt740', generate_password_hash('root-password')))
        self.root = app_module.app.test_client()
        self.login(self.root, 1)
        self.parent_id = self.add(self.root, 'parent', ['mailbox', 'admins', 'mailbox_access', 'master_key'], level=2)
        self.peer_id = self.add(self.root, 'peer', ['mailbox', 'admins', 'mailbox_access'], level=2)
        self.parent = app_module.app.test_client()
        self.login(self.parent, self.parent_id)
        self.child_id = self.add(self.parent, 'child', ['mailbox', 'master_key'])
        self.child = app_module.app.test_client()
        self.login(self.child, self.child_id)
        with sqlite3.connect(self.path) as db:
            for index, owner in enumerate(('tjt740', 'parent', 'peer', 'child'), 1):
                db.execute('''INSERT INTO mail_accounts (id, email, username, password, server, port, protocol, created_by_admin)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                           (index, owner + '@example.com', owner, 'test', 'imap.example.com', 993, 'imap', owner))

    def tearDown(self):
        app_module.app.config.update(self.previous)
        self.tmp.cleanup()

    def login(self, client, admin_id):
        with sqlite3.connect(self.path) as db:
            username, version = db.execute('''SELECT u.username, a.session_version FROM admin_users u
                JOIN admin_access a ON a.admin_id = u.id WHERE u.id = ?''', (admin_id,)).fetchone()
        with client.session_transaction() as session:
            session['admin_logged_in'] = True
            session['admin_id'] = admin_id
            session['admin_username'] = username
            session['admin_session_version'] = version

    def add(self, client, username, permissions=None, level=None):
        data = {'action': 'add_admin', 'admin_username': username, 'admin_password': 'test-password'}
        if permissions is not None:
            data['permissions'] = permissions
        if level is not None:
            data['admin_level'] = level
        response = client.post('/admin/api/system-config', json=data)
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()['data']['id']

    def grant(self, client, target_id, permissions):
        return client.post('/admin/api/system-config', json={
            'action': 'update_admin_permissions', 'admin_id': target_id, 'permissions': permissions,
        })

    def key(self, client, value):
        return client.post('/admin/api/system-config', json={
            'action': 'update_admin_master_key', 'admin_master_key': value, 'confirm_master_key': value,
        })

    def test_owner_assignment_rejects_other_branches(self):
        response = self.parent.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'newchild', 'admin_password': 'password123',
            'parent_admin_id': self.peer_id, 'is_super_admin': True,
        })
        self.assertEqual(response.status_code, 403)
        with sqlite3.connect(self.path) as db:
            self.assertIsNone(db.execute('SELECT id FROM admin_users WHERE username = ?', ('newchild',)).fetchone())

    def test_hierarchy_ancestors_only_expose_minimal_current_branch_context(self):
        root_data = self.root.get('/admin/api/system-config').get_json()['data']
        self.assertEqual(root_data['admin_ancestors'], [])
        for client, expected in ((self.parent, {1}), (self.child, {1, self.parent_id})):
            data = client.get('/admin/api/system-config').get_json()['data']
            self.assertEqual({node['id'] for node in data['admin_ancestors']}, expected)
            for node in data['admin_ancestors']:
                self.assertEqual(set(node), {'id', 'username', 'admin_level', 'parent_admin_id'})
            self.assertNotIn(self.peer_id, {node['id'] for node in data['admin_users'] + data['admin_ancestors']})

    def test_explicit_own_parent_does_not_grant_super_admin(self):
        response = self.parent.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'newchild', 'admin_password': 'password123',
            'parent_admin_id': self.parent_id, 'is_super_admin': True,
        })
        self.assertEqual(response.status_code, 200)
        with sqlite3.connect(self.path) as db:
            row = db.execute('SELECT parent_admin_id, is_super_admin, permissions FROM admin_access WHERE admin_id = ?',
                             (response.get_json()['data']['id'],)).fetchone()
        self.assertEqual(row, (self.parent_id, 0, '[]'))

    def test_root_can_choose_a_parent_and_the_parent_can_manage_the_new_account(self):
        response = self.root.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'assigned', 'admin_password': 'password123',
            'parent_admin_id': str(self.parent_id), 'permissions': ['mailbox'],
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        assigned_id = response.get_json()['data']['id']
        for client in (self.root, self.parent):
            rows = client.get('/admin/api/system-config').get_json()['data']['admin_users']
            assigned = next(row for row in rows if row['id'] == assigned_id)
            self.assertEqual(assigned['parent_admin_id'], self.parent_id)
            self.assertEqual(assigned['parent_username'], 'parent')
            self.assertTrue(assigned['can_manage'])
        self.assertEqual(self.grant(self.parent, assigned_id, ['mailbox', 'master_key']).status_code, 200)

    def test_blank_parent_defaults_to_creator(self):
        for client, actor_id in ((self.root, 1), (self.parent, self.parent_id)):
            for index, value in enumerate((None, '', '  ')):
                with self.subTest(actor_id=actor_id, value=value):
                    response = client.post('/admin/api/system-config', json={
                        'action': 'add_admin', 'admin_username': f'default-{actor_id}-{index}',
                        'admin_password': 'password123', 'parent_admin_id': value,
                    })
                    self.assertEqual(response.status_code, 200, response.get_json())
                    with sqlite3.connect(self.path) as db:
                        row = db.execute('SELECT parent_admin_id, permissions FROM admin_access WHERE admin_id = ?',
                                         (response.get_json()['data']['id'],)).fetchone()
                    self.assertEqual(row, (actor_id, '[]'))

    def test_parent_options_follow_creation_permissions(self):
        for client, expected in (
            (self.root, {1, self.parent_id, self.peer_id}),
            (self.parent, {self.parent_id}), (self.child, set()),
        ):
            options = client.get('/admin/api/system-config').get_json()['data']['admin_parent_options']
            self.assertEqual({option['id'] for option in options}, expected)
            self.assertTrue(all(set(option) == {'id', 'username', 'admin_level'} for option in options))

    def test_root_can_create_both_levels_and_assign_third_level_to_either_parent_level(self):
        for level, parent_id in ((2, None), (3, None), (3, self.parent_id)):
            with self.subTest(level=level, parent=parent_id):
                result = self.root.post('/admin/api/system-config', json={
                    'action': 'add_admin', 'admin_username': f'level-{level}-{parent_id}',
                    'admin_password': 'password123', 'admin_level': level, 'parent_admin_id': parent_id,
                    'is_super_admin': True, 'is_builtin_admin': True,
                })
                self.assertEqual(result.status_code, 200, result.get_json())
                account = result.get_json()['data']
                self.assertEqual(account['admin_level'], level)
                self.assertEqual(account['parent_admin_id'], parent_id or 1)
                with sqlite3.connect(self.path) as db:
                    self.assertEqual(db.execute(
                        'SELECT admin_level, is_super_admin, is_builtin_admin, permissions FROM admin_access WHERE admin_id=?',
                        (account['id'],)).fetchone(), (level, 0, 0, '[]'))

    def test_second_level_cannot_create_second_level_or_assign_a_different_parent(self):
        for data in ({'admin_level': 2}, {'admin_level': 3, 'parent_admin_id': self.peer_id}):
            result = self.parent.post('/admin/api/system-config', json={
                'action': 'add_admin', 'admin_username': 'forged-level', 'admin_password': 'password123', **data,
            })
            self.assertEqual(result.status_code, 403)
        self.assertEqual(self.parent.get('/admin/api/system-config').get_json()['data']['creatable_admin_levels'], [3])
        self.assertEqual(self.root.get('/admin/api/system-config').get_json()['data']['creatable_admin_levels'], [2, 3])

    def test_third_level_cannot_create_or_manage_further_accounts_even_with_forged_grants(self):
        self.assertEqual(self.grant(self.parent, self.child_id, ['mailbox', 'admins']).status_code, 400)
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE admin_access SET permissions=? WHERE admin_id=?',
                       (json.dumps(list(app_module.security.PERMISSIONS)), self.child_id))
        for level in (2, 3, 4):
            result = self.child.post('/admin/api/system-config', json={
                'action': 'add_admin', 'admin_username': 'level-four', 'admin_password': 'password123', 'admin_level': level,
            })
            self.assertEqual(result.status_code, 403)
        config = self.child.get('/admin/api/system-config').get_json()['data']
        self.assertEqual(config['creatable_admin_levels'], [])
        self.assertNotIn('admins', config['permissions'])
        self.assertNotIn('mailbox_access', config['permissions'])
        with sqlite3.connect(self.path) as db:
            self.assertIsNone(db.execute("SELECT id FROM admin_users WHERE username='level-four'").fetchone())

    def test_invalid_level_and_same_or_lower_parent_are_rejected_without_creating_account(self):
        for level in (None, 0, 1, 4, True, 2.0, [], {}, 'third'):
            result = self.root.post('/admin/api/system-config', json={
                'action': 'add_admin', 'admin_username': 'invalid-level', 'admin_password': 'password123', 'admin_level': level,
            })
            self.assertEqual(result.status_code, 400, result.get_json())
        for level, parent_id in ((2, self.parent_id), (2, self.child_id), (3, self.child_id)):
            result = self.root.post('/admin/api/system-config', json={
                'action': 'add_admin', 'admin_username': 'invalid-level', 'admin_password': 'password123',
                'admin_level': level, 'parent_admin_id': parent_id,
            })
            self.assertEqual(result.status_code, 400, result.get_json())
        with sqlite3.connect(self.path) as db:
            self.assertIsNone(db.execute("SELECT id FROM admin_users WHERE username='invalid-level'").fetchone())

    def test_invalid_or_missing_parent_does_not_create_an_account(self):
        for value in (0, -1, 'bogus', '1.5', True, False, 1.5, [], {}, 99999):
            with self.subTest(value=value):
                response = self.root.post('/admin/api/system-config', json={
                    'action': 'add_admin', 'admin_username': 'invalid-parent', 'admin_password': 'password123',
                    'parent_admin_id': value,
                })
                self.assertEqual(response.status_code, 400, response.get_json())
                with sqlite3.connect(self.path) as db:
                    self.assertIsNone(db.execute('SELECT id FROM admin_users WHERE username = ?', ('invalid-parent',)).fetchone())

    def test_selected_parent_limits_initial_feature_grants(self):
        response = self.root.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'too-powerful', 'admin_password': 'password123',
            'parent_admin_id': self.parent_id, 'permissions': ['settings'],
        })
        self.assertEqual(response.status_code, 403)
        with sqlite3.connect(self.path) as db:
            self.assertIsNone(db.execute('SELECT id FROM admin_users WHERE username = ?', ('too-powerful',)).fetchone())

    def test_account_lists_are_isolated_and_root_sees_everyone(self):
        self.assertEqual({p['id'] for p in self.root.get('/admin/api/system-config').get_json()['data']['admin_users']},
                         {1, self.parent_id, self.peer_id, self.child_id})
        rows = self.parent.get('/admin/api/system-config').get_json()['data']['admin_users']
        self.assertEqual({p['id'] for p in rows}, {self.parent_id, self.child_id})
        self.assertTrue(next(p for p in rows if p['id'] == self.child_id)['can_manage'])
        self.assertEqual(len(self.child.get('/admin/api/system-config').get_json()['data']['admin_users']), 1)

    def test_cross_branch_actions_are_denied_even_when_actor_can_manage_admins(self):
        for target_id in (1, self.peer_id, self.parent_id):
            for action in ('delete_admin', 'reset_admin_password', 'update_admin_permissions'):
                response = self.parent.post('/admin/api/system-config', json={
                    'action': action, 'admin_id': target_id, 'admin_password': 'new-password', 'permissions': [],
                })
                self.assertEqual(response.status_code, 403, (target_id, action))

    def test_cannot_grant_permissions_above_parent_or_unknown_permissions(self):
        self.assertEqual(self.grant(self.parent, self.child_id, ['mailbox', 'settings']).status_code, 403)
        self.assertEqual(self.grant(self.root, self.child_id, ['not-a-permission']).status_code, 400)
        self.assertEqual(self.grant(self.root, 1, []).status_code, 403)
        self.assertEqual(self.grant(self.root, self.child_id, 'mailbox').status_code, 400)
        self.assertEqual(self.grant(self.root, self.child_id, ['settings']).status_code, 403)

    def test_parent_revocation_immediately_limits_existing_child_session(self):
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 200)
        self.assertEqual(self.grant(self.root, self.parent_id, ['admins']).status_code, 200)
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 403)
        self.assertEqual(self.child.get('/legacy/admin/mailbox').status_code, 403)
        data = self.child.get('/admin/api/system-config').get_json()['data']
        self.assertNotIn('mailbox', data['permissions'])

    def test_core_endpoints_and_legacy_pages_require_explicit_permissions(self):
        paths = ('/admin/home', '/legacy/admin/home', '/admin/kami', '/legacy/admin/kami',
                 '/admin/daili', '/admin/kamirizhi', '/admin/shoujian',
                 '/admin/api/cards', '/admin/api/cards/stats', '/admin/api/cards/1/available-emails',
                 '/admin/api/cards/generate-api/test', '/admin/api/card-logs',
                 '/admin/api/recycle-bin', '/admin/api/poller/config', '/admin/api/proxy-config',
                 '/admin/api/proxies/http', '/admin/api/mail-logs', '/admin/api/mail-logs/1')
        for path in paths:
            self.assertEqual(self.child.get(path).status_code, 403, path)
        for path, method in (('/admin/api/cards', 'post'), ('/admin/api/cards', 'delete'),
                             ('/admin/api/recycle-bin/restore', 'post'), ('/admin/api/recycle-bin/clear', 'delete'),
                             ('/admin/api/recycle-bin/permanent-delete', 'delete'),
                             ('/admin/api/process-expired-cards', 'post'), ('/admin/api/servers', 'post')):
            self.assertEqual(getattr(self.child, method)(path, json={}).status_code, 403, path)
        for action in ('update_system_title', 'update_page_titles'):
            self.assertEqual(self.child.post('/admin/api/system-config', json={'action': action}).status_code, 403)

    def test_granting_core_permissions_enables_the_corresponding_page_and_api(self):
        self.assertEqual(self.grant(self.root, self.parent_id, ['home', 'cards', 'settings']).status_code, 200)
        for path in ('/admin/home', '/legacy/admin/home', '/admin/kami', '/legacy/admin/kami',
                     '/admin/api/cards', '/admin/api/cards/stats', '/admin/api/poller/config'):
            self.assertEqual(self.parent.get(path).status_code, 200, path)

    def test_empty_permissions_can_login_and_reach_account_settings(self):
        empty_id = self.add(self.parent, 'empty')
        with app_module.app.test_client() as client:
            response = client.post('/admin/login', data={'username': 'empty', 'password': 'test-password'})
            self.assertEqual(response.status_code, 302)
            self.assertEqual(response.location, '/admin/system')
            self.assertEqual(client.get('/api/check_login').get_json()['logged_in'], True)
            self.assertEqual(client.get('/admin/system').status_code, 200)
            html = client.get('/legacy/admin/system').get_data(as_text=True)
            self.assertNotIn('href="#sec-admins"', html)
            self.assertNotIn('href="#sec-masterkey"', html)
        self.assertGreater(empty_id, 0)

    def test_delete_parent_with_children_is_rejected_without_partial_deletion(self):
        response = self.root.post('/admin/api/system-config', json={'action': 'delete_admin', 'admin_id': self.parent_id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.parent.get('/admin/api/mailbox').status_code, 200)
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 200)

    def test_deletion_invalidates_sessions_and_transfers_mailbox_ownership(self):
        response = self.parent.post('/admin/api/system-config', json={'action': 'delete_admin', 'admin_id': self.child_id})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 401)
        self.assertFalse(self.child.get('/api/check_login').get_json()['logged_in'])
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT created_by_admin FROM mail_accounts WHERE id=4').fetchone()[0], 'parent')
            self.assertIsNone(db.execute('SELECT admin_id FROM admin_access WHERE admin_id=?', (self.child_id,)).fetchone())

    def test_password_reset_invalidates_old_session_and_personal_key(self):
        self.assertEqual(self.key(self.child, 'child-secret-123').status_code, 200)
        response = self.parent.post('/admin/api/system-config', json={
            'action': 'reset_admin_password', 'admin_id': self.child_id, 'admin_password': 'replacement-password',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 401)
        anonymous = app_module.app.test_client()
        self.assertEqual(anonymous.post('/api/get_mail', json={
            'email': 'child@example.com', 'master_key': 'child-secret-123',
        }).status_code, 403)

    def test_names_cannot_be_changed_to_claim_ownership_or_root(self):
        for name in ('tjt740', 'other-name'):
            response = self.child.post('/admin/api/system-config', json={
                'action': 'update_admin', 'admin_username': name, 'admin_password': 'new-password',
            })
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.root.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'TJT740', 'admin_password': 'new-password',
        }).status_code, 403)

    def test_personal_key_cannot_read_other_mailboxes_or_modify_global_key(self):
        self.assertEqual(self.key(self.root, 'global-secret-123').status_code, 200)
        self.assertEqual(self.key(self.child, 'child-secret-123').status_code, 200)
        with sqlite3.connect(self.path) as db:
            root_hash = db.execute("SELECT config_value FROM system_config WHERE config_key='admin_master_key'").fetchone()[0]
            child_hash = db.execute('SELECT master_key_hash FROM admin_access WHERE admin_id=?', (self.child_id,)).fetchone()[0]
        self.assertNotEqual(root_hash, child_hash)
        self.assertNotEqual(child_hash, 'child-secret-123')
        anonymous = app_module.app.test_client()
        with patch.object(app_module.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout='', stderr='probe')) as run:
            denied = anonymous.post('/api/get_mail', json={'email': 'peer@example.com', 'card_key': 'child-secret-123'})
            self.assertEqual(denied.status_code, 404)
            run.assert_not_called()
            allowed = anonymous.post('/api/get_mail', json={'email': 'child@example.com', 'card_key': 'child-secret-123'})
            self.assertIn('probe', allowed.get_json()['message'])
            run.assert_called_once()
        self.assertTrue(anonymous.post('/api/card_info', json={'card_key': 'global-secret-123'}).get_json()['success'])

    def test_revoked_ancestor_key_permission_destroys_descendant_key(self):
        self.assertEqual(self.key(self.child, 'child-secret-123').status_code, 200)
        self.assertEqual(self.grant(self.root, self.parent_id, ['mailbox', 'admins']).status_code, 200)
        self.assertEqual(self.grant(self.root, self.parent_id, ['mailbox', 'admins', 'master_key']).status_code, 200)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT master_key_hash FROM admin_access WHERE admin_id=?', (self.child_id,)).fetchone()[0], '')
        anonymous = app_module.app.test_client()
        with patch.object(app_module.subprocess, 'run') as run:
            self.assertEqual(anonymous.post('/api/get_mail', json={
                'email': 'child@example.com', 'master_key': 'child-secret-123',
            }).status_code, 403)
            run.assert_not_called()

    def test_scope_manager_cannot_grant_unowned_mailboxes_or_disable_scope(self):
        for values in ({'mailbox_ids': [3]}, {'restricted_enabled': False}):
            response = self.parent.post('/admin/api/mailbox-access', json={'target_admin_id': self.child_id, **values})
            self.assertEqual(response.status_code, 403)
        response = self.parent.post('/admin/api/mailbox-access', json={'target_admin_id': self.child_id, 'mailbox_ids': [2]})
        self.assertEqual(response.status_code, 200)
        emails = {row['email'] for row in self.child.get('/admin/api/mailbox').get_json()['data']}
        self.assertEqual(emails, {'child@example.com', 'parent@example.com'})

    def test_mailbox_grants_stop_working_when_parent_loses_resource_access(self):
        self.assertEqual(self.root.post('/admin/api/mailbox-access', json={
            'target_admin_id': self.parent_id, 'mailbox_ids': [1],
        }).status_code, 200)
        self.assertEqual(self.parent.post('/admin/api/mailbox-access', json={
            'target_admin_id': self.child_id, 'mailbox_ids': [1],
        }).status_code, 200)
        self.assertEqual(self.child.get('/admin/api/mailbox?id=1').status_code, 200)
        self.assertEqual(self.root.post('/admin/api/mailbox-access', json={
            'target_admin_id': self.parent_id, 'mailbox_ids': [],
        }).status_code, 200)
        self.assertEqual(self.child.get('/admin/api/mailbox?id=1').status_code, 404)

    def test_migration_preserves_existing_authority_and_grants_on_restart(self):
        with sqlite3.connect(self.path) as db:
            before = db.execute('SELECT * FROM admin_access ORDER BY admin_id').fetchall()
            app_module.security.migrate(db, 'sqlite')
            app_module.security.migrate(db, 'sqlite')
            self.assertEqual(db.execute('SELECT * FROM admin_access ORDER BY admin_id').fetchall(), before)

    def test_level_upgrade_restores_builtin_admins_once_and_preserves_children_and_mailbox_grants(self):
        with sqlite3.connect(self.path) as db:
            for admin_id, name in ((5, 'lhm'), (6, 'pink')):
                db.execute('INSERT INTO admin_users (id, username, password) VALUES (?, ?, ?)', (admin_id, name, 'test'))
                db.execute('''INSERT INTO admin_access
                    (admin_id, parent_admin_id, permissions, master_key_hash, session_version)
                    VALUES (?, 1, ?, ?, 7)''', (admin_id, '["mailbox"]', 'preserved-key-hash'))
            db.execute('INSERT INTO admin_mailbox_scopes (restricted_admin_id, manager_admin_id) VALUES (5, 1)')
            db.execute('INSERT INTO admin_mailbox_permissions (admin_id, mailbox_id, granted_by_admin_id) VALUES (5, 2, 1)')
            db.execute('ALTER TABLE admin_access DROP COLUMN admin_level')
            db.execute('ALTER TABLE admin_access DROP COLUMN is_builtin_admin')
            children_before = db.execute('SELECT admin_id, parent_admin_id, permissions FROM admin_access WHERE admin_id IN (2,3,4)').fetchall()
            scopes_before = db.execute('SELECT * FROM admin_mailbox_scopes').fetchall()
            grants_before = db.execute('SELECT * FROM admin_mailbox_permissions').fetchall()
            app_module.security.migrate(db, 'sqlite')
            for admin_id in (5, 6):
                level, builtin, parent, grants, version, key_hash = db.execute('''SELECT admin_level, is_builtin_admin,
                    parent_admin_id, permissions, session_version, master_key_hash FROM admin_access WHERE admin_id=?''', (admin_id,)).fetchone()
                self.assertEqual((level, builtin, parent, version, key_hash), (2, 1, 1, 7, 'preserved-key-hash'))
                self.assertEqual(set(json.loads(grants)), set(app_module.security.PERMISSIONS) - ({'mailbox_all'} if admin_id == 5 else set()))
            self.assertEqual(db.execute('SELECT admin_id, parent_admin_id, permissions FROM admin_access WHERE admin_id IN (2,3,4)').fetchall(), children_before)
            self.assertEqual(db.execute('SELECT admin_level FROM admin_access WHERE admin_id=2').fetchone()[0], 2)
            self.assertEqual(db.execute('SELECT admin_level FROM admin_access WHERE admin_id=4').fetchone()[0], 3)
            self.assertEqual(db.execute('SELECT * FROM admin_mailbox_scopes').fetchall(), scopes_before)
            self.assertEqual(db.execute('SELECT * FROM admin_mailbox_permissions').fetchall(), grants_before)
            before = db.execute('SELECT * FROM admin_access ORDER BY admin_id').fetchall()
            db.execute("UPDATE admin_users SET username='renamed-lhm' WHERE id=5")
            db.execute("UPDATE admin_users SET username='lhm' WHERE id=2")
            app_module.security.migrate(db, 'sqlite')
            self.assertEqual(db.execute('SELECT * FROM admin_access ORDER BY admin_id').fetchall(), before)
        for admin_id in (5, 6):
            client = app_module.app.test_client()
            self.login(client, admin_id)
            config = client.get('/admin/api/system-config').get_json()['data']
            self.assertEqual(config['creatable_admin_levels'], [3])
            self.assertTrue({'home', 'cards', 'proxies', 'settings', 'admins'}.issubset(config['permissions']))
            created_id = self.add(client, f'builtin-child-{admin_id}')
            with sqlite3.connect(self.path) as db:
                self.assertEqual(db.execute('SELECT admin_level, parent_admin_id, permissions FROM admin_access WHERE admin_id=?',
                                            (created_id,)).fetchone(), (3, admin_id, '[]'))
            self.assertEqual(self.grant(self.root, admin_id, []).status_code, 403)

    def test_cycles_or_missing_profiles_fail_closed(self):
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE admin_access SET parent_admin_id=? WHERE admin_id=?', (self.child_id, self.parent_id))
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 403)
        with sqlite3.connect(self.path) as db:
            db.execute('DELETE FROM admin_access WHERE admin_id=?', (self.child_id,))
        self.assertEqual(self.child.get('/admin/api/mailbox').status_code, 401)

    def test_public_card_bindings_remain_available_without_admin_session(self):
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO cards (id, card_key, usage_limit, bound_email_id) VALUES (1, 'public-card', 10, 3)")
            db.execute('INSERT INTO card_email_bindings (card_id, mailbox_id) VALUES (1, 3)')
        anonymous = app_module.app.test_client()
        response = anonymous.post('/api/card_info', json={'card_key': 'public-card'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        self.assertIn('peer@example.com', response.get_data(as_text=True))
        page = anonymous.get('/api/mail/public-card')
        self.assertEqual(page.status_code, 200)
        self.assertIn('peer@example.com', page.get_data(as_text=True))
        self.assertEqual(anonymous.get('/admin/api/cards/generate-api/public-card').status_code, 401)

    def test_bad_scope_input_is_rejected_without_erasing_saved_grants(self):
        self.assertEqual(self.parent.post('/admin/api/mailbox-access', json={
            'target_admin_id': self.child_id, 'mailbox_ids': [2],
        }).status_code, 200)
        for value in ('2', [-1], ['invalid'], [9999]):
            response = self.parent.post('/admin/api/mailbox-access', json={
                'target_admin_id': self.child_id, 'mailbox_ids': value,
            })
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.parent.post('/admin/api/mailbox-access', json=[]).status_code, 400)
        self.assertEqual(self.parent.post('/admin/api/system-config', json=[]).status_code, 400)
        self.assertEqual(self.child.get('/admin/api/mailbox?id=2').status_code, 200)

    def test_keys_cannot_collide_across_accounts_even_when_owner_loses_mailbox_permission(self):
        self.assertEqual(self.key(self.child, 'unique-secret-123').status_code, 200)
        self.assertEqual(self.grant(self.root, self.parent_id, ['admins', 'master_key']).status_code, 200)
        self.assertEqual(self.key(self.root, 'unique-secret-123').status_code, 400)
        self.assertEqual(self.key(self.parent, 'unique-secret-123').status_code, 400)

    def test_log_read_permission_does_not_allow_global_polling(self):
        self.assertEqual(self.grant(self.root, self.parent_id, ['mail_logs']).status_code, 200)
        with patch.object(app_module, 'trigger_mail_poll_once') as poll:
            self.assertEqual(self.parent.post('/admin/api/mail-logs', json={'action': 'poll_now'}).status_code, 403)
            poll.assert_not_called()
        payload = self.parent.get('/admin/api/mail-logs').get_json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['poller'], {})
        self.assertEqual(payload['admin_options'], ['parent'])

    def test_password_whitespace_is_preserved_and_legacy_sessions_expire(self):
        account_id = self.add(self.parent, 'spaces')
        response = self.parent.post('/admin/api/system-config', json={
            'action': 'reset_admin_password', 'admin_id': account_id, 'admin_password': ' password ',
        })
        self.assertEqual(response.status_code, 200)
        with app_module.app.test_client() as client:
            self.assertEqual(client.post('/admin/login', data={'username': 'spaces', 'password': ' password '}).status_code, 302)
            self.assertTrue(client.get('/api/check_login').get_json()['logged_in'])
            with client.session_transaction() as session:
                session.pop('admin_session_version')
            self.assertEqual(client.get('/admin/api/mailbox').status_code, 401)


if __name__ == '__main__':
    unittest.main()
