import os
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from werkzeug.security import check_password_hash

import app as app_module


class AdminMasterKeyTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = os.path.join(self.temp_dir.name, 'test.sqlite')
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
            CREATE TABLE system_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT NOT NULL UNIQUE,
                config_value TEXT NOT NULL,
                config_type TEXT DEFAULT 'string',
                description TEXT DEFAULT '',
                is_system INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_key TEXT NOT NULL UNIQUE
            );
            CREATE TABLE admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO admin_users (username, password) VALUES ('admin', 'test-only');
            INSERT INTO system_config
                (config_key, config_value, config_type, description, is_system)
            VALUES ('admin_master_key', '', 'secret', '管理员万能秘钥', 0);
        ''')
        connection.close()

    def tearDown(self):
        app_module.app.config.update(self.original_config)
        self.temp_dir.cleanup()

    def _login(self, client):
        with client.session_transaction() as session:
            session['admin_logged_in'] = True
            session['admin_id'] = 1
            session['admin_username'] = 'admin'

    def test_update_persists_hash_and_reports_verified(self):
        master_key = 'master-key-123'
        with app_module.app.test_client() as client:
            self._login(client)
            response = client.post('/admin/api/system-config', json={
                'action': 'update_admin_master_key',
                'admin_master_key': master_key,
                'confirm_master_key': master_key,
            })

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertTrue(payload['data']['verified'])

        with app_module.app.test_client() as client:
            self._login(client)
            refreshed_payload = client.get('/admin/api/system-config').get_json()
        self.assertTrue(refreshed_payload['data']['admin_master_key_set'])

        connection = sqlite3.connect(self.database_path)
        stored_hash = connection.execute(
            "SELECT config_value FROM system_config WHERE config_key='admin_master_key'"
        ).fetchone()[0]
        connection.close()
        self.assertNotEqual(stored_hash, master_key)
        self.assertTrue(check_password_hash(stored_hash, master_key))

    def test_card_info_identifies_master_key(self):
        master_key = 'master-key-456'
        with app_module.app.test_client() as client:
            self._login(client)
            update_response = client.post('/admin/api/system-config', json={
                'action': 'update_admin_master_key',
                'admin_master_key': master_key,
                'confirm_master_key': master_key,
            })
            self.assertTrue(update_response.get_json()['success'])

            response = client.post('/api/card_info', json={'card_key': master_key})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['status'], 'master_key')
        self.assertEqual(payload['credential_type'], 'master_key')
        self.assertIsNone(payload['card_info'])

    def test_get_mail_accepts_master_key_in_legacy_card_key_field(self):
        master_key = 'master-key-789'
        with app_module.app.test_client() as client:
            self._login(client)
            update_response = client.post('/admin/api/system-config', json={
                'action': 'update_admin_master_key',
                'admin_master_key': master_key,
                'confirm_master_key': master_key,
            })
            self.assertTrue(update_response.get_json()['success'])

            failed_fetch = SimpleNamespace(returncode=1, stdout='', stderr='probe failure')
            with patch.object(app_module.subprocess, 'run', return_value=failed_fetch) as run:
                response = client.post('/api/get_mail', json={
                    'email': 'mailbox@example.com',
                    'card_key': master_key,
                })

        payload = response.get_json()
        self.assertFalse(payload['success'])
        self.assertIn('probe failure', payload['message'])
        run.assert_called_once()
        self.assertIn('--admin-access', run.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
