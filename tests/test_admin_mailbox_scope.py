import os
import sqlite3
import tempfile
import unittest

import app as app_module


class AdminMailboxScopeTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = os.path.join(self.temp_dir.name, 'scope.sqlite')
        self.original_config = {
            'DATABASE': app_module.app.config['DATABASE'],
            'DATABASE_TYPE': app_module.app.config['DATABASE_TYPE'],
            'TESTING': app_module.app.config.get('TESTING', False),
        }
        app_module.app.config.update(
            DATABASE=self.database_path,
            DATABASE_TYPE='sqlite',
            TESTING=True,
        )

        connection = sqlite3.connect(self.database_path)
        connection.executescript('''
            CREATE TABLE admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO admin_users (id, username, password) VALUES
                (1, 'tjt740', 'test'),
                (2, 'lhm', 'test'),
                (3, 'pink', 'test');

            CREATE TABLE system_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT NOT NULL UNIQUE,
                config_value TEXT NOT NULL
            );
            INSERT INTO system_config (config_key, config_value)
            VALUES ('system_title', '邮件查看系统');

            CREATE TABLE mail_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                server TEXT DEFAULT '',
                remarks TEXT DEFAULT '',
                created_by_admin TEXT DEFAULT '',
                status INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO mail_accounts (id, email, created_by_admin) VALUES
                (1, 'tjt@example.com', 'tjt740'),
                (2, 'lhm@example.com', 'lhm'),
                (3, 'pink@example.com', 'pink'),
                (4, 'legacy@example.com', '');

            CREATE TABLE mailbox_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent_id INTEGER,
                sort_order INTEGER DEFAULT 0,
                is_expanded INTEGER DEFAULT 1,
                mailbox_count INTEGER DEFAULT 0,
                created_by_admin TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO mailbox_groups (id, name, mailbox_count, created_by_admin) VALUES
                (1, 'TJT Group', 1, 'tjt740'),
                (2, 'LHM Group', 1, 'lhm'),
                (3, 'Pink Group', 1, 'pink'),
                (4, 'Legacy Group', 1, '');

            CREATE TABLE mailbox_group_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mailbox_id INTEGER NOT NULL,
                group_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(mailbox_id, group_id)
            );
            INSERT INTO mailbox_group_mappings (mailbox_id, group_id) VALUES
                (1, 1), (2, 2), (3, 3), (4, 4);

            CREATE TABLE admin_mailbox_scopes (
                restricted_admin_id INTEGER PRIMARY KEY,
                manager_admin_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO admin_mailbox_scopes (restricted_admin_id, manager_admin_id)
            VALUES (2, 1);

            CREATE TABLE admin_mailbox_scope_managers (
                manager_admin_id INTEGER PRIMARY KEY,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO admin_mailbox_scope_managers (manager_admin_id) VALUES (1);

            CREATE TABLE admin_mailbox_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                mailbox_id INTEGER NOT NULL,
                granted_by_admin_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(admin_id, mailbox_id)
            );

            CREATE TABLE admin_mailbox_group_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                group_id INTEGER NOT NULL,
                granted_by_admin_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(admin_id, group_id)
            );
        ''')
        connection.close()

    def tearDown(self):
        app_module.app.config.update(self.original_config)
        self.temp_dir.cleanup()

    def _login(self, client, admin_id, username):
        with client.session_transaction() as session:
            session['admin_logged_in'] = True
            session['admin_id'] = admin_id
            session['admin_username'] = username

    def _mailbox_emails(self, client):
        response = client.get('/admin/api/mailbox?per_page=100')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        return {mailbox['email'] for mailbox in payload['data']}

    def test_lhm_sees_only_own_mailbox_without_grants(self):
        with app_module.app.test_client() as client:
            self._login(client, 2, 'lhm')
            self.assertEqual(self._mailbox_emails(client), {'lhm@example.com'})

            hidden_detail = client.get('/admin/api/mailbox?id=1')
            self.assertEqual(hidden_detail.status_code, 404)

            hidden_edit = client.post('/admin/api/mailbox', json={
                'action': 'update_remarks',
                'id': 1,
                'remarks': 'should not update',
            })
            self.assertEqual(hidden_edit.status_code, 404)

    def test_tjt740_grant_adds_only_selected_mailbox(self):
        with app_module.app.test_client() as manager:
            self._login(manager, 1, 'tjt740')
            response = manager.post('/admin/api/mailbox-access', json={
                'target_admin_id': 2,
                'mailbox_ids': [1],
            })
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.get_json()['success'])

        with app_module.app.test_client() as restricted:
            self._login(restricted, 2, 'lhm')
            self.assertEqual(
                self._mailbox_emails(restricted),
                {'lhm@example.com', 'tjt@example.com'},
            )
            self.assertEqual(restricted.get('/admin/api/mailbox?id=3').status_code, 404)

    def test_groups_and_mappings_follow_visible_mailboxes(self):
        connection = sqlite3.connect(self.database_path)
        connection.execute('''
            INSERT INTO admin_mailbox_permissions
                (admin_id, mailbox_id, granted_by_admin_id)
            VALUES (2, 1, 1)
        ''')
        connection.commit()
        connection.close()

        with app_module.app.test_client() as client:
            self._login(client, 2, 'lhm')
            payload = client.get('/admin/api/mailbox-groups').get_json()
            self.assertTrue(payload['success'])
            self.assertEqual(
                {group['name'] for group in payload['groups']},
                {'TJT Group', 'LHM Group'},
            )
            self.assertEqual(
                {(mapping['mailbox_id'], mapping['group_id']) for mapping in payload['mappings']},
                {(1, 1), (2, 2)},
            )

            forbidden_update = client.post('/admin/api/mailbox-groups', json={
                'action': 'update',
                'id': 1,
                'name': 'Changed',
            })
            self.assertEqual(forbidden_update.status_code, 403)

    def test_only_tjt740_scope_manager_can_change_grants(self):
        with app_module.app.test_client() as restricted:
            self._login(restricted, 2, 'lhm')
            response = restricted.post('/admin/api/mailbox-access', json={
                'target_admin_id': 2,
                'mailbox_ids': [1, 3, 4],
            })
            self.assertEqual(response.status_code, 403)

            delete_manager = restricted.post('/admin/api/system-config', json={
                'action': 'delete_admin',
                'admin_id': 1,
            })
            self.assertEqual(delete_manager.status_code, 403)

            reset_manager = restricted.post('/admin/api/system-config', json={
                'action': 'reset_admin_password',
                'admin_id': 1,
                'admin_password': 'new-password',
            })
            self.assertEqual(reset_manager.status_code, 403)

        with app_module.app.test_client() as manager:
            self._login(manager, 1, 'tjt740')
            payload = manager.get('/admin/api/mailbox-access?target_admin_id=2').get_json()
            self.assertTrue(payload['success'])
            self.assertEqual(payload['data']['target']['username'], 'lhm')
            self.assertEqual(len(payload['data']['mailboxes']), 4)
            self.assertEqual(
                self._mailbox_emails(manager),
                {
                    'tjt@example.com',
                    'lhm@example.com',
                    'pink@example.com',
                    'legacy@example.com',
                },
            )

    def test_manager_can_restrict_any_admin_and_grant_a_dynamic_group(self):
        with app_module.app.test_client() as manager:
            self._login(manager, 1, 'tjt740')
            payload = manager.get('/admin/api/mailbox-access?target_admin_id=3').get_json()
            self.assertTrue(payload['success'])
            self.assertEqual(
                {target['username'] for target in payload['data']['targets']},
                {'lhm', 'pink'},
            )
            self.assertFalse(payload['data']['restricted_enabled'])

            response = manager.post('/admin/api/mailbox-access', json={
                'target_admin_id': 3,
                'restricted_enabled': True,
                'group_ids': [1],
                'mailbox_ids': [],
            })
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.get_json()['success'])

        with app_module.app.test_client() as restricted:
            self._login(restricted, 3, 'pink')
            self.assertEqual(
                self._mailbox_emails(restricted),
                {'pink@example.com', 'tjt@example.com'},
            )
            groups = restricted.get('/admin/api/mailbox-groups').get_json()['groups']
            self.assertEqual({group['name'] for group in groups}, {'Pink Group', 'TJT Group'})

        connection = sqlite3.connect(self.database_path)
        connection.execute('''
            INSERT INTO mail_accounts (id, email, created_by_admin)
            VALUES (5, 'new-in-tjt-group@example.com', 'lhm')
        ''')
        connection.execute('''
            INSERT INTO mailbox_group_mappings (mailbox_id, group_id) VALUES (5, 1)
        ''')
        connection.commit()
        connection.close()

        with app_module.app.test_client() as restricted:
            self._login(restricted, 3, 'pink')
            self.assertEqual(
                self._mailbox_emails(restricted),
                {
                    'pink@example.com',
                    'tjt@example.com',
                    'new-in-tjt-group@example.com',
                },
            )

        with app_module.app.test_client() as manager:
            self._login(manager, 1, 'tjt740')
            response = manager.post('/admin/api/mailbox-access', json={
                'target_admin_id': 3,
                'restricted_enabled': False,
                'group_ids': [1],
                'mailbox_ids': [1],
            })
            self.assertEqual(response.status_code, 200)

        with app_module.app.test_client() as unrestricted:
            self._login(unrestricted, 3, 'pink')
            self.assertEqual(
                self._mailbox_emails(unrestricted),
                {
                    'tjt@example.com',
                    'lhm@example.com',
                    'pink@example.com',
                    'legacy@example.com',
                    'new-in-tjt-group@example.com',
                },
            )

    def test_mailbox_access_ui_and_api_are_exclusive_to_tjt740(self):
        with app_module.app.test_client() as tjt:
            self._login(tjt, 1, 'tjt740')
            page = tjt.get('/legacy/admin/system?embedded=1')
            self.assertEqual(page.status_code, 200)
            self.assertIn('id="sec-mailbox-access"', page.get_data(as_text=True))
            self.assertEqual(tjt.get('/admin/api/mailbox-access').status_code, 200)

        for admin_id, username in ((2, 'lhm'), (3, 'pink')):
            with self.subTest(username=username), app_module.app.test_client() as other:
                self._login(other, admin_id, username)
                page = other.get('/legacy/admin/system?embedded=1')
                self.assertEqual(page.status_code, 200)
                page_html = page.get_data(as_text=True)
                self.assertNotIn('id="sec-mailbox-access"', page_html)
                self.assertNotIn('id="mailboxAccessNav"', page_html)
                self.assertEqual(other.get('/admin/api/mailbox-access').status_code, 403)


if __name__ == '__main__':
    unittest.main()
